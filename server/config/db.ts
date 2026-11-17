import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer: MongoMemoryServer | null = null;
let isConnected = false;

async function connectLocalPersistentMongo(): Promise<string> {
  const dbPath = path.resolve(process.cwd(), 'data', 'mongodb');
  fs.mkdirSync(dbPath, { recursive: true });
  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbPath,
      storageEngine: 'wiredTiger',
      dbName: 'bookback',
    },
  });
  const uri = memoryServer.getUri('bookback');
  await mongoose.connect(uri, { autoIndex: true });
  isConnected = true;
  console.log(`[BookBack DB] Connected to persistent local MongoDB (WiredTiger) at ${dbPath}`);
  return uri;
}

export async function connectDatabase(customUri?: string): Promise<string> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection.host;
  }

  const envUri = customUri || process.env.MONGODB_URI?.trim();

  if (envUri) {
    try {
      console.log('[BookBack DB] Connecting to external MONGODB_URI...');
      await mongoose.connect(envUri, {
        autoIndex: true,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      isConnected = true;
      console.log('[BookBack DB] Connected to external MongoDB.');
      return envUri;
    } catch (err: any) {
      console.warn(
        `[BookBack DB] External MONGODB_URI connection failed (${err?.message || err}). ` +
          'If using MongoDB Atlas, ensure 0.0.0.0/0 is whitelisted in Network Access. ' +
          'Falling back to persistent local MongoDB so the application remains available.',
      );
      try {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }
      } catch {
        // ignore cleanup failure
      }
    }
  }

  return connectLocalPersistentMongo();
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  isConnected = false;
}
