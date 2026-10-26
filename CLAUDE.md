# CLAUDE.md — topflyte-backend

Top Flyte Stair Configurator API. Stack: Node 22, Express 5, Mongoose 9, TypeScript (strict, ESM, `.ts` import specifiers rewritten on build), zod, Vitest + supertest. Frontend: `../topflyte-frontend`.

## Commands
- `npm run dev`: API on :5000. With no `MONGODB_URI` it starts an embedded MongoDB on :27018 (`.data/mongo`), which `migrate` and `seed` reuse.
- `npm test`: runs against an in-memory MongoDB.
- `npm run typecheck`, `npm run build`.
- `npm run migrate [-- status | -- down n]`, `npm run seed:demo`.
- `npm run contracts:sync`: run it after changing `src/contracts/api.ts`.
- Run test and typecheck before finishing a change.

## Conventions
- **API contract.** `src/contracts/api.ts` is the single source for the request and response types and the enums (roles, statuses, activity actions). It stays self-contained, with no imports. Models import their enums from it. After any change, run `npm run contracts:sync` to regenerate `../topflyte-frontend/src/types/api.ts`. Never edit the frontend copy.
- **Responses.** Send DTOs from `src/utils/serializers.ts`, never raw documents.
- **Indexes and data changes go through migrations** (`src/migrations/NNNN-name.ts`, appended to `MIGRATIONS`), and `autoIndex` is off. Never edit a migration that has run; add a new one. Keep the schema `index` declarations in step, or `tests/migrations.test.ts` fails.
- Add every env var to the zod schema in `src/config/env.ts` and to `.env.example`. Never read `process.env` anywhere else.
- Keep `app.ts` free of `listen` and DB calls. `server.ts` owns startup.
- One router file and one controller file per resource. Above each handler, add a comment block with `@desc`, `@route` and `@access`.
- Use the response envelope `{ success, data, message }`. Throw `HttpError(status, message)` and let `error.middleware.ts` format the response. Express 5 forwards async errors automatically.
- Validate request bodies with zod schemas in the controller or route. The error middleware turns a `ZodError` into a 400.
- Log user-visible events with `logActivity()`, which is fire-and-forget. Use `await recordActivity()` when the write must succeed. A new action must be added to `ACTIVITY_ACTIONS` first.
- `ActivityLog` is append-only. Never add update paths to it.
- `passwordHash` is `select: false`. Use `.select('+passwordHash')` only where a password is verified.

## Security baseline (Security & Backend Addendum)
- Account status is enforced on the server. Only `status === 'approved'` users reach configurator endpoints, and admin routes also require `role === 'admin'`.
- Phase 8 sessions use httpOnly, secure, SameSite cookies, invalidated through `sessionVersion`. Do not use JWTs in localStorage.
- Never commit secrets. Use `.env` locally and the host's secret store in production.
