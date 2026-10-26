import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.ts';
import { ActivityLog } from '../src/models/ActivityLog.model.ts';
import { Project } from '../src/models/Project.model.ts';
import { User } from '../src/models/User.model.ts';
import { DEMO_PASSWORD, seedDemoData } from '../src/services/demoSeed.ts';
import { useTestDatabase } from './helpers/db.ts';

useTestDatabase();

describe('seedDemoData', () => {
  it('creates one user per access state, a project, and consistent activity', async () => {
    expect(await seedDemoData()).toEqual({ created: true, users: 4, projects: 1 });

    const users = await User.find().sort({ email: 1 });
    expect(users.map((u) => [u.email, u.status])).toEqual([
      ['aroha@demo.topflyte.test', 'approved'],
      ['ben@demo.topflyte.test', 'pending'],
      ['priya@demo.topflyte.test', 'disabled'],
      ['sam@demo.topflyte.test', 'declined'],
    ]);

    const aroha = (await User.findOne({ email: 'aroha@demo.topflyte.test' }).select('+passwordHash'))!;
    expect(await aroha.verifyPassword(DEMO_PASSWORD)).toBe(true);
    expect(aroha.stats).toMatchObject({ loginCount: 2, configuratorUseCount: 2, projectCount: 1 });

    const pending = (await User.findOne({ status: 'pending' }).select('+passwordHash'))!;
    expect(pending.passwordHash).toBeUndefined(); // no login until approved

    const project = (await Project.findOne())!;
    expect(project.owner.toString()).toBe(aroha._id.toString());
    expect(project.stairs.map((s) => s.result?.overall)).toEqual(['pass', 'fail']);

    expect(await ActivityLog.countDocuments({ action: 'access_requested' })).toBe(4);
    expect(await ActivityLog.countDocuments({ action: 'access_declined' })).toBe(1);
  });

  it('is idempotent', async () => {
    await seedDemoData();
    expect(await seedDemoData()).toEqual({ created: false, users: 0, projects: 0 });
    expect(await User.countDocuments()).toBe(4);
  });

  it('refuses to run in production', async () => {
    Object.assign(env, { NODE_ENV: 'production' });
    try {
      await expect(seedDemoData()).rejects.toThrow(/development and testing only/);
    } finally {
      Object.assign(env, { NODE_ENV: 'test' });
    }
  });
});
