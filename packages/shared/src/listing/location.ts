/** Structured listing location as stored (SPEC §13). */
export interface ListingLocation {
  country: string;
  city: string;
  municipality: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  street: string;
  streetNumber: string;
  latitude: number;
  longitude: number;
}

/** The parts of the location that pinpoint the property. */
export interface ExactLocation {
  street: string;
  streetNumber: string;
  latitude: number;
  longitude: number;
}

/** What anonymous visitors may see. `exact` is null unless the advertiser made the address public. */
export interface PublicListingLocation {
  country: string;
  city: string;
  municipality: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  exact: ExactLocation | null;
}

/**
 * Builds the public view of a listing's location. The street address and coordinates are
 * left out unless `isExactAddressPublic` is true (hidden by default, SPEC §13–14).
 */
export function toPublicLocation(
  location: ListingLocation,
  isExactAddressPublic: boolean,
): PublicListingLocation {
  const { country, city, municipality, neighborhood, postalCode } = location;
  return {
    country,
    city,
    municipality,
    neighborhood,
    postalCode,
    exact: isExactAddressPublic
      ? {
          street: location.street,
          streetNumber: location.streetNumber,
          latitude: location.latitude,
          longitude: location.longitude,
        }
      : null,
  };
}
