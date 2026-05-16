/**
 * Client-safe helper for building a public Google Maps URL for a location.
 * Prefers exact lat/lng; falls back to an address-based search query when
 * coords aren't populated yet.
 *
 * No env access, no fetch — safe to import in client components.
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

/** True if a location has usable numeric coordinates. */
export function hasCoords(loc: { latitude?: number | string | null; longitude?: number | string | null }): boolean {
  if (loc.latitude == null || loc.longitude == null) return false;
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  return !Number.isNaN(lat) && !Number.isNaN(lng);
}
