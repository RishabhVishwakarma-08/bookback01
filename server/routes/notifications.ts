import { Router } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/notifications', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user!._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = notifications.filter((n: any) => !n.isRead).length;

    res.json({
      unreadCount,
      notifications: notifications.map((n: any) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        message: n.message,
        relatedRequestId: n.relatedRequestId?.toString(),
        relatedListingId: n.relatedListingId?.toString(),
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /notifications error:', err);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.patch('/notifications/read-all', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user!._id, isRead: false },
      { $set: { isRead: true } },
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('PATCH /notifications/read-all error:', err);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

router.patch('/notifications/:id/read', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }

    const updated = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user!._id },
      { $set: { isRead: true } },
      { new: true },
    ).lean();

    if (!updated) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }

    res.json({
      notification: {
        id: (updated as any)._id.toString(),
        isRead: updated.isRead,
      },
    });
  } catch (err) {
    console.error('PATCH /notifications/:id/read error:', err);
    res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

export default router;
