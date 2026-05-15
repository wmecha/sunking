import path from 'path';
import fs from 'fs';
import getDb from './db';

let initialized = false;
let initializing = false;

export async function initializeSchema(): Promise<void> {
  if (initialized) return;
  if (initializing) {
    // Wait for the in-flight initialization
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (initialized) { clearInterval(check); resolve(); }
      }, 50);
    });
    return;
  }
  initializing = true;

  const db = getDb();

  try {
  // Create all tables
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS gbp_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        total_count INTEGER DEFAULT 0,
        published_count INTEGER DEFAULT 0,
        not_published_count INTEGER DEFAULT 0,
        duplicate_count INTEGER DEFAULT 0,
        notes TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS gbp_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        store_code TEXT,
        business_name TEXT,
        status TEXT,
        address TEXT,
        city TEXT,
        country TEXT,
        FOREIGN KEY (snapshot_id) REFERENCES gbp_snapshots(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS tracker_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_code TEXT UNIQUE,
        business_name TEXT,
        country TEXT,
        location_type TEXT,
        ov TEXT,
        ou TEXT,
        claiming_issue TEXT,
        action_taken TEXT,
        address TEXT,
        city TEXT,
        tracker_status TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS reconciliation_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_at TEXT NOT NULL,
        snapshot_id INTEGER NOT NULL,
        total_gbp INTEGER,
        total_tracker INTEGER,
        matched INTEGER,
        ov_confirmed INTEGER,
        ou_confirmed INTEGER,
        missing_from_tracker INTEGER,
        status_mismatches INTEGER,
        FOREIGN KEY (snapshot_id) REFERENCES gbp_snapshots(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS export_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exported_at TEXT NOT NULL,
        filename TEXT,
        filter_country TEXT,
        filter_status TEXT,
        row_count INTEGER
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        details TEXT,
        performed_at TEXT DEFAULT (datetime('now'))
      )`,
      args: [],
    },
  ], 'write');

  // Seed tracker data if empty
  const trackerCountResult = await db.execute('SELECT COUNT(*) as count FROM tracker_locations');
  const trackerCount = Number(trackerCountResult.rows[0]?.count ?? 0);

  if (trackerCount === 0) {
    const seedPath = path.join(process.cwd(), 'data', 'seeds', 'tracker_seed.json');
    if (fs.existsSync(seedPath)) {
      const seedData: Record<string, string>[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

      const insertStatements = seedData.map((row) => ({
        sql: `INSERT OR IGNORE INTO tracker_locations
          (store_code, business_name, country, location_type, ov, ou, claiming_issue, action_taken, address, city, tracker_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          row.store_code || null,
          row.business_name || null,
          row.country || null,
          row.location_type || null,
          row.ov || null,
          row.ou || null,
          row.claiming_issue || null,
          row.action_taken || null,
          row.address || null,
          row.city || null,
          row.tracker_status || null,
        ] as (string | null)[],
      }));

      await db.batch(insertStatements, 'write');
      console.log(`[schema] Seeded ${seedData.length} tracker locations`);
    }
  }

  // Seed GBP snapshot if empty
  const snapshotCountResult = await db.execute('SELECT COUNT(*) as count FROM gbp_snapshots');
  const snapshotCount = Number(snapshotCountResult.rows[0]?.count ?? 0);

  if (snapshotCount === 0) {
    const gbpCsvPath = path.join(process.cwd(), 'data', 'seeds', 'gbp_latest.csv');
    if (fs.existsSync(gbpCsvPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Papa = require('papaparse');
      const csvContent = fs.readFileSync(gbpCsvPath, 'utf-8');
      const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
      const rows = parsed.data as Record<string, string>[];

      if (rows.length > 0) {
        const published = rows.filter(
          (r) => r['Status']?.toLowerCase().trim() === 'published'
        ).length;
        const notPublished = rows.filter(
          (r) => r['Status']?.toLowerCase().trim() === 'not published'
        ).length;
        const duplicate = rows.filter(
          (r) => r['Status']?.toLowerCase().trim() === 'duplicate'
        ).length;

        const snapshotResult = await db.execute({
          sql: `INSERT INTO gbp_snapshots (filename, imported_at, total_count, published_count, not_published_count, duplicate_count, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: ['gbp_latest.csv', new Date().toISOString(), rows.length, published, notPublished, duplicate, 'Auto-seeded from gbp_latest.csv'],
        });

        const snapshotId = snapshotResult.lastInsertRowid;

        const locationStatements = rows.map((row) => ({
          sql: `INSERT INTO gbp_locations (snapshot_id, store_code, business_name, status, address, city, country)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            snapshotId,
            row['Shop code'] || row['Store code'] || row['store_code'] || null,
            row['Business name'] || row['business_name'] || null,
            row['Status'] || null,
            row['Address'] || row['address'] || null,
            row['Locality'] || row['city'] || null,
            row['Country/Region'] || row['Country'] || row['country'] || null,
          ] as (string | number | bigint | null)[],
        }));

        // Batch in chunks of 500 to avoid limits
        const chunkSize = 500;
        for (let i = 0; i < locationStatements.length; i += chunkSize) {
          await db.batch(locationStatements.slice(i, i + chunkSize), 'write');
        }

        console.log(`[schema] Seeded GBP snapshot with ${rows.length} locations`);
      }
    }
  }

  initialized = true;
  } catch (err) {
    // Reset flags so the next request can retry initialization
    initializing = false;
    initialized = false;
    throw err;
  }
}
