import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { AuditLog } from '../server/models/AuditLog.js';
import { BookListing } from '../server/models/BookListing.js';
import { Campus } from '../server/models/Campus.js';
import { Discrepancy } from '../server/models/Discrepancy.js';
import { PlatformSetting } from '../server/models/PlatformSetting.js';
import { User } from '../server/models/User.js';

let mongod: MongoMemoryServer;
let app: ReturnType<typeof createApp>;

const SETUP_KEY = 'TEST-SETUP-KEY-BOOKBACK-2026';

let superAdminToken = '';
let superAdminId = '';
let teamAdmin1Token = '';
let teamAdmin1Id = '';
let teamAdmin2Token = '';
let studentToken = '';
let studentId = '';
let secondStudentToken = '';
let sampleBookId = '';
let sampleDiscrepancyId = '';
let sampleAuditLogId = '';
let sampleBackupId = '';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_SETUP_KEY = SETUP_KEY;
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('bookback_admin_rbac_test'));
  app = createApp();

  await Campus.create({
    name: 'MITS Gwalior',
    domain: 'mitsgwalior.in',
    location: 'Gwalior, MP',
  });
  await PlatformSetting.create({
    key: 'global',
    siteName: 'BookBack',
    campusName: 'MITS Gwalior',
    campusDomain: 'mitsgwalior.in',
    failedLoginAlertThreshold: 4,
    quantityJumpAlertThreshold: 5,
    maxActiveRequestsPerStudent: 4,
  });
});

afterAll(async () => {
  delete process.env.ADMIN_SETUP_KEY;
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Admin Governance, Multi-Role RBAC, Discrepancies, Audit Recovery & Theme', () => {
  it('1. Setup Wizard: rejects bad setup key (403), initializes Super Admin + Team Admin 1 & 2, and locks setup afterwards', async () => {
    const statusBefore = await request(app).get('/api/setup/status');
    expect(statusBefore.status).toBe(200);
    expect(statusBefore.body.needsSetup).toBe(true);

    const badSetup = await request(app).post('/api/setup/initialize').send({
      setupKey: 'WRONG-KEY-123456',
      campusName: 'MITS Gwalior',
      campusDomain: 'mitsgwalior.in',
      superAdmin: {
        name: 'Main Owner',
        email: 'owner@mitsgwalior.in',
        collegeId: 'OWNER_01',
        password: 'SuperOwner#2026!',
      },
      teamAdmin1: {
        name: 'Team Moderator One',
        email: 'team1@mitsgwalior.in',
        collegeId: 'ADMIN_1',
        password: 'TeamAdmin1#2026!',
        permissions: ['manage_books', 'investigate_discrepancies', 'view_reports'],
      },
      teamAdmin2: {
        name: 'Team Moderator Two',
        email: 'team2@mitsgwalior.in',
        collegeId: 'ADMIN_2',
        password: 'TeamAdmin2#2026!',
        permissions: ['manage_requests', 'verify_users'],
      },
    });
    expect(badSetup.status).toBe(403);

    const okSetup = await request(app).post('/api/setup/initialize').send({
      setupKey: SETUP_KEY,
      campusName: 'MITS Gwalior',
      campusDomain: 'mitsgwalior.in',
      superAdmin: {
        name: 'Main Owner',
        email: 'owner@mitsgwalior.in',
        collegeId: 'OWNER_01',
        password: 'SuperOwner#2026!',
      },
      teamAdmin1: {
        name: 'Team Moderator One',
        email: 'team1@mitsgwalior.in',
        collegeId: 'ADMIN_1',
        password: 'TeamAdmin1#2026!',
        permissions: ['manage_books', 'investigate_discrepancies', 'view_reports'],
      },
      teamAdmin2: {
        name: 'Team Moderator Two',
        email: 'team2@mitsgwalior.in',
        collegeId: 'ADMIN_2',
        password: 'TeamAdmin2#2026!',
        permissions: ['manage_requests', 'verify_users'],
      },
    });
    expect(okSetup.status).toBe(201);
    expect(okSetup.body.user.role).toBe('super_admin');
    expect(okSetup.body.teamAdminsCreated.length).toBe(2);
    superAdminToken = okSetup.body.token;
    superAdminId = okSetup.body.user.id;

    // Setup endpoint must now be locked
    const retrySetup = await request(app).post('/api/setup/initialize').send({
      setupKey: SETUP_KEY,
      campusName: 'MITS Gwalior',
      campusDomain: 'mitsgwalior.in',
      superAdmin: {
        name: 'Attacker',
        email: 'attacker@mitsgwalior.in',
        collegeId: 'ATK_01',
        password: 'Password#1234',
      },
    });
    expect(retrySetup.status).toBe(403);

    const statusAfter = await request(app).get('/api/setup/status');
    expect(statusAfter.body.needsSetup).toBe(false);
    expect(statusAfter.body.teamAdminCount).toBe(2);
  });

  it('2. Authenticates all 4 roles (Super Admin, Team Admin 1, Team Admin 2, Students) & enforces strict RBAC boundaries', async () => {
    const t1Login = await request(app).post('/api/auth/login').send({
      identifier: 'team1@mitsgwalior.in',
      password: 'TeamAdmin1#2026!',
    });
    expect(t1Login.status).toBe(200);
    expect(t1Login.body.user.role).toBe('team_admin');
    teamAdmin1Token = t1Login.body.token;
    teamAdmin1Id = t1Login.body.user.id;

    const t2Login = await request(app).post('/api/auth/login').send({
      identifier: 'team2@mitsgwalior.in',
      password: 'TeamAdmin2#2026!',
    });
    expect(t2Login.status).toBe(200);
    teamAdmin2Token = t2Login.body.token;

    const s1 = await request(app).post('/api/auth/register').send({
      name: 'Neha Student',
      email: 'neha.rbac@mitsgwalior.in',
      collegeId: '0901CS241010',
      branch: 'CSE',
      year: '2nd Year',
      semester: 4,
      password: 'Password@123',
    });
    expect(s1.status).toBe(201);
    studentToken = s1.body.token;
    studentId = s1.body.user.id;

    const s2 = await request(app).post('/api/auth/register').send({
      name: 'Kabir Student',
      email: 'kabir.rbac@mitsgwalior.in',
      collegeId: '0901CS241011',
      branch: 'CSE',
      year: '2nd Year',
      semester: 4,
      password: 'Password@123',
    });
    expect(s2.status).toBe(201);
    secondStudentToken = s2.body.token;

    // Student blocked from all /admin routes
    const studentAdminRes = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(studentAdminRes.status).toBe(403);

    // Team Admin 1 blocked from Super-Admin-only endpoints (team, settings patch, backups, permanent delete)
    expect(
      (await request(app).get('/api/admin/team').set('Authorization', `Bearer ${teamAdmin1Token}`)).status,
    ).toBe(403);
    expect(
      (await request(app).post('/api/admin/backups').set('Authorization', `Bearer ${teamAdmin1Token}`)).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch('/api/admin/settings')
          .set('Authorization', `Bearer ${teamAdmin1Token}`)
          .send({ siteName: 'Hacked', reason: 'Attempting escalation' })
      ).status,
    ).toBe(403);

    // Team Admin 1 cannot modify Super Admin account (403 + unauthorized_modification discrepancy)
    const modSuperRes = await request(app)
      .patch(`/api/admin/users/${superAdminId}`)
      .set('Authorization', `Bearer ${teamAdmin1Token}`)
      .send({ isSuspended: true, reason: 'Trying to suspend owner' });
    expect(modSuperRes.status).toBe(403);

    // Team Admin 1 lacks manage_requests permission -> blocked (403) while Team Admin 2 has it (200)
    expect(
      (await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${teamAdmin1Token}`)).status,
    ).toBe(403);
    expect(
      (await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${teamAdmin2Token}`)).status,
    ).toBe(200);

    // Super Admin cannot be suspended even via /admin/team/:id
    const disableOwner = await request(app)
      .patch(`/api/admin/team/${superAdminId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ isSuspended: true, reason: 'Self-disable guard test' });
    expect(disableOwner.status).toBe(403);
  });

  it('3. Mandatory Audit Reasons, Audit Log Immutability, Record Restoration & Team Admin Scoped Log Visibility', async () => {
    const bookRes = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Operating System Concepts',
        author: 'Silberschatz',
        subject: 'Operating Systems',
        branch: 'CSE',
        semester: 4,
        condition: 'Good',
        offerType: 'sell',
        price: 380,
        quantity: 2,
        description: 'Clean campus copy with solved exercises.',
      });
    expect(bookRes.status).toBe(201);
    sampleBookId = bookRes.body.book.id;

    // Listing modification without reason rejected (400)
    const noReasonRes = await request(app)
      .patch(`/api/admin/listings/${sampleBookId}`)
      .set('Authorization', `Bearer ${teamAdmin1Token}`)
      .send({ price: 320 });
    expect(noReasonRes.status).toBe(400);

    // Team Admin 1 corrects price with mandatory reason
    const editRes = await request(app)
      .patch(`/api/admin/listings/${sampleBookId}`)
      .set('Authorization', `Bearer ${teamAdmin1Token}`)
      .send({ price: 320, reason: 'Corrected pricing to match campus guideline' });
    expect(editRes.status).toBe(200);
    expect(editRes.body.listing.price).toBe(320);

    // Team Admin 1 sees own logs; Team Admin 2 does not see Team Admin 1 logs
    const t1Logs = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${teamAdmin1Token}`);
    expect(t1Logs.status).toBe(200);
    const priceFixLog = t1Logs.body.logs.find(
      (l: any) => l.targetId === sampleBookId && l.action === 'corrected listing data',
    );
    expect(priceFixLog).toBeTruthy();
    expect(priceFixLog.restorable).toBe(true);
    sampleAuditLogId = priceFixLog.id;

    const t2Logs = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${teamAdmin2Token}`);
    expect(
      t2Logs.body.logs.some((l: any) => l.actorId === teamAdmin1Id),
    ).toBe(false);

    // Audit logs cannot be deleted or edited via HTTP or Mongoose
    const delAuditRes = await request(app)
      .delete(`/api/admin/audit-logs/${sampleAuditLogId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(delAuditRes.status).toBe(403);

    await expect(AuditLog.deleteOne({ _id: sampleAuditLogId })).rejects.toThrow(/immutable/i);

    // Team Admin cannot restore records (403); Super Admin restores previous price (380)
    const t1Restore = await request(app)
      .post(`/api/admin/audit-logs/${sampleAuditLogId}/restore`)
      .set('Authorization', `Bearer ${teamAdmin1Token}`)
      .send({ reason: 'Trying restore as team admin' });
    expect(t1Restore.status).toBe(403);

    const superRestore = await request(app)
      .post(`/api/admin/audit-logs/${sampleAuditLogId}/restore`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'Restoring original student price after verification' });
    expect(superRestore.status).toBe(200);

    const restoredBook = await BookListing.findById(sampleBookId).lean();
    expect(restoredBook?.price).toBe(380);
  });

  it('4. Discrepancy Detection: detects quantity anomaly, duplicate listing, failed logins (no auto-suspend), availability mismatch & human investigation', async () => {
    // 4a. Quantity jump anomaly (2 -> 15 exceeds threshold 5)
    const jumpRes = await request(app)
      .patch(`/api/books/${sampleBookId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ quantity: 15, availableQuantity: 15 });
    expect(jumpRes.status).toBe(200);

    // 4b. Duplicate listing by same owner
    const dupBookRes = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Operating System Concepts',
        author: 'Silberschatz',
        subject: 'Operating Systems',
        branch: 'CSE',
        semester: 4,
        condition: 'Good',
        offerType: 'sell',
        price: 390,
        description: 'Duplicate listing test copy for campus marketplace.',
      });
    expect(dupBookRes.status).toBe(201);

    // 4c. Repeated failed login attempts (4 attempts) -> triggers alert, NEVER auto-suspends user
    for (let i = 0; i < 4; i++) {
      const badLogin = await request(app).post('/api/auth/login').send({
        identifier: 'neha.rbac@mitsgwalior.in',
        password: 'WrongPassword#99',
      });
      expect(badLogin.status).toBe(401);
    }
    const nehaAccount = await User.findById(studentId).lean();
    expect(nehaAccount?.isSuspended).toBe(false);

    // 4d. Availability mismatch caught by consistency scan
    await BookListing.updateOne(
      { _id: sampleBookId },
      { $set: { availableQuantity: 99, quantity: 2 } },
    );
    const scanRes = await request(app)
      .post('/api/admin/discrepancies/scan')
      .set('Authorization', `Bearer ${teamAdmin1Token}`);
    expect(scanRes.status).toBe(200);

    const discRes = await request(app)
      .get('/api/admin/discrepancies')
      .set('Authorization', `Bearer ${teamAdmin1Token}`);
    expect(discRes.status).toBe(200);
    const types = new Set(discRes.body.discrepancies.map((d: any) => d.type));
    expect(types.has('quantity_anomaly')).toBe(true);
    expect(types.has('duplicate_listing')).toBe(true);
    expect(types.has('repeated_failed_login')).toBe(true);
    expect(types.has('availability_mismatch')).toBe(true);
    expect(types.has('unauthorized_modification')).toBe(true);

    sampleDiscrepancyId = discRes.body.discrepancies[0].id;

    // Add investigation note & mark false_positive via human review
    const noteRes = await request(app)
      .post(`/api/admin/discrepancies/${sampleDiscrepancyId}/notes`)
      .set('Authorization', `Bearer ${teamAdmin1Token}`)
      .send({ note: 'Contacted student and inspected physical inventory receipt.' });
    expect(noteRes.status).toBe(201);

    const resolveRes = await request(app)
      .patch(`/api/admin/discrepancies/${sampleDiscrepancyId}`)
      .set('Authorization', `Bearer ${teamAdmin1Token}`)
      .send({
        status: 'false_positive',
        resolutionSummary: 'Confirmed legitimate bulk lab textbook donation.',
        reason: 'Completed human verification of student stock',
      });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.discrepancy.status).toBe('false_positive');

    const updatedDisc = await Discrepancy.findById(sampleDiscrepancyId).lean();
    expect(updatedDisc?.investigationNotes.length).toBeGreaterThanOrEqual(1);
  });

  it('5. Super Admin Backup & Restore, CSV Export, Popular Books Sort & Persistent Theme Preference', async () => {
    // Create backup snapshot
    const backupRes = await request(app)
      .post('/api/admin/backups')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ label: 'Pre-Test Checkpoint' });
    expect(backupRes.status).toBe(201);
    sampleBackupId = backupRes.body.backup.id;

    // Modify book price then restore from backup
    await BookListing.updateOne({ _id: sampleBookId }, { $set: { price: 999 } });
    const restoreBackupRes = await request(app)
      .post(`/api/admin/backups/${sampleBackupId}/restore`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'Testing full snapshot restore workflow' });
    expect(restoreBackupRes.status).toBe(200);

    const restoredFromBackup = await BookListing.findById(sampleBookId).lean();
    expect(restoredFromBackup?.price).toBe(380);

    // CSV Export
    const csvRes = await request(app)
      .get('/api/admin/analytics/export?type=discrepancies')
      .set('Authorization', `Bearer ${teamAdmin1Token}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('IssueID,Type,Severity');

    // Popularity tracking via request & view + sort=popular
    await request(app).get(`/api/books/${sampleBookId}`);
    const reqBook = await request(app)
      .post(`/api/books/${sampleBookId}/requests`)
      .set('Authorization', `Bearer ${secondStudentToken}`)
      .send({ message: 'Interested in buying this OS book', pickupLocation: 'Library' });
    expect(reqBook.status).toBe(201);

    const popularRes = await request(app).get('/api/books?sort=popular');
    expect(popularRes.status).toBe(200);
    expect(popularRes.body.books[0].id).toBe(sampleBookId);

    // Theme preference persisted on profile
    const themeRes = await request(app)
      .patch('/api/me/profile')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ themePreference: 'dark' });
    expect(themeRes.status).toBe(200);
    expect(themeRes.body.user.themePreference).toBe('dark');
  });
});
