import { describe, expect, it } from 'vitest';
import {
  containsNoSqlOperator,
  escapeRegex,
  hashPassword,
  sanitizeObject,
  sanitizePlainText,
  signToken,
  verifyPassword,
  verifyToken,
} from '../server/utils/security.js';
import {
  createBookSchema,
  createRequestSchema,
  createReviewSchema,
  registerSchema,
} from '../server/utils/validators.js';

describe('Unit Tests — Security Utilities', () => {
  it('hashes passwords securely with bcrypt and verifies matching/non-matching passwords', async () => {
    const hash = await hashPassword('CampusPass#2026');
    expect(hash).not.toBe('CampusPass#2026');
    expect(hash.startsWith('$2')).toBe(true);
    expect(await verifyPassword('CampusPass#2026', hash)).toBe(true);
    expect(await verifyPassword('WrongPassword', hash)).toBe(false);
  });

  it('signs and verifies JWT payloads and rejects tampered tokens', () => {
    const token = signToken({ sub: '6734abcd1234567890abcdef', role: 'student', email: 's@mits.in' });
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe('6734abcd1234567890abcdef');
    expect(decoded.role).toBe('student');
    expect(() => verifyToken(`${token}tamper`)).toThrow();
  });

  it('strips HTML tags, script blocks, and inline event handlers to prevent XSS', () => {
    const dirty = `<script>alert("xss")</script><b>Clean Title</b> <img src=x onerror=alert(1)> javascript:void(0)`;
    const cleaned = sanitizePlainText(dirty);
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('<b>');
    expect(cleaned).not.toContain('onerror=');
    expect(cleaned).not.toContain('javascript:');
    expect(cleaned).toContain('Clean Title');
  });

  it('escapes regex metacharacters to prevent ReDoS/regex injection', () => {
    const escaped = escapeRegex('C++ (2nd Ed.) [2025]?*');
    expect(escaped).toBe('C\\+\\+ \\(2nd Ed\\.\\) \\[2025\\]\\?\\*');
    expect(() => new RegExp(escaped, 'i')).not.toThrow();
  });

  it('detects and strips MongoDB NoSQL operator keys ($gt, $ne, dotted keys)', () => {
    expect(containsNoSqlOperator({ email: { $ne: '' } })).toBe(true);
    expect(containsNoSqlOperator({ 'user.role': 'admin' })).toBe(true);
    expect(containsNoSqlOperator({ title: 'Operating Systems', price: 300 })).toBe(false);

    const sanitized = sanitizeObject({
      name: '<b>Aarav</b>',
      $where: 'sleep(1000)',
      'nested.field': 'hack',
    });
    expect(sanitized).toEqual({ name: 'Aarav' });
  });
});

describe('Unit Tests — Input Validators (Zod)', () => {
  it('validates a complete student registration payload', () => {
    const res = registerSchema.safeParse({
      name: 'Priya Nair',
      email: 'Priya@mitsgwalior.in',
      collegeId: '0901CS251042',
      branch: 'CSE',
      year: '1st Year',
      semester: 2,
      password: 'Password@123',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.email).toBe('priya@mitsgwalior.in');
    }
  });

  it('rejects weak password and invalid collegeId format on registration', () => {
    const res = registerSchema.safeParse({
      name: 'A',
      email: 'bad-email',
      collegeId: '0901$CS',
      branch: 'CSE',
      year: '1st Year',
      semester: 2,
      password: '123',
    });
    expect(res.success).toBe(false);
  });

  it('enforces selling price > 0 for sell listings and price === 0 for donate listings', () => {
    const invalidSell = createBookSchema.safeParse({
      title: 'DBMS',
      author: 'Korth',
      subject: 'Database Systems',
      branch: 'CSE',
      semester: 4,
      condition: 'Good',
      offerType: 'sell',
      price: 0,
      description: 'Clean textbook with zero highlights.',
    });
    expect(invalidSell.success).toBe(false);

    const validDonate = createBookSchema.safeParse({
      title: 'DBMS',
      author: 'Korth',
      subject: 'Database Systems',
      branch: 'CSE',
      semester: 4,
      condition: 'Good',
      offerType: 'donate',
      price: 0,
      description: 'Free donation for 4th semester student.',
    });
    expect(validDonate.success).toBe(true);
  });

  it('validates request message length and review rating bounds (1-5)', () => {
    expect(createRequestSchema.safeParse({ message: 'Hi' }).success).toBe(false);
    expect(createRequestSchema.safeParse({ message: 'Can I pick this up at 2pm?' }).success).toBe(true);
    expect(createReviewSchema.safeParse({ rating: 6, comment: 'Great' }).success).toBe(false);
    expect(createReviewSchema.safeParse({ rating: 5, comment: 'Smooth campus handover.' }).success).toBe(true);
  });
});
