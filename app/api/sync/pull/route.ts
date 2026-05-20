export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { pullFromSheet } from '@/lib/sheet-sync';
import { getSheetSyncDisabledReason, isSheetSyncEnabled } from '@/lib/sheet-sync-config';
import { logAction } from '@/lib/audit';

export async function GET() {
  // Dry-run preview
  if (!isSheetSyncEnabled()) {
    return NextResponse.json(
      { error: getSheetSyncDisabledReason() },
      { status: 503 },
    );
  }
  try {
    const result = await pullFromSheet(true);
    return NextResponse.json({ ok: true, dryRun: true, ...result });
  } catch (error) {
    console.error('[sync/pull] GET error:', error);
    const msg = error instanceof Error ? error.message : 'Sync pull preview failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(_req: NextRequest) {
  if (!isSheetSyncEnabled()) {
    return NextResponse.json(
      { error: getSheetSyncDisabledReason() },
      { status: 503 },
    );
  }
  try {
    const result = await pullFromSheet(false);
    await logAction('sync_pull_from_sheet', {
      updated: result.updated,
      unchanged: result.unchanged,
      not_in_db: result.not_in_db.length,
    });
    return NextResponse.json({ ok: true, dryRun: false, ...result });
  } catch (error) {
    console.error('[sync/pull] POST error:', error);
    const msg = error instanceof Error ? error.message : 'Sync pull failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
