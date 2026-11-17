import path from 'node:path';
import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { uploadDir } from '../utils/uploadStorage.js';
import { BookListing } from '../models/BookListing.js';
import { BookRequest } from '../models/BookRequest.js';
import { Campus } from '../models/Campus.js';
import { Notification } from '../models/Notification.js';
import {
  authenticate,
  hasAdminPermission,
  optionalAuth,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import {
  checkAvailabilityMismatch,
  checkDuplicateListing,
  checkQuantityAnomaly,
  recordUnauthorizedModificationAttempt,
} from '../services/discrepancyDetector.js';
import { escapeRegex } from '../utils/security.js';
import { createBookSchema, updateBookSchema } from '../utils/validators.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    }
  },
});

export function formatBook(doc: any) {
  const owner = doc.ownerId && typeof doc.ownerId === 'object' ? doc.ownerId : null;
  const campus = doc.campusId && typeof doc.campusId === 'object' ? doc.campusId : null;
  const quantity = typeof doc.quantity === 'number' ? doc.quantity : 1;
  const availableQuantity =
    typeof doc.availableQuantity === 'number' ? doc.availableQuantity : doc.status === 'available' ? 1 : 0;

  return {
    id: doc._id.toString(),
    ownerId: owner ? owner._id.toString() : doc.ownerId?.toString(),
    owner: owner
      ? {
          id: owner._id.toString(),
          name: owner.name,
          branch: owner.branch,
          year: owner.year,
          semester: owner.semester,
          verified: owner.verified,
        }
      : undefined,
    campusId: campus ? campus._id.toString() : doc.campusId?.toString(),
    campusName: campus ? campus.name : undefined,
    title: doc.title,
    author: doc.author,
    subject: doc.subject,
    course: doc.course || '',
    isbn: doc.isbn || '',
    edition: doc.edition || '',
    branch: doc.branch,
    semester: doc.semester,
    condition: doc.condition,
    offerType: doc.offerType,
    price: doc.price,
    deposit: doc.deposit || 0,
    loanDurationDays: doc.loanDurationDays || 30,
    quantity,
    availableQuantity,
    viewsCount: doc.viewsCount || 0,
    requestCount: doc.requestCount || 0,
    description: doc.description,
    images: Array.isArray(doc.images) ? doc.images : [],
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

router.post('/upload', authenticate, upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided.' });
    return;
  }
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

router.get('/books', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const semester = req.query.semester ? Number(req.query.semester) : undefined;
    const branch = typeof req.query.branch === 'string' ? req.query.branch.trim() : '';
    const offerType = typeof req.query.offerType === 'string' ? req.query.offerType.trim() : '';
    const condition = typeof req.query.condition === 'string' ? req.query.condition.trim() : '';
    const statusParam = typeof req.query.status === 'string' ? req.query.status.trim() : 'available';
    const ownerId = typeof req.query.ownerId === 'string' ? req.query.ownerId.trim() : '';
    const maxPrice = req.query.maxPrice !== undefined && req.query.maxPrice !== '' ? Number(req.query.maxPrice) : undefined;
    const sortParam = typeof req.query.sort === 'string' ? req.query.sort : 'newest';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 24));

    const filter: Record<string, unknown> = {};

    if (statusParam && statusParam !== 'all') {
      filter.status = statusParam;
    } else if (!ownerId) {
      filter.status = { $ne: 'deactivated' };
    }

    if (ownerId) {
      if (!mongoose.isValidObjectId(ownerId)) {
        res.status(400).json({ error: 'Invalid owner ID.' });
        return;
      }
      filter.ownerId = new mongoose.Types.ObjectId(ownerId);
    }

    if (semester && Number.isInteger(semester) && semester >= 1 && semester <= 8) {
      filter.semester = semester;
    }
    if (branch && branch !== 'all') {
      filter.branch = branch;
    }
    if (offerType && offerType !== 'all') {
      filter.offerType = offerType;
    }
    if (condition && condition !== 'all') {
      filter.condition = condition;
    }
    if (maxPrice !== undefined && !Number.isNaN(maxPrice) && maxPrice >= 0) {
      filter.price = { $lte: maxPrice };
    }
    if (q) {
      const safePattern = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { title: safePattern },
        { author: safePattern },
        { subject: safePattern },
        { course: safePattern },
        { isbn: safePattern },
      ];
    }

    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
    if (sortParam === 'popular') sortObj = { requestCount: -1, viewsCount: -1, createdAt: -1 };
    if (sortParam === 'price_asc') sortObj = { price: 1, createdAt: -1 };
    if (sortParam === 'price_desc') sortObj = { price: -1, createdAt: -1 };
    if (sortParam === 'semester_asc') sortObj = { semester: 1, createdAt: -1 };

    const [docs, total] = await Promise.all([
      BookListing.find(filter)
        .populate('ownerId', 'name branch year semester verified')
        .populate('campusId', 'name')
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BookListing.countDocuments(filter),
    ]);

    res.json({
      books: docs.map(formatBook),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error('GET /books error:', err);
    res.status(500).json({ error: 'Failed to retrieve book listings.' });
  }
});

router.get('/books/:id', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Book listing not found.' });
      return;
    }

    const doc = await BookListing.findByIdAndUpdate(
      id,
      { $inc: { viewsCount: 1 } },
      { returnDocument: 'after' },
    )
      .populate('ownerId', 'name branch year semester verified bio createdAt')
      .populate('campusId', 'name location')
      .lean();

    if (!doc) {
      res.status(404).json({ error: 'Book listing not found.' });
      return;
    }

    let existingRequest = null;
    if (req.user) {
      const reqDoc = await BookRequest.findOne({
        listingId: (doc as any)._id,
        requesterId: req.user._id,
        status: { $in: ['pending', 'accepted'] },
      }).lean();
      if (reqDoc) {
        existingRequest = {
          id: (reqDoc as any)._id.toString(),
          status: reqDoc.status,
        };
      }
    }

    res.json({
      book: formatBook(doc),
      existingRequest,
    });
  } catch (err) {
    console.error('GET /books/:id error:', err);
    res.status(500).json({ error: 'Failed to load book details.' });
  }
});

router.post('/books', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createBookSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid book listing fields.',
        issues: parsed.error.issues,
      });
      return;
    }

    const data = parsed.data;
    const defaultCampus = req.user!.campusId || (await Campus.findOne())?._id;
    const qty = data.quantity || 1;

    const listing = await BookListing.create({
      ownerId: req.user!._id,
      campusId: defaultCampus,
      title: data.title,
      author: data.author,
      subject: data.subject,
      course: data.course,
      isbn: data.isbn,
      edition: data.edition,
      branch: data.branch,
      semester: data.semester,
      condition: data.condition,
      offerType: data.offerType,
      price: data.offerType === 'donate' || data.offerType === 'exchange' ? 0 : data.price,
      deposit: data.offerType === 'lend' ? data.deposit : 0,
      loanDurationDays: data.offerType === 'lend' ? data.loanDurationDays : 30,
      quantity: qty,
      availableQuantity: qty,
      description: data.description,
      images:
        data.images && data.images.length > 0
          ? data.images
          : ['/assets/images/book_cover_algorithms_1794567285119.jpg'],
      status: 'available',
    });

    await Promise.all([
      checkDuplicateListing(listing),
      checkQuantityAnomaly(listing, 0, qty, req.user!._id),
    ]);

    const populated = await BookListing.findById(listing._id)
      .populate('ownerId', 'name branch year semester verified')
      .populate('campusId', 'name')
      .lean();

    res.status(201).json({ book: formatBook(populated) });
  } catch (err) {
    console.error('POST /books error:', err);
    res.status(500).json({ error: 'Failed to create book listing.' });
  }
});

router.patch('/books/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Book listing not found.' });
      return;
    }

    const listing = await BookListing.findById(id);
    if (!listing) {
      res.status(404).json({ error: 'Book listing not found.' });
      return;
    }

    const isOwner = listing.ownerId.toString() === req.user!._id.toString();
    const canManageBooks = hasAdminPermission(req.user, 'manage_books');
    if (!isOwner && !canManageBooks) {
      await recordUnauthorizedModificationAttempt(
        req.user!,
        'BookListing',
        listing._id.toString(),
        'Attempted to modify another student book listing',
      );
      res.status(403).json({ error: 'Forbidden: Only the book owner or an authorized admin can update this listing.' });
      return;
    }

    const parsed = updateBookSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid update fields.' });
      return;
    }

    const prevStatus = listing.status;
    const prevQuantity = listing.quantity ?? 1;

    Object.assign(listing, parsed.data);
    if (parsed.data.quantity !== undefined && parsed.data.availableQuantity === undefined) {
      const diff = parsed.data.quantity - prevQuantity;
      listing.availableQuantity = Math.max(0, Math.min(parsed.data.quantity, (listing.availableQuantity ?? prevQuantity) + diff));
    }
    if (listing.availableQuantity > listing.quantity) {
      res.status(400).json({ error: 'Available quantity cannot exceed total quantity.' });
      return;
    }

    await listing.save();

    if (parsed.data.quantity !== undefined && parsed.data.quantity !== prevQuantity) {
      await checkQuantityAnomaly(listing, prevQuantity, parsed.data.quantity, req.user!._id);
    }
    await checkAvailabilityMismatch(listing);

    if (
      prevStatus === 'available' &&
      (listing.status === 'deactivated' || listing.status === 'completed')
    ) {
      const pendingRequests = await BookRequest.find({
        listingId: listing._id,
        status: 'pending',
      });
      if (pendingRequests.length > 0) {
        await Notification.insertMany(
          pendingRequests.map((r) => ({
            userId: r.requesterId,
            type: 'listing_unavailable',
            title: 'Listing no longer available',
            message: `The book "${listing.title}" is no longer available.`,
            relatedListingId: listing._id,
            relatedRequestId: r._id,
          })),
        );
      }
    }

    const populated = await BookListing.findById(listing._id)
      .populate('ownerId', 'name branch year semester verified')
      .populate('campusId', 'name')
      .lean();

    res.json({ book: formatBook(populated) });
  } catch (err) {
    console.error('PATCH /books/:id error:', err);
    res.status(500).json({ error: 'Failed to update listing.' });
  }
});

router.delete('/books/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Book listing not found.' });
      return;
    }

    const listing = await BookListing.findById(id);
    if (!listing) {
      res.status(404).json({ error: 'Book listing not found.' });
      return;
    }

    const isOwner = listing.ownerId.toString() === req.user!._id.toString();
    const canManageBooks = hasAdminPermission(req.user, 'manage_books');
    if (!isOwner && !canManageBooks) {
      await recordUnauthorizedModificationAttempt(
        req.user!,
        'BookListing',
        listing._id.toString(),
        'Attempted to deactivate another student book listing',
      );
      res.status(403).json({ error: 'Forbidden: Only the book owner or an authorized admin can remove this listing.' });
      return;
    }

    listing.status = 'deactivated';
    await listing.save();

    const pendingRequests = await BookRequest.find({
      listingId: listing._id,
      status: 'pending',
    });

    if (pendingRequests.length > 0) {
      await BookRequest.updateMany(
        { listingId: listing._id, status: 'pending' },
        { $set: { status: 'cancelled' } },
      );
      await Notification.insertMany(
        pendingRequests.map((r) => ({
          userId: r.requesterId,
          type: 'listing_unavailable',
          title: 'Book listing removed',
          message: `"${listing.title}" was deactivated by the owner.`,
          relatedListingId: listing._id,
          relatedRequestId: r._id,
        })),
      );
    }

    res.json({ message: 'Listing deactivated successfully.', id: listing._id.toString() });
  } catch (err) {
    console.error('DELETE /books/:id error:', err);
    res.status(500).json({ error: 'Failed to deactivate listing.' });
  }
});

export default router;
