import type { RequestHandler } from 'express';
import pkg from '../../package.json' with { type: 'json' };
import { dbState } from '../config/database.ts';

// @desc    Liveness + database status (used by uptime monitoring and the frontend footer)
// @route   GET /api/health
// @access  Public
export const getHealth: RequestHandler = (_req, res) => {
  const db = dbState();
  res.status(db === 'connected' ? 200 : 503).json({
    success: db === 'connected',
    data: {
      service: pkg.name,
      version: pkg.version,
      db,
      time: new Date().toISOString(),
    },
  });
};
