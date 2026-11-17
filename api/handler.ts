import type { Request, Response } from 'express';
import { createApp } from '../server/app.js';
import { connectDatabase } from '../server/config/db.js';
import { seedInitialDataIfEmpty } from '../server/seed.js';

const app = createApp();
let initialization: Promise<void> | undefined;

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    if (!initialization) {
      initialization = connectDatabase()
        .then(() => seedInitialDataIfEmpty())
        .catch((error: unknown) => {
          initialization = undefined;
          throw error;
        });
    }

    await initialization;

    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const apiPath = requestUrl.searchParams.get('__api_path');
    if (apiPath !== null) {
      requestUrl.searchParams.delete('__api_path');
      req.url = `/api/${apiPath}${requestUrl.search}`;
    }

    app(req, res);
  } catch (error) {
    console.error('[BookBack Vercel API] Initialization failed:', error);
    res.status(503).json({ error: 'API service is temporarily unavailable.' });
  }
}
