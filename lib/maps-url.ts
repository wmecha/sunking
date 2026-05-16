/**
 * Client-safe helper for building a public Google Maps URL for a location.
 *
 * Resolution order (highest precedence first):
 *   1. `google_maps_url` — canonical Place URL from Google (e.g. maps.app.goo.gl/...).
 *      This is what's stored when a human verified the exact GBP listing.
 *      Always wins because it lands on the specific Sun King listing
 *      with reviews/photos/hours, not a nearby pin.
 *   2. `latitude` + `longitude` — drops a pin at exact coords. Google
 *      auto-resolves the pin to the nearest known business, which is
 *      usually (but not always) the Sun King storefront.
 *   3. Address-based search — text query of business_name + address +
 *      city + country. Best-effort; first result is generally accurate
 *      but not pinned to a specific Place ID.
 *
 * No env access, no fetch — safe to import in client components.
 */
export function googleMapsUrl(loc: {
  google_maps_url?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  business_name?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  if (loc.google_maps_url && loc.google_maps_url.trim()) return loc.google_maps_url.trim();

  const lat = loc.latitude != null && loc.latitude !== '' ? Number(loc.latitude) : null;
  const lng = loc.longitude != null && loc.longitude !== '' ? Number(loc.longitude) : null;
  if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const q = [loc.business_name, loc.address, loc.city, loc.country].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || 'Sun King')}`;
}

/** Tells the caller which source the current URL would come from — useful for UI hints. */
export function mapsUrlSource(loc: {
  google_maps_url?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}): 'canonical' | 'coords' | 'search' {
  if (loc.google_maps_url && loc.google_maps_url.trim()) return 'canonical';
  if (hasCoords(loc)) return 'coords';
  return 'search';
}

/** True if a location has usable numeric coordinates. */
export function hasCoords(loc: { latitude?: number | string | null; longitude?: number | string | null }): boolean {
  if (loc.latitude == null || loc.longitude == null) return false;
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  return !Number.isNaN(lat) && !Number.isNaN(lng);
}
