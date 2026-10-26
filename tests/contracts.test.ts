import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contractHash, GENERATED_MARKER, normaliseEol, renderGeneratedContract } from '../scripts/contracts.ts';
import { ACTIVITY_ACTIONS, USER_ROLES, USER_STATUSES } from '../src/contracts/api.ts';
import { ActivityLog } from '../src/models/ActivityLog.model.ts';
import { User } from '../src/models/User.model.ts';

const SOURCE = new URL('../src/contracts/api.ts', import.meta.url);
const FRONTEND_COPY = new URL('../../topflyte-frontend/src/types/api.ts', import.meta.url);

describe('API contract', () => {
  it('is self-contained so it compiles unchanged in the frontend', () => {
    expect(readFileSync(SOURCE, 'utf8')).not.toMatch(/^\s*import\s/m);
  });

  it('drives the model enums', () => {
    expect(User.schema.path('role').options.enum).toEqual(USER_ROLES);
    expect(User.schema.path('status').options.enum).toEqual(USER_STATUSES);
    expect(ActivityLog.schema.path('action').options.enum).toEqual(ACTIVITY_ACTIONS);
  });

  it('renders a generated copy whose header hash matches its body', () => {
    const out = renderGeneratedContract('export type A = 1;\r\n');
    const [line1, line2, blank, ...body] = out.split('\n');
    expect(line1.startsWith(GENERATED_MARKER)).toBe(true);
    expect(blank).toBe('');
    expect(body.join('\n')).toBe('export type A = 1;\n');
    expect(line2).toContain(`sha256:${contractHash('export type A = 1;\n')}`);
  });

  // Local convenience: when both repos sit side by side, catch a forgotten sync.
  it.skipIf(!existsSync(FRONTEND_COPY))('frontend copy is in sync (run `npm run contracts:sync`)', () => {
    const expected = renderGeneratedContract(readFileSync(SOURCE, 'utf8'));
    expect(normaliseEol(readFileSync(FRONTEND_COPY, 'utf8'))).toBe(expected);
  });
});
