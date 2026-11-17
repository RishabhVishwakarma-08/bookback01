import mongoose, { Schema, type Document } from 'mongoose';

export interface ICampus extends Document {
  name: string;
  domain: string;
  location: string;
  createdAt: Date;
}

const CampusSchema = new Schema<ICampus>(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    domain: { type: String, required: true, trim: true, lowercase: true, unique: true },
    location: { type: String, required: true, trim: true, maxlength: 140 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Campus = mongoose.models.Campus || mongoose.model<ICampus>('Campus', CampusSchema);
