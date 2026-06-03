'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Search, ChevronLeft, ChevronRight, Download, Pencil, CheckCircle, MapPin, ExternalLink } from 'lucide-react';
import type { TrackerLocation } from '@/lib/types';
import { PhotoUploader } from '@/components/tracker/PhotoUploader';
import { googleMapsUrl, hasCoords, mapsUrlSource } from '@/lib/maps-url';
import { TRACKER_STATUSES } from '@/lib/status';

interface TrackerResponse {
  data: TrackerLocation[];
  total: number;
  page: number;
  pageSize: number;
  countries: string[];
  statuses: string[];
}

const LOCATION_TYPES = ['Shop', 'Store', 'Experience Centre', 'Warehouse', 'Head Office', 'LPG Depot'];

const SAVED_VIEWS = [
  { label: 'All', statuses: [] as string[], country: '' },
  { label: 'Verified', statuses: ['In account verified'], country: '' },
  { label: 'Not verified', statuses: ['In account not verified'], country: '' },
  { label: 'Submitted claims', statuses: ['Submitted Claim Awaiting Response'], country: '' },
  { label: 'No claim option', statuses: ['No claim Option'], country: '' },
];

export function TrackerTable() {
  const searchParams = useSearchParams();
  const initialStatuses = (searchParams.get('status') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const initialAccount = searchParams.get('account') || '';
  const initialGbpStatus = searchParams.get('gbpStatus') || '';
  const initialWorkflow = searchParams.get('workflow') || '';
  const initialDuplicates = searchParams.get('duplicates') || '';
  const [data, setData] = useState<TrackerLocation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [countries, setCountries] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [country, setCountry] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(initialStatuses);
  const [account, setAccount] = useState(initialAccount);
  const [gbpStatus, setGbpStatus] = useState(initialGbpStatus);
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [duplicates, setDuplicates] = useState(initialDuplicates);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeView, setActiveView] = useState(
    SAVED_VIEWS.find((view) => view.statuses.join(',') === initialStatuses.join(','))?.label ?? (initialStatuses.length ? '' : 'All'),
  );
  const [selectedRowCodes, setSelectedRowCodes] = useState<Set<string>>(new Set());

  // Edit modal
  const [editingRow, setEditingRow] = useState<TrackerLocation | null>(null);
  const [editForm, setEditForm] = useState<Partial<TrackerLocation>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(country && { country }),
        ...(selectedStatuses.length > 0 && { status: selectedStatuses.join(',') }),
        ...(account && { account }),
        ...(gbpStatus && { gbpStatus }),
        ...(workflow && { workflow }),
        ...(duplicates && { duplicates }),
        ...(search && { search }),
      });
      const res = await fetch(`/api/tracker?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json: TrackerResponse = await res.json();
      setData(json.data);
      setTotal(json.total);
      if (json.countries.length > 0) setCountries(json.countries);
      if (json.statuses.length > 0) setStatuses(json.statuses);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, country, selectedStatuses, account, gbpStatus, workflow, duplicates, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const nextStatuses = (searchParams.get('status') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const nextAccount = searchParams.get('account') || '';
    const nextGbpStatus = searchParams.get('gbpStatus') || '';
    const nextWorkflow = searchParams.get('workflow') || '';
    const nextDuplicates = searchParams.get('duplicates') || '';
    setSelectedStatuses(nextStatuses);
    setAccount(nextAccount);
    setGbpStatus(nextGbpStatus);
    setWorkflow(nextWorkflow);
    setDuplicates(nextDuplicates);
    setActiveView(SAVED_VIEWS.find((view) => view.statuses.join(',') === nextStatuses.join(','))?.label ?? (nextStatuses.length ? '' : 'All'));
    setPage(1);
  }, [searchParams]);

  function applyView(view: typeof SAVED_VIEWS[0]) {
    setActiveView(view.label);
    setSelectedStatuses(view.statuses);
    setAccount('');
    setGbpStatus('');
    setWorkflow('');
    setDuplicates('');
    setCountry(view.country);
    setPage(1);
  }

  function toggleDuplicates() {
    setDuplicates((current) => (current === '1' ? '' : '1'));
    setSelectedStatuses([]);
    setAccount('');
    setGbpStatus('');
    setWorkflow('');
    setPage(1);
    setActiveView('');
  }

  function handleSearch() {
    setSearch(searchInput);
    setPage(1);
    setActiveView('');
  }

  function handleFilterChange(field: 'country', value: string) {
    if (field === 'country') setCountry(value);
    setPage(1);
    setActiveView('');
  }

  function toggleStatus(nextStatus: string) {
    setSelectedStatuses((current) => (
      current.includes(nextStatus)
        ? current.filter((s) => s !== nextStatus)
        : [...current, nextStatus]
    ));
    setAccount('');
    setGbpStatus('');
    setWorkflow('');
    setDuplicates('');
    setPage(1);
    setActiveView('');
  }

  function buildExportParams(format: 'filtered' | 'selected') {
    const params = new URLSearchParams({
      ...(country && { country }),
      ...(selectedStatuses.length > 0 && { status: selectedStatuses.join(',') }),
      ...(account && { account }),
      ...(gbpStatus && { gbpStatus }),
      ...(workflow && { workflow }),
    });
    if (format === 'selected' && selectedRowCodes.size > 0) {
      params.set('store_codes', Array.from(selectedRowCodes).join(','));
      params.delete('country');
      params.delete('status');
      params.delete('account');
      params.delete('gbpStatus');
      params.delete('workflow');
    }
    return params;
  }

  function handleExport(format: 'filtered' | 'selected' = 'filtered', kind: 'tracker' | 'google-bulk' = 'tracker') {
    const params = buildExportParams(format);
    const path = kind === 'google-bulk' ? '/api/export/google-bulk' : '/api/export';
    window.location.href = `${path}?${params}`;
  }

  function openEdit(row: TrackerLocation, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingRow(row);
    setEditForm({ ...row });
    setSaveSuccess(false);
  }

  async function handleSave() {
    if (!editingRow) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tracker', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingRow.id, ...editForm }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveSuccess(true);
      fetchData();
      setTimeout(() => {
        setEditingRow(null);
        setSaveSuccess(false);
      }, 800);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const selectedOnPage = data.filter((row) => row.store_code && selectedRowCodes.has(row.store_code)).length;
  const selectableOnPage = data.filter((row) => row.store_code).length;
  const allPageSelected = selectableOnPage > 0 && selectedOnPage === selectableOnPage;

  return (
    <div className="flex flex-col gap-4">
      {/* Saved Views */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider mr-1">Quick:</span>
        {SAVED_VIEWS.map((view) => (
          <button
            key={view.label}
            onClick={() => applyView(view)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              activeView === view.label
                ? 'bg-[#F5C000] text-[#1C2B3A] border-[#F5C000]'
                : 'bg-white text-gray-500 border-[#E5E7EB] hover:border-[#F5C000] hover:text-[#1C2B3A]'
            }`}
          >
            {view.label}
          </button>
        ))}
        <button
          onClick={toggleDuplicates}
          title="Show only locations flagged as duplicates (grouped together)"
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            duplicates === '1'
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white text-red-600 border-red-200 hover:border-red-400'
          }`}
        >
          ⚠ Duplicates
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 flex flex-wrap items-center gap-3">
        <select
          value={country}
          onChange={(e) => handleFilterChange('country', e.target.value)}
          className="select-field w-44"
        >
          <option value="">All Countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-2 max-w-xl">
          {Array.from(new Set([...TRACKER_STATUSES, ...statuses])).map((s) => (
            <label key={s} className="flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs text-[#374151]">
              <input
                type="checkbox"
                checked={selectedStatuses.includes(s)}
                onChange={() => toggleStatus(s)}
                className="rounded border-[#E5E7EB] text-[#F5C000] focus:ring-[#F5C000]"
              />
              {s}
            </label>
          ))}
          {selectedStatuses.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedStatuses([]);
                setAccount('');
                setGbpStatus('');
                setWorkflow('');
                setPage(1);
                setActiveView('All');
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear statuses
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search store code, name, locality..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="input-field"
          />
          <Button variant="secondary" size="md" onClick={handleSearch}>
            <Search size={16} />
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="md" onClick={() => handleExport('filtered', 'tracker')}>
            <Download size={16} />
            Export filtered
          </Button>
          <Button variant="secondary" size="md" onClick={() => handleExport('filtered', 'google-bulk')}>
            <Download size={16} />
            Bulk CSV
          </Button>
        </div>
      </div>

      {selectedRowCodes.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#F5C000] bg-yellow-50 px-4 py-3 text-sm">
          <span className="font-medium text-[#1C2B3A]">{selectedRowCodes.size} location(s) selected</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleExport('selected', 'tracker')}>
              <Download size={14} /> Export selected tracker CSV
            </Button>
            <Button size="sm" onClick={() => handleExport('selected', 'google-bulk')}>
              <Download size={14} /> Export selected bulk upload CSV
            </Button>
            <button className="text-xs text-gray-500 underline hover:text-gray-700" onClick={() => setSelectedRowCodes(new Set())}>
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Row count + pagination */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {loading ? 'Loading...' : (
            total === 0
              ? 'No locations found'
              : `Showing ${start}–${end} of ${total} locations`
          )}
        </span>
        {total > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-medium">Page {page} of {totalPages}</span>
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={(event) => {
                      setSelectedRowCodes((current) => {
                        const next = new Set(current);
                        for (const row of data) {
                          if (!row.store_code) continue;
                          if (event.target.checked) next.add(row.store_code);
                          else next.delete(row.store_code);
                        }
                        return next;
                      });
                    }}
                    className="rounded border-[#E5E7EB] text-[#F5C000] focus:ring-[#F5C000]"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Store Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Business Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Locality</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">OV</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">OU</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-[#F5C000]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading locations...
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">No locations match your filters.</td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="border-b border-[#E5E7EB] hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {row.store_code ? (
                        <input
                          type="checkbox"
                          checked={selectedRowCodes.has(row.store_code)}
                          onChange={(event) => {
                            setSelectedRowCodes((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(row.store_code!);
                              else next.delete(row.store_code!);
                              return next;
                            });
                          }}
                          className="rounded border-[#E5E7EB] text-[#F5C000] focus:ring-[#F5C000]"
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#374151] whitespace-nowrap">{row.store_code || '—'}</td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <div className="flex items-center gap-1.5">
                        {row.business_name ? (
                          <a
                            href={googleMapsUrl(row)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-[#1C2B3A] hover:text-blue-600 hover:underline transition-colors truncate inline-block max-w-full align-bottom"
                            title="Open in Google Maps"
                          >
                            {row.business_name}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                        {row.duplicate_flag ? (
                          <span
                            title={row.duplicate_flag}
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              /—\s*duplicate/i.test(row.duplicate_flag)
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : 'bg-amber-100 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {/—\s*duplicate/i.test(row.duplicate_flag) ? 'DUP' : 'DUP?'}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{row.country || '—'}</td>
                    <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{row.city || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{row.location_type || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold ${row.ov === 'TRUE' ? 'text-green-700' : 'text-gray-300'}`}>
                        {row.ov === 'TRUE' ? '✓' : '·'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold ${row.ou === 'TRUE' ? 'text-blue-600' : 'text-gray-300'}`}>
                        {row.ou === 'TRUE' ? '✓' : '·'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={row.tracker_status || 'Unknown'} />
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-0.5">
                        {(() => {
                          const src = mapsUrlSource(row);
                          const classes =
                            src === 'canonical'
                              ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                              : src === 'coords'
                              ? 'text-[#F5C000] hover:text-yellow-600 hover:bg-yellow-50'
                              : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50';
                          const title =
                            src === 'canonical'
                              ? 'Open in Google Maps (canonical Place link)'
                              : src === 'coords'
                              ? 'Open in Google Maps (pinned by coords)'
                              : 'Open in Google Maps (search by address)';
                          return (
                            <a
                              href={googleMapsUrl(row)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`p-1 rounded transition-colors ${classes}`}
                              title={title}
                            >
                              <MapPin size={13} />
                            </a>
                          );
                        })()}
                        <button
                          onClick={(e) => openEdit(row, e)}
                          className="p-1 text-gray-400 hover:text-[#1C2B3A] rounded transition-colors"
                          title="Edit location"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={16} />Previous
          </Button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next<ChevronRight size={16} />
          </Button>
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={!!editingRow} onClose={() => setEditingRow(null)} title={`Edit — ${editingRow?.business_name || editingRow?.store_code || 'Location'}`} width="xl">
        {editingRow && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Store Code</label>
                <input
                  className="input-field"
                  value={editForm.store_code || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, store_code: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Business Name</label>
                <input
                  className="input-field"
                  value={editForm.business_name || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, business_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
                <input
                  className="input-field"
                  value={editForm.country || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Locality</label>
                <input
                  className="input-field"
                  value={editForm.city || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                <input
                  className="input-field"
                  value={editForm.address || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Location Type</label>
                <select
                  className="select-field"
                  value={editForm.location_type || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, location_type: e.target.value }))}
                >
                  <option value="">— Select type —</option>
                  {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tracker Status</label>
                <select
                  className="select-field"
                  value={editForm.tracker_status || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, tracker_status: e.target.value }))}
                >
                  <option value="">— Select status —</option>
                  {TRACKER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">OV (Owned & Verified)</label>
                <select
                  className="select-field"
                  value={editForm.ov || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, ov: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="TRUE">TRUE</option>
                  <option value="FALSE">FALSE</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">OU (Owned & Unverified)</label>
                <select
                  className="select-field"
                  value={editForm.ou || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, ou: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="TRUE">TRUE</option>
                  <option value="FALSE">FALSE</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Claiming Issue</label>
                <input
                  className="input-field"
                  value={editForm.claiming_issue || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, claiming_issue: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Action Taken</label>
                <input
                  className="input-field"
                  value={editForm.action_taken || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, action_taken: e.target.value }))}
                />
              </div>
            </div>

            {/* Google Maps + Coordinates */}
            <div className="pt-4 border-t border-[#E5E7EB]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#1C2B3A] flex items-center gap-1.5">
                  <MapPin size={14} className="text-[#F5C000]" /> Google Maps & Coordinates
                </h3>
                <a
                  href={googleMapsUrl(editForm)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-[#1C2B3A] hover:text-[#F5C000] inline-flex items-center gap-1 border border-[#E5E7EB] hover:border-[#F5C000] rounded px-2.5 py-1 transition-colors"
                >
                  <ExternalLink size={12} /> Open in Google Maps
                </a>
              </div>

              {/* Canonical Google Maps URL — the one Google gave for this specific GBP listing */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Google Maps URL
                  <span className="ml-2 font-normal text-gray-400">— Share link from this location&apos;s GBP listing</span>
                </label>
                <input
                  type="url"
                  className="input-field font-mono text-xs"
                  placeholder="https://maps.app.goo.gl/... or https://www.google.com/maps/place/..."
                  value={editForm.google_maps_url ?? ''}
                  onChange={(e) => setEditForm((f) => ({
                    ...f,
                    google_maps_url: e.target.value === '' ? null : e.target.value,
                  }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="input-field font-mono text-xs"
                    placeholder="e.g. -1.2921"
                    value={editForm.latitude ?? ''}
                    onChange={(e) => setEditForm((f) => ({
                      ...f,
                      latitude: e.target.value === '' ? null : Number(e.target.value),
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="input-field font-mono text-xs"
                    placeholder="e.g. 36.8219"
                    value={editForm.longitude ?? ''}
                    onChange={(e) => setEditForm((f) => ({
                      ...f,
                      longitude: e.target.value === '' ? null : Number(e.target.value),
                    }))}
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                {mapsUrlSource(editForm) === 'canonical' && (
                  <>Using the saved Google Maps URL above — lands on the exact GBP listing.</>
                )}
                {mapsUrlSource(editForm) === 'coords' && (
                  <>Using lat/lng — drops a pin at the exact coords (no canonical URL stored).</>
                )}
                {mapsUrlSource(editForm) === 'search' && (
                  <>Searching by address — paste a Maps share link above or set lat/lng to upgrade.
                  Get coords from Google Maps (right-click → &quot;What&apos;s here?&quot;) or use Settings → &quot;Geocode all&quot;.</>
                )}
              </p>
            </div>

            {/* Photos */}
            {editForm.store_code && (
              <div className="pt-4 border-t border-[#E5E7EB]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#1C2B3A]">Photos</h3>
                  <span className="text-[11px] text-gray-400">Uploads save immediately</span>
                </div>
                <PhotoUploader
                  storeCode={editForm.store_code}
                  logoUrl={editForm.logo_photo_url}
                  coverUrl={editForm.cover_photo_url}
                  otherUrls={Array.isArray(editForm.other_photo_urls) ? editForm.other_photo_urls : []}
                  onChange={(next) => setEditForm((f) => ({ ...f, ...next }))}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
              <Button variant="secondary" onClick={() => setEditingRow(null)}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>
                {saveSuccess ? (
                  <><CheckCircle size={15} /> Saved!</>
                ) : 'Save changes'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
