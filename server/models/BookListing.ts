import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBookListing extends Document {
  ownerId: Types.ObjectId;
  campusId: Types.ObjectId;
  title: string;
  author: string;
  subject: string;
  course: string;
  isbn: string;
  edition: string;
  branch: string;
  semester: number;
  condition: 'New' | 'Like New' | 'Good' | 'Fair';
  offerType: 'sell' | 'lend' | 'donate' | 'exchange';
  price: number;
  deposit: number;
  loanDurationDays: number;
  quantity: number;
  availableQuantity: number;
  viewsCount: number;
  requestCount: number;
  description: string;
  images: string[];
  status: 'available' | 'reserved' | 'completed' | 'deactivated';
  createdAt: Date;
  updatedAt: Date;
}

const BookListingSchema = new Schema<IBookListing>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    author: { type: String, required: true, trim: true, maxlength: 120 },
    subject: { type: String, required: true, trim: true, maxlength: 100 },
    course: { type: String, trim: true, default: '', maxlength: 100 },
    isbn: { type: String, trim: true, default: '', maxlength: 32 },
    edition: { type: String, trim: true, default: '', maxlength: 40 },
    branch: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    condition: { type: String, enum: ['New', 'Like New', 'Good', 'Fair'], required: true },
    offerType: { type: String, enum: ['sell', 'lend', 'donate', 'exchange'], required: true },
    price: { type: Number, default: 0, min: 0 },
    deposit: { type: Number, default: 0, min: 0 },
    loanDurationDays: { type: Number, default: 30, min: 1, max: 365 },
    quantity: { type: Number, default: 1, min: 0, max: 500 },
    availableQuantity: { type: Number, default: 1, min: 0, max: 500 },
    viewsCount: { type: Number, default: 0, min: 0 },
    requestCount: { type: Number, default: 0, min: 0 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    images: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['available', 'reserved', 'completed', 'deactivated'],
      default: 'available',
    },
  },
  { timestamps: true },
);

// Compound indexes for optimized marketplace search, filter, and popularity sorting
BookListingSchema.index({ status: 1, semester: 1, offerType: 1, createdAt: -1 });
BookListingSchema.index({ status: 1, branch: 1, createdAt: -1 });
BookListingSchema.index({ status: 1, requestCount: -1, viewsCount: -1, createdAt: -1 });
BookListingSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
BookListingSchema.index(
  { title: 'text', author: 'text', subject: 'text', course: 'text', isbn: 'text' },
  { weights: { title: 5, subject: 3, author: 3, course: 2, isbn: 1 } },
);

export const BookListing =
  mongoose.models.BookListing || mongoose.model<IBookListing>('BookListing', BookListingSchema);
