import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface INotification extends Document {
  userId: Types.ObjectId;
  type:
    | 'new_request'
    | 'new_message'
    | 'status_change'
    | 'listing_unavailable'
    | 'verification'
    | 'report_update';
  title: string;
  message: string;
  relatedRequestId?: Types.ObjectId;
  relatedListingId?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'new_request',
        'new_message',
        'status_change',
        'listing_unavailable',
        'verification',
        'report_update',
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 400 },
    relatedRequestId: { type: Schema.Types.ObjectId, ref: 'BookRequest' },
    relatedListingId: { type: Schema.Types.ObjectId, ref: 'BookListing' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
