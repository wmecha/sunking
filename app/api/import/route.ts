export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { initializeSchema } from '@/lib/schema';
import { logAction } from '@/lib/audit';
import Papa from 'papaparse';

export async function GET() {
  await initializeSchema();
  const db = getDb();
  try {
    const result = await db.execute('SELECT * FROM gbp_snapshots ORDER BY imported_at DESC LIMIT 20');
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('[import] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch import history' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await initializeSchema();
  const db = getDb();
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (!file.name.endsWith('.csv')) return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 });

    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

    const rows = parsed.data;
    if (rows.length === 0) return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });

    const published   = rows.filter((r) => r['Status']?.toLowerCase().trim() === 'published').length;
    const notPublished = rows.filter((r) => r['Status']?.toLowerCase().trim() === 'not published').length;
    const duplicate   = rows.filter((r) => r['Status']?.toLowerCase().trim() === 'duplicate').length;

    // Insert snapshot and get back the new id
    const snapshotResult = await db.execute({
      sql: `INSERT INTO gbp_snapshots (filename, imported_at, total_count, published_count, not_published_count, duplicate_count)
            VALUES (?, NOW(), ?, ?, ?, ?)
            RETURNING id`,
      args: [file.name, rows.length, published, notPublished, duplicate],
    });
    const snapshotId = snapshotResult.rows[0]?.id as number;

    // Insert GBP location rows in chunks
    const locationStatements = rows.map((row) => ({
      sql: `INSERT INTO gbp_locations (snapshot_id, store_code, business_name, status, address, city, country)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT DO NOTHING`,
      args: [
        snapshotId,
        row['Shop code']  || row['Store code']    || row['store_code']    || null,
        row['Business name'] || row['Business Name'] || row['business_name'] || null,
        row['Status']     || null,
        row['Address']    || row['address']        || null,
        row['Locality']   || row['City']           || row['city']          || null,
        row['Country/Region'] || row['Country']    || row['country']       || null,
      ] as (string | number | null)[],
    }));

    const chunkSize = 500;
    for (let i = 0; i < locationStatements.length; i += chunkSize) {
      await db.batch(locationStatements.slice(i, i + chunkSize));
    }

    await logAction('import_gbp_csv', {
      filename: file.name,
      total: rows.length,
      published,
      notPublished,
      duplicate,
    }, 'gbp_snapshot', String(snapshotId));

    return NextResponse.json({
      success: true,
      snapshotId: String(snapshotId),
      filename: file.name,
      total: rows.length,
      published,
      notPublished,
      duplicate,
    });
  } catch (error) {
    console.error('[import] POST error:', error);
    return NextResponse.json({ error: 'Failed to import CSV' }, { status: 500 });
  }
}
