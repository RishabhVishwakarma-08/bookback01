import { Router } from 'express';
import mongoose from 'mongoose';
import { BookListing } from '../models/BookListing.js';
import { Review } from '../models/Review.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js';
import { toSafeUser } from './auth.js';
import { updateProfileSchema } from '../utils/validators.js';

const router = Router();

// Public-safe student profile (never exposes email, collegeId, or passwordHash)
router.get('/users/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }

    const user = await User.findById(id)
      .select('name branch year semester verified bio campusId createdAt')
      .populate('campusId', 'name location')
      .lean();

    if (!user) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }

    const [listings, reviews, completedCount] = await Promise.all([
      BookListing.find({ ownerId: id, status: { $in: ['available', 'reserved'] } })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      Review.find({ revieweeId: id })
        .populate('reviewerId', 'name branch year')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Transaction.countDocuments({
        $or: [{ ownerId: id }, { requesterId: id }],
        status: 'completed',
      }),
    ]);

    const avgRating =
      reviews.length > 0
        ? Number((reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1))
        : null;

    res.json({
      profile: {
        id: (user as any)._id.toString(),
        name: user.name,
        branch: user.branch,
        year: user.year,
        semester: user.semester,
        verified: user.verified,
        bio: user.bio || '',
        campusName: (user as any).campusId?.name || 'Campus Community',
        createdAt: user.createdAt,
        completedTransactions: completedCount,
        averageRating: avgRating,
        reviewCount: reviews.length,
      },
      listings: listings.map((b: any) => ({
        id: b._id.toString(),
        title: b.title,
        author: b.author,
        subject: b.subject,
        semester: b.semester,
        branch: b.branch,
        condition: b.condition,
        offerType: b.offerType,
        price: b.price,
        quantity: b.quantity ?? 1,
        availableQuantity: b.availableQuantity ?? 1,
        status: b.status,
        images: b.images || [],
        createdAt: b.createdAt,
      })),
      reviews: reviews.map((r: any) => ({
        id: r._id.toString(),
        rating: r.rating,
        comment: r.comment,
        reviewerName: r.reviewerId?.name || 'Student',
        reviewerBranch: r.reviewerId?.branch || '',
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /users/:id/profile error:', err);
    res.status(500).json({ error: 'Failed to load student profile.' });
  }
});

router.patch('/me/profile', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile data.' });
      return;
    }

    const updated = await User.findByIdAndUpdate(
      req.user!._id,
      { $set: parsed.data },
      { returnDocument: 'after', runValidators: true },
    );

    if (!updated) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    res.json({ user: toSafeUser(updated) });
  } catch (err) {
    console.error('PATCH /me/profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
