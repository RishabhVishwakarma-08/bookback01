import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const uploadDir =
  process.env.VERCEL === '1'
    ? path.join(os.tmpdir(), 'bookback-uploads')
    : path.resolve(process.cwd(), 'uploads');

fs.mkdirSync(uploadDir, { recursive: true });
