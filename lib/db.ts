import path from 'path';
import fs from 'fs';
import { createClient, type Client } from '@libsql/client';

let _db: Client | null = null;

export function getDb(): Client {
  if (_db) return _db;

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'sunking.db');

  _db = createClient({
    url: `file:${dbPath}`,
  });

  return _db;
}

export default getDb;
