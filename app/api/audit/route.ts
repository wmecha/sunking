export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { initializeSchema } from '@/lib/schema';

export async function GET(request: NextRequest) {
  await initializeSchema();
  const db = getDb();

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = 50;
    const offset = (page - 1) * pageSize;
    const action = searchParams.get('action') || '';

    const whereParts = ['1=1'];
    const params: (string | number)[] = [];
    if (action) { whereParts.push('action = ?'); params.push(action); }
    const where = 'WHERE ' + whereParts.join(' AND ');

    const [countResult, dataResult, actionsResult] = await Promise.all([
      db.execute({ sql: `SELECT COUNT(*) as count FROM audit_logs ${where}`, args: params }),
      db.execute({
        sql: `SELECT * FROM audit_logs ${where} ORDER BY performed_at DESC LIMIT ? OFFSET ?`,
        args: [...params, pageSize, offset],
      }),
      db.execute('SELECT DISTINCT action FROM audit_logs ORDER BY action'),
    ]);

    return NextResponse.json({
      data: dataResult.rows,
      total: Number(countResult.rows[0]?.count ?? 0),
      page,
      pageSize,
      actions: actionsResult.rows.map((r) => r.action),
    });
  } catch (error) {
    console.error('[audit] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
