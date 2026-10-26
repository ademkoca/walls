'use client';

import 'leaflet/dist/leaflet.css';
import type { ApproximateArea, ExactLocation } from '@walls/shared';
import { useEffect, useRef } from 'react';
import { mapProvider } from '@/lib/map/map-provider';

/** A pin drawn with CSS in the brand color, so no marker image assets are needed. */
const PIN_HTML =
  '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;background:var(--primary);border:2px solid var(--foreground);transform:rotate(-45deg)"></span>';

/**
 * A listing's location on a read-only map (SPEC §14): a pin at the exact location when the
 * advertiser made it public, otherwise only a circle around the approximate area. Leaflet
 * touches `window`, so it is loaded only in the browser.
 */
export function ListingMap({
  exact,
  approximate,
  label,
}: {
  exact: ExactLocation | null;
  approximate: ApproximateArea | null;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const place = exact ?? approximate;
  // Primitive dependencies: re-rendering the page (e.g. after a currency change) passes new
  // but equal objects, which must not rebuild the map.
  const latitude = place?.latitude;
  const longitude = place?.longitude;
  const radius = exact ? null : (approximate?.radiusMeters ?? null);

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    let cancelled = false;
    let remove: (() => void) | undefined;
    void import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;
      const center: [number, number] = [latitude, longitude];
      const map = L.map(containerRef.current, {
        center,
        zoom: radius === null ? mapProvider.pinnedZoom : mapProvider.areaZoom,
        // Scrolling the page must not zoom the map.
        scrollWheelZoom: false,
      });
      L.tileLayer(mapProvider.tileUrl, {
        attribution: mapProvider.attribution,
        maxZoom: mapProvider.maxZoom,
      }).addTo(map);
      if (radius === null) {
        const icon = L.divIcon({
          html: PIN_HTML,
          className: '',
          iconSize: [22, 22],
          iconAnchor: [2, 22],
        });
        L.marker(center, { icon, keyboard: false, interactive: false }).addTo(map);
      } else {
        L.circle(center, {
          radius,
          // Brand color from the theme (CSS beats Leaflet's SVG attributes).
          className: 'fill-primary stroke-foreground',
          fillOpacity: 0.35,
          weight: 2,
          interactive: false,
        }).addTo(map);
      }
      remove = () => map.remove();
    });
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [latitude, longitude, radius]);

  if (!place) return null;
  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label}
      className="isolate z-0 h-72 w-full overflow-hidden rounded-lg border sm:h-96"
    />
  );
}
