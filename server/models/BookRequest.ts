import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBookRequest extends Document {
  listingId: Types.ObjectId;
  ownerId: Types.ObjectId;
  requesterId: Types.ObjectId;
  offerType: 'sell' | 'lend' | 'donate' | 'exchange';
  initialMessage: string;
  pickupLocation: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const BookRequestSchema = new Schema<IBookRequest>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'BookListing', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    offerType: { type: String, enum: ['sell', 'lend', 'donate', 'exchange'], required: true },
    initialMessage: { type: String, required: true, trim: true, maxlength: 1000 },
    pickupLocation: { type: String, trim: true, default: 'Main Campus Library Desk', maxlength: 140 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

BookRequestSchema.index({ ownerId: 1, status: 1, updatedAt: -1 });
BookRequestSchema.index({ requesterId: 1, status: 1, updatedAt: -1 });
BookRequestSchema.index(
  { listingId: 1, requesterId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'accepted'] } },
  },
);

export const BookRequest =
  mongoose.models.BookRequest || mongoose.model<IBookRequest>('BookRequest', BookRequestSchema);
