/**
 * Seed data.
 *   npm run seed         apply migrations, then create the first admin from SEED_ADMIN_*
 *   npm run seed:demo    …and add demo users / project / activity (development only)
 * With the embedded dev database this works while `npm run dev` is running.
 */
import { connectDB, disconnectDB, nativeDb } from '../config/database.ts';
import { env } from '../config/env.ts';
import { ensureSeedAdmin } from '../services/bootstrap.ts';
import { DEMO_EMAIL_DOMAIN, DEMO_PASSWORD, seedDemoData } from '../services/demoSeed.ts';
import { migrateUp } from '../services/migrator.ts';

async function main() {
  const demo = process.argv.includes('--demo');
  if (!demo && (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD)) {
    console.error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 12 chars) in .env first, or run `npm run seed:demo`.');
    process.exit(1);
  }

  await connectDB();
  const applied = await migrateUp(nativeDb());
  if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);

  const admin = await ensureSeedAdmin();
  console.log(admin ? `Created administrator ${admin}` : 'Administrator: none created (one exists, or SEED_ADMIN_* not set).');

  if (demo) {
    const result = await seedDemoData();
    console.log(
      result.created
        ? `Created ${result.users} demo users (@${DEMO_EMAIL_DOMAIN}, password "${DEMO_PASSWORD}") and ${result.projects} project.`
        : 'Demo data already present — nothing to do.',
    );
  }
  await disconnectDB();
}

main().catch(async (err: Error) => {
  console.error(err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
