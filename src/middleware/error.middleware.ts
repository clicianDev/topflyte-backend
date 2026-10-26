import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env.ts';

/**
 * Every error response uses the same envelope as success responses:
 *   { success: false, message, errors? }
 */

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.originalUrl}` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(404).json({ success: false, message: 'Resource not found' });
    return;
  }
  if (err?.code === 11000) {
    res.status(409).json({ success: false, message: 'Duplicate value', fields: Object.keys(err.keyValue ?? {}) });
    return;
  }
  // body-parser's malformed JSON / payload too large
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    res.status(err.status ?? 400).json({ success: false, message: err.message });
    return;
  }

  const status: number = err?.statusCode ?? 500;
  if (status >= 500) console.error(err);
  const message = status >= 500 && env.NODE_ENV === 'production' ? 'Server error' : (err?.message ?? 'Server error');
  res.status(status).json({ success: false, message });
};
