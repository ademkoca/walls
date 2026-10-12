import { PropertyType } from '../enums';

/**
 * Amenity (feature) codes (SPEC §10). The database `amenities` table holds the same codes
 * (seeded by migrations) so property features keep referential integrity.
 */
export const Amenity = {
  ELEVATOR: 'ELEVATOR',
  AIR_CONDITIONING: 'AIR_CONDITIONING',
  BALCONY: 'BALCONY',
  TERRACE: 'TERRACE',
  GARDEN: 'GARDEN',
  PARKING: 'PARKING',
  GARAGE: 'GARAGE',
  SECURITY_SYSTEM: 'SECURITY_SYSTEM',
  INTERNET: 'INTERNET',
  PETS_ALLOWED: 'PETS_ALLOWED',
  SMOKING_ALLOWED: 'SMOKING_ALLOWED',
  // Utilities and permits, mainly for land.
  ELECTRICITY: 'ELECTRICITY',
  WATER: 'WATER',
  SEWAGE: 'SEWAGE',
  GAS_CONNECTION: 'GAS_CONNECTION',
  ROAD_ACCESS: 'ROAD_ACCESS',
  BUILDING_PERMIT: 'BUILDING_PERMIT',
} as const;
export type Amenity = (typeof Amenity)[keyof typeof Amenity];

/** Every amenity, in display order (matches `amenities.sort_order`). */
export const AMENITIES: readonly Amenity[] = Object.values(Amenity);

const {
  ELEVATOR,
  AIR_CONDITIONING,
  BALCONY,
  TERRACE,
  GARDEN,
  PARKING,
  GARAGE,
  SECURITY_SYSTEM,
  INTERNET,
  PETS_ALLOWED,
  SMOKING_ALLOWED,
  ELECTRICITY,
  WATER,
  SEWAGE,
  GAS_CONNECTION,
  ROAD_ACCESS,
  BUILDING_PERMIT,
} = Amenity;

const HOME = [
  AIR_CONDITIONING,
  BALCONY,
  TERRACE,
  GARDEN,
  PARKING,
  GARAGE,
  SECURITY_SYSTEM,
  INTERNET,
  PETS_ALLOWED,
  SMOKING_ALLOWED,
] as const;

/** Features that apply to each property type (agreed with the product owner, Phase 5). */
export const AMENITIES_BY_PROPERTY_TYPE: Readonly<Record<PropertyType, readonly Amenity[]>> = {
  [PropertyType.APARTMENT]: [ELEVATOR, ...HOME],
  [PropertyType.HOUSE]: [...HOME, SEWAGE, GAS_CONNECTION],
  [PropertyType.VILLA]: [ELEVATOR, ...HOME, SEWAGE, GAS_CONNECTION],
  [PropertyType.OFFICE]: [
    ELEVATOR,
    AIR_CONDITIONING,
    BALCONY,
    TERRACE,
    PARKING,
    GARAGE,
    SECURITY_SYSTEM,
    INTERNET,
    SMOKING_ALLOWED,
  ],
  [PropertyType.RETAIL]: [ELEVATOR, AIR_CONDITIONING, TERRACE, PARKING, SECURITY_SYSTEM, INTERNET],
  [PropertyType.WAREHOUSE]: [ELEVATOR, AIR_CONDITIONING, PARKING, SECURITY_SYSTEM, INTERNET],
  [PropertyType.GARAGE]: [ELEVATOR, SECURITY_SYSTEM],
  [PropertyType.LAND]: [ELECTRICITY, WATER, SEWAGE, GAS_CONNECTION, ROAD_ACCESS, BUILDING_PERMIT],
  [PropertyType.OTHER]: AMENITIES,
};

/** Amenities offered for a property type, in display order; none until a type is chosen. */
export function amenitiesFor(propertyType: PropertyType | null): Amenity[] {
  if (!propertyType) return [];
  const allowed = new Set<string>(AMENITIES_BY_PROPERTY_TYPE[propertyType]);
  return AMENITIES.filter((amenity) => allowed.has(amenity));
}

export function isAmenityAllowed(propertyType: PropertyType | null, code: string): boolean {
  return amenitiesFor(propertyType).some((amenity) => amenity === code);
}
