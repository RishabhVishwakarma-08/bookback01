import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IReview extends Document {
  transactionId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  revieweeId: Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true, index: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revieweeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 600 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ReviewSchema.index({ transactionId: 1, reviewerId: 1 }, { unique: true });

export const Review = mongoose.models.Review || mongoose.model<IReview>('Review', ReviewSchema);
