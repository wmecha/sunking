export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { buildGeocodeQuery, geocodeAddress, isGeocodingEnabled } from '@/lib/geocode';
import { logAction } from '@/lib/audit';

/**
 * Batch-geocode tracker rows that have no lat/lng yet.
 *
 * Query params:
 *   limit (default 50, max 200) — how many rows to process this invocation
 *
 * Returns: { processed, succeeded, failed, skipped, remaining, samples }
 *
 * The endpoint is safe to call repeatedly: it only ever picks up rows
 * where latitude IS NULL. Run it 10x to cover 488 rows at limit=50.
 */
export async function POST(request: NextRequest) {
  if (!isGeocodingEnabled()) {
    return NextResponse.json(
      { error: 'Geocoding disabled. Set GOOGLE_MAPS_API_KEY on Vercel.' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

  const db = getDb();
  try {
    const rowsResp = await db.execute({
      sql: `SELECT id, store_code, business_name, address, city, country
            FROM tracker_locations
            WHERE latitude IS NULL
            ORDER BY country, business_name
            LIMIT ?`,
      args: [limit],
    });
    const rows = rowsResp.rows as unknown as Array<{
      id: number;
      store_code: string;
      business_name: string;
      address: string | null;
      city: string | null;
      country: string | null;
    }>;

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const samples: Array<{ store_code: string; query: string; ok: boolean; formatted?: string }> = [];

    for (const row of rows) {
      const query = buildGeocodeQuery(row);
      if (!query.trim()) {
        skipped++;
        continue;
      }
      try {
        const result = await geocodeAddress(query, row.country);
        if (!result) {
          failed++;
          if (samples.length < 5) samples.push({ store_code: row.store_code, query, ok: false });
          continue;
        }
        await db.execute({
          sql: `UPDATE tracker_locations
                SET latitude = ?, longitude = ?
                WHERE id = ? AND latitude IS NULL`,
          args: [result.latitude, result.longitude, row.id],
        });
        succeeded++;
        if (samples.length < 5) {
          samples.push({ store_code: row.store_code, query, ok: true, formatted: result.formatted_address });
        }
      } catch {
        failed++;
        if (samples.length < 5) samples.push({ store_code: row.store_code, query, ok: false });
      }
    }

    const remainingResp = await db.execute(
      'SELECT COUNT(*) AS n FROM tracker_locations WHERE latitude IS NULL',
    );
    const remaining = Number(remainingResp.rows[0]?.n ?? 0);

    await logAction('geocode_batch', { processed: rows.length, succeeded, failed, skipped, remaining });

    return NextResponse.json({
      processed: rows.length,
      succeeded,
      failed,
      skipped,
      remaining,
      samples,
    });
  } catch (error) {
    console.error('[geocode/batch] error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Geocode batch failed' }, { status: 500 });
  }
}
