import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { sanitizeRequestMiddleware } from './middleware/sanitize.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import booksRoutes from './routes/books.js';
import notificationsRoutes from './routes/notifications.js';
import reportsRoutes from './routes/reports.js';
import requestsRoutes from './routes/requests.js';
import setupRoutes from './routes/setup.js';
import usersRoutes from './routes/users.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const allowedOrigin = process.env.CLIENT_ORIGIN?.trim();
  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (allowedOrigin && requestOrigin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    } else if (!allowedOrigin && requestOrigin) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Defense against NoSQL operator injection and stored XSS payloads
  app.use('/api', sanitizeRequestMiddleware);

  // Serve uploaded book photos and generated cover assets safely
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
  app.use('/src/assets/images', express.static(path.resolve(process.cwd(), 'src/assets/images')));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'bookback-api' });
  });

  // Mount API routes on both /api (Milestone 3 spec) and /api/v1 (SDD spec)
  const apiRouters = [
    setupRoutes,
    authRoutes,
    booksRoutes,
    requestsRoutes,
    notificationsRoutes,
    usersRoutes,
    reportsRoutes,
    adminRoutes,
  ];

  for (const r of apiRouters) {
    app.use('/api', r);
    app.use('/api/v1', r);
  }

  // Global error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Uploaded image must be smaller than 4 MB.' });
      return;
    }
    if (err?.message?.includes('Only JPEG, PNG, and WebP')) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}
