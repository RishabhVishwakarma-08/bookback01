import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Campus } from '../models/Campus.js';
import { User } from '../models/User.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  getPlatformSettings,
  recordFailedLoginDiscrepancy,
} from '../services/discrepancyDetector.js';
import { hashPassword, signToken, verifyPassword } from '../utils/security.js';
import { loginSchema, registerSchema } from '../utils/validators.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many authentication attempts. Please wait a few minutes and try again.' },
});

export function toSafeUser(user: any) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    collegeId: user.collegeId,
    branch: user.branch,
    year: user.year,
    semester: user.semester,
    campusId: user.campusId?.toString(),
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    verified: user.verified,
    isSuspended: user.isSuspended,
    themePreference: user.themePreference || 'system',
    bio: user.bio || '',
    createdAt: user.createdAt,
  };
}

router.get('/platform-info', async (_req, res) => {
  try {
    const settings = await getPlatformSettings();
    res.json({
      siteName: settings.siteName,
      campusName: settings.campusName,
      campusDomain: settings.campusDomain,
      maintenanceBanner: settings.maintenanceBanner || '',
    });
  } catch {
    res.json({
      siteName: 'BookBack',
      campusName: 'University Book Exchange',
      campusDomain: 'mitsgwalior.in',
      maintenanceBanner: '',
    });
  }
});

router.get('/campuses', async (_req, res) => {
  try {
    const campuses = await Campus.find().sort({ name: 1 }).lean();
    res.json({
      campuses: campuses.map((c: any) => ({
        id: c._id.toString(),
        name: c.name,
        domain: c.domain,
        location: c.location,
      })),
    });
  } catch (err) {
    console.error('Error fetching campuses:', err);
    res.status(500).json({ error: 'Unable to load campus directory.' });
  }
});

router.post('/auth/register', authLimiter, async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Validation failed',
        issues: parsed.error.issues,
      });
      return;
    }

    const { name, email, collegeId, branch, year, semester, campusId, password } = parsed.data;
    const normalizedCollegeId = collegeId.toUpperCase();

    const existing = await User.findOne({
      $or: [{ email }, { collegeId: normalizedCollegeId }],
    });
    if (existing) {
      const conflictField = existing.email === email ? 'email' : 'college ID';
      res.status(409).json({
        error: `An account with this ${conflictField} already exists.`,
      });
      return;
    }

    let campus = campusId ? await Campus.findById(campusId) : null;
    if (!campus) {
      campus = await Campus.findOne();
    }
    if (!campus) {
      campus = await Campus.create({
        name: 'MITS Gwalior',
        domain: 'mitsgwalior.in',
        location: 'Gwalior, MP',
      });
    }

    const settings = await getPlatformSettings();
    const passwordHash = await hashPassword(password);
    const isCampusEmail =
      settings.autoVerifyCampusEmail && email.endsWith(`@${campus.domain}`);

    const user = await User.create({
      name,
      email,
      collegeId: normalizedCollegeId,
      branch,
      year,
      semester,
      campusId: campus._id,
      passwordHash,
      role: 'student',
      permissions: [],
      verified: isCampusEmail,
      isSuspended: false,
      themePreference: 'system',
      bio: `${branch} · ${year}`,
    });

    const token = signToken({
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    res.status(201).json({
      token,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed due to a server error.' });
  }
});

router.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid credentials payload.' });
      return;
    }

    const { identifier, password } = parsed.data;
    const isEmail = identifier.includes('@');
    const query = isEmail
      ? { email: identifier.toLowerCase() }
      : { collegeId: identifier.toUpperCase() };

    const user = await User.findOne(query).select('+passwordHash');
    if (!user) {
      res.status(401).json({ error: 'Invalid email/college ID or password.' });
      return;
    }

    const matches = await verifyPassword(password, user.passwordHash);
    if (!matches) {
      // Track failed login attempts and raise discrepancy report for human review without auto-suspending
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      user.lastFailedLoginAt = new Date();
      await user.save();

      const settings = await getPlatformSettings();
      if (user.failedLoginAttempts >= settings.failedLoginAlertThreshold) {
        await recordFailedLoginDiscrepancy(user, user.failedLoginAttempts);
      }

      res.status(401).json({ error: 'Invalid email/college ID or password.' });
      return;
    }

    if (user.isSuspended) {
      res.status(403).json({ error: 'This account has been suspended by campus administration.' });
      return;
    }

    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      await user.save();
    }

    const token = signToken({
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    res.json({
      token,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed due to a server error.' });
  }
});

router.get('/auth/me', authenticate, async (req: AuthenticatedRequest, res) => {
  res.json({ user: toSafeUser(req.user) });
});

export default router;
