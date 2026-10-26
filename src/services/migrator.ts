import { hostname } from 'node:os';
import { MIGRATIONS } from '../migrations/index.ts';
import type { Db, Migration } from '../migrations/types.ts';

/**
 * Runs the versioned migrations in src/migrations against a database.
 * Applied migrations are recorded in the `migrations` collection; a document in
 * `migrations_lock` stops two processes migrating at once.
 */

const RECORDS = 'migrations';
const LOCKS = 'migrations_lock';
const STALE_LOCK_MS = 10 * 60 * 1000;

interface MigrationRecord {
  _id: string;
  description: string;
  appliedAt: Date;
}

interface LockRecord {
  _id: 'lock';
  lockedAt: Date;
  owner: string;
}

export interface MigrationState {
  id: string;
  description: string;
  appliedAt?: Date;
}

export interface MigrationStatus {
  migrations: MigrationState[];
  /** Applied in the database but missing from this code (e.g. code was rolled back). */
  unknown: string[];
}

export async function migrationStatus(db: Db, migrations: readonly Migration[] = MIGRATIONS): Promise<MigrationStatus> {
  const records = await db.collection<MigrationRecord>(RECORDS).find().toArray();
  const appliedAt = new Map(records.map((r) => [r._id, r.appliedAt]));
  const known = new Set(migrations.map((m) => m.id));
  return {
    migrations: migrations.map((m) => ({ id: m.id, description: m.description, appliedAt: appliedAt.get(m.id) })),
    unknown: records.map((r) => r._id).filter((id) => !known.has(id)),
  };
}

/** Applies every pending migration in order. Returns the ids applied. */
export async function migrateUp(db: Db, migrations: readonly Migration[] = MIGRATIONS): Promise<string[]> {
  return withLock(db, async () => {
    const status = await migrationStatus(db, migrations);
    if (status.unknown.length) {
      throw new Error(
        `The database has migrations this code does not know (${status.unknown.join(', ')}). ` +
          'Deploy the newer code, or roll those migrations back with that code first.',
      );
    }
    const applied: string[] = [];
    for (const [i, m] of migrations.entries()) {
      if (status.migrations[i].appliedAt) continue;
      await m.up(db);
      await db.collection<MigrationRecord>(RECORDS).insertOne({ _id: m.id, description: m.description, appliedAt: new Date() });
      applied.push(m.id);
    }
    return applied;
  });
}

/** Reverts the most recently applied `steps` migrations. Returns the ids reverted. */
export async function migrateDown(db: Db, steps = 1, migrations: readonly Migration[] = MIGRATIONS): Promise<string[]> {
  return withLock(db, async () => {
    const status = await migrationStatus(db, migrations);
    const toRevert = migrations.filter((_, i) => status.migrations[i].appliedAt).reverse().slice(0, steps);
    const reverted: string[] = [];
    for (const m of toRevert) {
      await m.down(db);
      await db.collection<MigrationRecord>(RECORDS).deleteOne({ _id: m.id });
      reverted.push(m.id);
    }
    return reverted;
  });
}

async function withLock<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  const locks = db.collection<LockRecord>(LOCKS);
  // A crashed run can leave its lock behind; take it over once it is clearly stale.
  await locks.deleteOne({ _id: 'lock', lockedAt: { $lt: new Date(Date.now() - STALE_LOCK_MS) } });
  try {
    await locks.insertOne({ _id: 'lock', lockedAt: new Date(), owner: `${hostname()}:${process.pid}` });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const held = await locks.findOne({ _id: 'lock' });
      throw new Error(`Another migration run holds the lock (${held?.owner ?? 'unknown'}, since ${held?.lockedAt?.toISOString()}).`);
    }
    throw err;
  }
  try {
    return await fn();
  } finally {
    await locks.deleteOne({ _id: 'lock' });
  }
}
