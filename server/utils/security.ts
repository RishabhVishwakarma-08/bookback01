import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../models/User.js';

const BCRYPT_ROUNDS = 12;

let cachedJwtSecret: string | null = null;
let cachedSetupKey: string | null = null;

function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
}

export function getJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
    return process.env.JWT_SECRET.trim();
  }
  if (isVercelRuntime()) {
    throw new Error('JWT_SECRET must be configured with at least 16 characters on Vercel.');
  }
  if (cachedJwtSecret) {
    return cachedJwtSecret;
  }
  const secretDir = path.resolve(process.cwd(), 'data');
  const secretFile = path.join(secretDir, '.jwt_secret');
  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf8').trim();
      if (existing.length >= 32) {
        cachedJwtSecret = existing;
        return existing;
      }
    }
    fs.mkdirSync(secretDir, { recursive: true });
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    cachedJwtSecret = generated;
    return generated;
  } catch {
    cachedJwtSecret = crypto.randomBytes(48).toString('hex');
    return cachedJwtSecret;
  }
}

export function getAdminSetupKey(): string {
  if (process.env.ADMIN_SETUP_KEY && process.env.ADMIN_SETUP_KEY.trim().length >= 12) {
    return process.env.ADMIN_SETUP_KEY.trim();
  }
  if (isVercelRuntime()) {
    throw new Error('ADMIN_SETUP_KEY must be configured with at least 12 characters on Vercel.');
  }
  if (cachedSetupKey) {
    return cachedSetupKey;
  }
  const secretDir = path.resolve(process.cwd(), 'data');
  const keyFile = path.join(secretDir, '.setup_key');
  try {
    if (fs.existsSync(keyFile)) {
      const existing = fs.readFileSync(keyFile, 'utf8').trim();
      if (existing.length >= 16) {
        cachedSetupKey = existing;
        return existing;
      }
    }
    fs.mkdirSync(secretDir, { recursive: true });
    const generated = `BB-SETUP-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    fs.writeFileSync(keyFile, generated, { mode: 0o600 });
    cachedSetupKey = generated;
    return generated;
  } catch {
    cachedSetupKey = `BB-SETUP-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    return cachedSetupKey;
  }
}

export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtUserPayload {
  sub: string;
  role: UserRole;
  email: string;
}

export function signToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtUserPayload {
  return jwt.verify(token, getJwtSecret()) as JwtUserPayload;
}

/**
 * Escapes regex metacharacters to prevent regex injection and ReDoS in MongoDB $regex searches.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips HTML tags and dangerous script/event-handler payloads from user-supplied text to prevent stored XSS.
 */
export function sanitizePlainText(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Detects MongoDB operator keys ($gt, $ne, $where, etc.) or dotted keys in parsed request objects.
 */
export function containsNoSqlOperator(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsNoSqlOperator);
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) {
        return true;
      }
      if (containsNoSqlOperator(nested)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Recursively strips any $-prefixed or dotted keys and sanitizes string values.
 */
export function sanitizeObject<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizePlainText(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      clean[key] = sanitizeObject(nested);
    }
    return clean as T;
  }
  return value;
}
