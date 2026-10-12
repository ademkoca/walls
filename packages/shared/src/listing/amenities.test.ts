import { describe, expect, it } from 'vitest';
import { PropertyType } from '../enums';
import { AMENITIES, AMENITIES_BY_PROPERTY_TYPE, amenitiesFor, isAmenityAllowed } from './amenities';

describe('amenities per property type', () => {
  it('offers land only utilities and permits', () => {
    expect(amenitiesFor(PropertyType.LAND)).toEqual([
      'ELECTRICITY',
      'WATER',
      'SEWAGE',
      'GAS_CONNECTION',
      'ROAD_ACCESS',
      'BUILDING_PERMIT',
    ]);
    expect(isAmenityAllowed(PropertyType.LAND, 'ELEVATOR')).toBe(false);
  });

  it('offers no home features for garages', () => {
    expect(amenitiesFor(PropertyType.GARAGE)).toEqual(['ELEVATOR', 'SECURITY_SYSTEM']);
    expect(isAmenityAllowed(PropertyType.GARAGE, 'TERRACE')).toBe(false);
  });

  it('offers an elevator for apartments but not for houses', () => {
    expect(isAmenityAllowed(PropertyType.APARTMENT, 'ELEVATOR')).toBe(true);
    expect(isAmenityAllowed(PropertyType.HOUSE, 'ELEVATOR')).toBe(false);
  });

  it('offers everything for "other" and nothing before a type is chosen', () => {
    expect(amenitiesFor(PropertyType.OTHER)).toEqual(AMENITIES);
    expect(amenitiesFor(null)).toEqual([]);
    expect(isAmenityAllowed(null, 'ELEVATOR')).toBe(false);
  });

  it('keeps the catalogue display order and only known codes', () => {
    for (const type of Object.values(PropertyType)) {
      const offered = amenitiesFor(type);
      expect(offered).toEqual(AMENITIES.filter((amenity) => offered.includes(amenity)));
      expect(offered).toHaveLength(new Set(AMENITIES_BY_PROPERTY_TYPE[type]).size);
    }
  });
});
