import mongoose from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';
import { MIGRATIONS } from '../src/migrations/index.ts';
import type { Migration } from '../src/migrations/types.ts';
import { ActivityLog } from '../src/models/ActivityLog.model.ts';
import { Project } from '../src/models/Project.model.ts';
import { User } from '../src/models/User.model.ts';
import { migrateDown, migrateUp, migrationStatus } from '../src/services/migrator.ts';
import { useTestDatabase } from './helpers/db.ts';

useTestDatabase(); // connects and runs every migration once

const db = () => mongoose.connection.db!;
const indexNames = async (collection: string) => (await db().collection(collection).indexes()).map((i) => i.name);

describe('migration registry', () => {
  it('has unique, ordered NNNN-kebab-case ids', () => {
    const ids = MIGRATIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [i, id] of ids.entries()) {
      expect(id).toMatch(/^\d{4}-[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(Number(id.slice(0, 4))).toBe(i + 1);
    }
  });
});

describe('schema ↔ migration drift', () => {
  // If this fails, a schema index changed without a migration (or vice versa):
  // add a new migration that creates/drops the index.
  it.each([
    ['User', User],
    ['Project', Project],
    ['ActivityLog', ActivityLog],
  ] as const)('%s indexes match the migrations', async (_name, model) => {
    const diff = await model.diffIndexes();
    expect(diff.toCreate).toEqual([]);
    expect(diff.toDrop).toEqual([]);
  });
});

describe('migrator', () => {
  beforeEach(async () => {
    // Bring the shared database back to "all applied" whatever the previous test did.
    await migrateUp(db());
  });

  it('records every migration as applied and is idempotent', async () => {
    const status = await migrationStatus(db());
    expect(status.migrations.every((m) => m.appliedAt instanceof Date)).toBe(true);
    expect(status.unknown).toEqual([]);
    expect(await migrateUp(db())).toEqual([]);
  });

  it('reverts the last migration and re-applies it', async () => {
    expect(await indexNames('users')).toContain('email_1');

    expect(await migrateDown(db())).toEqual(['0001-initial-indexes']);
    expect(await indexNames('users')).not.toContain('email_1');
    expect((await migrationStatus(db())).migrations[0].appliedAt).toBeUndefined();

    expect(await migrateUp(db())).toEqual(['0001-initial-indexes']);
    expect(await indexNames('users')).toContain('email_1');
  });

  it('runs pending migrations in order', async () => {
    const calls: string[] = [];
    const fake = (id: string): Migration => ({
      id,
      description: id,
      up: async () => void calls.push(`up:${id}`),
      down: async () => void calls.push(`down:${id}`),
    });
    const list = [...MIGRATIONS, fake('9001-a'), fake('9002-b')];

    expect(await migrateUp(db(), list)).toEqual(['9001-a', '9002-b']);
    expect(await migrateDown(db(), 2, list)).toEqual(['9002-b', '9001-a']);
    expect(calls).toEqual(['up:9001-a', 'up:9002-b', 'down:9002-b', 'down:9001-a']);
  });

  it('refuses to migrate a database that has migrations this code does not know', async () => {
    await db().collection('migrations').insertOne({ _id: '9999-from-the-future' as never, description: 'x', appliedAt: new Date() });
    try {
      expect((await migrationStatus(db())).unknown).toEqual(['9999-from-the-future']);
      await expect(migrateUp(db())).rejects.toThrow(/does not know \(9999-from-the-future\)/);
    } finally {
      await db().collection('migrations').deleteOne({ _id: '9999-from-the-future' as never });
    }
  });

  it('refuses to run while another process holds the lock, but takes over a stale one', async () => {
    const locks = db().collection('migrations_lock');
    await locks.insertOne({ _id: 'lock' as never, lockedAt: new Date(), owner: 'other-host:42' });
    await expect(migrateUp(db())).rejects.toThrow(/holds the lock \(other-host:42/);

    await locks.updateOne({ _id: 'lock' as never }, { $set: { lockedAt: new Date(Date.now() - 60 * 60 * 1000) } });
    await expect(migrateUp(db())).resolves.toEqual([]);
    expect(await locks.countDocuments()).toBe(0);
  });
});
