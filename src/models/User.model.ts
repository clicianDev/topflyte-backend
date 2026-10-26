import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from '../contracts/api.ts';

/*
 * Account lifecycle (request-access model) — statuses are defined in contracts/api.ts:
 *   pending  → user has requested access, awaiting a Top Flyte admin
 *   approved → may log in and use the configurator
 *   declined → request was turned down (may be approved later)
 *   disabled → previously approved, access switched off (re-enable → approved)
 * Only `approved` accounts can use the configurator. This is enforced server-side.
 */

const BCRYPT_COST = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface IUser {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  passwordHash?: string;
  access: {
    requestedAt?: Date;
    requestMessage?: string; // "What will you use the configurator for?"
    reviewedAt?: Date;
    reviewedBy?: Types.ObjectId;
    approvedAt?: Date;
    decisionNote?: string;
  };
  stats: {
    loginCount: number;
    configuratorUseCount: number;
    projectCount: number;
    lastLoginAt?: Date;
    lastActivityAt?: Date;
  };
  // Incremented to invalidate every existing session (logout-all, disable).
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  setPassword(plain: string): Promise<void>;
  verifyPassword(plain: string): Promise<boolean>;
  canUseConfigurator(): boolean;
}

export type UserModel = Model<IUser, object, IUserMethods>;
export type UserDocument = HydratedDocument<IUser, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [EMAIL_RE, 'Invalid email address'],
    },
    company: { type: String, trim: true, maxlength: 150 },
    phone: { type: String, trim: true, maxlength: 40 },
    role: { type: String, enum: USER_ROLES, default: 'user' },
    status: { type: String, enum: USER_STATUSES, default: 'pending', index: true },
    passwordHash: { type: String, select: false },
    access: {
      requestedAt: Date,
      requestMessage: { type: String, trim: true, maxlength: 1000 },
      reviewedAt: Date,
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
      decisionNote: { type: String, trim: true, maxlength: 1000 },
    },
    stats: {
      loginCount: { type: Number, default: 0, min: 0 },
      configuratorUseCount: { type: Number, default: 0, min: 0 },
      projectCount: { type: Number, default: 0, min: 0 },
      lastLoginAt: Date,
      lastActivityAt: { type: Date, index: true },
    },
    sessionVersion: { type: Number, default: 0 },
  },
  {
    collection: 'users',
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.sessionVersion;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.methods.setPassword = async function (plain: string) {
  this.passwordHash = await bcrypt.hash(plain, BCRYPT_COST);
};

// passwordHash is select:false — load it with `.select('+passwordHash')` before calling this.
userSchema.methods.verifyPassword = async function (plain: string) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.canUseConfigurator = function () {
  return this.status === 'approved';
};

export const User = model<IUser, UserModel>('User', userSchema);
