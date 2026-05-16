'use client';

import { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Search, ChevronLeft, ChevronRight, Download, Pencil, CheckCircle, MapPin, ExternalLink } from 'lucide-react';
import type { TrackerLocation } from '@/lib/types';
import { PhotoUploader } from '@/components/tracker/PhotoUploader';
import { googleMapsUrl, hasCoords } from '@/lib/maps-url';

interface TrackerResponse {
  data: TrackerLocation[];
  total: number;
  page: number;
  pageSize: number;
  countries: string[];
  statuses: string[];
}

const TRACKER_STATUSES = ['Live', 'In Account', 'Submitted', 'Needs Pin', 'No Claim', 'Duplicate', 'Closed'];
const LOCATION_TYPES = ['Shop', 'Store', 'Experience Centre', 'Warehouse', 'Head Office', 'LPG Depot'];

const SAVED_VIEWS = [
  { label: 'All', status: '', country: '' },
  { label: 'Live', status: 'Live', country: '' },
  { label: 'In Account', status: 'In Account', country: '' },
  { label: 'Needs Pin', status: 'Needs Pin', country: '' },
  { label: 'No Claim', status: 'No Claim', country: '' },
];

export function TrackerTable() {
  const [data, setData] = useState<TrackerLocation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [countries, setCountries] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeView, setActiveView] = useState('All');

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
        ...(status && { status }),
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
  }, [page, pageSize, country, status, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyView(view: typeof SAVED_VIEWS[0]) {
    setActiveView(view.label);
    setStatus(view.status);
    setCountry(view.country);
    setPage(1);
  }

  function handleSearch() {
    setSearch(searchInput);
    setPage(1);
    setActiveView('');
  }

  function handleFilterChange(field: 'country' | 'status', value: string) {
    if (field === 'country') setCountry(value);
    if (field === 'status') setStatus(value);
    setPage(1);
    setActiveView('');
  }

  function handleExport() {
    const params = new URLSearchParams({
      ...(country && { country }),
      ...(status && { status }),
    });
    window.location.href = `/api/export?${params}`;
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

        <select
          value={status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="select-field w-44"
        >
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search store code, name, city..."
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
          <Button variant="secondary" size="md" onClick={handleExport}>
            <Download size={16} />
            Export filtered
          </Button>
        </div>
      </div>

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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Store Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Business Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">City</th>
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
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
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
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">No locations match your filters.</td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="border-b border-[#E5E7EB] hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[#374151] whitespace-nowrap">{row.store_code || '—'}</td>
                    <td className="px-4 py-3 text-[#1C2B3A] font-medium max-w-[200px] truncate">{row.business_name || '—'}</td>
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
                        <a
                          href={googleMapsUrl(row)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`p-1 rounded transition-colors ${
                            hasCoords(row)
                              ? 'text-[#F5C000] hover:text-yellow-600 hover:bg-yellow-50'
                              : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'
                          }`}
                          title={hasCoords(row) ? 'Open in Google Maps (pinned)' : 'Open in Google Maps (search by address)'}
                        >
                          <MapPin size={13} />
                        </a>
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
                <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
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
                {hasCoords(editForm)
                  ? 'The Maps link uses these exact coordinates. Edit to refine the pin position.'
                  : 'Maps link will search by address. Click "Geocode all" in Settings to auto-fill coords, or paste from Google Maps (right-click → "What\'s here?").'}
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
