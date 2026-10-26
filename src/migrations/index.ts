import m0001 from './0001-initial-indexes.ts';
import type { Migration } from './types.ts';

/**
 * Every migration, in run order. To add one:
 *   1. create src/migrations/NNNN-what-it-does.ts (next number),
 *   2. append it here,
 *   3. run `npm run migrate`, and add a test if it changes data.
 */
export const MIGRATIONS: readonly Migration[] = [m0001];
