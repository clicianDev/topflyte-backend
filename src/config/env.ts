import { z } from 'zod';

// `KEY=` in .env arrives as "" — treat it the same as not set.
const blankAsUnset = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

/**
 * Every environment variable the API reads, validated once at startup.
 * Add new variables here (and to .env.example) rather than reading
 * process.env directly elsewhere — a typo then fails fast at boot.
 */
const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),

    // Comma-separated list of origins allowed to call the API with credentials.
    FRONTEND_URL: z.string().default('http://localhost:5173'),

    // Leave unset in development to use the embedded MongoDB (see config/database.ts).
    MONGODB_URI: blankAsUnset(z.string()),
    DEV_DB_PATH: z.string().default('.data/mongo'),
    // Fixed port so `npm run migrate` / `npm run seed` can share the dev server's embedded DB.
    DEV_DB_PORT: z.coerce.number().int().min(1024).max(65535).default(27018),

    // Apply pending migrations at startup. Defaults to on outside production; in production
    // run `npm run migrate:dist` as a release step instead.
    MIGRATE_ON_BOOT: blankAsUnset(z.stringbool()),

    // First administrator, created on boot only if no admin exists yet.
    // Remove SEED_ADMIN_PASSWORD from the environment once the admin has logged in.
    SEED_ADMIN_EMAIL: blankAsUnset(z.email()),
    SEED_ADMIN_PASSWORD: blankAsUnset(z.string().min(12, 'SEED_ADMIN_PASSWORD must be at least 12 characters')),
    SEED_ADMIN_NAME: z.string().default('Top Flyte Admin'),
  })
  .refine((e) => e.NODE_ENV !== 'production' || !!e.MONGODB_URI, {
    message: 'MONGODB_URI is required when NODE_ENV=production',
    path: ['MONGODB_URI'],
  });

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const migrateOnBoot = env.MIGRATE_ON_BOOT ?? env.NODE_ENV !== 'production';

export const allowedOrigins = env.FRONTEND_URL.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
