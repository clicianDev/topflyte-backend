import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { allowedOrigins } from './config/env.ts';
import { errorHandler, notFound } from './middleware/error.middleware.ts';
import healthRoutes from './routes/health.routes.ts';
import { HttpError } from './utils/HttpError.ts';

/**
 * Builds the Express app without starting a server or touching the database,
 * so tests can mount it with supertest. server.ts does the listening.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Non-browser clients (curl, uptime monitors) send no Origin header.
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new HttpError(403, `Origin not allowed: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/health', healthRoutes);
  // Phase 8 / 11–12: /api/auth, /api/access-requests, /api/admin, /api/projects, /api/activity

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
