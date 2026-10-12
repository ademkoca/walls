import { describe, expect, it } from 'vitest';
import { type ListingLocation, toPublicLocation } from './location';

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
    });
    expect(JSON.stringify(view)).not.toMatch(/Njegoševa|44\.8|20\.47/);
  });

  it('includes them when the advertiser made the address public', () => {
    expect(toPublicLocation(location, true).exact).toEqual({
      street: 'Njegoševa',
      streetNumber: '12a',
      latitude: 44.8,
      longitude: 20.47,
    });
  });
});
