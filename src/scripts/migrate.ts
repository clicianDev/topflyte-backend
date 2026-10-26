/**
 * Database migrations CLI.
 *   npm run migrate                 apply pending migrations
 *   npm run migrate -- status       list applied / pending migrations
 *   npm run migrate -- down [n]     revert the last n migrations (default 1)
 * Compiled build: `npm run migrate:dist` (same arguments).
 */
import { connectDB, disconnectDB, nativeDb } from '../config/database.ts';
import { migrateDown, migrateUp, migrationStatus } from '../services/migrator.ts';

async function main() {
  const [command = 'up', arg] = process.argv.slice(2);
  await connectDB();
  const db = nativeDb();

  switch (command) {
    case 'up': {
      const applied = await migrateUp(db);
      console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Nothing to apply — database is up to date.');
      break;
    }
    case 'down': {
      const steps = arg ? Number(arg) : 1;
      if (!Number.isInteger(steps) || steps < 1) throw new Error('Usage: npm run migrate -- down [n]  (n ≥ 1)');
      const reverted = await migrateDown(db, steps);
      console.log(reverted.length ? `Reverted: ${reverted.join(', ')}` : 'Nothing to revert.');
      break;
    }
    case 'status': {
      const { migrations, unknown } = await migrationStatus(db);
      for (const m of migrations) {
        console.log(`${m.appliedAt ? `applied ${m.appliedAt.toISOString()}` : 'PENDING                         '}  ${m.id}  ${m.description}`);
      }
      if (unknown.length) console.log(`\nIn the database but not in this code: ${unknown.join(', ')}`);
      break;
    }
    default:
      throw new Error(`Unknown command "${command}". Use: up | status | down [n]`);
  }
  await disconnectDB();
}

main().catch(async (err: Error) => {
  console.error(err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
