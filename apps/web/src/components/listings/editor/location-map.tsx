'use client';

import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import type { LeafletMouseEvent, Map as LeafletMap, Marker } from 'leaflet';
import { useEffect, useRef } from 'react';
import { type Coordinates, mapProvider } from '@/lib/map/map-provider';

/** A pin drawn with CSS in the brand color, so no marker image assets are needed. */
const PIN_HTML =
  '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;background:var(--primary);border:2px solid var(--foreground);transform:rotate(-45deg)"></span>';

/**
 * Picks a location by clicking the map or dragging the pin. Leaflet touches `window`, so it
 * is loaded only in the browser.
 */
export function LocationMap({
  value,
  onChange,
  disabled,
  label,
}: {
  value: Coordinates | null;
  onChange: (value: Coordinates) => void;
  disabled?: boolean;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onChangeRef.current = onChange;
    disabledRef.current = disabled;
  });

  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      const center = value ?? mapProvider.defaultCenter;
      const map = L.map(containerRef.current, {
        center: [center.latitude, center.longitude],
        zoom: value ? mapProvider.pinnedZoom : mapProvider.defaultZoom,
      });
      L.tileLayer(mapProvider.tileUrl, {
        attribution: mapProvider.attribution,
        maxZoom: mapProvider.maxZoom,
      }).addTo(map);
      map.on('click', (event: LeafletMouseEvent) => {
        if (disabledRef.current) return;
        onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      });
      mapRef.current = map;
      syncMarker(value);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; later value changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncMarker(coordinates: Coordinates | null) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!coordinates) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const position: [number, number] = [coordinates.latitude, coordinates.longitude];
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    } else {
      const icon = L.divIcon({
        html: PIN_HTML,
        className: '',
        iconSize: [22, 22],
        iconAnchor: [2, 22],
      });
      const marker = L.marker(position, { icon, draggable: !disabledRef.current, keyboard: false });
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        onChangeRef.current({ latitude: lat, longitude: lng });
      });
      marker.addTo(map);
      markerRef.current = marker;
    }
    if (!map.getBounds().contains(position)) map.setView(position, mapProvider.pinnedZoom);
  }

  useEffect(() => {
    syncMarker(value);
    if (markerRef.current) {
      if (disabled) markerRef.current.dragging?.disable();
      else markerRef.current.dragging?.enable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.latitude, value?.longitude, disabled]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={label}
      className="isolate z-0 h-72 w-full overflow-hidden rounded-lg border sm:h-96"
    />
  );
}
