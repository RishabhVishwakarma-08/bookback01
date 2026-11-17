import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { Campus } from '../server/models/Campus.js';
import { User } from '../server/models/User.js';
import { hashPassword } from '../server/utils/security.js';

let mongod: MongoMemoryServer;
let app: ReturnType<typeof createApp>;

let sellerToken = '';
let sellerId = '';
let buyerToken = '';
let buyerId = '';
let outsiderToken = '';
let adminToken = '';
let createdBookId = '';
let createdRequestId = '';
let createdTxId = '';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('bookback_integration_test'));
  app = createApp();

  const campus = await Campus.create({
    name: 'MITS Gwalior',
    domain: 'mitsgwalior.in',
    location: 'Gwalior, MP',
  });

  const adminHash = await hashPassword('AdminPass#2026');
  await User.create({
    name: 'Test Admin',
    email: 'admin@mitsgwalior.in',
    collegeId: 'ADMIN999',
    branch: 'CSE',
    year: '4th Year',
    semester: 8,
    campusId: campus._id,
    passwordHash: adminHash,
    role: 'admin',
    verified: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Integration Tests — BookBack Full Student & Admin Journey', () => {
  it('T01 & T02: Registers students, enforces duplicate email/collegeId check, and hides passwordHash', async () => {
    const res1 = await request(app).post('/api/auth/register').send({
      name: 'Aarav Senior',
      email: 'aarav.test@mitsgwalior.in',
      collegeId: '0901CS231001',
      branch: 'CSE',
      year: '3rd Year',
      semester: 6,
      password: 'Password@123',
    });
    expect(res1.status).toBe(201);
    expect(res1.body.token).toBeTruthy();
    expect(res1.body.user.passwordHash).toBeUndefined();
    expect(res1.body.user.verified).toBe(true); // auto-verified via @mitsgwalior.in
    sellerToken = res1.body.token;
    sellerId = res1.body.user.id;

    // Duplicate email rejected with 409
    const dup = await request(app).post('/api/auth/register').send({
      name: 'Duplicate',
      email: 'aarav.test@mitsgwalior.in',
      collegeId: '0901CS231999',
      branch: 'CSE',
      year: '3rd Year',
      semester: 6,
      password: 'Password@123',
    });
    expect(dup.status).toBe(409);

    // Register buyer & outsider
    const res2 = await request(app).post('/api/auth/register').send({
      name: 'Priya Buyer',
      email: 'priya.test@mitsgwalior.in',
      collegeId: '0901CS251002',
      branch: 'CSE',
      year: '1st Year',
      semester: 2,
      password: 'Password@123',
    });
    expect(res2.status).toBe(201);
    buyerToken = res2.body.token;
    buyerId = res2.body.user.id;

    const res3 = await request(app).post('/api/auth/register').send({
      name: 'Rohan Outsider',
      email: 'rohan.out@gmail.com',
      collegeId: '0901EC241003',
      branch: 'ECE',
      year: '2nd Year',
      semester: 4,
      password: 'Password@123',
    });
    expect(res3.status).toBe(201);
    expect(res3.body.user.verified).toBe(false);
    outsiderToken = res3.body.token;
  });

  it('T03 & T04: Authenticates valid login and rejects invalid password', async () => {
    const ok = await request(app).post('/api/auth/login').send({
      identifier: '0901CS251002',
      password: 'Password@123',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.user.id).toBe(buyerId);

    const bad = await request(app).post('/api/auth/login').send({
      identifier: 'priya.test@mitsgwalior.in',
      password: 'WrongPassword!',
    });
    expect(bad.status).toBe(401);
  });

  it('T05-T08: Creates a book listing, searches by keyword/semester, handles missing title, and opens details', async () => {
    const createRes = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: 'Computer Networking: A Top-Down Approach',
        author: 'James Kurose, Keith Ross',
        subject: 'Computer Networks',
        course: 'CS-502',
        edition: '8th Edition',
        branch: 'CSE',
        semester: 5,
        condition: 'Like New',
        offerType: 'sell',
        price: 450,
        description: 'Clean textbook with zero pen marks. Pickup at Central Library.',
      });

    expect(createRes.status).toBe(201);
    createdBookId = createRes.body.book.id;

    const searchOk = await request(app).get('/api/books?q=Kurose&semester=5&offerType=sell');
    expect(searchOk.status).toBe(200);
    expect(searchOk.body.books.length).toBe(1);
    expect(searchOk.body.books[0].id).toBe(createdBookId);

    const searchEmpty = await request(app).get('/api/books?q=NonExistentQuantumBook999');
    expect(searchEmpty.status).toBe(200);
    expect(searchEmpty.body.books.length).toBe(0);

    const detail = await request(app).get(`/api/books/${createdBookId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.book.title).toContain('Computer Networking');
    // Public details must NOT expose private email or collegeId
    expect(detail.body.book.owner.email).toBeUndefined();
    expect(detail.body.book.owner.collegeId).toBeUndefined();
  });

  it('E2E 4-6: Submits book request, enforces duplicate/self-request rules, exchanges messages, and triggers notifications', async () => {
    // Self-request forbidden
    const selfReq = await request(app)
      .post(`/api/books/${createdBookId}/requests`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ message: 'Testing self request' });
    expect(selfReq.status).toBe(400);

    // Buyer requests book
    const reqRes = await request(app)
      .post(`/api/books/${createdBookId}/requests`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        message: 'Hi Aarav, can I buy this tomorrow at 1 PM near the library?',
        pickupLocation: 'Library Steps',
      });
    expect(reqRes.status).toBe(201);
    createdRequestId = reqRes.body.request.id;

    // Duplicate active request rejected with 409
    const dupReq = await request(app)
      .post(`/api/books/${createdBookId}/requests`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ message: 'Duplicate request attempt' });
    expect(dupReq.status).toBe(409);

    // Owner receives notification
    const sellerNotifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(sellerNotifs.status).toBe(200);
    expect(sellerNotifs.body.unreadCount).toBeGreaterThanOrEqual(1);

    // Owner replies in request conversation
    const msgRes = await request(app)
      .post(`/api/requests/${createdRequestId}/messages`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ body: 'Yes, 1 PM at the Library Steps works for me.' });
    expect(msgRes.status).toBe(201);

    // Buyer receives new_message notification
    const buyerNotifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(buyerNotifs.status).toBe(200);
    expect(buyerNotifs.body.notifications.some((n: any) => n.type === 'new_message')).toBe(true);
  });

  it('E2E 7 (Access Control): Rejects unauthorized 3rd student from reading or posting private request messages (403)', async () => {
    const readAttempt = await request(app)
      .get(`/api/requests/${createdRequestId}/messages`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(readAttempt.status).toBe(403);

    const postAttempt = await request(app)
      .post(`/api/requests/${createdRequestId}/messages`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ body: 'Snooping attempt' });
    expect(postAttempt.status).toBe(403);
  });

  it('Accepts request -> creates transaction -> completes handover -> submits review', async () => {
    // Buyer cannot accept own request
    const buyerAccept = await request(app)
      .patch(`/api/requests/${createdRequestId}/status`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ status: 'accepted' });
    expect(buyerAccept.status).toBe(403);

    // Owner accepts request
    const ownerAccept = await request(app)
      .patch(`/api/requests/${createdRequestId}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'accepted' });
    expect(ownerAccept.status).toBe(200);
    expect(ownerAccept.body.request.status).toBe('accepted');
    expect(ownerAccept.body.request.transaction.id).toBeTruthy();
    createdTxId = ownerAccept.body.request.transaction.id;

    // Complete handover
    const completeRes = await request(app)
      .post(`/api/transactions/${createdTxId}/complete`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.transaction.status).toBe('completed');

    // Buyer submits review
    const reviewRes = await request(app)
      .post(`/api/transactions/${createdTxId}/reviews`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ rating: 5, comment: 'Book was in great condition and handover was on time.' });
    expect(reviewRes.status).toBe(201);

    // Duplicate review rejected
    const dupReview = await request(app)
      .post(`/api/transactions/${createdTxId}/reviews`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ rating: 4, comment: 'Second review attempt' });
    expect(dupReview.status).toBe(409);

    // Seller profile reflects completed transaction & rating
    const profileRes = await request(app).get(`/api/users/${sellerId}/profile`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.profile.completedTransactions).toBe(1);
    expect(profileRes.body.profile.averageRating).toBe(5);
  });

  it('Admin RBAC: Blocks students from /api/admin/* (403) and allows Admin to verify users with AuditLog', async () => {
    const studentAttempt = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(studentAttempt.status).toBe(403);

    const adminLogin = await request(app).post('/api/auth/login').send({
      identifier: 'admin@mitsgwalior.in',
      password: 'AdminPass#2026',
    });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.token;

    const overview = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(overview.status).toBe(200);
    expect(overview.body.stats.completedTransactions).toBe(1);

    const usersRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const rohan = usersRes.body.users.find((u: any) => u.email === 'rohan.out@gmail.com');
    expect(rohan.verified).toBe(false);

    const verifyRes = await request(app)
      .patch(`/api/admin/users/${rohan.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ verified: true, reason: 'Verified institutional domain registration' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.user.verified).toBe(true);

    const auditRes = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.logs.length).toBeGreaterThanOrEqual(1);
    expect(auditRes.body.logs[0].reason).toBe('Verified institutional domain registration');
  });
});
