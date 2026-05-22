export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { initializeSchema } from '@/lib/schema';
import { TRACKER_STATUS_ALIASES, normalizeTrackerStatus } from '@/lib/status';
import Papa from 'papaparse';

function addStatusFilter(whereParts: string[], params: (string | number)[], status: string) {
  if (!status) return;
  const aliases = status
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => {
      const canonicalStatus = normalizeTrackerStatus(s);
      return canonicalStatus ? TRACKER_STATUS_ALIASES[canonicalStatus] : [s];
    });
  whereParts.push(`tracker_status IN (${aliases.map(() => '?').join(',')})`);
  params.push(...aliases);
}

function addStoreCodeFilter(whereParts: string[], params: (string | number)[], storeCodes: string) {
  const codes = storeCodes.split(',').map((s) => s.trim()).filter(Boolean);
  if (codes.length === 0) return;
  whereParts.push(`UPPER(TRIM(store_code)) IN (${codes.map(() => '?').join(',')})`);
  params.push(...codes.map((code) => code.toUpperCase()));
}

export async function GET(request: NextRequest) {
  await initializeSchema();
  const db = getDb();
  const { searchParams } = new URL(request.url);

  try {
    if (searchParams.get('action') === 'history') {
      const result = await db.execute('SELECT * FROM export_history ORDER BY exported_at DESC LIMIT 20');
      return NextResponse.json({ data: result.rows });
    }

    const country = searchParams.get('country') || '';
    const status = searchParams.get('status') || '';
    const locationType = searchParams.get('location_type') || '';
    const storeCodes = searchParams.get('store_codes') || '';
    const account = searchParams.get('account') || '';
    const gbpStatus = searchParams.get('gbpStatus') || '';
    const workflow = searchParams.get('workflow') || '';

    const whereParts: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (country) {
      const countries = country.split(',').filter(Boolean);
      if (countries.length === 1) {
        whereParts.push('country = ?'); params.push(countries[0]);
      } else if (countries.length > 1) {
        whereParts.push(`country IN (${countries.map(() => '?').join(',')})`);
        params.push(...countries);
      }
    }
    if (account === 'in') {
      whereParts.push(`EXISTS (
        SELECT 1
        FROM gbp_locations g
        WHERE g.snapshot_id = (SELECT id FROM gbp_snapshots ORDER BY imported_at DESC LIMIT 1)
          AND UPPER(TRIM(g.store_code)) = UPPER(TRIM(tracker_locations.store_code))
      )`);
    }
    if (account === 'out') {
      whereParts.push(`(
        claiming_issue ILIKE '%Awaiting Response%'
        OR claiming_issue ILIKE '%No Claim Option%'
      )`);
    }
    if (gbpStatus === 'published') {
      whereParts.push(`EXISTS (
        SELECT 1
        FROM gbp_locations g
        WHERE g.snapshot_id = (SELECT id FROM gbp_snapshots ORDER BY imported_at DESC LIMIT 1)
          AND UPPER(TRIM(g.store_code)) = UPPER(TRIM(tracker_locations.store_code))
          AND LOWER(TRIM(g.status)) = 'published'
      )`);
    }
    if (gbpStatus === 'not_verified') {
      whereParts.push(`EXISTS (
        SELECT 1
        FROM gbp_locations g
        WHERE g.snapshot_id = (SELECT id FROM gbp_snapshots ORDER BY imported_at DESC LIMIT 1)
          AND UPPER(TRIM(g.store_code)) = UPPER(TRIM(tracker_locations.store_code))
          AND LOWER(TRIM(g.status)) IN ('not published', 'duplicate')
      )`);
    }
    if (workflow === 'submitted') {
      whereParts.push("claiming_issue ILIKE '%Awaiting Response%'");
    }
    if (workflow === 'no_claim') {
      whereParts.push("claiming_issue ILIKE '%No Claim Option%'");
    }
    addStatusFilter(whereParts, params, status);
    if (locationType) { whereParts.push('location_type = ?'); params.push(locationType); }
    addStoreCodeFilter(whereParts, params, storeCodes);

    const where = 'WHERE ' + whereParts.join(' AND ');
    const result = await db.execute({
      sql: `SELECT * FROM tracker_locations ${where} ORDER BY country, business_name`,
      args: params,
    });

    const rows = result.rows as unknown as Array<Record<string, unknown>>;

    const exportRows = rows.map((r) => ({
      Status: r.tracker_status || '',
      'Store code': r.store_code || '',
      'Business name': r.business_name || '',
      Address: r.address || '',
      Locality: r.city || '',
      Latitude: r.latitude || '',
      Longitude: r.longitude || '',
      'Google Maps Link': r.google_maps_url || '',
      'Country/Region': r.country || '',
      'Location type': r.location_type || '',
      'OV Status': r.ov || '',
      'OU Status': r.ou || '',
      'Claiming Issue': r.claiming_issue || '',
      'Action Taken': r.action_taken || '',
    }));

    const csv = Papa.unparse(exportRows);
    const filename = `sunking_gbp_export_${new Date().toISOString().slice(0, 10)}.csv`;

    await db.execute({
      sql: `INSERT INTO export_history (exported_at, filename, filter_country, filter_status, row_count)
            VALUES (NOW(), ?, ?, ?, ?)`,
      args: [filename, country || null, status || null, rows.length],
    });

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[export] GET error:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await initializeSchema();
  const db = getDb();
  try {
    const body = await request.json();
    const { countries, status, statuses, location_type, store_codes } = body;

    const whereParts: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (countries && countries.length > 0) {
      whereParts.push(`country IN (${countries.map(() => '?').join(',')})`);
      params.push(...countries);
    }
    addStatusFilter(whereParts, params, Array.isArray(statuses) ? statuses.join(',') : status);
    if (location_type) { whereParts.push('location_type = ?'); params.push(location_type); }
    if (Array.isArray(store_codes) && store_codes.length > 0) {
      whereParts.push(`UPPER(TRIM(store_code)) IN (${store_codes.map(() => '?').join(',')})`);
      params.push(...store_codes.map((code: string) => code.toUpperCase()));
    }

    const where = 'WHERE ' + whereParts.join(' AND ');
    const result = await db.execute({
      sql: `SELECT COUNT(*) as count FROM tracker_locations ${where}`,
      args: params,
    });

    return NextResponse.json({ count: Number(result.rows[0]?.count ?? 0) });
  } catch (error) {
    console.error('[export] POST error:', error);
    return NextResponse.json({ error: 'Failed to count export rows' }, { status: 500 });
  }
}
