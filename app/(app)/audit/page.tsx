'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLog {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: string | null;
  performed_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  import_gbp_csv: { label: 'GBP Import', color: 'bg-blue-100 text-blue-800' },
  run_reconciliation: { label: 'Reconciliation', color: 'bg-purple-100 text-purple-800' },
  export_csv: { label: 'Export', color: 'bg-green-100 text-green-800' },
  edit_tracker_location: { label: 'Tracker Edit', color: 'bg-amber-100 text-amber-800' },
  sync_push_to_sheet: { label: 'Sheet Push', color: 'bg-sky-100 text-sky-800' },
  sync_pull_from_sheet: { label: 'Sheet Pull', color: 'bg-cyan-100 text-cyan-800' },
};

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_LABELS[action] ?? { label: action, color: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function parseDetails(raw: string | null): string {
  if (!raw) return '—';
  try {
    const obj = JSON.parse(raw);
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
  } catch {
    return raw;
  }
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actions, setActions] = useState<string[]>([]);
  const [filterAction, setFilterAction] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), ...(filterAction && { action: filterAction }) });
      const res = await fetch(`/api/audit?${params}`);
      const json = await res.json();
      setLogs(json.data || []);
      setTotal(Number(json.total ?? 0));
      if (json.actions?.length > 0) setActions(json.actions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Audit Log" subtitle="History of all system actions and data changes" />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 flex items-center gap-3">
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="select-field w-48"
          >
            <option value="">All Actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">
            {loading ? 'Loading...' : `${total} entries`}
          </span>
          {total > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-medium text-gray-600">{start}–{end} of {total}</span>
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </div>

        <Card padding={false}>
          {logs.length === 0 && !loading ? (
            <div className="px-6 py-10 text-center text-gray-400 text-sm">
              No audit log entries yet. Actions like imports, reconciliations, and tracker edits will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading audit log...</td></tr>
                  ) : logs.map((log) => (
                    <tr key={log.id} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(log.performed_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><ActionBadge action={log.action} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {log.entity_type ? `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[400px] truncate">{parseDetails(log.details)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
