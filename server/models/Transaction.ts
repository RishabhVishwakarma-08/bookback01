import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ITransaction extends Document {
  requestId: Types.ObjectId;
  listingId: Types.ObjectId;
  ownerId: Types.ObjectId;
  requesterId: Types.ObjectId;
  offerType: 'sell' | 'lend' | 'donate' | 'exchange';
  agreedPrice: number;
  startDate: Date;
  dueDate?: Date;
  completedAt?: Date;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'BookRequest', required: true, unique: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'BookListing', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    offerType: { type: String, enum: ['sell', 'lend', 'donate', 'exchange'], required: true },
    agreedPrice: { type: Number, default: 0, min: 0 },
    startDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    completedAt: { type: Date },
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active', index: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

export const Transaction =
  mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);
