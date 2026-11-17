import { Router } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { Campus } from '../models/Campus.js';
import { PlatformSetting } from '../models/PlatformSetting.js';
import { TEAM_PERMISSIONS, User } from '../models/User.js';
import { getPlatformSettings } from '../services/discrepancyDetector.js';
import {
  getAdminSetupKey,
  hashPassword,
  signToken,
  timingSafeCompare,
} from '../utils/security.js';
import { setupInitializeSchema } from '../utils/validators.js';

const router = Router();

router.get('/setup/status', async (_req, res) => {
  try {
    const [superAdminCount, teamAdminCount, settings] = await Promise.all([
      User.countDocuments({ role: 'super_admin' }),
      User.countDocuments({ role: 'team_admin' }),
      getPlatformSettings(),
    ]);

    res.json({
      needsSetup: superAdminCount === 0,
      hasSuperAdmin: superAdminCount > 0,
      teamAdminCount,
      siteName: settings.siteName,
      campusName: settings.campusName,
      campusDomain: settings.campusDomain,
    });
  } catch (err) {
    console.error('GET /setup/status error:', err);
    res.status(500).json({ error: 'Failed to inspect platform setup status.' });
  }
});

router.post('/setup/initialize', async (req, res) => {
  try {
    const existingSuperAdmin = await User.exists({ role: 'super_admin' });
    if (existingSuperAdmin) {
      res.status(403).json({
        error: 'Initial administrator setup is already complete and locked.',
      });
      return;
    }

    const parsed = setupInitializeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid setup configuration.',
        issues: parsed.error.issues,
      });
      return;
    }

    const expectedKey = getAdminSetupKey();
    if (!timingSafeCompare(parsed.data.setupKey, expectedKey)) {
      res.status(403).json({
        error: 'Invalid Admin Setup Key. Check your server ADMIN_SETUP_KEY environment variable or ./data/.setup_key.',
      });
      return;
    }

    const { campusName, campusDomain, superAdmin, teamAdmin1, teamAdmin2 } = parsed.data;
    const candidates = [superAdmin, teamAdmin1, teamAdmin2].filter(Boolean) as Array<
      typeof superAdmin
    >;

    const emailSet = new Set(candidates.map((c) => c.email.toLowerCase()));
    const collegeIdSet = new Set(candidates.map((c) => c.collegeId.toUpperCase()));
    if (emailSet.size !== candidates.length || collegeIdSet.size !== candidates.length) {
      res.status(400).json({
        error: 'Super Admin, Team Admin 1, and Team Admin 2 must each have a unique email and College/Staff ID.',
      });
      return;
    }

    const conflict = await User.findOne({
      $or: [
        { email: { $in: Array.from(emailSet) } },
        { collegeId: { $in: Array.from(collegeIdSet) } },
      ],
    });
    if (conflict) {
      res.status(409).json({
        error: `An account with email "${conflict.email}" or ID "${conflict.collegeId}" already exists.`,
      });
      return;
    }

    let campus = await Campus.findOne();
    if (!campus) {
      campus = await Campus.create({
        name: campusName,
        domain: campusDomain.toLowerCase(),
        location: 'Campus',
      });
    } else if (campusName && campusDomain) {
      campus.name = campusName;
      campus.domain = campusDomain.toLowerCase();
      await campus.save();
    }

    const superHash = await hashPassword(superAdmin.password);
    const createdSuper = await User.create({
      name: superAdmin.name,
      email: superAdmin.email.toLowerCase(),
      collegeId: superAdmin.collegeId.toUpperCase(),
      branch: 'CSE',
      year: '4th Year',
      semester: 8,
      campusId: campus._id,
      passwordHash: superHash,
      role: 'super_admin',
      permissions: [...TEAM_PERMISSIONS],
      verified: true,
      isSuspended: false,
      bio: 'Main Owner & Super Administrator',
    });

    const createdTeam: Array<{ id: string; name: string; email: string; role: string }> = [];
    const defaultTeamPerms = ['manage_books', 'manage_requests', 'investigate_discrepancies', 'verify_users', 'view_reports'];

    for (const tm of [teamAdmin1, teamAdmin2]) {
      if (!tm) continue;
      const tmHash = await hashPassword(tm.password);
      const created = await User.create({
        name: tm.name,
        email: tm.email.toLowerCase(),
        collegeId: tm.collegeId.toUpperCase(),
        branch: 'CSE',
        year: '4th Year',
        semester: 8,
        campusId: campus._id,
        passwordHash: tmHash,
        role: 'team_admin',
        permissions: tm.permissions && tm.permissions.length > 0 ? tm.permissions : defaultTeamPerms,
        verified: true,
        isSuspended: false,
        createdByAdminId: createdSuper._id,
        bio: 'Campus BookBack Team Administrator',
      });
      createdTeam.push({
        id: created._id.toString(),
        name: created.name,
        email: created.email,
        role: created.role,
      });
    }

    await PlatformSetting.findOneAndUpdate(
      { key: 'global' },
      {
        $set: {
          campusName: campus.name,
          campusDomain: campus.domain,
          updatedBy: createdSuper._id,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    await AuditLog.create({
      actorId: createdSuper._id,
      actorName: createdSuper.name,
      actorRole: createdSuper.role,
      action: 'initialized super admin and administrative team',
      targetType: 'team',
      targetId: createdSuper._id.toString(),
      details: `Super Admin: ${createdSuper.email}; Team Admins created: ${createdTeam.length}`,
      reason: 'Initial one-time secure administrative setup',
      previousValue: null,
      newValue: {
        superAdminEmail: createdSuper.email,
        teamAdmins: createdTeam.map((t) => t.email),
      },
      restorable: false,
    });

    const token = signToken({
      sub: createdSuper._id.toString(),
      role: createdSuper.role,
      email: createdSuper.email,
    });

    res.status(201).json({
      token,
      user: {
        id: createdSuper._id.toString(),
        name: createdSuper.name,
        email: createdSuper.email,
        collegeId: createdSuper.collegeId,
        branch: createdSuper.branch,
        year: createdSuper.year,
        semester: createdSuper.semester,
        campusId: createdSuper.campusId.toString(),
        role: createdSuper.role,
        permissions: createdSuper.permissions,
        verified: createdSuper.verified,
        isSuspended: createdSuper.isSuspended,
        themePreference: createdSuper.themePreference,
        bio: createdSuper.bio,
        createdAt: createdSuper.createdAt,
      },
      teamAdminsCreated: createdTeam,
    });
  } catch (err) {
    console.error('POST /setup/initialize error:', err);
    res.status(500).json({ error: 'Failed to initialize administrative accounts.' });
  }
});

export default router;
