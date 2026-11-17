import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app.js';
import { connectDatabase, disconnectDatabase } from './server/config/db.js';
import { seedInitialDataIfEmpty } from './server/seed.js';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  await connectDatabase();
  await seedInitialDataIfEmpty();

  const app = createApp();

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BookBack] Server running at http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('[BookBack] Fatal startup error:', err);
  process.exit(1);
});
