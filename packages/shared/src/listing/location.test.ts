import { describe, expect, it } from 'vitest';
import { type ListingLocation, approximateArea, toPublicLocation } from './location';

const location: ListingLocation = {
  country: 'RS',
  city: 'Beograd',
  municipality: 'Vračar',
  neighborhood: 'Crveni krst',
  postalCode: '11000',
  street: 'Njegoševa',
  streetNumber: '12a',
  latitude: 44.8,
  longitude: 20.47,
};

describe('public listing location (SPEC §13)', () => {
  it('omits the street address and coordinates when the exact address is hidden', () => {
    const view = toPublicLocation(location, false);
    expect(view).toEqual({
      country: 'RS',
      city: 'Beograd',
      municipality: 'Vračar',
      neighborhood: 'Crveni krst',
      postalCode: '11000',
      exact: null,
      approximate: approximateArea(44.8, 20.47),
    });
    expect(JSON.stringify(view)).not.toMatch(/Njegoševa|44\.8,|20\.47,/);
  });

  it('includes them when the advertiser made the address public', () => {
    expect(toPublicLocation(location, true).exact).toEqual({
      street: 'Njegoševa',
      streetNumber: '12a',
      latitude: 44.8,
      longitude: 20.47,
    });
    expect(toPublicLocation(location, true).approximate).toBeNull();
  });
});

const EARTH_RADIUS_METERS = 6_371_000;

/** Great-circle distance in meters. */
function distance(a: { latitude: number; longitude: number }, b: typeof a): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

describe('approximate area of a hidden address (decision, Phase 8)', () => {
  const points = [
    { latitude: 44.8197, longitude: 20.4632 }, // Belgrade
    { latitude: 45.2671, longitude: 19.8335 }, // Novi Sad
    { latitude: 43.3209, longitude: 21.8958 }, // Niš
    { latitude: -33.8688, longitude: 151.2093 },
  ];

  it('is a circle about 500 m across that contains the property', () => {
    for (const point of points) {
      const area = approximateArea(point.latitude, point.longitude);
      expect(area.radiusMeters).toBe(250);
      expect(distance(point, area)).toBeLessThanOrEqual(area.radiusMeters);
    }
  });

  it('does not centre on the property and is the same for every property nearby', () => {
    const area = approximateArea(44.8197, 20.4632);
    expect(area).not.toMatchObject({ latitude: 44.8197, longitude: 20.4632 });
    // Snapping to a fixed grid: the circle depends only on the cell, not on the point.
    const cellNeighbours = [
      [area.latitude + 0.0005, area.longitude - 0.0005],
      [area.latitude - 0.001, area.longitude + 0.001],
    ] as const;
    for (const [latitude, longitude] of cellNeighbours) {
      expect(approximateArea(latitude, longitude)).toEqual(area);
    }
  });
});
