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

/** Geocode a single query. Returns null on any failure (caller decides whether to retry). */
export async function geocodeAddress(
  query: string,
  countryName?: string | null,
): Promise<GeocodeResult | null> {
  if (!query.trim()) return null;
  const params = new URLSearchParams({ address: query, key: apiKey() });
  const region = countryName ? COUNTRY_TO_CCTLD[countryName] : undefined;
  if (region) params.set('region', region);

  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  if (json.status !== 'OK' || !json.results?.length) return null;

  const top = json.results[0];
  const loc = top.geometry?.location;
  if (!loc) return null;

  return {
    latitude: Number(loc.lat),
    longitude: Number(loc.lng),
    formatted_address: String(top.formatted_address ?? query),
  };
}

/** True if geocoding is configured. Cheap check used by the UI to hide/show the action. */
export function isGeocodingEnabled(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}
