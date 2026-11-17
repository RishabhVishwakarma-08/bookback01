import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type UserRole = 'student' | 'team_admin' | 'super_admin' | 'admin';

export const TEAM_PERMISSIONS = [
  'manage_books',
  'manage_requests',
  'investigate_discrepancies',
  'verify_users',
  'view_reports',
] as const;

export type TeamPermission = (typeof TEAM_PERMISSIONS)[number];

export interface IUser extends Document {
  name: string;
  email: string;
  collegeId: string;
  branch: string;
  year: string;
  semester: number;
  campusId: Types.ObjectId;
  passwordHash: string;
  role: UserRole;
  permissions: TeamPermission[];
  verified: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
  failedLoginAttempts: number;
  lastFailedLoginAt?: Date;
  themePreference: 'light' | 'dark' | 'system';
  createdByAdminId?: Types.ObjectId;
  bio: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    collegeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    branch: { type: String, required: true, trim: true },
    year: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', required: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['student', 'team_admin', 'super_admin', 'admin'],
      default: 'student',
      index: true,
    },
    permissions: {
      type: [String],
      enum: TEAM_PERMISSIONS,
      default: [],
    },
    verified: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
    suspensionReason: { type: String, default: '', maxlength: 300 },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lastFailedLoginAt: { type: Date },
    themePreference: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    createdByAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
    bio: { type: String, default: '', maxlength: 400 },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

UserSchema.index({ role: 1, verified: 1 });

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
