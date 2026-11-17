import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IPlatformSetting extends Document {
  key: string;
  siteName: string;
  campusName: string;
  campusDomain: string;
  autoVerifyCampusEmail: boolean;
  maxActiveRequestsPerStudent: number;
  failedLoginAlertThreshold: number;
  quantityJumpAlertThreshold: number;
  maintenanceBanner: string;
  updatedBy?: Types.ObjectId;
  updatedAt: Date;
}

const PlatformSettingSchema = new Schema<IPlatformSetting>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    siteName: { type: String, default: 'BookBack', maxlength: 60 },
    campusName: { type: String, default: 'MITS Gwalior', maxlength: 120 },
    campusDomain: { type: String, default: 'mitsgwalior.in', maxlength: 100 },
    autoVerifyCampusEmail: { type: Boolean, default: true },
    maxActiveRequestsPerStudent: { type: Number, default: 5, min: 1, max: 50 },
    failedLoginAlertThreshold: { type: Number, default: 5, min: 3, max: 20 },
    quantityJumpAlertThreshold: { type: Number, default: 5, min: 2, max: 100 },
    maintenanceBanner: { type: String, default: '', maxlength: 240 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const PlatformSetting =
  mongoose.models.PlatformSetting ||
  mongoose.model<IPlatformSetting>('PlatformSetting', PlatformSettingSchema);
