import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { Campus } from '../server/models/Campus.js';

let mongod: MongoMemoryServer;
let app: ReturnType<typeof createApp>;
let userToken = '';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('bookback_security_test'));
  app = createApp();

  await Campus.create({
    name: 'MITS Gwalior',
    domain: 'mitsgwalior.in',
    location: 'Gwalior, MP',
  });

  const reg = await request(app).post('/api/auth/register').send({
    name: 'Security Tester',
    email: 'sec@mitsgwalior.in',
    collegeId: '0901CS251077',
    branch: 'CSE',
    year: '2nd Year',
    semester: 4,
    password: 'StrongPassword@99',
  });
  userToken = reg.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Security & Injection Testing', () => {
  it('SEC-01 (NoSQL Injection): Rejects $ne / $gt / $where operator objects on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: { $ne: '' },
        password: { $gt: '' },
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('prohibited');
  });

  it('SEC-02 (NoSQL Injection): Rejects dotted keys and $regex injection in query parameters', async () => {
    const res = await request(app).get('/api/books?q[$regex]=.*');
    expect(res.status).toBe(400);

    const res2 = await request(app).post('/api/books').set('Authorization', `Bearer ${userToken}`).send({
      title: 'Valid Book',
      author: 'Author Name',
      subject: 'Algorithms',
      branch: 'CSE',
      semester: 4,
      condition: 'Good',
      offerType: 'donate',
      price: 0,
      description: 'Valid description for testing.',
      'owner.role': 'admin',
    });
    expect(res2.status).toBe(400);
  });

  it('SEC-03 (SQL Injection Strings): Handles classic SQLi payloads safely as inert literal text', async () => {
    const sqliLogin = await request(app).post('/api/auth/login').send({
      identifier: "' OR '1'='1",
      password: "' OR '1'='1",
    });
    expect(sqliLogin.status).toBe(401);

    const sqliSearch = await request(app).get("/api/books?q='; DROP TABLE books; --");
    expect(sqliSearch.status).toBe(200);
    expect(sqliSearch.body.books).toEqual([]);
  });

  it('SEC-04 (Stored XSS): Strips <script> tags and inline event handlers before saving book listings', async () => {
    const res = await request(app)
      .post('/api/books')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: '<script>alert("XSS")</script>Discrete Mathematics',
        author: '<img src=x onerror=alert(1)>Kenneth Rosen',
        subject: 'Mathematics',
        branch: 'CSE',
        semester: 3,
        condition: 'Good',
        offerType: 'donate',
        price: 0,
        description: 'Clean book <script>fetch("http://evil.example")</script> available near lab.',
      });

    expect(res.status).toBe(201);
    expect(res.body.book.title).toBe('Discrete Mathematics');
    expect(res.body.book.author).toBe('Kenneth Rosen');
    expect(res.body.book.description).not.toContain('<script>');
    expect(res.body.book.author).not.toContain('onerror');
  });

  it('SEC-05 (Privilege Escalation): Ignores role="admin" supplied during public registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Escalation Attempt',
      email: 'attacker@mitsgwalior.in',
      collegeId: '0901CS251099',
      branch: 'CSE',
      year: '1st Year',
      semester: 1,
      role: 'admin',
      password: 'Password@123',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('student');
  });

  it('SEC-06 (Auth & Security Headers): Verifies Helmet headers and unauthenticated endpoint rejection', async () => {
    const unauth = await request(app).post('/api/books').send({ title: 'Unauthorized' });
    expect(unauth.status).toBe(401);
    expect(unauth.headers['x-content-type-options']).toBe('nosniff');
    expect(unauth.headers['x-powered-by']).toBeUndefined();
  });
});
