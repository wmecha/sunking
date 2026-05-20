'use client';

import { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface SyncPanelProps {
  syncEnabled: boolean;
  sheetUrl: string | null;
}

type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'running'; op: 'push' | 'pull' | 'preview' }
  | { kind: 'success'; op: 'push' | 'pull'; message: string }
  | { kind: 'error'; op: 'push' | 'pull' | 'preview'; message: string };

interface PullPreview {
  total_sheet_rows: number;
  updated: number;
  unchanged: number;
  not_in_db: string[];
  applied_changes: Array<{ store_code: string; changes: Record<string, [unknown, unknown]> }>;
}

async function readApiResponse(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 500));
  }
}

export function SyncPanel({ syncEnabled, sheetUrl }: SyncPanelProps) {
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' });
  const [preview, setPreview] = useState<PullPreview | null>(null);

  async function handlePush() {
    if (!confirm('This will overwrite the Master Tracker sheet with the current DB state. Continue?')) return;
    setStatus({ kind: 'running', op: 'push' });
    try {
      const res = await fetch('/api/sync/push', { method: 'POST' });
      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(json.error || 'Push failed');
      setStatus({ kind: 'success', op: 'push', message: `Pushed ${json.pushed} rows to the Sheet.` });
    } catch (e) {
      setStatus({ kind: 'error', op: 'push', message: e instanceof Error ? e.message : 'Push failed' });
    }
  }

  async function handlePreview() {
    setStatus({ kind: 'running', op: 'preview' });
    setPreview(null);
    try {
      const res = await fetch('/api/sync/pull', { method: 'GET' });
      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(json.error || 'Preview failed');
      setPreview(json);
      setStatus({ kind: 'idle' });
    } catch (e) {
      setStatus({ kind: 'error', op: 'preview', message: e instanceof Error ? e.message : 'Preview failed' });
    }
  }

  async function handlePullApply() {
    if (!preview) return;
    if (!confirm(`Apply ${preview.updated} row update(s) from the Sheet to the DB?`)) return;
    setStatus({ kind: 'running', op: 'pull' });
    try {
      const res = await fetch('/api/sync/pull', { method: 'POST' });
      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(json.error || 'Pull failed');
      setStatus({
        kind: 'success',
        op: 'pull',
        message: `Applied ${json.updated} update(s). ${json.unchanged} unchanged. ${json.not_in_db.length} sheet row(s) had no matching DB record.`,
      });
      setPreview(null);
    } catch (e) {
      setStatus({ kind: 'error', op: 'pull', message: e instanceof Error ? e.message : 'Pull failed' });
    }
  }

  if (!syncEnabled) {
    return (
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-md">
        <AlertTriangle size={18} className="text-amber-700 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Sheet sync is disabled.</p>
          <p className="text-amber-800 mt-1">
            Set <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">SHEET_SYNC_PROVIDER=google_service_account</code> and
            Google service account env vars on Vercel, then redeploy to enable the buttons below.
          </p>
        </div>
      </div>
    );
  }

  const isRunning = status.kind === 'running';

  return (
    <div className="space-y-4">
      {sheetUrl && (
        <p className="text-sm text-gray-500">
          Master Tracker:{' '}
          <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="text-[#1C2B3A] underline hover:text-[#F5C000]">
            open in Google Sheets ↗
          </a>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Push button */}
        <div className="border border-[#E5E7EB] rounded-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle size={18} className="text-[#F5C000]" />
            <h3 className="text-sm font-semibold text-[#1C2B3A]">Push DB → Sheet</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Overwrites all rows in the Master Tracker sheet with the current DB state.
            Matched by Store Code (upserts).
          </p>
          <button
            onClick={handlePush}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-[#1C2B3A] text-white hover:bg-[#0F1B2A] disabled:opacity-50 transition-colors"
          >
            {status.kind === 'running' && status.op === 'push' ? (
              <><Loader2 size={14} className="animate-spin" /> Pushing...</>
            ) : (
              <><ArrowUpCircle size={14} /> Push all to Sheet</>
            )}
          </button>
        </div>

        {/* Pull buttons */}
        <div className="border border-[#E5E7EB] rounded-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownCircle size={18} className="text-[#F5C000]" />
            <h3 className="text-sm font-semibold text-[#1C2B3A]">Pull Sheet → DB</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Reads the Master Tracker sheet and applies changes to the DB.
            Preview first, then apply.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={handlePreview}
              disabled={isRunning}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border border-[#1C2B3A] text-[#1C2B3A] hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {status.kind === 'running' && status.op === 'preview' ? (
                <><Loader2 size={14} className="animate-spin" /> Loading preview...</>
              ) : (
                <><RefreshCw size={14} /> Preview changes</>
              )}
            </button>
            {preview && preview.updated > 0 && (
              <button
                onClick={handlePullApply}
                disabled={isRunning}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-[#F5C000] text-[#1C2B3A] hover:bg-yellow-400 disabled:opacity-50 transition-colors"
              >
                {status.kind === 'running' && status.op === 'pull' ? (
                  <><Loader2 size={14} className="animate-spin" /> Applying...</>
                ) : (
                  <><ArrowDownCircle size={14} /> Apply {preview.updated} update(s)</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Result banners */}
      {status.kind === 'success' && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
          <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
          <span>{status.message}</span>
        </div>
      )}
      {status.kind === 'error' && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
          <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Failed during {status.op}</p>
            <p className="text-xs mt-0.5 text-red-700 break-words">{status.message}</p>
          </div>
        </div>
      )}

      {/* Preview details */}
      {preview && (
        <div className="border border-[#E5E7EB] rounded-md p-4 bg-gray-50 text-sm">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Stat label="Rows in sheet" value={preview.total_sheet_rows} />
            <Stat label="Will update" value={preview.updated} highlight={preview.updated > 0} />
            <Stat label="Unchanged" value={preview.unchanged} />
          </div>
          {preview.not_in_db.length > 0 && (
            <p className="text-xs text-amber-700 mb-3">
              ⚠️ {preview.not_in_db.length} sheet row(s) have store codes not found in DB:{' '}
              <code className="font-mono text-[11px]">{preview.not_in_db.slice(0, 5).join(', ')}</code>
              {preview.not_in_db.length > 5 ? ` and ${preview.not_in_db.length - 5} more` : ''}.
              These will be skipped.
            </p>
          )}
          {preview.applied_changes.length > 0 && (
            <div className="max-h-64 overflow-y-auto bg-white border border-[#E5E7EB] rounded p-2">
              {preview.applied_changes.slice(0, 20).map(({ store_code, changes }) => (
                <div key={store_code} className="text-xs py-1.5 border-b last:border-0 border-[#E5E7EB]">
                  <div className="font-mono font-semibold text-[#1C2B3A]">{store_code}</div>
                  {Object.entries(changes).map(([field, [oldV, newV]]) => (
                    <div key={field} className="ml-3 text-gray-600">
                      <span className="text-gray-400">{field}:</span>{' '}
                      <span className="line-through text-red-600">{String(oldV) || '(empty)'}</span>
                      {' → '}
                      <span className="text-green-700">{String(newV) || '(empty)'}</span>
                    </div>
                  ))}
                </div>
              ))}
              {preview.applied_changes.length > 20 && (
                <p className="text-xs text-gray-400 text-center pt-2">
                  …and {preview.applied_changes.length - 20} more
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${highlight ? 'text-[#F5C000]' : 'text-[#1C2B3A]'}`}>{value}</p>
    </div>
  );
}
