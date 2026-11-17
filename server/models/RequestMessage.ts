import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IRequestMessage extends Document {
  requestId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  createdAt: Date;
}

const RequestMessageSchema = new Schema<IRequestMessage>(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'BookRequest', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 1500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

RequestMessageSchema.index({ requestId: 1, createdAt: 1 });

export const RequestMessage =
  mongoose.models.RequestMessage ||
  mongoose.model<IRequestMessage>('RequestMessage', RequestMessageSchema);
