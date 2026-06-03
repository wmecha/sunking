export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { initializeSchema } from '@/lib/schema';
import { logAction } from '@/lib/audit';
import { TRACKER_STATUSES, TRACKER_STATUS_ALIASES, normalizeTrackerStatus } from '@/lib/status';

export async function GET(request: NextRequest) {
  await initializeSchema();
  const db = getDb();

  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || '';
    const status = searchParams.get('status') || '';
    const account = searchParams.get('account') || '';
    const gbpStatus = searchParams.get('gbpStatus') || '';
    const workflow = searchParams.get('workflow') || '';
    const duplicates = searchParams.get('duplicates') || '';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const offset = (page - 1) * pageSize;

    const whereParts: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (country) { whereParts.push('t.country = ?'); params.push(country); }
    if (status) {
      const aliases = status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .flatMap((s) => {
          const canonicalStatus = normalizeTrackerStatus(s);
          return canonicalStatus ? TRACKER_STATUS_ALIASES[canonicalStatus] : [s];
        });
      whereParts.push(`t.tracker_status IN (${aliases.map(() => '?').join(',')})`);
      params.push(...aliases);
    }
    if (account === 'in') {
      whereParts.push(`EXISTS (
        SELECT 1
        FROM gbp_locations g
        WHERE g.snapshot_id = (SELECT id FROM gbp_snapshots ORDER BY imported_at DESC LIMIT 1)
          AND UPPER(TRIM(g.store_code)) = UPPER(TRIM(t.store_code))
      )`);
    }
    if (account === 'out') {
      whereParts.push(`(
        t.claiming_issue ILIKE '%Awaiting Response%'
        OR t.claiming_issue ILIKE '%No Claim Option%'
      )`);
    }
    if (gbpStatus === 'published') {
      whereParts.push(`EXISTS (
        SELECT 1
        FROM gbp_locations g
        WHERE g.snapshot_id = (SELECT id FROM gbp_snapshots ORDER BY imported_at DESC LIMIT 1)
          AND UPPER(TRIM(g.store_code)) = UPPER(TRIM(t.store_code))
          AND LOWER(TRIM(g.status)) = 'published'
      )`);
    }
    if (gbpStatus === 'not_verified') {
      whereParts.push(`EXISTS (
        SELECT 1
        FROM gbp_locations g
        WHERE g.snapshot_id = (SELECT id FROM gbp_snapshots ORDER BY imported_at DESC LIMIT 1)
          AND UPPER(TRIM(g.store_code)) = UPPER(TRIM(t.store_code))
          AND LOWER(TRIM(g.status)) IN ('not published', 'duplicate')
      )`);
    }
    if (workflow === 'submitted') {
      whereParts.push("t.claiming_issue ILIKE '%Awaiting Response%'");
    }
    if (workflow === 'no_claim') {
      whereParts.push("t.claiming_issue ILIKE '%No Claim Option%'");
    }
    if (duplicates === '1') {
      whereParts.push("t.duplicate_flag IS NOT NULL AND t.duplicate_flag != ''");
    }
    if (search) {
      whereParts.push('(t.store_code ILIKE ? OR t.business_name ILIKE ? OR t.city ILIKE ? OR t.country ILIKE ? OR t.address ILIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    const where = 'WHERE ' + whereParts.join(' AND ');

    const countResult = await db.execute({ sql: `SELECT COUNT(*) as count FROM tracker_locations t ${where}`, args: params });
    const total = Number(countResult.rows[0]?.count ?? 0);

    // When viewing duplicates, cluster each group together (canonical row
    // before its duplicate); otherwise sort by country + name as usual.
    const orderBy = duplicates === '1'
      ? 'ORDER BY t.duplicate_flag, t.country, t.business_name'
      : 'ORDER BY t.country, t.business_name';

    const dataResult = await db.execute({
      sql: `SELECT t.* FROM tracker_locations t ${where} ${orderBy} LIMIT ? OFFSET ?`,
      args: [...params, pageSize, offset],
    });

    const countriesResult = await db.execute('SELECT DISTINCT country FROM tracker_locations WHERE country IS NOT NULL AND country != \'\' ORDER BY country');
    const statusesResult = await db.execute('SELECT DISTINCT tracker_status FROM tracker_locations WHERE tracker_status IS NOT NULL AND tracker_status != \'\' ORDER BY tracker_status');
    const statuses = Array.from(new Set([
      ...TRACKER_STATUSES,
      ...statusesResult.rows.map((r) => String(r.tracker_status ?? '')).filter(Boolean),
    ]));

    return NextResponse.json({
      data: dataResult.rows,
      total,
      page,
      pageSize,
      countries: countriesResult.rows.map((r) => r.country),
      statuses,
    });
  } catch (error) {
    console.error('[tracker] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch tracker locations' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  await initializeSchema();
  const db = getDb();

  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const allowedFields = [
      'store_code', 'business_name', 'country', 'location_type',
      'ov', 'ou', 'claiming_issue', 'action_taken', 'address', 'city', 'tracker_status',
      'latitude', 'longitude', 'primary_phone', 'website', 'primary_category',
      'monday_hours', 'tuesday_hours', 'wednesday_hours', 'thursday_hours',
      'friday_hours', 'saturday_hours', 'sunday_hours',
      'google_maps_url',
    ];

    const entries = Object.entries(fields).filter(([key]) => allowedFields.includes(key));
    if (entries.length === 0) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    const setClauses = entries.map(([key]) => `${key} = ?`);
    setClauses.push('updated_at = NOW()');
    const values = entries.map(([, val]) => {
      // Convert empty strings to null for nullable numeric cols, pass others through.
      if (val === '') return null;
      return val as string | number | null;
    });

    await db.execute({
      sql: `UPDATE tracker_locations SET ${setClauses.join(', ')} WHERE id = ?`,
      args: [...values, id],
    });

    const updated = await db.execute({ sql: 'SELECT * FROM tracker_locations WHERE id = ?', args: [id] });

    await logAction('edit_tracker_location', { fields: Object.fromEntries(entries) }, 'tracker_location', String(id));

    return NextResponse.json({ data: updated.rows[0] });
  } catch (error) {
    console.error('[tracker] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
  }
}
