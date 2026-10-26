import { env } from '../config/env.ts';
import { User } from '../models/User.model.ts';
import { recordActivity } from './activityLogger.ts';

/**
 * Creates the first administrator from SEED_ADMIN_* — only when no admin exists.
 * Returns the email of the admin created, or null when nothing was done.
 */
export async function ensureSeedAdmin(): Promise<string | null> {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) return null;
  if (await User.exists({ role: 'admin' })) return null;

  const now = new Date();
  const admin = new User({
    name: env.SEED_ADMIN_NAME,
    email: env.SEED_ADMIN_EMAIL,
    company: 'Top Flyte Systems',
    role: 'admin',
    status: 'approved',
    access: { requestedAt: now, reviewedAt: now, approvedAt: now, decisionNote: 'Seeded first administrator' },
  });
  await admin.setPassword(env.SEED_ADMIN_PASSWORD);
  await admin.save();

  await recordActivity({ user: admin._id, action: 'user_added', email: admin.email, metadata: { source: 'seed' } });
  return admin.email;
}
