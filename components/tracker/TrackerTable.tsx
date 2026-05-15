'use client';

import { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Search, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type { TrackerLocation } from '@/lib/types';

interface TrackerResponse {
  data: TrackerLocation[];
  total: number;
  page: number;
  pageSize: number;
  countries: string[];
  statuses: string[];
}

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleSearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function handleFilterChange(field: 'country' | 'status', value: string) {
    if (field === 'country') setCountry(value);
    if (field === 'status') setStatus(value);
    setPage(1);
  }

  function handleExport() {
    const params = new URLSearchParams({
      ...(country && { country }),
      ...(status && { status }),
    });
    window.location.href = `/api/export?${params}`;
  }

  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 flex flex-wrap items-center gap-3">
        {/* Country */}
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

        {/* Status */}
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

        {/* Search */}
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

      {/* Row count */}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-medium">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Claiming Issue</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
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
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No locations match your filters.
                  </td>
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
                      <span className={`text-xs font-semibold ${row.ov === 'TRUE' ? 'text-green-700' : 'text-gray-400'}`}>
                        {row.ov === 'TRUE' ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold ${row.ou === 'TRUE' ? 'text-green-700' : 'text-gray-400'}`}>
                        {row.ou === 'TRUE' ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">{row.claiming_issue || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={row.tracker_status || 'Unknown'} />
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft size={16} />
            Previous
          </Button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
