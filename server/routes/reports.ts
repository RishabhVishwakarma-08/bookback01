import { Router } from 'express';
import mongoose from 'mongoose';
import { Report } from '../models/Report.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js';
import { createReportSchema } from '../utils/validators.js';

const router = Router();

router.post('/reports', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid report details.' });
      return;
    }

    const { listingId, reportedUserId, reason, details } = parsed.data;
    if (!listingId && !reportedUserId) {
      res.status(400).json({ error: 'Please specify a listing or user to report.' });
      return;
    }

    if (listingId && !mongoose.isValidObjectId(listingId)) {
      res.status(400).json({ error: 'Invalid listing ID.' });
      return;
    }
    if (reportedUserId && !mongoose.isValidObjectId(reportedUserId)) {
      res.status(400).json({ error: 'Invalid reported user ID.' });
      return;
    }

    const report = await Report.create({
      reporterId: req.user!._id,
      listingId: listingId || undefined,
      reportedUserId: reportedUserId || undefined,
      reason,
      details,
      status: 'open',
    });

    res.status(201).json({
      report: {
        id: report._id.toString(),
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (err) {
    console.error('POST /reports error:', err);
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

export default router;
