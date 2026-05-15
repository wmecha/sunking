export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { initializeSchema } from '@/lib/schema';
import Papa from 'papaparse';

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
    if (status) { whereParts.push('tracker_status = ?'); params.push(status); }
    if (locationType) { whereParts.push('location_type = ?'); params.push(locationType); }

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
            VALUES (?, ?, ?, ?, ?)`,
      args: [new Date().toISOString(), filename, country || null, status || null, rows.length],
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
    const { countries, status, location_type } = body;

    const whereParts: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (countries && countries.length > 0) {
      whereParts.push(`country IN (${countries.map(() => '?').join(',')})`);
      params.push(...countries);
    }
    if (status) { whereParts.push('tracker_status = ?'); params.push(status); }
    if (location_type) { whereParts.push('location_type = ?'); params.push(location_type); }

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
