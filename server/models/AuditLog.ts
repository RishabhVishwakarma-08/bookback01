import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IAuditLog extends Document {
  actorId: Types.ObjectId;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: 'user' | 'listing' | 'report' | 'request' | 'discrepancy' | 'team' | 'settings' | 'backup';
  targetId: string;
  details: string;
  reason: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  restorable: boolean;
  restoredAt?: Date;
  restoredBy?: Types.ObjectId;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorName: { type: String, default: 'Administrator', maxlength: 100 },
    actorRole: { type: String, default: 'admin', maxlength: 40 },
    action: { type: String, required: true, trim: true, maxlength: 120 },
    targetType: {
      type: String,
      enum: ['user', 'listing', 'report', 'request', 'discrepancy', 'team', 'settings', 'backup'],
      required: true,
      index: true,
    },
    targetId: { type: String, required: true, index: true },
    details: { type: String, default: '', maxlength: 600 },
    reason: { type: String, default: '', maxlength: 500 },
    previousValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    restorable: { type: Boolean, default: false },
    restoredAt: { type: Date },
    restoredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AuditLogSchema.index({ createdAt: -1 });

// Tamper-resistance guards: prevent deletion of audit history
AuditLogSchema.pre('deleteOne', function () {
  throw new Error('AuditLog records are immutable and cannot be deleted.');
});
AuditLogSchema.pre('deleteMany', function () {
  throw new Error('AuditLog records are immutable and cannot be deleted.');
});
AuditLogSchema.pre('findOneAndDelete', function () {
  throw new Error('AuditLog records are immutable and cannot be deleted.');
});

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
