/**
 * Server-side geocoding helper.
 *
 * Uses Google's REST Geocoding API directly so we don't need to install
 * another SDK. Requires GOOGLE_MAPS_API_KEY in env (same key used by the
 * client-side map).
 *
 * Region hint maps each Sun King country to its ccTLD — this biases
 * results into the right country when the address is ambiguous (e.g.
 * "Lokossa" exists in multiple countries).
 */

const COUNTRY_TO_CCTLD: Record<string, string> = {
  Benin: 'bj',
  Cameroon: 'cm',
  Kenya: 'ke',
  Malawi: 'mw',
  Mozambique: 'mz',
  Nigeria: 'ng',
  'South Africa': 'za',
  Tanzania: 'tz',
  Togo: 'tg',
  Uganda: 'ug',
  Zambia: 'zm',
};

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
}

/** Detailed error so callers can surface the actual reason. */
export interface GeocodeError {
  status: string; // Google API status code (REQUEST_DENIED, ZERO_RESULTS, etc.)
  message?: string; // Google's error_message field
}

function apiKey(): string {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) throw new Error('GOOGLE_MAPS_API_KEY is not set — geocoding disabled.');
  return k;
}

/** Build the search string from a location row. City + country gives the geocoder more context than address alone. */
export function buildGeocodeQuery(row: {
  address?: string | null;
  city?: string | null;
  country?: string | null;
  business_name?: string | null;
}): string {
  const parts = [row.address, row.city, row.country].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  // Fallback to business name + country when no address available
  return [row.business_name, row.country].filter(Boolean).join(', ');
}

/**
 * Geocode a single query. Returns { ok, result } | { ok: false, error }.
 * Surfaces Google's actual error status + message so callers can show
 * the real reason (REQUEST_DENIED, OVER_QUERY_LIMIT, ZERO_RESULTS, etc.).
 */
export async function geocodeAddress(
  query: string,
  countryName?: string | null,
): Promise<{ ok: true; result: GeocodeResult } | { ok: false; error: GeocodeError }> {
  if (!query.trim()) {
    return { ok: false, error: { status: 'INVALID_REQUEST', message: 'Empty query' } };
  }
  const params = new URLSearchParams({ address: query, key: apiKey() });
  const region = countryName ? COUNTRY_TO_CCTLD[countryName] : undefined;
  if (region) params.set('region', region);

  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    return { ok: false, error: { status: 'NETWORK_ERROR', message: e instanceof Error ? e.message : 'fetch failed' } };
  }

  if (!res.ok) {
    return { ok: false, error: { status: `HTTP_${res.status}`, message: await res.text().catch(() => '') } };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: { status: 'INVALID_JSON' } };
  }

  if (json.status !== 'OK' || !json.results?.length) {
    return { ok: false, error: { status: String(json.status ?? 'UNKNOWN'), message: json.error_message } };
  }

  const top = json.results[0];
  const loc = top.geometry?.location;
  if (!loc) return { ok: false, error: { status: 'NO_LOCATION' } };

  return {
    ok: true,
    result: {
      latitude: Number(loc.lat),
      longitude: Number(loc.lng),
      formatted_address: String(top.formatted_address ?? query),
    },
  };
}

/** True if geocoding is configured. Cheap check used by the UI to hide/show the action. */
export function isGeocodingEnabled(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

/**
 * Build a public Google Maps URL for a location.
 * Prefers exact lat/lng (drops a pin precisely); falls back to an
 * address-based search query when coords are not yet populated.
 */
export function googleMapsUrl(loc: {
  latitude?: number | string | null;
  longitude?: number | string | null;
  business_name?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  const lat = loc.latitude != null && loc.latitude !== '' ? Number(loc.latitude) : null;
  const lng = loc.longitude != null && loc.longitude !== '' ? Number(loc.longitude) : null;
  if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const q = [loc.business_name, loc.address, loc.city, loc.country].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || 'Sun King')}`;
}
