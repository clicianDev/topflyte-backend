import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { migrateUp } from '../../src/services/migrator.ts';

const KEEP = new Set(['migrations', 'migrations_lock']);

/**
 * Gives the calling test file a throwaway MongoDB, built by the real migrations
 * (so every suite also exercises them), with documents cleared after each test.
 */
export function useTestDatabase(): void {
  let server: MongoMemoryServer;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri('topflyte-test'), { autoIndex: false });
    await migrateUp(mongoose.connection.db!);
  });

  afterEach(async () => {
    const collections = Object.values(mongoose.connection.collections).filter((c) => !KEEP.has(c.collectionName));
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await server.stop();
  });
}
