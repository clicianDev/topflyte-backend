/**
 * Copies the API contract to the frontend.
 *   npm run contracts:sync     write topflyte-frontend/src/types/api.ts
 *   npm run contracts:check    exit 1 if the frontend copy is out of date
 * The frontend repo is expected next to this one; override with FRONTEND_DIR.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normaliseEol, renderGeneratedContract } from './contracts.ts';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = resolve(process.env.FRONTEND_DIR ?? join(backendRoot, '..', 'topflyte-frontend'));
const source = join(backendRoot, 'src', 'contracts', 'api.ts');
const target = join(frontendRoot, 'src', 'types', 'api.ts');

const expected = renderGeneratedContract(readFileSync(source, 'utf8'));

if (process.argv.includes('--check')) {
  if (!existsSync(frontendRoot)) {
    console.log(`Frontend not found at ${frontendRoot} — skipping contract check (set FRONTEND_DIR).`);
    process.exit(0);
  }
  const current = existsSync(target) ? normaliseEol(readFileSync(target, 'utf8')) : '';
  if (current !== expected) {
    console.error(`${target} is out of date with src/contracts/api.ts — run \`npm run contracts:sync\`.`);
    process.exit(1);
  }
  console.log('Frontend API contract is in sync.');
} else {
  if (!existsSync(join(frontendRoot, 'src', 'types'))) {
    console.error(`Frontend not found at ${frontendRoot} — set FRONTEND_DIR to the topflyte-frontend checkout.`);
    process.exit(1);
  }
  writeFileSync(target, expected);
  console.log(`Wrote ${target}`);
}
