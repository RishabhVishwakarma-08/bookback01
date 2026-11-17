import type { NextFunction, Request, Response } from 'express';
import { containsNoSqlOperator, sanitizeObject } from '../utils/security.js';

/**
 * Rejects payloads containing MongoDB operator injection ($gt, $ne, $where, etc.)
 * and sanitizes string values to strip XSS/script fragments.
 */
export function sanitizeRequestMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (
    containsNoSqlOperator(req.body) ||
    containsNoSqlOperator(req.query) ||
    containsNoSqlOperator(req.params)
  ) {
    res.status(400).json({
      error: 'Invalid input detected: prohibited query operator or key format.',
    });
    return;
  }

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      const val = req.query[key];
      if (typeof val === 'string') {
        req.query[key] = sanitizeObject(val);
      }
    }
  }
  next();
}
