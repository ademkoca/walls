/**
 * Map provider settings (SPEC §14). Components use only this module, so the tile source
 * and geocoder can be replaced without touching them. The public OpenStreetMap tile server
 * is fine for development but forbids heavy use: set NEXT_PUBLIC_MAP_TILE_URL to an
 * OSM-based tile host for production.
 */
export const mapProvider = {
  tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
  /** Belgrade, shown until a location is chosen. */
  defaultCenter: { latitude: 44.8125, longitude: 20.4612 },
  defaultZoom: 12,
  pinnedZoom: 17,
} as const;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const GEOCODER_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Finds coordinates for an address typed by the user, using OpenStreetMap's Nominatim.
 * Called only on an explicit button press (Nominatim forbids autocomplete-style use).
 */
export async function geocodeAddress(query: string, signal?: AbortSignal) {
  const url = new URL(GEOCODER_URL);
  url.search = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'rs',
  }).toString();
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) return null;
  const [result] = (await response.json()) as { lat: string; lon: string }[];
  return result ? { latitude: Number(result.lat), longitude: Number(result.lon) } : null;
}
