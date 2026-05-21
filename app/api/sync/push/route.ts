export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { previewPushToSheet, pushAllToSheet } from '@/lib/sheet-sync';
import { getSheetSyncDisabledReason, isSheetSyncEnabled } from '@/lib/sheet-sync-config';
import { logAction } from '@/lib/audit';

export async function GET() {
  if (!isSheetSyncEnabled()) {
    return NextResponse.json(
      { error: getSheetSyncDisabledReason() },
      { status: 503 },
    );
  }

  try {
    const result = await previewPushToSheet();
    return NextResponse.json({ ok: true, dryRun: true, ...result });
  } catch (error) {
    console.error('[sync/push] GET error:', error);
    const msg = error instanceof Error ? error.message : 'Sync push preview failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSheetSyncEnabled()) {
    return NextResponse.json(
      { error: getSheetSyncDisabledReason() },
      { status: 503 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const storeCodes = Array.isArray(body?.store_codes)
      ? body.store_codes.map((code: unknown) => String(code).trim()).filter(Boolean)
      : undefined;
    const result = await pushAllToSheet(storeCodes);
    await logAction('sync_push_to_sheet', {
      pushed: result.pushed,
      updated: result.updated,
      appended: result.appended,
      chunked: Boolean(storeCodes?.length),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[sync/push] error:', error);
    const msg = error instanceof Error ? error.message : 'Sync push failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
