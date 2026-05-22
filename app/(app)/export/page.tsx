'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download, Filter } from 'lucide-react';
import { TRACKER_STATUSES } from '@/lib/status';

interface ExportHistoryRow {
  id: number;
  exported_at: string;
  filename?: string;
  filter_country?: string;
  filter_status?: string;
  row_count?: number;
}

const COUNTRIES = [
  'Benin', 'Cameroon', 'Kenya', 'Malawi', 'Mozambique', 'Nigeria',
  'South Africa', 'Tanzania', 'Togo', 'Uganda', 'Zambia',
];

const LOCATION_TYPES = ['Shop', 'Store', 'Experience Centre', 'Warehouse', 'Head Office', 'LPG Depot'];

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseStoreCodes(value: string): string[] {
  return Array.from(new Set(
    value
      .split(/[\s,;]+/)
      .map((code) => code.trim())
      .filter(Boolean)
  ));
}

export default function ExportPage() {
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [locationType, setLocationType] = useState('');
  const [storeCodeInput, setStoreCodeInput] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [history, setHistory] = useState<ExportHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/export?action=history');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setHistory(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchCount = async () => {
      setCountLoading(true);
      try {
        const res = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            countries: selectedCountries,
            statuses: selectedStatuses,
            location_type: locationType || undefined,
            store_codes: parseStoreCodes(storeCodeInput),
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        setPreviewCount(json.count);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') console.error(err);
      } finally {
        setCountLoading(false);
      }
    };

    fetchCount();
    return () => controller.abort();
  }, [selectedCountries, selectedStatuses, locationType, storeCodeInput]);

  function toggleCountry(c: string) {
    setSelectedCountries((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  function toggleStatus(s: string) {
    setSelectedStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function handleDownload(format: 'tracker' | 'google-bulk' = 'tracker') {
    const params = new URLSearchParams();
    if (selectedCountries.length > 0) params.set('country', selectedCountries.join(','));
    if (selectedStatuses.length > 0) params.set('status', selectedStatuses.join(','));
    if (locationType) params.set('location_type', locationType);
    const storeCodes = parseStoreCodes(storeCodeInput);
    if (storeCodes.length > 0) params.set('store_codes', storeCodes.join(','));
    const path = format === 'google-bulk' ? '/api/export/google-bulk' : '/api/export';
    window.location.href = `${path}?${params}`;

    // Refresh history after a short delay to show the new export
    setTimeout(fetchHistory, 1500);
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Export for Google Business Profile"
        subtitle="Generate filtered CSV exports in GBP-compatible format"
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filter Panel */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader title="Filter Options" subtitle="Narrow your export" />

              {/* Countries */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  <Filter size={14} className="inline mr-1" />
                  Countries
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {COUNTRIES.map((c) => (
                    <label key={c} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCountries.includes(c)}
                        onChange={() => toggleCountry(c)}
                        className="rounded border-[#E5E7EB] text-[#F5C000] focus:ring-[#F5C000]"
                      />
                      <span className="text-sm text-[#374151]">{c}</span>
                    </label>
                  ))}
                </div>
                {selectedCountries.length > 0 && (
                  <button
                    onClick={() => setSelectedCountries([])}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {/* Status */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#374151] mb-2">Statuses</label>
                <div className="space-y-2">
                  {TRACKER_STATUSES.map((s) => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(s)}
                        onChange={() => toggleStatus(s)}
                        className="rounded border-[#E5E7EB] text-[#F5C000] focus:ring-[#F5C000]"
                      />
                      <span className="text-sm text-[#374151]">{s}</span>
                    </label>
                  ))}
                </div>
                {selectedStatuses.length > 0 && (
                  <button
                    onClick={() => setSelectedStatuses([])}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    Clear statuses
                  </button>
                )}
              </div>

              {/* Location Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#374151] mb-1">Location Type</label>
                <select
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value)}
                  className="select-field"
                >
                  <option value="">All types</option>
                  {LOCATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Specific locations */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#374151] mb-1">Specific store codes</label>
                <textarea
                  value={storeCodeInput}
                  onChange={(e) => setStoreCodeInput(e.target.value)}
                  className="input-field min-h-[96px] font-mono text-xs"
                  placeholder="Paste store codes separated by commas, spaces, or new lines"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {parseStoreCodes(storeCodeInput).length > 0
                    ? `${parseStoreCodes(storeCodeInput).length} specific location(s) selected`
                    : 'Optional. Leave empty to export by filters only.'}
                </p>
              </div>
            </Card>
          </div>

          {/* Preview + Download */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader title="Export Preview" />

              {/* Count Preview */}
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-6 text-center mb-6">
                {countLoading ? (
                  <div className="text-gray-400 text-sm">Calculating...</div>
                ) : (
                  <>
                    <p className="text-5xl font-bold text-[#1C2B3A] tabular-nums">
                      {previewCount ?? '—'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      {previewCount === 1 ? 'location matches' : 'locations match'} your filters
                    </p>
                  </>
                )}
              </div>

              {/* Active Filters Summary */}
              <div className="mb-6 text-sm text-gray-500">
                <span className="font-medium text-[#374151]">Active filters: </span>
                {selectedCountries.length > 0 ? (
                  <span className="text-[#1C2B3A]">{selectedCountries.join(', ')}</span>
                ) : (
                  <span>All countries</span>
                )}
                {selectedStatuses.length > 0 && (
                  <span> · Statuses: <span className="text-[#1C2B3A]">{selectedStatuses.join(', ')}</span></span>
                )}
                {locationType && <span> · Type: <span className="text-[#1C2B3A]">{locationType}</span></span>}
                {parseStoreCodes(storeCodeInput).length > 0 && (
                  <span> · Specific locations: <span className="text-[#1C2B3A]">{parseStoreCodes(storeCodeInput).length}</span></span>
                )}
              </div>

              {/* Download Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={() => handleDownload('tracker')}
                  disabled={previewCount === 0}
                  size="lg"
                  className="w-full justify-center"
                >
                  <Download size={18} />
                  Download Tracker CSV ({previewCount ?? '...'} locations)
                </Button>
                <Button
                  onClick={() => handleDownload('google-bulk')}
                  disabled={previewCount === 0}
                  variant="secondary"
                  size="lg"
                  className="w-full justify-center"
                >
                  <Download size={18} />
                  Download Google Bulk Upload CSV
                </Button>
              </div>

              {/* Format note */}
              <div className="text-xs text-gray-400 mt-3 space-y-1">
                <p>
                  <span className="font-medium text-gray-500">Tracker CSV:</span> internal columns
                  (Status, Store Code, Business Name, Address, Locality, Country/Region, Location Type,
                  OV/OU Status, Claiming Issue, Action Taken).
                </p>
                <p>
                  <span className="font-medium text-gray-500">Google Bulk Upload CSV:</span> Google&apos;s
                  34-column template with Logo / Cover / Other photo URLs auto-filled from uploaded photos.
                  Country shown as ISO 2-letter code (e.g. KE, NG, ZA).
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Export History */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-lg font-semibold text-[#1C2B3A]">Export History</h2>
          </div>
          {historyLoading ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : history.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">No exports yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Filename</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Country Filter</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status Filter</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                      <td className="px-4 py-3 text-[#374151] whitespace-nowrap">{formatDate(row.exported_at)}</td>
                      <td className="px-4 py-3 text-[#374151] max-w-[200px] truncate">{row.filename || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{row.filter_country || 'All'}</td>
                      <td className="px-4 py-3 text-gray-500">{row.filter_status || 'All'}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{row.row_count ?? '—'}</td>
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
