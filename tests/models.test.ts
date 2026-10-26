import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.ts';
import { ActivityLog } from '../src/models/ActivityLog.model.ts';
import { Project } from '../src/models/Project.model.ts';
import { User } from '../src/models/User.model.ts';
import { recordActivity } from '../src/services/activityLogger.ts';
import { ensureSeedAdmin } from '../src/services/bootstrap.ts';
import { useTestDatabase } from './helpers/db.ts';

useTestDatabase();

const makeUser = (overrides: Record<string, unknown> = {}) =>
  User.create({ name: 'Jane Architect', email: 'Jane@Studio.co.nz', company: 'Studio Ltd', ...overrides });

describe('User model', () => {
  it('defaults to a pending, non-admin account with zeroed stats', async () => {
    const u = await makeUser();
    expect(u.status).toBe('pending');
    expect(u.role).toBe('user');
    expect(u.email).toBe('jane@studio.co.nz');
    expect(u.stats.loginCount).toBe(0);
    expect(u.canUseConfigurator()).toBe(false);
  });

  it('only approved accounts can use the configurator', async () => {
    for (const status of ['pending', 'declined', 'disabled'] as const) {
      expect(new User({ name: 'x', email: `${status}@x.nz`, status }).canUseConfigurator()).toBe(false);
    }
    expect(new User({ name: 'x', email: 'ok@x.nz', status: 'approved' }).canUseConfigurator()).toBe(true);
  });

  it('hashes passwords and never exposes the hash', async () => {
    const u = await makeUser();
    await u.setPassword('correct horse battery');
    await u.save();

    const plain = await User.findById(u._id);
    expect(plain?.passwordHash).toBeUndefined(); // select:false

    const withHash = await User.findById(u._id).select('+passwordHash');
    expect(withHash!.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await withHash!.verifyPassword('correct horse battery')).toBe(true);
    expect(await withHash!.verifyPassword('wrong')).toBe(false);
    expect(JSON.stringify(withHash)).not.toContain('passwordHash');
  });

  it('rejects invalid and duplicate emails (case-insensitive)', async () => {
    await expect(makeUser({ email: 'not-an-email' })).rejects.toThrow(/Invalid email/);
    await makeUser();
    await expect(makeUser({ email: 'JANE@studio.co.nz' })).rejects.toMatchObject({ code: 11000 });
  });

  it('rejects unknown statuses and roles', async () => {
    await expect(makeUser({ status: 'banned' })).rejects.toThrow();
    await expect(makeUser({ role: 'superuser' })).rejects.toThrow();
  });
});

describe('Project model', () => {
  it('stores a job with multiple stairs and their engine version', async () => {
    const owner = await makeUser({ status: 'approved' });
    const p = await Project.create({
      owner: owner._id,
      name: 'Smith residence',
      reference: 'TF-1042',
      purpose: 'Consent drawings',
      architect: { name: 'Jane Architect', company: 'Studio Ltd' },
      stairs: [
        { label: 'Main stair', input: { layout: 'straight', totalRiseMm: 2700 }, engineVersion: '0.1.0', result: { overall: 'pass', failCount: 0, warnCount: 1 } },
        { label: 'Garage stair', input: { layout: 'straight', totalRiseMm: 1200 }, engineVersion: '0.1.0' },
      ],
    });
    expect(p.stairs).toHaveLength(2);
    expect(p.stairs[0].result?.overall).toBe('pass');
    expect(p.client).toBeDefined();
  });

  it('requires an owner and a name', async () => {
    await expect(Project.create({ name: 'x' })).rejects.toThrow(/owner/);
    const owner = await makeUser();
    await expect(Project.create({ owner: owner._id })).rejects.toThrow(/name/);
  });
});

describe('Activity log', () => {
  it('records a login and updates the user counters', async () => {
    const u = await makeUser({ status: 'approved' });
    await recordActivity({ user: u._id, action: 'login', ip: '127.0.0.1' });
    await recordActivity({ user: u._id, action: 'login' });
    await recordActivity({ user: u._id, action: 'configurator_opened' });

    const fresh = await User.findById(u._id);
    expect(fresh!.stats.loginCount).toBe(2);
    expect(fresh!.stats.configuratorUseCount).toBe(1);
    expect(fresh!.stats.lastLoginAt).toBeInstanceOf(Date);
    expect(await ActivityLog.countDocuments({ user: u._id })).toBe(3);
  });

  it('accepts a failed login for an unknown email', async () => {
    const entry = await recordActivity({ action: 'login_failed', email: 'who@x.nz' });
    expect(entry.user).toBeUndefined();
  });

  it('rejects actions that are not in the catalogue', async () => {
    // @ts-expect-error — deliberately invalid action
    await expect(recordActivity({ action: 'signup' })).rejects.toThrow();
  });

  it('is append-only: updates are refused', async () => {
    const u = await makeUser();
    const entry = await recordActivity({ user: u._id, action: 'access_requested' });
    await expect(ActivityLog.updateOne({ _id: entry._id }, { action: 'access_approved' })).rejects.toThrow(/append-only/);
    await expect(ActivityLog.findOneAndUpdate({ _id: entry._id }, { ip: 'x' })).rejects.toThrow(/append-only/);
  });
});

describe('ensureSeedAdmin', () => {
  it('creates the first admin once, then does nothing', async () => {
    Object.assign(env, { SEED_ADMIN_EMAIL: 'admin@topflyte.co.nz', SEED_ADMIN_PASSWORD: 'a-long-enough-password' });
    try {
      expect(await ensureSeedAdmin()).toBe('admin@topflyte.co.nz');
      expect(await ensureSeedAdmin()).toBeNull();

      const admin = await User.findOne({ role: 'admin' }).select('+passwordHash');
      expect(admin!.status).toBe('approved');
      expect(await admin!.verifyPassword('a-long-enough-password')).toBe(true);
      expect(await ActivityLog.countDocuments({ action: 'user_added' })).toBe(1);
    } finally {
      Object.assign(env, { SEED_ADMIN_EMAIL: undefined, SEED_ADMIN_PASSWORD: undefined });
    }
  });
});
