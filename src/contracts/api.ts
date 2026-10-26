/**
 * API contract between topflyte-backend and topflyte-frontend — the single source of truth.
 *
 * Edit this file only in topflyte-backend, then run `npm run contracts:sync` to copy it
 * to topflyte-frontend/src/types/api.ts. Keep it self-contained (no imports) so it
 * compiles unchanged in both repos.
 *
 * Over JSON, every id is a string and every date is an ISO-8601 string.
 */

// ── Response envelope ───────────────────────────────────────────────────────

export interface ApiFieldError {
  path: string;
  message: string;
}

export type ApiResponse<T> =
  | { success: true; data: T; message?: string; count?: number }
  | { success: false; message: string; errors?: ApiFieldError[] };

export interface HealthInfo {
  service: string;
  version: string;
  db: 'connected' | 'disconnected';
  time: string;
}

// ── Users & access ──────────────────────────────────────────────────────────

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Request-access lifecycle:
 *   pending → approved | declined;  approved ⇄ disabled (disable / re-enable).
 * Only `approved` accounts may use the configurator.
 */
export const USER_STATUSES = ['pending', 'approved', 'declined', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface UserDTO {
  _id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  access: {
    requestedAt?: string;
    requestMessage?: string; // "What will you use the configurator for?"
    reviewedAt?: string;
    reviewedBy?: string;
    approvedAt?: string;
    decisionNote?: string;
  };
  stats: {
    loginCount: number;
    configuratorUseCount: number;
    projectCount: number;
    lastLoginAt?: string;
    lastActivityAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ── Projects ────────────────────────────────────────────────────────────────

export interface ContactDTO {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
}

export interface StairResultSummary {
  overall: 'pass' | 'fail';
  failCount: number;
  warnCount: number;
}

export interface StairConfigDTO {
  _id: string;
  label: string;
  /** The configurator's StairInput (topflyte-frontend/src/types/stair.ts), stored as-is. */
  input: Record<string, unknown>;
  /** Rule-engine version that produced `result`. */
  engineVersion: string;
  result?: StairResultSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDTO {
  _id: string;
  owner: string;
  name: string;
  reference?: string;
  siteAddress?: string;
  purpose?: string; // "What was the configurator being used for?"
  client: ContactDTO;
  architect: ContactDTO;
  stairs: StairConfigDTO[];
  createdAt: string;
  updatedAt: string;
}

// ── Activity log ────────────────────────────────────────────────────────────

/** Add a new action here before logging it — unknown actions are rejected. */
export const ACTIVITY_ACTIONS = [
  // Account lifecycle
  'access_requested',
  'access_approved',
  'access_declined',
  'access_disabled',
  'access_enabled',
  'user_added',
  'user_removed',
  // Sessions
  'login',
  'login_failed',
  'logout',
  // Configurator usage
  'configurator_opened',
  'project_created',
  'project_updated',
  'pdf_exported',
  'dxf_exported',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface ActivityDTO {
  _id: string;
  user?: string;
  actor?: string;
  action: ActivityAction;
  project?: string;
  email?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
