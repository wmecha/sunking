'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { Filter, MapPin, Search, X } from 'lucide-react';

export interface MapLocation {
  store_code: string;
  business_name: string;
  country: string;
  city: string;
  address: string;
  location_type: string;
  tracker_status: string;
  ov: boolean;
  ou: boolean;
  lat: number;
  lng: number;
  logo: string | null;
}

interface MapViewProps {
  apiKey: string;
  locations: MapLocation[];
  countries: string[];
  types: string[];
  statuses: string[];
  missingCount: number;
}

// Colour per status (matches StatusBadge palette in tracker)
const STATUS_COLOURS: Record<string, string> = {
  'In account verified': '#16A34A',
  'In account not verified': '#2563EB',
  'Submitted Claim Awaiting Response': '#D97706',
  'No claim Option': '#DC2626',
};

function colourFor(status: string): string {
  return STATUS_COLOURS[status] ?? '#1C2B3A';
}

export function MapView({ apiKey, locations, countries, types, statuses, missingCount }: MapViewProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [country, setCountry] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return locations.filter((l) => {
      if (country && l.country !== country) return false;
      if (type && l.location_type !== type) return false;
      if (status && l.tracker_status !== status) return false;
      if (needle) {
        const hay = `${l.store_code} ${l.business_name} ${l.city} ${l.address}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [locations, country, type, status, search]);

  // Initial map load
  useEffect(() => {
    let cancelled = false;
    setOptions({ key: apiKey, v: 'weekly' });

    (async () => {
      try {
        const [{ Map, InfoWindow }] = await Promise.all([
          importLibrary('maps'),
          importLibrary('marker'),
        ]);
        if (cancelled || !mapDivRef.current) return;
        const map = new Map(mapDivRef.current, {
          center: { lat: 0.5, lng: 28 },
          zoom: 4,
          mapId: 'SUNKING_LOCATIONS',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;
        infoWindowRef.current = new InfoWindow();
        setLoading(false);
      } catch (e) {
        console.error('[map] loader error:', e);
        setError(e instanceof Error ? e.message : 'Failed to load Google Maps');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Re-render markers when filters or data change
  useEffect(() => {
    if (loading || !mapRef.current) return;

    // Clear existing
    if (clustererRef.current) clustererRef.current.clearMarkers();
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    const map = mapRef.current;
    const g: any = (window as any).google;
    const bounds = new g.maps.LatLngBounds();

    const markers = filtered.map((loc) => {
      const dot = document.createElement('div');
      dot.style.width = '14px';
      dot.style.height = '14px';
      dot.style.borderRadius = '50%';
      dot.style.background = colourFor(loc.tracker_status);
      dot.style.border = '2px solid white';
      dot.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
      dot.style.cursor = 'pointer';

      const marker = new g.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: loc.lat, lng: loc.lng },
        content: dot,
        title: loc.business_name,
      });

      marker.addListener('click', () => {
        if (!infoWindowRef.current) return;
        const html = `
          <div style="font-family: -apple-system, Segoe UI, sans-serif; min-width: 220px; max-width: 280px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              ${loc.logo ? `<img src="${loc.logo}" style="width:32px;height:32px;border-radius:4px;object-fit:cover" />` : ''}
              <strong style="color:#1C2B3A;font-size:14px">${escapeHtml(loc.business_name)}</strong>
            </div>
            <div style="font-size:12px;color:#374151;line-height:1.4">
              <div><span style="color:#9CA3AF">Store:</span> <code style="font-family:monospace;font-size:11px">${escapeHtml(loc.store_code)}</code></div>
              <div><span style="color:#9CA3AF">Type:</span> ${escapeHtml(loc.location_type || '—')}</div>
              <div><span style="color:#9CA3AF">Address:</span> ${escapeHtml(loc.address || loc.city || '—')}</div>
              <div style="margin-top:6px;display:flex;align-items:center;gap:6px">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colourFor(loc.tracker_status)}"></span>
                <strong>${escapeHtml(loc.tracker_status || 'Unknown')}</strong>
                ${loc.ov ? '<span style="color:#16A34A;font-size:11px">✓ OV</span>' : ''}
                ${loc.ou ? '<span style="color:#2563EB;font-size:11px">✓ OU</span>' : ''}
              </div>
            </div>
          </div>
        `;
        infoWindowRef.current.setContent(html);
        infoWindowRef.current.open({ map, anchor: marker });
      });

      bounds.extend({ lat: loc.lat, lng: loc.lng });
      return marker;
    });

    markersRef.current = markers;
    clustererRef.current = new MarkerClusterer({ map, markers });

    if (filtered.length > 0) {
      map.fitBounds(bounds, 60);
      if (filtered.length === 1) map.setZoom(14);
    }
  }, [filtered, loading]);

  const filterCount = [country, type, status, search].filter(Boolean).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      {/* Filter sidebar */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 space-y-3 self-start">
        <div className="flex items-center gap-2 mb-1">
          <Filter size={16} className="text-[#F5C000]" />
          <h3 className="text-sm font-semibold text-[#1C2B3A]">Filters</h3>
          {filterCount > 0 && (
            <button
              onClick={() => { setCountry(''); setType(''); setStatus(''); setSearch(''); }}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1"
              aria-label="Clear filters"
            >
              <X size={12} /> Clear ({filterCount})
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code, name, city, address..."
              className="input-field pl-7"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="select-field">
            <option value="">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Location Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="select-field">
            <option value="">All types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tracker Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="select-field">
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="pt-3 border-t border-[#E5E7EB] space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Showing</span>
            <strong className="text-[#1C2B3A] tabular-nums">{filtered.length}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">With coordinates</span>
            <span className="text-gray-700 tabular-nums">{locations.length}</span>
          </div>
          {missingCount > 0 && (
            <div className="flex items-center justify-between text-amber-700">
              <span>Missing coords</span>
              <span className="tabular-nums">{missingCount}</span>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-[#E5E7EB]">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Status legend</p>
          <div className="space-y-1 text-xs">
            {Object.entries(STATUS_COLOURS).map(([s, c]) => (
              <div key={s} className="flex items-center gap-2 text-gray-700">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map canvas */}
      <div className="relative bg-white border border-[#E5E7EB] rounded-lg overflow-hidden" style={{ minHeight: '70vh' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 z-10 bg-white">
            <MapPin className="animate-pulse mr-2" size={18} /> Loading map...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-700 text-sm z-10 bg-red-50 p-6 text-center">
            Failed to load Google Maps: {error}
          </div>
        )}
        <div ref={mapDivRef} className="w-full h-full" style={{ minHeight: '70vh' }} />
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
