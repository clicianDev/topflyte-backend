import { Schema, model, type Types } from 'mongoose';
import { ACTIVITY_ACTIONS, type ActivityAction } from '../contracts/api.ts';

export type { ActivityAction };

// Append-only audit trail feeding the admin activity view.
// Actions are listed in contracts/api.ts — add a new one there before logging it.

export interface IActivityLog {
  user?: Types.ObjectId; // subject of the event (absent for login_failed on an unknown email)
  actor?: Types.ObjectId; // who performed it, when different from `user` (e.g. the approving admin)
  action: ActivityAction;
  project?: Types.ObjectId;
  email?: string; // snapshot, so the log stays readable after a user is removed
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project' },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 400 },
  },
  { collection: 'activitylogs', timestamps: { createdAt: true, updatedAt: false } },
);

activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ project: 1 }, { sparse: true });

// Audit integrity: entries can be created and (for retention/privacy) deleted,
// but never edited.
activityLogSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'],
  function () {
    throw new Error('ActivityLog entries are append-only');
  },
);
activityLogSchema.pre('save', function () {
  if (!this.isNew) throw new Error('ActivityLog entries are append-only');
});

export const ActivityLog = model<IActivityLog>('ActivityLog', activityLogSchema);
