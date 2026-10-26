import type { HydratedDocument, Types } from 'mongoose';
import { ActivityLog, type ActivityAction, type IActivityLog } from '../models/ActivityLog.model.ts';
import { User } from '../models/User.model.ts';

export interface ActivityInput {
  user?: Types.ObjectId | string;
  actor?: Types.ObjectId | string;
  action: ActivityAction;
  project?: Types.ObjectId | string;
  email?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

// Per-user counters shown in the admin panel. Kept on the User document so they
// survive any future activity-log retention policy.
const STAT_COUNTERS: Partial<Record<ActivityAction, 'loginCount' | 'configuratorUseCount' | 'projectCount'>> = {
  login: 'loginCount',
  configurator_opened: 'configuratorUseCount',
  project_created: 'projectCount',
};

/** Writes an activity entry and updates the user's counters. Awaitable; throws on failure. */
export async function recordActivity(input: ActivityInput): Promise<HydratedDocument<IActivityLog>> {
  const entry = await ActivityLog.create(input);

  if (input.user && input.action !== 'login_failed') {
    const now = entry.createdAt;
    const counter = STAT_COUNTERS[input.action];
    await User.updateOne(
      { _id: input.user },
      {
        $set: {
          'stats.lastActivityAt': now,
          ...(input.action === 'login' ? { 'stats.lastLoginAt': now } : {}),
        },
        ...(counter ? { $inc: { [`stats.${counter}`]: 1 } } : {}),
      },
    );
  }
  return entry;
}

/** Fire-and-forget variant for request handlers — logging must never fail a user action. */
export function logActivity(input: ActivityInput): void {
  recordActivity(input).catch((err: unknown) => {
    console.error(`[activity] failed to log "${input.action}":`, err);
  });
}
