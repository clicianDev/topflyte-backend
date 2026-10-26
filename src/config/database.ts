import { mkdir } from 'node:fs/promises';
import mongoose from 'mongoose';
import { env } from './env.ts';

type EmbeddedServer = { stop(): Promise<boolean> };
let embedded: EmbeddedServer | null = null;

export type DbMode = 'uri' | 'embedded' | 'embedded-shared';

/**
 * Connects Mongoose.
 *
 * - MONGODB_URI set → connect to it (Top-Flyte-owned Atlas / self-hosted MongoDB).
 * - MONGODB_URI unset (development only) → use the embedded MongoDB on DEV_DB_PORT,
 *   with data kept in DEV_DB_PATH. If another process (e.g. the dev server) already
 *   started it, connect to that one ('embedded-shared'); otherwise start it ('embedded').
 *   The first start downloads a MongoDB binary (~100 MB) into ~/.cache/mongodb-binaries.
 *
 * Indexes come from migrations (src/migrations), so Mongoose's autoIndex is off.
 */
export async function connectDB(): Promise<{ mode: DbMode; dbName: string }> {
  let uri = env.MONGODB_URI;
  let mode: DbMode = 'uri';

  if (!uri) {
    if (env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI is required in production');
    }
    uri = `mongodb://127.0.0.1:${env.DEV_DB_PORT}/topflyte`;
    if (await isReachable(uri)) {
      mode = 'embedded-shared';
    } else {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      await mkdir(env.DEV_DB_PATH, { recursive: true });
      embedded = await MongoMemoryServer.create({
        instance: { port: env.DEV_DB_PORT, dbPath: env.DEV_DB_PATH, storageEngine: 'wiredTiger' },
      });
      mode = 'embedded';
    }
  }

  await mongoose.connect(uri, { autoIndex: false });
  return { mode, dbName: mongoose.connection.name };
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (embedded) {
    await embedded.stop();
    embedded = null;
  }
}

export function dbState(): 'connected' | 'disconnected' {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}

/** The native driver handle, for migrations. Only valid after connectDB(). */
export function nativeDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database is not connected');
  return db;
}

async function isReachable(uri: string): Promise<boolean> {
  const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 800 });
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.close().catch(() => {});
  }
}
