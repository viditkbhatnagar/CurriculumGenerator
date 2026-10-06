/**
 * Secrets the server generates for itself and keeps, so that none has to live in the code.
 *
 * The JWT signing secret fell back to a constant committed in passwordAuthService when
 * JWT_SECRET was unset, so anyone who had seen the repository could sign a login token for any
 * user. Without JWT_SECRET the server now generates a random secret once and stores it here.
 */
import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemSecret extends Document {
  name: string;
  value: string;
  createdAt: Date;
}

const SystemSecretSchema = new Schema<ISystemSecret>(
  {
    name: { type: String, required: true, unique: true },
    value: { type: String, required: true, select: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const SystemSecret = mongoose.model<ISystemSecret>('SystemSecret', SystemSecretSchema);
