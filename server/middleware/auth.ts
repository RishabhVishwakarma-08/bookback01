import type { NextFunction, Request, Response } from 'express';
import { User, type IUser, type TeamPermission } from '../models/User.js';
import { recordUnauthorizedModificationAttempt } from '../services/discrepancyDetector.js';
import { verifyToken } from '../utils/security.js';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export function isAnyAdmin(user?: IUser | null): boolean {
  if (!user) return false;
  return user.role === 'super_admin' || user.role === 'team_admin' || user.role === 'admin';
}

export function isSuperAdmin(user?: IUser | null): boolean {
  if (!user) return false;
  return user.role === 'super_admin' || user.role === 'admin';
}

export function hasAdminPermission(user: IUser | undefined | null, permission: TeamPermission): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (user.role === 'team_admin') {
    return Array.isArray(user.permissions) && user.permissions.includes(permission);
  }
  return false;
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      res.status(401).json({ error: 'Invalid authorization token.' });
      return;
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.sub);
    if (!user) {
      res.status(401).json({ error: 'Account no longer exists.' });
      return;
    }
    if (user.isSuspended) {
      res.status(403).json({ error: 'Your account has been suspended by campus administration.' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.sub);
      if (user && !user.isSuspended) {
        req.user = user;
      }
    }
  } catch {
    // Ignore optional token failure
  }
  next();
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!isAnyAdmin(req.user)) {
    void recordUnauthorizedModificationAttempt(
      req.user,
      'User',
      req.user._id.toString(),
      `Accessed admin route ${req.method} ${req.originalUrl}`,
    );
    res.status(403).json({ error: 'Forbidden: Administrator access required.' });
    return;
  }
  next();
}

export function requireSuperAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.user.role !== 'super_admin') {
    void recordUnauthorizedModificationAttempt(
      req.user,
      'User',
      req.user._id.toString(),
      `Attempted Super Admin route ${req.method} ${req.originalUrl}`,
    );
    res.status(403).json({ error: 'Forbidden: Super Admin privileges required for this action.' });
    return;
  }
  next();
}

export function requirePermission(permission: TeamPermission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!hasAdminPermission(req.user, permission)) {
      void recordUnauthorizedModificationAttempt(
        req.user,
        'User',
        req.user._id.toString(),
        `Missing permission "${permission}" for ${req.method} ${req.originalUrl}`,
      );
      res.status(403).json({
        error: `Forbidden: Missing "${permission}" permission.`,
      });
      return;
    }
    next();
  };
}
