# Top Flyte Stair Configurator — API

The Express + MongoDB API behind the Stair Configurator. It will handle:

- access requests and approval
- sessions
- admin user management
- the activity log
- generated-file metadata

It runs on infrastructure Top Flyte owns, with no vendor lock-in. The frontend lives in a separate repository, `topflyte-frontend`.

## Getting started

Requires Node 22 or later.

```bash
npm install
cp .env.example .env     # optional in development
npm run dev              # http://localhost:5000/api/health
```

If `MONGODB_URI` is blank, development uses an **embedded MongoDB** on port 27018, stored in `.data/mongo`, so nothing else needs installing. The first start downloads a MongoDB binary (about 100 MB). The migrate and seed commands connect to the same embedded database, even while `npm run dev` is running. You can also open it in MongoDB Compass at `mongodb://127.0.0.1:27018/topflyte`. In production, set `MONGODB_URI` to a Top-Flyte-owned database such as MongoDB Atlas.

The first administrator is created on boot when `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are set and no admin exists yet.

| Script | What it does |
| --- | --- |
| `npm run dev` | Watch mode via tsx. Loads `.env` if it exists and applies pending migrations at startup. |
| `npm test` | Vitest + supertest against an in-memory MongoDB |
| `npm run typecheck` / `npm run build` | `tsc` / compile to `dist/` |
| `npm start` | Run the compiled build |
| `npm run migrate` | Apply pending migrations. Add `-- status` to list them, or `-- down [n]` to revert the last *n*. |
| `npm run migrate:dist` | The same, using the compiled build (for servers without dev dependencies) |
| `npm run seed` | Apply migrations, then create the first admin from `SEED_ADMIN_*` |
| `npm run seed:demo` | Also add demo users, a project and activity (development only, see below) |
| `npm run contracts:sync` | Copy the API contract to `../topflyte-frontend/src/types/api.ts` |
| `npm run contracts:check` | Fail if the frontend copy is out of date |

### Demo data

`npm run seed:demo` adds four users at `@demo.topflyte.test`, one in each access state:

- `aroha` is approved, with password `demo-password-123`
- `ben` is pending
- `sam` is declined
- `priya` is disabled

It also adds a project with a passing and a failing stair, plus matching activity. Running it again changes nothing, and it refuses to run in production.

## Migrations

Indexes and data changes are versioned in `src/migrations/`, and Mongoose's `autoIndex` is turned off.

- Applied migrations are recorded in the `migrations` collection.
- A lock document in `migrations_lock` stops two processes migrating at once.
- In development, migrations run at startup. In production they're off by default (`MIGRATE_ON_BOOT`): run `npm run migrate:dist` as a release step.

To add a migration:

1. Create `src/migrations/NNNN-what-it-does.ts`, using the next number. Use literal collection and field names, not model imports.
2. Append it to `MIGRATIONS` in `src/migrations/index.ts`.
3. Run `npm run migrate`.

Never edit a migration that has already run somewhere; add a new one instead. If a schema index and the migrations disagree, `tests/migrations.test.ts` fails.

## API contract

`src/contracts/api.ts` holds the request and response types plus the enums: roles, statuses and activity actions. It is the single source of truth for both repos, and the models import their enums from it.

After changing it, run `npm run contracts:sync` to update the frontend copy. That copy is marked as generated, and a frontend test fails if anyone edits it by hand.

Controllers send DTOs built by `src/utils/serializers.ts`, never raw documents, so secrets can't leak.

## Structure

| Folder | Purpose |
| --- | --- |
| `src/app.ts` | Builds the Express app (middleware and routes). It doesn't listen, so tests can mount it. |
| `src/server.ts` | Connects the database, bootstraps, listens, and shuts down gracefully |
| `src/config/` | `env.ts` (every environment variable, validated with zod) and `database.ts` |
| `src/contracts/` | `api.ts`: the API contract shared with the frontend |
| `src/models/` | `User`, `Project`, `ActivityLog` (Mongoose) |
| `src/migrations/` | Versioned database migrations |
| `src/routes/`, `src/controllers/` | One router and one controller per resource |
| `src/services/` | `activityLogger` (audit trail and user counters), `migrator`, `bootstrap` (first admin), `demoSeed` |
| `src/utils/` | `serializers` (document → DTO) and `HttpError` |
| `src/scripts/` | `migrate` and `seed` CLIs (compiled into `dist/scripts`) |
| `src/middleware/` | Error handler and 404 handler. Auth guards arrive in Phase 8. |
| `scripts/` | Repo tooling: the contract sync. Not part of the build. |

Every response uses one envelope:

- success: `{ success: true, data, message? }`
- failure: `{ success: false, message, errors? }`

## Data model

**User.** A user's `status` follows a request-access lifecycle:

- `pending`: the user has requested access
- `approved`: Top Flyte approved the request (`approved` ⇄ `disabled` covers disable and re-enable)
- `declined`: Top Flyte declined the request

Only `approved` accounts can use the configurator, and this is enforced on the server. A user also has a `role`, either `user` or `admin`.

Each user stores:

- `access`: requested, reviewed and approved dates, who reviewed it, and the user's reason for requesting access
- `stats`: login count, configurator uses, projects, last login and last activity
- the password as a bcrypt hash (cost 12, `select: false`)
- `sessionVersion`, so all of a user's sessions can be revoked at once

**Project.** A project is one job for one owner. It holds:

- reference, site address and purpose
- client and architect contacts
- one or more `stairs`, each with:
  - the configurator input, stored as JSON
  - the rule-engine version
  - the Pass/Fail summary

**ActivityLog.** An append-only audit trail. Updates are refused at the model level. Each entry records:

- user and actor
- action (from a fixed catalogue)
- project, metadata, IP and user agent

`recordActivity()` also updates the user's counters.

## Status

Phase 1 delivered:

- the architecture and data models
- migrations and seed data
- the shared API contract
- the health endpoint, error handling, security headers and CORS
- tests and CI

Still to come:

- Phases 8 and 11–12: authentication and access-request endpoints, admin endpoints, transactional email
- Phase 13: file storage
- Phase 14: security hardening
