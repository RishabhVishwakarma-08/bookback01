import { Router } from 'express';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { BackupSnapshot } from '../models/BackupSnapshot.js';
import { BookListing } from '../models/BookListing.js';
import { BookRequest } from '../models/BookRequest.js';
import { Campus } from '../models/Campus.js';
import { Discrepancy } from '../models/Discrepancy.js';
import { Notification } from '../models/Notification.js';
import { PlatformSetting } from '../models/PlatformSetting.js';
import { Report } from '../models/Report.js';
import { RequestMessage } from '../models/RequestMessage.js';
import { Transaction } from '../models/Transaction.js';
import { TEAM_PERMISSIONS, User } from '../models/User.js';
import {
  authenticate,
  isSuperAdmin,
  requireAdmin,
  requirePermission,
  requireSuperAdmin,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import {
  checkAvailabilityMismatch,
  checkQuantityAnomaly,
  getPlatformSettings,
  recordUnauthorizedModificationAttempt,
  runConsistencyScan,
} from '../services/discrepancyDetector.js';
import { hashPassword } from '../utils/security.js';
import {
  adminUpdateBookSchema,
  adminUpdateRequestSchema,
  adminUpdateUserSchema,
  createTeamAdminSchema,
  discrepancyActionSchema,
  discrepancyNoteSchema,
  platformSettingsSchema,
  updateTeamAdminSchema,
} from '../utils/validators.js';

const router = Router();

router.use('/admin', authenticate, requireAdmin);

async function writeAuditLog(params: {
  actor: NonNullable<AuthenticatedRequest['user']>;
  action: string;
  targetType:
    | 'user'
    | 'listing'
    | 'report'
    | 'request'
    | 'discrepancy'
    | 'team'
    | 'settings'
    | 'backup';
  targetId: string;
  details: string;
  reason: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  restorable?: boolean;
}) {
  return AuditLog.create({
    actorId: params.actor._id,
    actorName: params.actor.name,
    actorRole: params.actor.role,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    reason: params.reason,
    previousValue: params.previousValue ?? null,
    newValue: params.newValue ?? null,
    restorable: Boolean(params.restorable && params.previousValue),
  });
}

// 1. Overview & KPIs
router.get('/admin/overview', async (_req, res) => {
  try {
    const [
      totalUsers,
      verifiedUsers,
      suspendedUsers,
      totalListings,
      activeListings,
      totalRequests,
      completedTransactions,
      openReports,
      openDiscrepancies,
      teamAdminsCount,
      recentDiscrepancies,
      recentLogs,
    ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'student', verified: true }),
      User.countDocuments({ isSuspended: true }),
      BookListing.countDocuments(),
      BookListing.countDocuments({ status: 'available' }),
      BookRequest.countDocuments(),
      Transaction.countDocuments({ status: 'completed' }),
      Report.countDocuments({ status: { $in: ['open', 'reviewing'] } }),
      Discrepancy.countDocuments({ status: { $in: ['open', 'investigating'] } }),
      User.countDocuments({ role: { $in: ['team_admin', 'super_admin'] } }),
      Discrepancy.find()
        .populate('assignedAdminId', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      AuditLog.find().sort({ createdAt: -1 }).limit(6).lean(),
    ]);

    res.json({
      stats: {
        totalUsers,
        verifiedUsers,
        suspendedUsers,
        totalListings,
        activeListings,
        totalRequests,
        completedTransactions,
        openReports,
        openDiscrepancies,
        teamAdminsCount,
      },
      recentDiscrepancies: recentDiscrepancies.map((d: any) => ({
        id: d._id.toString(),
        issueId: d.issueId,
        type: d.type,
        severity: d.severity,
        status: d.status,
        description: d.description,
        assignedAdminName: d.assignedAdminId?.name || 'Unassigned',
        createdAt: d.createdAt,
      })),
      recentLogs: recentLogs.map((l: any) => ({
        id: l._id.toString(),
        actorName: l.actorName || 'Administrator',
        actorRole: l.actorRole || 'admin',
        action: l.action,
        targetType: l.targetType,
        details: l.details,
        reason: l.reason || '',
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /admin/overview error:', err);
    res.status(500).json({ error: 'Failed to fetch admin overview.' });
  }
});

// 2. Reports & Analytics + CSV Export
router.get('/admin/analytics', requirePermission('view_reports'), async (_req, res) => {
  try {
    const [byBranch, byOfferType, byDiscrepancyType, topBooks] = await Promise.all([
      BookListing.aggregate([
        { $match: { status: { $ne: 'deactivated' } } },
        { $group: { _id: '$branch', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      BookListing.aggregate([
        { $match: { status: { $ne: 'deactivated' } } },
        { $group: { _id: '$offerType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Discrepancy.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      BookListing.find({ status: { $ne: 'deactivated' } })
        .sort({ requestCount: -1, viewsCount: -1 })
        .limit(5)
        .select('title author branch offerType requestCount viewsCount availableQuantity quantity')
        .lean(),
    ]);

    res.json({
      analytics: {
        byBranch: byBranch.map((b: any) => ({ label: b._id, count: b.count })),
        byOfferType: byOfferType.map((o: any) => ({ label: o._id, count: o.count })),
        byDiscrepancyType: byDiscrepancyType.map((d: any) => ({ label: d._id, count: d.count })),
        topBooks: topBooks.map((b: any) => ({
          id: b._id.toString(),
          title: b.title,
          author: b.author,
          branch: b.branch,
          offerType: b.offerType,
          requestCount: b.requestCount || 0,
          viewsCount: b.viewsCount || 0,
        })),
      },
    });
  } catch (err) {
    console.error('GET /admin/analytics error:', err);
    res.status(500).json({ error: 'Failed to load analytics.' });
  }
});

router.get('/admin/analytics/export', requirePermission('view_reports'), async (req, res) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : 'books';
    const csvEscape = (val: unknown) => {
      const s = String(val ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };

    let csv = '';
    if (type === 'discrepancies') {
      const rows = await Discrepancy.find().sort({ createdAt: -1 }).lean();
      csv = ['IssueID,Type,Severity,Status,Model,RecordID,Description,CreatedAt']
        .concat(
          rows.map((r: any) =>
            [r.issueId, r.type, r.severity, r.status, r.relatedModel, r.relatedRecordId, r.description, r.createdAt?.toISOString?.() || '']
              .map(csvEscape)
              .join(','),
          ),
        )
        .join('\n');
    } else if (type === 'audit') {
      const rows = await AuditLog.find().sort({ createdAt: -1 }).limit(500).lean();
      csv = ['Timestamp,Actor,Role,Action,TargetType,TargetID,Reason,Details']
        .concat(
          rows.map((r: any) =>
            [r.createdAt?.toISOString?.() || '', r.actorName, r.actorRole, r.action, r.targetType, r.targetId, r.reason, r.details]
              .map(csvEscape)
              .join(','),
          ),
        )
        .join('\n');
    } else if (type === 'requests') {
      const rows = await BookRequest.find()
        .populate('listingId', 'title')
        .populate('ownerId', 'name')
        .populate('requesterId', 'name')
        .sort({ createdAt: -1 })
        .lean();
      csv = ['RequestID,BookTitle,Owner,Requester,OfferType,Status,PickupLocation,CreatedAt']
        .concat(
          rows.map((r: any) =>
            [
              r._id.toString(),
              r.listingId?.title || '',
              r.ownerId?.name || '',
              r.requesterId?.name || '',
              r.offerType,
              r.status,
              r.pickupLocation,
              r.createdAt?.toISOString?.() || '',
            ]
              .map(csvEscape)
              .join(','),
          ),
        )
        .join('\n');
    } else {
      const rows = await BookListing.find().populate('ownerId', 'name collegeId').sort({ createdAt: -1 }).lean();
      csv = ['BookID,Title,Author,Branch,Semester,OfferType,Price,Quantity,Available,Status,Owner,CreatedAt']
        .concat(
          rows.map((b: any) =>
            [
              b._id.toString(),
              b.title,
              b.author,
              b.branch,
              b.semester,
              b.offerType,
              b.price,
              b.quantity ?? 1,
              b.availableQuantity ?? 1,
              b.status,
              b.ownerId?.name || '',
              b.createdAt?.toISOString?.() || '',
            ]
              .map(csvEscape)
              .join(','),
          ),
        )
        .join('\n');
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bookback-${type}-report.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('GET /admin/analytics/export error:', err);
    res.status(500).json({ error: 'Failed to export report.' });
  }
});

// 3. User Management
router.get('/admin/users', async (_req, res) => {
  try {
    const users = await User.find()
      .populate('campusId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      users: users.map((u: any) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        collegeId: u.collegeId,
        branch: u.branch,
        year: u.year,
        semester: u.semester,
        campusName: u.campusId?.name || 'Campus',
        role: u.role,
        permissions: u.permissions || [],
        verified: u.verified,
        isSuspended: u.isSuspended,
        suspensionReason: u.suspensionReason || '',
        failedLoginAttempts: u.failedLoginAttempts || 0,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /admin/users error:', err);
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

router.patch('/admin/users/:id', requirePermission('verify_users'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const parsed = adminUpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Mandatory reason and valid fields required.' });
      return;
    }

    const target = await User.findById(id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Team Admins cannot modify/disable Super Admins or other Team Admins
    if (!isSuperAdmin(req.user) && (target.role === 'super_admin' || target.role === 'team_admin' || target.role === 'admin')) {
      await recordUnauthorizedModificationAttempt(
        req.user!,
        'User',
        target._id.toString(),
        `Team admin attempted to modify privileged account (${target.role})`,
      );
      res.status(403).json({
        error: 'Forbidden: Only the Super Admin can manage administrator accounts.',
      });
      return;
    }

    if (target._id.toString() === req.user!._id.toString() && parsed.data.isSuspended === true) {
      res.status(400).json({ error: 'Administrators cannot suspend their own account.' });
      return;
    }

    const previousValue = {
      verified: target.verified,
      isSuspended: target.isSuspended,
      suspensionReason: target.suspensionReason || '',
    };

    const actions: string[] = [];
    if (typeof parsed.data.verified === 'boolean' && parsed.data.verified !== target.verified) {
      target.verified = parsed.data.verified;
      actions.push(parsed.data.verified ? 'verified campus membership' : 'revoked verification');
      await Notification.create({
        userId: target._id,
        type: 'verification',
        title: parsed.data.verified ? 'Campus profile verified' : 'Verification updated',
        message: parsed.data.verified
          ? 'Your student profile has been verified by campus administration.'
          : 'Your campus verification status was updated by an administrator.',
      });
    }

    if (typeof parsed.data.isSuspended === 'boolean' && parsed.data.isSuspended !== target.isSuspended) {
      target.isSuspended = parsed.data.isSuspended;
      target.suspensionReason = parsed.data.isSuspended
        ? parsed.data.suspensionReason || parsed.data.reason
        : '';
      actions.push(parsed.data.isSuspended ? 'suspended account' : 'reinstated account');
    }

    await target.save();

    const newValue = {
      verified: target.verified,
      isSuspended: target.isSuspended,
      suspensionReason: target.suspensionReason || '',
    };

    if (actions.length > 0) {
      await writeAuditLog({
        actor: req.user!,
        action: actions.join('; '),
        targetType: 'user',
        targetId: target._id.toString(),
        details: `${target.name} (${target.collegeId})`,
        reason: parsed.data.reason,
        previousValue,
        newValue,
        restorable: true,
      });
    }

    res.json({
      user: {
        id: target._id.toString(),
        name: target.name,
        email: target.email,
        collegeId: target.collegeId,
        verified: target.verified,
        isSuspended: target.isSuspended,
        suspensionReason: target.suspensionReason || '',
      },
    });
  } catch (err) {
    console.error('PATCH /admin/users/:id error:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// 4. Book Management & Data Correction
router.get('/admin/listings', async (_req, res) => {
  try {
    const listings = await BookListing.find()
      .populate('ownerId', 'name collegeId branch verified')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      listings: listings.map((b: any) => ({
        id: b._id.toString(),
        title: b.title,
        author: b.author,
        subject: b.subject,
        branch: b.branch,
        semester: b.semester,
        offerType: b.offerType,
        price: b.price,
        quantity: b.quantity ?? 1,
        availableQuantity: b.availableQuantity ?? 1,
        viewsCount: b.viewsCount ?? 0,
        requestCount: b.requestCount ?? 0,
        status: b.status,
        ownerName: b.ownerId?.name || 'Student',
        ownerCollegeId: b.ownerId?.collegeId || '',
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /admin/listings error:', err);
    res.status(500).json({ error: 'Failed to load listings.' });
  }
});

router.patch('/admin/listings/:id', requirePermission('manage_books'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Listing not found.' });
      return;
    }

    const parsed = adminUpdateBookSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid listing correction data.' });
      return;
    }

    const listing = await BookListing.findById(id);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found.' });
      return;
    }

    const { reason, ...updates } = parsed.data;
    if (
      updates.quantity !== undefined &&
      updates.availableQuantity !== undefined &&
      updates.availableQuantity > updates.quantity
    ) {
      res.status(400).json({ error: 'Available quantity cannot exceed total quantity.' });
      return;
    }

    const previousValue: Record<string, unknown> = {
      title: listing.title,
      author: listing.author,
      subject: listing.subject,
      price: listing.price,
      quantity: listing.quantity ?? 1,
      availableQuantity: listing.availableQuantity ?? 1,
      status: listing.status,
    };

    const prevQuantity = listing.quantity ?? 1;
    Object.assign(listing, updates);
    if (listing.availableQuantity > listing.quantity) {
      listing.availableQuantity = listing.quantity;
    }
    await listing.save();

    const newValue: Record<string, unknown> = {
      title: listing.title,
      author: listing.author,
      subject: listing.subject,
      price: listing.price,
      quantity: listing.quantity,
      availableQuantity: listing.availableQuantity,
      status: listing.status,
    };

    await writeAuditLog({
      actor: req.user!,
      action: 'corrected listing data',
      targetType: 'listing',
      targetId: listing._id.toString(),
      details: listing.title,
      reason,
      previousValue,
      newValue,
      restorable: true,
    });

    if (updates.quantity !== undefined && updates.quantity !== prevQuantity) {
      await checkQuantityAnomaly(listing, prevQuantity, updates.quantity, req.user!._id);
    }
    await checkAvailabilityMismatch(listing);

    if (updates.status === 'deactivated' && previousValue.status !== 'deactivated') {
      await Notification.create({
        userId: listing.ownerId,
        type: 'listing_unavailable',
        title: 'Listing removed by moderator',
        message: `Your listing "${listing.title}" was deactivated during campus moderation (${reason}).`,
        relatedListingId: listing._id,
      });
    }

    res.json({
      listing: {
        id: listing._id.toString(),
        title: listing.title,
        author: listing.author,
        subject: listing.subject,
        price: listing.price,
        quantity: listing.quantity,
        availableQuantity: listing.availableQuantity,
        status: listing.status,
      },
    });
  } catch (err) {
    console.error('PATCH /admin/listings/:id error:', err);
    res.status(500).json({ error: 'Failed to moderate listing.' });
  }
});

// Permanent deletion restricted strictly to Super Admin
router.delete('/admin/listings/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Listing not found.' });
      return;
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 5) {
      res.status(400).json({ error: 'A mandatory reason (at least 5 characters) is required for permanent deletion.' });
      return;
    }

    const listing = await BookListing.findById(id).lean();
    if (!listing) {
      res.status(404).json({ error: 'Listing not found.' });
      return;
    }

    await BookListing.deleteOne({ _id: id });
    await writeAuditLog({
      actor: req.user!,
      action: 'permanently deleted listing',
      targetType: 'listing',
      targetId: id,
      details: (listing as any).title,
      reason,
      previousValue: listing as unknown as Record<string, unknown>,
      newValue: null,
      restorable: false,
    });

    res.json({ message: 'Listing permanently deleted.', id });
  } catch (err) {
    console.error('DELETE /admin/listings/:id error:', err);
    res.status(500).json({ error: 'Failed to delete listing.' });
  }
});

// 5. Borrowing Requests Oversight
router.get('/admin/requests', requirePermission('manage_requests'), async (_req, res) => {
  try {
    const requests = await BookRequest.find()
      .populate('listingId', 'title offerType price status')
      .populate('ownerId', 'name collegeId')
      .populate('requesterId', 'name collegeId')
      .sort({ createdAt: -1 })
      .limit(150)
      .lean();

    res.json({
      requests: requests.map((r: any) => ({
        id: r._id.toString(),
        listingId: r.listingId?._id?.toString(),
        bookTitle: r.listingId?.title || 'Book',
        offerType: r.offerType,
        ownerName: r.ownerId?.name || 'Owner',
        ownerCollegeId: r.ownerId?.collegeId || '',
        requesterName: r.requesterId?.name || 'Requester',
        requesterCollegeId: r.requesterId?.collegeId || '',
        pickupLocation: r.pickupLocation,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    console.error('GET /admin/requests error:', err);
    res.status(500).json({ error: 'Failed to load borrowing requests.' });
  }
});

router.patch('/admin/requests/:id', requirePermission('manage_requests'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    const parsed = adminUpdateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request correction.' });
      return;
    }

    const bookRequest = await BookRequest.findById(id);
    if (!bookRequest) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    const previousValue = {
      status: bookRequest.status,
      pickupLocation: bookRequest.pickupLocation,
    };

    if (parsed.data.status) bookRequest.status = parsed.data.status;
    if (parsed.data.pickupLocation) bookRequest.pickupLocation = parsed.data.pickupLocation;
    await bookRequest.save();

    const newValue = {
      status: bookRequest.status,
      pickupLocation: bookRequest.pickupLocation,
    };

    await writeAuditLog({
      actor: req.user!,
      action: 'corrected borrowing request',
      targetType: 'request',
      targetId: bookRequest._id.toString(),
      details: `Request status: ${previousValue.status} -> ${newValue.status}`,
      reason: parsed.data.reason,
      previousValue,
      newValue,
      restorable: true,
    });

    res.json({
      request: {
        id: bookRequest._id.toString(),
        status: bookRequest.status,
        pickupLocation: bookRequest.pickupLocation,
      },
    });
  } catch (err) {
    console.error('PATCH /admin/requests/:id error:', err);
    res.status(500).json({ error: 'Failed to update borrowing request.' });
  }
});

// 6. Discrepancy Detection Dashboard
router.get('/admin/discrepancies', requirePermission('investigate_discrepancies'), async (_req, res) => {
  try {
    const discrepancies = await Discrepancy.find()
      .populate('relatedUserId', 'name collegeId email')
      .populate('assignedAdminId', 'name role')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      discrepancies: discrepancies.map((d: any) => ({
        id: d._id.toString(),
        issueId: d.issueId,
        type: d.type,
        severity: d.severity,
        description: d.description,
        relatedModel: d.relatedModel,
        relatedRecordId: d.relatedRecordId,
        relatedUser: d.relatedUserId
          ? {
              id: d.relatedUserId._id.toString(),
              name: d.relatedUserId.name,
              collegeId: d.relatedUserId.collegeId,
            }
          : null,
        assignedAdminId: d.assignedAdminId?._id?.toString() || null,
        assignedAdminName: d.assignedAdminId?.name || 'Unassigned',
        status: d.status,
        investigationNotes: d.investigationNotes || [],
        resolutionSummary: d.resolutionSummary || '',
        autoDetected: d.autoDetected,
        resolvedAt: d.resolvedAt,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (err) {
    console.error('GET /admin/discrepancies error:', err);
    res.status(500).json({ error: 'Failed to load discrepancy reports.' });
  }
});

router.post('/admin/discrepancies/scan', requirePermission('investigate_discrepancies'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await runConsistencyScan();
    await writeAuditLog({
      actor: req.user!,
      action: 'ran platform consistency scan',
      targetType: 'discrepancy',
      targetId: 'scan',
      details: `Flagged/updated ${result.createdOrUpdated} records`,
      reason: 'Administrator initiated consistency and anomaly check',
      restorable: false,
    });
    res.json({ message: 'Consistency scan complete.', ...result });
  } catch (err) {
    console.error('POST /admin/discrepancies/scan error:', err);
    res.status(500).json({ error: 'Consistency scan failed.' });
  }
});

router.patch('/admin/discrepancies/:id', requirePermission('investigate_discrepancies'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Discrepancy report not found.' });
      return;
    }

    const parsed = discrepancyActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid discrepancy update.' });
      return;
    }

    const discrepancy = await Discrepancy.findById(id);
    if (!discrepancy) {
      res.status(404).json({ error: 'Discrepancy report not found.' });
      return;
    }

    const previousValue = {
      status: discrepancy.status,
      assignedAdminId: discrepancy.assignedAdminId?.toString() || null,
      resolutionSummary: discrepancy.resolutionSummary,
    };

    if (parsed.data.status) {
      discrepancy.status = parsed.data.status;
      if (parsed.data.status === 'resolved' || parsed.data.status === 'false_positive') {
        discrepancy.resolvedAt = new Date();
      }
    }
    if (parsed.data.assignedAdminId !== undefined) {
      discrepancy.assignedAdminId = parsed.data.assignedAdminId
        ? new mongoose.Types.ObjectId(parsed.data.assignedAdminId)
        : undefined;
    }
    if (parsed.data.resolutionSummary !== undefined) {
      discrepancy.resolutionSummary = parsed.data.resolutionSummary;
    }

    await discrepancy.save();

    await writeAuditLog({
      actor: req.user!,
      action: `updated discrepancy ${discrepancy.issueId} (${discrepancy.status})`,
      targetType: 'discrepancy',
      targetId: discrepancy._id.toString(),
      details: `${discrepancy.issueId}: ${discrepancy.type}`,
      reason: parsed.data.reason,
      previousValue,
      newValue: {
        status: discrepancy.status,
        assignedAdminId: discrepancy.assignedAdminId?.toString() || null,
        resolutionSummary: discrepancy.resolutionSummary,
      },
      restorable: false,
    });

    res.json({
      discrepancy: {
        id: discrepancy._id.toString(),
        issueId: discrepancy.issueId,
        status: discrepancy.status,
        assignedAdminId: discrepancy.assignedAdminId?.toString() || null,
        resolutionSummary: discrepancy.resolutionSummary,
        resolvedAt: discrepancy.resolvedAt,
      },
    });
  } catch (err) {
    console.error('PATCH /admin/discrepancies/:id error:', err);
    res.status(500).json({ error: 'Failed to update discrepancy.' });
  }
});

router.post('/admin/discrepancies/:id/notes', requirePermission('investigate_discrepancies'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Discrepancy report not found.' });
      return;
    }

    const parsed = discrepancyNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid note.' });
      return;
    }

    const discrepancy = await Discrepancy.findById(id);
    if (!discrepancy) {
      res.status(404).json({ error: 'Discrepancy report not found.' });
      return;
    }

    discrepancy.investigationNotes.push({
      adminId: req.user!._id,
      adminName: req.user!.name,
      note: parsed.data.note,
      createdAt: new Date(),
    });
    if (discrepancy.status === 'open') {
      discrepancy.status = 'investigating';
    }
    if (!discrepancy.assignedAdminId) {
      discrepancy.assignedAdminId = req.user!._id;
    }
    await discrepancy.save();

    await writeAuditLog({
      actor: req.user!,
      action: `added investigation note on ${discrepancy.issueId}`,
      targetType: 'discrepancy',
      targetId: discrepancy._id.toString(),
      details: parsed.data.note.slice(0, 140),
      reason: 'Discrepancy investigation documentation',
      restorable: false,
    });

    res.status(201).json({
      investigationNotes: discrepancy.investigationNotes,
      status: discrepancy.status,
    });
  } catch (err) {
    console.error('POST /admin/discrepancies/:id/notes error:', err);
    res.status(500).json({ error: 'Failed to add investigation note.' });
  }
});

// 7. Student Reports Moderation
router.get('/admin/reports', async (_req, res) => {
  try {
    const reports = await Report.find()
      .populate('reporterId', 'name collegeId')
      .populate('listingId', 'title status')
      .populate('reportedUserId', 'name collegeId')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      reports: reports.map((r: any) => ({
        id: r._id.toString(),
        reason: r.reason,
        details: r.details,
        status: r.status,
        adminNote: r.adminNote || '',
        reporterName: r.reporterId?.name || 'Student',
        listingId: r.listingId?._id?.toString(),
        listingTitle: r.listingId?.title,
        reportedUserId: r.reportedUserId?._id?.toString(),
        reportedUserName: r.reportedUserId?.name,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /admin/reports error:', err);
    res.status(500).json({ error: 'Failed to load reports.' });
  }
});

router.patch('/admin/reports/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const { status, adminNote } = req.body;
    if (!['open', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
      res.status(400).json({ error: 'Invalid report status.' });
      return;
    }

    const existing = await Report.findById(id).lean();
    if (!existing) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const report = await Report.findByIdAndUpdate(
      id,
      { $set: { status, adminNote: typeof adminNote === 'string' ? adminNote : '' } },
      { returnDocument: 'after' },
    );

    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    await writeAuditLog({
      actor: req.user!,
      action: `marked report ${status}`,
      targetType: 'report',
      targetId: report._id.toString(),
      details: report.reason,
      reason: typeof adminNote === 'string' && adminNote.trim() ? adminNote.trim() : `Updated report status to ${status}`,
      previousValue: { status: (existing as any).status },
      newValue: { status },
      restorable: false,
    });

    await Notification.create({
      userId: report.reporterId,
      type: 'report_update',
      title: 'Report status updated',
      message: `Your report (${report.reason}) is now marked "${status}".`,
    });

    res.json({
      report: {
        id: report._id.toString(),
        status: report.status,
        adminNote: report.adminNote,
      },
    });
  } catch (err) {
    console.error('PATCH /admin/reports/:id error:', err);
    res.status(500).json({ error: 'Failed to update report.' });
  }
});

// 8. Tamper-Resistant Activity Logs & Record Restoration
router.get('/admin/audit-logs', async (req: AuthenticatedRequest, res) => {
  try {
    // Super Admin & legacy Admin see all logs; Team Admins view their own activity history
    const query =
      req.user!.role === 'team_admin' ? { actorId: req.user!._id } : {};

    const logs = await AuditLog.find(query)
      .populate('actorId', 'name role')
      .sort({ createdAt: -1 })
      .limit(150)
      .lean();

    res.json({
      logs: logs.map((l: any) => ({
        id: l._id.toString(),
        actorId: l.actorId?._id?.toString() || l.actorId?.toString(),
        actorName: l.actorId?.name || l.actorName || 'Administrator',
        actorRole: l.actorId?.role || l.actorRole || 'admin',
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        details: l.details,
        reason: l.reason || '',
        previousValue: l.previousValue ?? null,
        newValue: l.newValue ?? null,
        restorable: Boolean(l.restorable && l.previousValue && !l.restoredAt),
        restoredAt: l.restoredAt || null,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /admin/audit-logs error:', err);
    res.status(500).json({ error: 'Failed to load audit logs.' });
  }
});

// Explicitly block tampering with audit log entries
router.all('/admin/audit-logs/:id', (_req, res) => {
  res.status(403).json({ error: 'Forbidden: Audit log entries are immutable and cannot be edited or deleted.' });
});

router.post('/admin/audit-logs/:id/restore', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Audit entry not found.' });
      return;
    }

    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim().length >= 5
      ? req.body.reason.trim()
      : 'Super Admin restored previous record state from activity log';

    const log = await AuditLog.findById(id);
    if (!log) {
      res.status(404).json({ error: 'Audit entry not found.' });
      return;
    }
    if (!log.restorable || !log.previousValue) {
      res.status(400).json({ error: 'This audit log entry does not contain a restorable snapshot.' });
      return;
    }
    if (log.restoredAt) {
      res.status(409).json({ error: 'This record snapshot has already been restored.' });
      return;
    }

    const prev = log.previousValue as Record<string, unknown>;
    let currentState: Record<string, unknown> | null = null;

    if (log.targetType === 'listing') {
      const listing = await BookListing.findById(log.targetId);
      if (!listing) {
        res.status(404).json({ error: 'Target book listing no longer exists.' });
        return;
      }
      currentState = {
        title: listing.title,
        author: listing.author,
        subject: listing.subject,
        price: listing.price,
        quantity: listing.quantity,
        availableQuantity: listing.availableQuantity,
        status: listing.status,
      };
      Object.assign(listing, prev);
      await listing.save();
    } else if (log.targetType === 'user') {
      const user = await User.findById(log.targetId);
      if (!user) {
        res.status(404).json({ error: 'Target user no longer exists.' });
        return;
      }
      currentState = {
        verified: user.verified,
        isSuspended: user.isSuspended,
        suspensionReason: user.suspensionReason || '',
      };
      Object.assign(user, prev);
      await user.save();
    } else if (log.targetType === 'request') {
      const reqDoc = await BookRequest.findById(log.targetId);
      if (!reqDoc) {
        res.status(404).json({ error: 'Target borrowing request no longer exists.' });
        return;
      }
      currentState = {
        status: reqDoc.status,
        pickupLocation: reqDoc.pickupLocation,
      };
      Object.assign(reqDoc, prev);
      await reqDoc.save();
    } else {
      res.status(400).json({ error: `Restoration is not supported for target type "${log.targetType}".` });
      return;
    }

    log.restoredAt = new Date();
    log.restoredBy = req.user!._id;
    await log.save();

    await writeAuditLog({
      actor: req.user!,
      action: `restored previous ${log.targetType} record`,
      targetType: log.targetType,
      targetId: log.targetId,
      details: `Restored from audit log ${log._id.toString()}`,
      reason,
      previousValue: currentState,
      newValue: prev,
      restorable: false,
    });

    res.json({ message: 'Previous record state restored successfully.', restoredTargetId: log.targetId });
  } catch (err) {
    console.error('POST /admin/audit-logs/:id/restore error:', err);
    res.status(500).json({ error: 'Failed to restore previous record.' });
  }
});

// 9. Team Management (Super Admin Only)
router.get('/admin/team', requireSuperAdmin, async (_req, res) => {
  try {
    const admins = await User.find({
      role: { $in: ['super_admin', 'team_admin', 'admin'] },
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      availablePermissions: TEAM_PERMISSIONS,
      team: admins.map((a: any) => ({
        id: a._id.toString(),
        name: a.name,
        email: a.email,
        collegeId: a.collegeId,
        role: a.role,
        permissions: a.role === 'super_admin' ? [...TEAM_PERMISSIONS] : a.permissions || [],
        isSuspended: a.isSuspended,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /admin/team error:', err);
    res.status(500).json({ error: 'Failed to load administrative team.' });
  }
});

router.post('/admin/team', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createTeamAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid team admin payload.' });
      return;
    }

    const { name, email, collegeId, password, permissions, reason } = parsed.data;
    const normalizedId = collegeId.toUpperCase();
    const existing = await User.findOne({ $or: [{ email }, { collegeId: normalizedId }] });
    if (existing) {
      res.status(409).json({ error: 'An account with this email or Staff ID already exists.' });
      return;
    }

    const defaultCampus = req.user!.campusId || (await Campus.findOne())?._id;
    const created = await User.create({
      name,
      email,
      collegeId: normalizedId,
      branch: 'CSE',
      year: '4th Year',
      semester: 8,
      campusId: defaultCampus,
      passwordHash: await hashPassword(password),
      role: 'team_admin',
      permissions,
      verified: true,
      isSuspended: false,
      createdByAdminId: req.user!._id,
      bio: 'BookBack Team Administrator',
    });

    await writeAuditLog({
      actor: req.user!,
      action: 'added team admin account',
      targetType: 'team',
      targetId: created._id.toString(),
      details: `${created.name} (${created.email})`,
      reason,
      previousValue: null,
      newValue: { email: created.email, permissions },
      restorable: false,
    });

    res.status(201).json({
      member: {
        id: created._id.toString(),
        name: created.name,
        email: created.email,
        collegeId: created.collegeId,
        role: created.role,
        permissions: created.permissions,
        isSuspended: created.isSuspended,
        createdAt: created.createdAt,
      },
    });
  } catch (err) {
    console.error('POST /admin/team error:', err);
    res.status(500).json({ error: 'Failed to add team admin.' });
  }
});

router.patch('/admin/team/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Team member not found.' });
      return;
    }

    const parsed = updateTeamAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid team update payload.' });
      return;
    }

    const target = await User.findById(id);
    if (!target) {
      res.status(404).json({ error: 'Team member not found.' });
      return;
    }
    if (target.role === 'super_admin') {
      res.status(403).json({ error: 'The Main Owner / Super Admin account cannot be disabled or downgraded.' });
      return;
    }

    const previousValue = {
      permissions: target.permissions,
      isSuspended: target.isSuspended,
    };

    if (parsed.data.permissions) {
      target.permissions = parsed.data.permissions;
    }
    if (typeof parsed.data.isSuspended === 'boolean') {
      target.isSuspended = parsed.data.isSuspended;
      target.suspensionReason = parsed.data.isSuspended ? parsed.data.reason : '';
    }
    await target.save();

    await writeAuditLog({
      actor: req.user!,
      action: 'updated team admin permissions/status',
      targetType: 'team',
      targetId: target._id.toString(),
      details: `${target.name} (${target.email})`,
      reason: parsed.data.reason,
      previousValue,
      newValue: {
        permissions: target.permissions,
        isSuspended: target.isSuspended,
      },
      restorable: false,
    });

    res.json({
      member: {
        id: target._id.toString(),
        name: target.name,
        email: target.email,
        collegeId: target.collegeId,
        role: target.role,
        permissions: target.permissions,
        isSuspended: target.isSuspended,
      },
    });
  } catch (err) {
    console.error('PATCH /admin/team/:id error:', err);
    res.status(500).json({ error: 'Failed to update team member.' });
  }
});

// 10. Settings & Backup Management (Super Admin for mutations)
router.get('/admin/settings', async (_req, res) => {
  try {
    const settings = await getPlatformSettings();
    res.json({ settings });
  } catch (err) {
    console.error('GET /admin/settings error:', err);
    res.status(500).json({ error: 'Failed to load platform settings.' });
  }
});

router.patch('/admin/settings', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = platformSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid settings payload.' });
      return;
    }

    const { reason, ...updates } = parsed.data;
    const current = await getPlatformSettings();
    const previousValue = {
      siteName: current.siteName,
      campusName: current.campusName,
      campusDomain: current.campusDomain,
      autoVerifyCampusEmail: current.autoVerifyCampusEmail,
      maxActiveRequestsPerStudent: current.maxActiveRequestsPerStudent,
      failedLoginAlertThreshold: current.failedLoginAlertThreshold,
      quantityJumpAlertThreshold: current.quantityJumpAlertThreshold,
      maintenanceBanner: current.maintenanceBanner,
    };

    Object.assign(current, updates, { updatedBy: req.user!._id });
    await current.save();

    await writeAuditLog({
      actor: req.user!,
      action: 'updated platform security settings',
      targetType: 'settings',
      targetId: current._id.toString(),
      details: Object.keys(updates).join(', '),
      reason,
      previousValue,
      newValue: updates,
      restorable: false,
    });

    res.json({ settings: current });
  } catch (err) {
    console.error('PATCH /admin/settings error:', err);
    res.status(500).json({ error: 'Failed to update platform settings.' });
  }
});

router.get('/admin/backups', requireSuperAdmin, async (_req, res) => {
  try {
    const backups = await BackupSnapshot.find()
      .select('label createdByName counts createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      backups: backups.map((b: any) => ({
        id: b._id.toString(),
        label: b.label,
        createdByName: b.createdByName,
        counts: b.counts,
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /admin/backups error:', err);
    res.status(500).json({ error: 'Failed to load backup snapshots.' });
  }
});

router.post('/admin/backups', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const label =
      typeof req.body?.label === 'string' && req.body.label.trim().length >= 3
        ? req.body.label.trim().slice(0, 120)
        : `Manual Backup ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

    const [users, books, requests, messages, transactions, discrepancies, reports, settings, auditLogs] =
      await Promise.all([
        User.find().select('-passwordHash').lean(),
        BookListing.find().lean(),
        BookRequest.find().lean(),
        RequestMessage.find().lean(),
        Transaction.find().lean(),
        Discrepancy.find().lean(),
        Report.find().lean(),
        PlatformSetting.find().lean(),
        AuditLog.find().lean(),
      ]);

    const snapshot = await BackupSnapshot.create({
      label,
      createdBy: req.user!._id,
      createdByName: req.user!.name,
      counts: {
        users: users.length,
        books: books.length,
        requests: requests.length,
        transactions: transactions.length,
        discrepancies: discrepancies.length,
        auditLogs: auditLogs.length,
      },
      payload: {
        users,
        books,
        requests,
        messages,
        transactions,
        discrepancies,
        reports,
        settings,
      },
    });

    await writeAuditLog({
      actor: req.user!,
      action: 'created database backup snapshot',
      targetType: 'backup',
      targetId: snapshot._id.toString(),
      details: `${snapshot.label} (${books.length} books, ${users.length} users)`,
      reason: 'Administrator initiated platform backup',
      restorable: false,
    });

    res.status(201).json({
      backup: {
        id: snapshot._id.toString(),
        label: snapshot.label,
        createdByName: snapshot.createdByName,
        counts: snapshot.counts,
        createdAt: snapshot.createdAt,
      },
    });
  } catch (err) {
    console.error('POST /admin/backups error:', err);
    res.status(500).json({ error: 'Failed to create backup snapshot.' });
  }
});

router.get('/admin/backups/:id/download', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Backup snapshot not found.' });
      return;
    }
    const snapshot = await BackupSnapshot.findById(id).lean();
    if (!snapshot) {
      res.status(404).json({ error: 'Backup snapshot not found.' });
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="bookback-backup-${id}.json"`);
    res.send(JSON.stringify(snapshot, null, 2));
  } catch (err) {
    console.error('GET /admin/backups/:id/download error:', err);
    res.status(500).json({ error: 'Failed to download backup.' });
  }
});

router.post('/admin/backups/:id/restore', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Backup snapshot not found.' });
      return;
    }

    const reason =
      typeof req.body?.reason === 'string' && req.body.reason.trim().length >= 5
        ? req.body.reason.trim()
        : 'Super Admin restored listings and requests from backup snapshot';

    const snapshot = await BackupSnapshot.findById(id).lean();
    if (!snapshot) {
      res.status(404).json({ error: 'Backup snapshot not found.' });
      return;
    }

    const payload = (snapshot as any).payload || {};
    let restoredBooks = 0;
    if (Array.isArray(payload.books)) {
      for (const b of payload.books) {
        if (!b?._id) continue;
        await BookListing.updateOne(
          { _id: b._id },
          {
            $set: {
              title: b.title,
              author: b.author,
              subject: b.subject,
              price: b.price,
              quantity: b.quantity ?? 1,
              availableQuantity: b.availableQuantity ?? 1,
              status: b.status,
              description: b.description,
            },
          },
          { upsert: true },
        );
        restoredBooks += 1;
      }
    }

    await writeAuditLog({
      actor: req.user!,
      action: 'restored database records from backup snapshot',
      targetType: 'backup',
      targetId: id,
      details: `Restored ${restoredBooks} book records from "${(snapshot as any).label}"`,
      reason,
      restorable: false,
    });

    res.json({ message: `Restored ${restoredBooks} book listings from backup snapshot.` });
  } catch (err) {
    console.error('POST /admin/backups/:id/restore error:', err);
    res.status(500).json({ error: 'Failed to restore from backup.' });
  }
});

export default router;
