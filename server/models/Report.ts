import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IReport extends Document {
  reporterId: Types.ObjectId;
  listingId?: Types.ObjectId;
  reportedUserId?: Types.ObjectId;
  reason: string;
  details: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  adminNote: string;
  createdAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'BookListing' },
    reportedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, required: true, trim: true, maxlength: 100 },
    details: { type: String, required: true, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ['open', 'reviewing', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    adminNote: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

export const Report = mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);
