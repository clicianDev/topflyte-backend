import { createApp } from './app.ts';
import { connectDB, disconnectDB, nativeDb } from './config/database.ts';
import { env, migrateOnBoot } from './config/env.ts';
import { ensureSeedAdmin } from './services/bootstrap.ts';
import { migrateUp, migrationStatus } from './services/migrator.ts';

const DB_MODE_LABEL = {
  uri: 'MONGODB_URI',
  embedded: `embedded dev MongoDB on :${env.DEV_DB_PORT}, ${env.DEV_DB_PATH}`,
  'embedded-shared': `existing embedded dev MongoDB on :${env.DEV_DB_PORT}`,
} as const;

async function main() {
  const db = await connectDB();
  console.log(`[db] connected (${DB_MODE_LABEL[db.mode]}) → ${db.dbName}`);

  if (migrateOnBoot) {
    const applied = await migrateUp(nativeDb());
    console.log(applied.length ? `[migrate] applied ${applied.join(', ')}` : '[migrate] database is up to date');
  } else {
    const pending = (await migrationStatus(nativeDb())).migrations.filter((m) => !m.appliedAt);
    if (pending.length) console.warn(`[migrate] ${pending.length} pending migration(s) — run \`npm run migrate:dist\``);
  }

  const seeded = await ensureSeedAdmin();
  if (seeded) console.log(`[seed] created first administrator ${seeded}`);

  const server = createApp().listen(env.PORT, () => {
    console.log(`[api] Top Flyte API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[api] ${signal} received, shutting down`);
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start:', err);
  process.exit(1);
});
