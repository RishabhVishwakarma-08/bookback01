import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type DiscrepancyType =
  | 'quantity_anomaly'
  | 'duplicate_listing'
  | 'suspicious_request'
  | 'availability_mismatch'
  | 'unauthorized_modification'
  | 'repeated_failed_login';

export type DiscrepancySeverity = 'low' | 'medium' | 'high' | 'critical';
export type DiscrepancyStatus = 'open' | 'investigating' | 'resolved' | 'false_positive';

export interface IDiscrepancyNote {
  adminId: Types.ObjectId;
  adminName: string;
  note: string;
  createdAt: Date;
}

export interface IDiscrepancy extends Document {
  issueId: string;
  type: DiscrepancyType;
  severity: DiscrepancySeverity;
  description: string;
  relatedModel: 'BookListing' | 'BookRequest' | 'User' | 'Transaction';
  relatedRecordId: string;
  relatedUserId?: Types.ObjectId;
  assignedAdminId?: Types.ObjectId;
  status: DiscrepancyStatus;
  investigationNotes: IDiscrepancyNote[];
  resolutionSummary: string;
  autoDetected: boolean;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DiscrepancyNoteSchema = new Schema<IDiscrepancyNote>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    adminName: { type: String, required: true, maxlength: 100 },
    note: { type: String, required: true, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const DiscrepancySchema = new Schema<IDiscrepancy>(
  {
    issueId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: [
        'quantity_anomaly',
        'duplicate_listing',
        'suspicious_request',
        'availability_mismatch',
        'unauthorized_modification',
        'repeated_failed_login',
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    relatedModel: {
      type: String,
      enum: ['BookListing', 'BookRequest', 'User', 'Transaction'],
      required: true,
    },
    relatedRecordId: { type: String, required: true, index: true },
    relatedUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    assignedAdminId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'false_positive'],
      default: 'open',
      index: true,
    },
    investigationNotes: { type: [DiscrepancyNoteSchema], default: [] },
    resolutionSummary: { type: String, default: '', maxlength: 600 },
    autoDetected: { type: Boolean, default: true },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

DiscrepancySchema.index({ status: 1, severity: -1, createdAt: -1 });

export const Discrepancy =
  mongoose.models.Discrepancy || mongoose.model<IDiscrepancy>('Discrepancy', DiscrepancySchema);
