export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/TopBar';
import getDb from '@/lib/db';
import { MapView, type MapLocation } from '@/components/map/MapView';
import { AlertTriangle, MapPin } from 'lucide-react';

async function getMapData(): Promise<{
  locations: MapLocation[];
  totalWithCoords: number;
  totalRows: number;
  countries: string[];
  types: string[];
  statuses: string[];
}> {
  const db = getDb();

  const [withCoordsResp, totalResp, countriesResp, typesResp, statusesResp] = await Promise.all([
    db.execute(`
      SELECT store_code, business_name, country, city, address, location_type,
             tracker_status, ov, ou, latitude, longitude, logo_photo_url
      FROM tracker_locations
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY country, business_name
    `),
    db.execute('SELECT COUNT(*) AS n FROM tracker_locations'),
    db.execute(`SELECT DISTINCT country FROM tracker_locations WHERE country IS NOT NULL AND country <> '' ORDER BY country`),
    db.execute(`SELECT DISTINCT location_type FROM tracker_locations WHERE location_type IS NOT NULL AND location_type <> '' ORDER BY location_type`),
    db.execute(`SELECT DISTINCT tracker_status FROM tracker_locations WHERE tracker_status IS NOT NULL AND tracker_status <> '' ORDER BY tracker_status`),
  ]);

  const locations: MapLocation[] = (withCoordsResp.rows as unknown as Array<{
    store_code: string;
    business_name: string;
    country: string;
    city: string;
    address: string | null;
    location_type: string;
    tracker_status: string;
    ov: string | null;
    ou: string | null;
    latitude: number | string;
    longitude: number | string;
    logo_photo_url: string | null;
  }>).map((r) => ({
    store_code: r.store_code,
    business_name: r.business_name,
    country: r.country ?? '',
    city: r.city ?? '',
    address: r.address ?? '',
    location_type: r.location_type ?? '',
    tracker_status: r.tracker_status ?? '',
    ov: r.ov === 'TRUE',
    ou: r.ou === 'TRUE',
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    logo: r.logo_photo_url ?? null,
  }));

  return {
    locations,
    totalWithCoords: locations.length,
    totalRows: Number(totalResp.rows[0]?.n ?? 0),
    countries: (countriesResp.rows as Array<Record<string, unknown>>).map((r) => String(r.country)),
    types: (typesResp.rows as Array<Record<string, unknown>>).map((r) => String(r.location_type)),
    statuses: (statusesResp.rows as Array<Record<string, unknown>>).map((r) => String(r.tracker_status)),
  };
}

export default async function MapPage() {
  const data = await getMapData();
  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';
  const missing = data.totalRows - data.totalWithCoords;

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Location Map"
        subtitle={`${data.totalWithCoords} of ${data.totalRows} locations plotted`}
      />

      <div className="p-3 sm:p-6">
        {!apiKey ? (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-md">
            <AlertTriangle size={18} className="text-amber-700 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Google Maps API key missing.</p>
              <p className="text-amber-800 mt-1">
                Set <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">GOOGLE_MAPS_API_KEY</code> on
                Vercel (enable Maps JavaScript API + Geocoding API in Google Cloud Console first), then redeploy.
              </p>
            </div>
          </div>
        ) : data.totalWithCoords === 0 ? (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-md">
            <MapPin size={18} className="text-amber-700 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">No locations have coordinates yet.</p>
              <p className="text-amber-800 mt-1">
                Go to <strong>Settings → Bulk geocode addresses</strong> and click the button. It will read each
                tracker row&apos;s address + country and fill in lat/lng so they show on this map.
                ({missing} row{missing === 1 ? '' : 's'} need coordinates.)
              </p>
            </div>
          </div>
        ) : (
          <MapView
            apiKey={apiKey}
            locations={data.locations}
            countries={data.countries}
            types={data.types}
            statuses={data.statuses}
            missingCount={missing}
          />
        )}
      </div>
    </div>
  );
}
