import { Router } from 'express';
import mongoose from 'mongoose';
import { BookListing } from '../models/BookListing.js';
import { BookRequest } from '../models/BookRequest.js';
import { Notification } from '../models/Notification.js';
import { RequestMessage } from '../models/RequestMessage.js';
import { Review } from '../models/Review.js';
import { Transaction } from '../models/Transaction.js';
import {
  authenticate,
  hasAdminPermission,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import {
  checkAvailabilityMismatch,
  checkSuspiciousRequests,
  recordUnauthorizedModificationAttempt,
} from '../services/discrepancyDetector.js';
import {
  createMessageSchema,
  createRequestSchema,
  createReviewSchema,
  updateRequestStatusSchema,
} from '../utils/validators.js';

const router = Router();

function formatRequest(doc: any, transaction?: any) {
  const listing = doc.listingId && typeof doc.listingId === 'object' ? doc.listingId : null;
  const owner = doc.ownerId && typeof doc.ownerId === 'object' ? doc.ownerId : null;
  const requester = doc.requesterId && typeof doc.requesterId === 'object' ? doc.requesterId : null;

  return {
    id: doc._id.toString(),
    listingId: listing ? listing._id.toString() : doc.listingId?.toString(),
    listing: listing
      ? {
          id: listing._id.toString(),
          title: listing.title,
          author: listing.author,
          subject: listing.subject,
          offerType: listing.offerType,
          price: listing.price,
          status: listing.status,
          images: listing.images || [],
        }
      : undefined,
    ownerId: owner ? owner._id.toString() : doc.ownerId?.toString(),
    owner: owner
      ? {
          id: owner._id.toString(),
          name: owner.name,
          branch: owner.branch,
          year: owner.year,
          verified: owner.verified,
        }
      : undefined,
    requesterId: requester ? requester._id.toString() : doc.requesterId?.toString(),
    requester: requester
      ? {
          id: requester._id.toString(),
          name: requester.name,
          branch: requester.branch,
          year: requester.year,
          verified: requester.verified,
        }
      : undefined,
    offerType: doc.offerType,
    initialMessage: doc.initialMessage,
    pickupLocation: doc.pickupLocation,
    status: doc.status,
    transaction: transaction
      ? {
          id: transaction._id.toString(),
          status: transaction.status,
          agreedPrice: transaction.agreedPrice,
          startDate: transaction.startDate,
          dueDate: transaction.dueDate,
          completedAt: transaction.completedAt,
        }
      : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// Create a request for a book
router.post('/books/:id/requests', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Book listing not found.' });
      return;
    }

    const parsed = createRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request input.' });
      return;
    }

    const listing = await BookListing.findById(id);
    if (!listing || listing.status === 'deactivated') {
      res.status(404).json({ error: 'Book listing not found.' });
      return;
    }

    const availableQty = typeof listing.availableQuantity === 'number' ? listing.availableQuantity : 1;
    if (listing.status !== 'available' || availableQty <= 0) {
      res.status(409).json({ error: `This book is currently ${listing.status} and cannot be requested.` });
      return;
    }

    if (listing.ownerId.toString() === req.user!._id.toString()) {
      res.status(400).json({ error: 'You cannot request your own book listing.' });
      return;
    }

    const existingActive = await BookRequest.findOne({
      listingId: listing._id,
      requesterId: req.user!._id,
      status: { $in: ['pending', 'accepted'] },
    });

    if (existingActive) {
      res.status(409).json({ error: 'You already have an active request for this book.' });
      return;
    }

    const bookRequest = await BookRequest.create({
      listingId: listing._id,
      ownerId: listing.ownerId,
      requesterId: req.user!._id,
      offerType: listing.offerType,
      initialMessage: parsed.data.message,
      pickupLocation: parsed.data.pickupLocation,
      status: 'pending',
    });

    await Promise.all([
      BookListing.updateOne({ _id: listing._id }, { $inc: { requestCount: 1 } }),
      RequestMessage.create({
        requestId: bookRequest._id,
        senderId: req.user!._id,
        body: parsed.data.message,
      }),
      Notification.create({
        userId: listing.ownerId,
        type: 'new_request',
        title: 'New book request',
        message: `${req.user!.name} requested "${listing.title}" (${listing.offerType}).`,
        relatedRequestId: bookRequest._id,
        relatedListingId: listing._id,
      }),
      checkSuspiciousRequests(req.user!._id, bookRequest._id),
    ]);

    const populated = await BookRequest.findById(bookRequest._id)
      .populate('listingId', 'title author subject offerType price status images')
      .populate('ownerId', 'name branch year verified')
      .populate('requesterId', 'name branch year verified')
      .lean();

    res.status(201).json({ request: formatRequest(populated) });
  } catch (err) {
    console.error('POST /books/:id/requests error:', err);
    res.status(500).json({ error: 'Failed to submit book request.' });
  }
});

// View requests associated with logged-in student (supports both /requests and /me/requests)
async function listMyRequests(req: AuthenticatedRequest, res: any) {
  try {
    const userId = req.user!._id;
    const roleFilter = req.query.direction;

    const query: Record<string, unknown> =
      roleFilter === 'incoming'
        ? { ownerId: userId }
        : roleFilter === 'outgoing'
          ? { requesterId: userId }
          : { $or: [{ ownerId: userId }, { requesterId: userId }] };

    const docs = await BookRequest.find(query)
      .populate('listingId', 'title author subject offerType price status images')
      .populate('ownerId', 'name branch year verified')
      .populate('requesterId', 'name branch year verified')
      .sort({ updatedAt: -1 })
      .lean();

    const requestIds = docs.map((d: any) => d._id);
    const transactions = await Transaction.find({ requestId: { $in: requestIds } }).lean();
    const txByReq = new Map(transactions.map((t: any) => [t.requestId.toString(), t]));

    res.json({
      requests: docs.map((d: any) => formatRequest(d, txByReq.get(d._id.toString()))),
    });
  } catch (err) {
    console.error('GET /requests error:', err);
    res.status(500).json({ error: 'Failed to load requests.' });
  }
}

router.get('/requests', authenticate, listMyRequests);
router.get('/me/requests', authenticate, listMyRequests);

// Get single request detail (only owner or requester)
router.get('/requests/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    const doc = await BookRequest.findById(id)
      .populate('listingId', 'title author subject offerType price status images loanDurationDays deposit')
      .populate('ownerId', 'name branch year verified')
      .populate('requesterId', 'name branch year verified')
      .lean();

    if (!doc) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    const uid = req.user!._id.toString();
    const isOwner = (doc as any).ownerId._id.toString() === uid;
    const isRequester = (doc as any).requesterId._id.toString() === uid;

    if (!isOwner && !isRequester) {
      res.status(403).json({ error: 'Forbidden: You are not a participant in this request.' });
      return;
    }

    const transaction = await Transaction.findOne({ requestId: (doc as any)._id }).lean();
    let myReview = null;
    if (transaction) {
      myReview = await Review.findOne({
        transactionId: (transaction as any)._id,
        reviewerId: req.user!._id,
      }).lean();
    }

    res.json({
      request: formatRequest(doc, transaction),
      hasReviewed: Boolean(myReview),
    });
  } catch (err) {
    console.error('GET /requests/:id error:', err);
    res.status(500).json({ error: 'Failed to load request details.' });
  }
});

// Update request status (accept/reject by owner; cancel by requester)
router.patch('/requests/:id/status', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    const parsed = updateRequestStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid status update.' });
      return;
    }

    const bookRequest = await BookRequest.findById(id);
    if (!bookRequest) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    const uid = req.user!._id.toString();
    const isOwner = bookRequest.ownerId.toString() === uid;
    const isRequester = bookRequest.requesterId.toString() === uid;
    const canManageRequests = hasAdminPermission(req.user, 'manage_requests');

    if (!isOwner && !isRequester && !canManageRequests) {
      await recordUnauthorizedModificationAttempt(
        req.user!,
        'BookRequest',
        bookRequest._id.toString(),
        'Attempted to change status on unrelated request',
      );
      res.status(403).json({ error: 'Forbidden: Not authorized to update this request.' });
      return;
    }

    const targetStatus = parsed.data.status;

    if ((targetStatus === 'accepted' || targetStatus === 'rejected') && !isOwner && !canManageRequests) {
      await recordUnauthorizedModificationAttempt(
        req.user!,
        'BookRequest',
        bookRequest._id.toString(),
        `Non-owner attempted to ${targetStatus} request`,
      );
      res.status(403).json({ error: 'Only the book owner can accept or reject a request.' });
      return;
    }

    if (targetStatus === 'cancelled' && !isRequester && !isOwner && !canManageRequests) {
      res.status(403).json({ error: 'Not authorized to cancel this request.' });
      return;
    }

    if (bookRequest.status === 'completed') {
      res.status(409).json({ error: 'Completed requests cannot be modified.' });
      return;
    }

    const listing = await BookListing.findById(bookRequest.listingId);
    if (!listing) {
      res.status(404).json({ error: 'Associated book listing no longer exists.' });
      return;
    }

    if (targetStatus === 'accepted') {
      const currentAvail = typeof listing.availableQuantity === 'number' ? listing.availableQuantity : 1;
      if (listing.status !== 'available' || currentAvail <= 0) {
        res.status(409).json({ error: 'This book listing is no longer available to accept.' });
        return;
      }

      bookRequest.status = 'accepted';
      await bookRequest.save();

      const nextAvail = Math.max(0, currentAvail - 1);
      listing.availableQuantity = nextAvail;
      if (nextAvail === 0) {
        listing.status = 'reserved';
      }
      await listing.save();
      await checkAvailabilityMismatch(listing);

      const dueDate =
        listing.offerType === 'lend'
          ? parsed.data.dueDate
            ? new Date(parsed.data.dueDate)
            : new Date(Date.now() + (listing.loanDurationDays || 30) * 86400000)
          : undefined;

      await Transaction.findOneAndUpdate(
        { requestId: bookRequest._id },
        {
          requestId: bookRequest._id,
          listingId: listing._id,
          ownerId: bookRequest.ownerId,
          requesterId: bookRequest.requesterId,
          offerType: listing.offerType,
          agreedPrice: listing.price,
          startDate: new Date(),
          dueDate,
          status: 'active',
        },
        { upsert: true, returnDocument: 'after' },
      );

      await Notification.create({
        userId: bookRequest.requesterId,
        type: 'status_change',
        title: 'Book request accepted',
        message: `Your request for "${listing.title}" was accepted! Coordinate handover in messages.`,
        relatedRequestId: bookRequest._id,
        relatedListingId: listing._id,
      });
    } else if (targetStatus === 'rejected') {
      bookRequest.status = 'rejected';
      await bookRequest.save();

      await Notification.create({
        userId: bookRequest.requesterId,
        type: 'status_change',
        title: 'Book request declined',
        message: `Your request for "${listing.title}" was declined by the owner.`,
        relatedRequestId: bookRequest._id,
        relatedListingId: listing._id,
      });
    } else if (targetStatus === 'cancelled') {
      const wasAccepted = bookRequest.status === 'accepted';
      bookRequest.status = 'cancelled';
      await bookRequest.save();

      if (wasAccepted) {
        const totalQty = typeof listing.quantity === 'number' ? listing.quantity : 1;
        listing.availableQuantity = Math.min(totalQty, (listing.availableQuantity ?? 0) + 1);
        listing.status = 'available';
        await listing.save();
        await Transaction.updateOne({ requestId: bookRequest._id }, { $set: { status: 'cancelled' } });
      }

      const recipientId = isRequester ? bookRequest.ownerId : bookRequest.requesterId;
      await Notification.create({
        userId: recipientId,
        type: 'status_change',
        title: 'Book request cancelled',
        message: `The request for "${listing.title}" has been cancelled.`,
        relatedRequestId: bookRequest._id,
        relatedListingId: listing._id,
      });
    }

    const populated = await BookRequest.findById(bookRequest._id)
      .populate('listingId', 'title author subject offerType price status images')
      .populate('ownerId', 'name branch year verified')
      .populate('requesterId', 'name branch year verified')
      .lean();
    const transaction = await Transaction.findOne({ requestId: bookRequest._id }).lean();

    res.json({ request: formatRequest(populated, transaction) });
  } catch (err) {
    console.error('PATCH /requests/:id/status error:', err);
    res.status(500).json({ error: 'Failed to update request status.' });
  }
});

// Strict participant-only messaging
router.get('/requests/:id/messages', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    const bookRequest = await BookRequest.findById(id).lean();
    if (!bookRequest) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    const uid = req.user!._id.toString();
    const isParticipant =
      (bookRequest as any).ownerId.toString() === uid ||
      (bookRequest as any).requesterId.toString() === uid;

    if (!isParticipant) {
      res.status(403).json({ error: 'Forbidden: Only the requester and book owner can view these messages.' });
      return;
    }

    const messages = await RequestMessage.find({ requestId: id })
      .populate('senderId', 'name branch year')
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      messages: messages.map((m: any) => ({
        id: m._id.toString(),
        requestId: m.requestId.toString(),
        senderId: m.senderId?._id ? m.senderId._id.toString() : m.senderId.toString(),
        senderName: m.senderId?.name || 'Student',
        body: m.body,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /requests/:id/messages error:', err);
    res.status(500).json({ error: 'Failed to load messages.' });
  }
});

router.post('/requests/:id/messages', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid message.' });
      return;
    }

    const bookRequest = await BookRequest.findById(id).populate('listingId', 'title');
    if (!bookRequest) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    const uid = req.user!._id.toString();
    const isOwner = bookRequest.ownerId.toString() === uid;
    const isRequester = bookRequest.requesterId.toString() === uid;

    if (!isOwner && !isRequester) {
      res.status(403).json({ error: 'Forbidden: Only the requester and book owner can send messages.' });
      return;
    }

    const msg = await RequestMessage.create({
      requestId: bookRequest._id,
      senderId: req.user!._id,
      body: parsed.data.body,
    });

    bookRequest.updatedAt = new Date();
    await bookRequest.save();

    const otherUserId = isOwner ? bookRequest.requesterId : bookRequest.ownerId;
    const bookTitle = (bookRequest.listingId as any)?.title || 'a book';

    await Notification.create({
      userId: otherUserId,
      type: 'new_message',
      title: 'New message on book request',
      message: `${req.user!.name} sent a message regarding "${bookTitle}".`,
      relatedRequestId: bookRequest._id,
      relatedListingId: (bookRequest.listingId as any)?._id || bookRequest.listingId,
    });

    res.status(201).json({
      message: {
        id: msg._id.toString(),
        requestId: msg.requestId.toString(),
        senderId: req.user!._id.toString(),
        senderName: req.user!.name,
        body: msg.body,
        createdAt: msg.createdAt,
      },
    });
  } catch (err) {
    console.error('POST /requests/:id/messages error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// Complete handover / transaction
router.post('/transactions/:id/complete', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    const uid = req.user!._id.toString();
    const isOwner = transaction.ownerId.toString() === uid;
    const isRequester = transaction.requesterId.toString() === uid;

    if (!isOwner && !isRequester) {
      res.status(403).json({ error: 'Forbidden: Only transaction participants can mark handover complete.' });
      return;
    }

    if (transaction.status === 'completed') {
      res.status(409).json({ error: 'Transaction is already marked as completed.' });
      return;
    }

    transaction.status = 'completed';
    transaction.completedAt = new Date();
    await transaction.save();

    await BookRequest.updateOne({ _id: transaction.requestId }, { $set: { status: 'completed' } });
    const listing = await BookListing.findById(transaction.listingId);
    if (listing) {
      const remaining = typeof listing.availableQuantity === 'number' ? listing.availableQuantity : 0;
      listing.status = remaining > 0 ? 'available' : 'completed';
      await listing.save();
    }

    const otherUserId = isOwner ? transaction.requesterId : transaction.ownerId;
    await Notification.create({
      userId: otherUserId,
      type: 'status_change',
      title: 'Handover completed',
      message: `The handover for "${listing?.title || 'your book'}" has been marked complete. You can now leave a review.`,
      relatedRequestId: transaction.requestId,
      relatedListingId: transaction.listingId,
    });

    res.json({
      transaction: {
        id: transaction._id.toString(),
        status: transaction.status,
        completedAt: transaction.completedAt,
      },
    });
  } catch (err) {
    console.error('POST /transactions/:id/complete error:', err);
    res.status(500).json({ error: 'Failed to complete transaction.' });
  }
});

// Submit a review for a completed transaction
router.post('/transactions/:id/reviews', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid review data.' });
      return;
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    const uid = req.user!._id.toString();
    const isOwner = transaction.ownerId.toString() === uid;
    const isRequester = transaction.requesterId.toString() === uid;
    if (!isOwner && !isRequester) {
      res.status(403).json({ error: 'Forbidden: Only transaction participants can submit a review.' });
      return;
    }

    if (transaction.status !== 'completed') {
      res.status(400).json({ error: 'Reviews can only be submitted after the handover is completed.' });
      return;
    }

    const existing = await Review.findOne({ transactionId: transaction._id, reviewerId: req.user!._id });
    if (existing) {
      res.status(409).json({ error: 'You have already submitted a review for this transaction.' });
      return;
    }

    const revieweeId = isOwner ? transaction.requesterId : transaction.ownerId;
    const review = await Review.create({
      transactionId: transaction._id,
      reviewerId: req.user!._id,
      revieweeId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });

    res.status(201).json({
      review: {
        id: review._id.toString(),
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      },
    });
  } catch (err) {
    console.error('POST /transactions/:id/reviews error:', err);
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

export default router;
