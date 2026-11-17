import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBackupSnapshot extends Document {
  label: string;
  createdBy: Types.ObjectId;
  createdByName: string;
  counts: {
    users: number;
    books: number;
    requests: number;
    transactions: number;
    discrepancies: number;
    auditLogs: number;
  };
  payload: Record<string, unknown[]>;
  createdAt: Date;
}

const BackupSnapshotSchema = new Schema<IBackupSnapshot>(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true, maxlength: 100 },
    counts: {
      users: { type: Number, default: 0 },
      books: { type: Number, default: 0 },
      requests: { type: Number, default: 0 },
      transactions: { type: Number, default: 0 },
      discrepancies: { type: Number, default: 0 },
      auditLogs: { type: Number, default: 0 },
    },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

BackupSnapshotSchema.index({ createdAt: -1 });

export const BackupSnapshot =
  mongoose.models.BackupSnapshot ||
  mongoose.model<IBackupSnapshot>('BackupSnapshot', BackupSnapshotSchema);
