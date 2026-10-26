import type { mongo } from 'mongoose';

export type Db = mongo.Db;

/**
 * One versioned database change.
 *
 * Rules:
 * - Never edit a migration that has run anywhere — add a new one instead.
 * - Use literal collection/field names, not model imports: a migration is a snapshot
 *   of the schema at the time it was written, and models keep changing.
 * - Make `up` safe to re-run (createIndexes / $set are idempotent).
 */
export interface Migration {
  /** `NNNN-kebab-name`, matching the file name. Run order = order in MIGRATIONS. */
  id: string;
  description: string;
  up(db: Db): Promise<void>;
  down(db: Db): Promise<void>;
}

/** Drops an index, ignoring "index not found" so `down` can be re-run. */
export async function dropIndexIfExists(db: Db, collection: string, name: string): Promise<void> {
  try {
    await db.collection(collection).dropIndex(name);
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 27 && code !== 26) throw err; // 27 IndexNotFound, 26 NamespaceNotFound
  }
}
