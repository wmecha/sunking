import path from 'path';
import fs from 'fs';
import getDb from '@/lib/db';

/**
 * Schema initialisation.
 * The database schema (tables, indexes) is pre-created in Supabase via SUPABASE_SCHEMA.sql.
 * This function seeds `tracker_locations` from data/seeds/tracker_seed.json on first run
 * (i.e. when the table is empty) and is idempotent on subsequent calls.
 */
export async function initializeSchema(): Promise<void> {
  const db = getDb();

  // Check if the table already has data.
  // If the table doesn't exist yet (schema not applied), the query will throw —
  // catch it gracefully so the page doesn't crash before the schema is applied.
  let count = 0;
  try {
    const countResult = await db.execute('SELECT COUNT(*) as n FROM tracker_locations');
    count = Number(countResult.rows[0]?.n ?? 0);
  } catch (err) {
    console.warn('[schema] tracker_locations table not found — schema has not been applied yet. Skipping seed.', err);
    return;
  }
  if (count > 0) return; // Already seeded — nothing to do

  // Load seed file
  const seedPath = path.join(process.cwd(), 'data', 'seeds', 'tracker_seed.json');
  if (!fs.existsSync(seedPath)) {
    console.warn('[schema] tracker_seed.json not found — skipping seed');
    return;
  }

  const rows: Array<{
    store_code: string;
    business_name: string;
    country: string;
    location_type: string;
    ov: string;
    ou: string;
    claiming_issue: string;
    action_taken: string;
    address: string;
    city: string;
    tracker_status: string;
  }> = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  console.log(`[schema] Seeding ${rows.length} tracker locations…`);

  // Insert in batches of 50 to stay well within parameter limits
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const stmts = chunk.map((r) => ({
      sql: `
        INSERT INTO tracker_locations
          (store_code, business_name, country, location_type, ov, ou,
           claiming_issue, action_taken, address, city, tracker_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (store_code) DO NOTHING
      `,
      args: [
        r.store_code    ?? null,
        r.business_name ?? null,
        r.country       ?? null,
        r.location_type ?? null,
        r.ov            ?? null,
        r.ou            ?? null,
        r.claiming_issue ?? null,
        r.action_taken  ?? null,
        r.address       ?? null,
        r.city          ?? null,
        r.tracker_status ?? null,
      ],
    }));

    await db.batch(stmts);
  }

  console.log('[schema] Seed complete.');
}
