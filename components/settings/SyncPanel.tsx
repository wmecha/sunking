'use client';

import { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface SyncPanelProps {
  syncEnabled: boolean;
  sheetUrl: string | null;
}

type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'running'; op: 'push' | 'pull' | 'preview' | 'push-preview' }
  | { kind: 'success'; op: 'push' | 'pull'; message: string }
  | { kind: 'error'; op: 'push' | 'pull' | 'preview' | 'push-preview'; message: string };

interface PullPreview {
  total_sheet_rows: number;
  updated: number;
  unchanged: number;
  not_in_db: string[];
  applied_changes: Array<{ store_code: string; match_store_code?: string; changes: Record<string, [unknown, unknown]> }>;
}

interface PushPreview {
  total_db_rows: number;
  updated: number;
  appended: number;
  unchanged: number;
  applied_changes: Array<{ store_code: string; mode: 'update' | 'append'; changes: Record<string, [unknown, unknown]> }>;
}

const SYNC_STEP_SIZE = 1;
const SYNC_STEP_DELAY_MS = 150;

async function readApiResponse(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 500));
  }
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SyncPanel({ syncEnabled, sheetUrl }: SyncPanelProps) {
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' });
  const [preview, setPreview] = useState<PullPreview | null>(null);
  const [pushPreview, setPushPreview] = useState<PushPreview | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [showAllPushChanges, setShowAllPushChanges] = useState(false);
  const [showAllPullChanges, setShowAllPullChanges] = useState(false);
  const [selectedPullCodes, setSelectedPullCodes] = useState<Set<string>>(new Set());

  async function handlePushPreview() {
    setStatus({ kind: 'running', op: 'push-preview' });
    setPushPreview(null);
    setShowAllPushChanges(false);
    setProgress(null);
    try {
      const res = await fetch('/api/sync/push', { method: 'GET' });
      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(json.error || 'Push preview failed');
      setPushPreview(json);
      setStatus({ kind: 'idle' });
    } catch (e) {
      setStatus({ kind: 'error', op: 'push-preview', message: e instanceof Error ? e.message : 'Push preview failed' });
    }
  }

  async function handlePushApply() {
    if (!pushPreview) return;
    const changes = pushPreview.applied_changes;
    if (!confirm(`Apply ${changes.length} Sheet update(s), one at a time?`)) return;
    setStatus({ kind: 'running', op: 'push' });
    setProgress({ done: 0, total: changes.length });
    try {
      let pushed = 0;
      for (let i = 0; i < changes.length; i += SYNC_STEP_SIZE) {
        const chunk = changes.slice(i, i + SYNC_STEP_SIZE);
        const res = await fetch('/api/sync/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_codes: chunk.map((c) => c.store_code) }),
        });
        const json = await readApiResponse(res);
        if (!res.ok) throw new Error(json.error || 'Push failed');
        pushed += Number(json.pushed ?? 0);
        setProgress({ done: Math.min(i + chunk.length, changes.length), total: changes.length });
        if (i + chunk.length < changes.length) await pause(SYNC_STEP_DELAY_MS);
      }
      setStatus({ kind: 'success', op: 'push', message: `Pushed ${pushed} row update(s) to the Sheet.` });
      setPushPreview(null);
      setProgress(null);
    } catch (e) {
      setStatus({ kind: 'error', op: 'push', message: e instanceof Error ? e.message : 'Push failed' });
    }
  }

  async function handlePreview() {
    setStatus({ kind: 'running', op: 'preview' });
    setPreview(null);
    setShowAllPullChanges(false);
    setSelectedPullCodes(new Set());
    setProgress(null);
    try {
      const res = await fetch('/api/sync/pull', { method: 'GET' });
      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(json.error || 'Preview failed');
      setPreview(json);
      setSelectedPullCodes(new Set(json.applied_changes.map((change: PullPreview['applied_changes'][number]) => change.store_code)));
      setStatus({ kind: 'idle' });
    } catch (e) {
      setStatus({ kind: 'error', op: 'preview', message: e instanceof Error ? e.message : 'Preview failed' });
    }
  }

  async function handlePullApply() {
    if (!preview) return;
    const changes = preview.applied_changes.filter((change) => selectedPullCodes.has(change.store_code));
    if (changes.length === 0) return;
    if (!confirm(`Apply ${changes.length} selected DB update(s), one at a time?`)) return;
    setStatus({ kind: 'running', op: 'pull' });
    setProgress({ done: 0, total: changes.length });
    try {
      let applied = 0;
      for (let i = 0; i < changes.length; i += SYNC_STEP_SIZE) {
        const chunk = changes.slice(i, i + SYNC_STEP_SIZE);
        const res = await fetch('/api/sync/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: chunk }),
        });
        const json = await readApiResponse(res);
        if (!res.ok) throw new Error(json.error || 'Pull failed');
        applied += Number(json.updated ?? 0);
        setProgress({ done: Math.min(i + chunk.length, changes.length), total: changes.length });
        if (i + chunk.length < changes.length) await pause(SYNC_STEP_DELAY_MS);
      }
      setStatus({
        kind: 'success',
        op: 'pull',
        message: `Applied ${applied} selected update(s). ${preview.unchanged} unchanged. ${preview.not_in_db.length} sheet row(s) had no matching DB record.`,
      });
      setPreview(null);
      setSelectedPullCodes(new Set());
      setProgress(null);
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
  const visiblePushChanges = pushPreview
    ? pushPreview.applied_changes.slice(0, showAllPushChanges ? pushPreview.applied_changes.length : 20)
    : [];
  const visiblePullChanges = preview
    ? preview.applied_changes.slice(0, showAllPullChanges ? preview.applied_changes.length : 20)
    : [];
  const selectedPullCount = preview
    ? preview.applied_changes.filter((change) => selectedPullCodes.has(change.store_code)).length
    : 0;

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
            Previews DB-to-Sheet differences first, then applies matching Store Code updates one row at a time.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={handlePushPreview}
              disabled={isRunning}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border border-[#1C2B3A] text-[#1C2B3A] hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {status.kind === 'running' && status.op === 'push-preview' ? (
                <><Loader2 size={14} className="animate-spin" /> Loading preview...</>
              ) : (
                <><RefreshCw size={14} /> Preview Sheet changes</>
              )}
            </button>
            {pushPreview && pushPreview.applied_changes.length > 0 && (
              <button
                onClick={handlePushApply}
                disabled={isRunning}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-[#1C2B3A] text-white hover:bg-[#0F1B2A] disabled:opacity-50 transition-colors"
              >
                {status.kind === 'running' && status.op === 'push' ? (
                  <><Loader2 size={14} className="animate-spin" /> Pushing...</>
                ) : (
                  <><ArrowUpCircle size={14} /> Apply {pushPreview.applied_changes.length} Sheet update(s)</>
                )}
              </button>
            )}
          </div>
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
                disabled={isRunning || selectedPullCount === 0}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-[#F5C000] text-[#1C2B3A] hover:bg-yellow-400 disabled:opacity-50 transition-colors"
              >
                {status.kind === 'running' && status.op === 'pull' ? (
                  <><Loader2 size={14} className="animate-spin" /> Applying...</>
                ) : (
                  <><ArrowDownCircle size={14} /> Apply {selectedPullCount} selected update(s)</>
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

      {progress && (
        <div className="border border-[#E5E7EB] rounded-md p-3 bg-white text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-[#1C2B3A]">
              {status.kind === 'running' && status.op === 'push' ? 'Pushing to Sheet' : 'Pulling into DB'}
            </span>
            <span className="text-xs tabular-nums text-gray-500">
              {progress.done} done · {Math.max(progress.total - progress.done, 0)} remaining
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-[#F5C000] transition-all"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {pushPreview && (
        <div className="border border-[#E5E7EB] rounded-md p-4 bg-gray-50 text-sm">
          <div className="grid grid-cols-4 gap-3 mb-3">
            <Stat label="Rows in DB" value={pushPreview.total_db_rows} />
            <Stat label="Will update" value={pushPreview.updated} highlight={pushPreview.updated > 0} />
            <Stat label="Will append" value={pushPreview.appended} highlight={pushPreview.appended > 0} />
            <Stat label="Unchanged" value={pushPreview.unchanged} />
          </div>
          {pushPreview.applied_changes.length > 0 && (
            <div className="max-h-64 overflow-y-auto bg-white border border-[#E5E7EB] rounded p-2">
              {visiblePushChanges.map(({ store_code, mode, changes }) => (
                <div key={store_code} className="text-xs py-1.5 border-b last:border-0 border-[#E5E7EB]">
                  <div className="font-mono font-semibold text-[#1C2B3A]">
                    {store_code} <span className="font-sans text-[10px] uppercase text-gray-400">({mode})</span>
                  </div>
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
              {pushPreview.applied_changes.length > 20 && (
                <button
                  type="button"
                  onClick={() => setShowAllPushChanges((v) => !v)}
                  className="w-full text-xs text-[#1C2B3A] hover:text-[#F5C000] font-medium text-center pt-2"
                >
                  {showAllPushChanges
                    ? 'Show first 20 only'
                    : `Show all ${pushPreview.applied_changes.length} proposed Sheet changes`}
                </button>
              )}
            </div>
          )}
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
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  {selectedPullCount} of {preview.applied_changes.length} proposed DB update(s) selected.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setSelectedPullCodes(new Set(preview.applied_changes.map((change) => change.store_code)))}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#1C2B3A] text-[#1C2B3A] hover:bg-gray-50 disabled:opacity-50"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setSelectedPullCodes(new Set())}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded border border-[#E5E7EB] text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto bg-white border border-[#E5E7EB] rounded p-2">
                {visiblePullChanges.map(({ store_code, match_store_code, changes }) => {
                  const selected = selectedPullCodes.has(store_code);
                  return (
                    <label
                      key={store_code}
                      className={`flex gap-2 text-xs py-1.5 border-b last:border-0 border-[#E5E7EB] ${isRunning ? 'opacity-60' : 'cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={isRunning}
                        onChange={(event) => {
                          setSelectedPullCodes((current) => {
                            const next = new Set(current);
                            if (event.target.checked) {
                              next.add(store_code);
                            } else {
                              next.delete(store_code);
                            }
                            return next;
                          });
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#F5C000] focus:ring-[#F5C000]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono font-semibold text-[#1C2B3A]">
                          {store_code}
                          {match_store_code && match_store_code !== store_code ? (
                            <span className="font-sans text-[10px] text-gray-400"> → DB {match_store_code}</span>
                          ) : null}
                        </span>
                        {Object.entries(changes).map(([field, [oldV, newV]]) => (
                          <span key={field} className="block ml-3 text-gray-600">
                            <span className="text-gray-400">{field}:</span>{' '}
                            <span className="line-through text-red-600">{String(oldV) || '(empty)'}</span>
                            {' → '}
                            <span className="text-green-700">{String(newV) || '(empty)'}</span>
                          </span>
                        ))}
                      </span>
                    </label>
                  );
                })}
                {preview.applied_changes.length > 20 && (
                  <button
                    type="button"
                    onClick={() => setShowAllPullChanges((v) => !v)}
                    className="w-full text-xs text-[#1C2B3A] hover:text-[#F5C000] font-medium text-center pt-2"
                  >
                    {showAllPullChanges
                      ? 'Show first 20 only'
                      : `Show all ${preview.applied_changes.length} proposed DB changes`}
                  </button>
                )}
              </div>
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
