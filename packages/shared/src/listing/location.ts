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

/** A circle that contains the property without revealing where in it the property is. */
export interface ApproximateArea {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

/**
 * What anonymous visitors may see. `exact` is null unless the advertiser made the address
 * public; otherwise `approximate` shows the area around it (decision, Phase 8).
 */
export interface PublicListingLocation {
  country: string;
  city: string;
  municipality: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  exact: ExactLocation | null;
  approximate: ApproximateArea | null;
}

/** Side of the square grid cells that hidden locations are snapped to. */
export const APPROXIMATE_AREA_CELL_METERS = 350;
const METERS_PER_DEGREE_OF_LATITUDE = 111_320;
const COORDINATE_DECIMALS = 5;
/** Keeps longitude cells finite near the poles. */
const MIN_LATITUDE_COSINE = 0.01;

const roundCoordinate = (value: number) => Number(value.toFixed(COORDINATE_DECIMALS));

/**
 * The approximate area of a hidden location: the centre of the grid cell the property is
 * in, with a circle that covers the whole cell. Every property in a cell gets the same
 * circle, so the result reveals the cell and nothing more. It involves no randomness or
 * secret, so it cannot be reversed by averaging or by reading this (public) code.
 */
export function approximateArea(latitude: number, longitude: number): ApproximateArea {
  const latitudeStep = APPROXIMATE_AREA_CELL_METERS / METERS_PER_DEGREE_OF_LATITUDE;
  const centerLatitude = (Math.floor(latitude / latitudeStep) + 0.5) * latitudeStep;
  const cosine = Math.max(Math.cos((centerLatitude * Math.PI) / 180), MIN_LATITUDE_COSINE);
  const longitudeStep = latitudeStep / cosine;
  const centerLongitude = (Math.floor(longitude / longitudeStep) + 0.5) * longitudeStep;
  return {
    latitude: roundCoordinate(centerLatitude),
    longitude: roundCoordinate(centerLongitude),
    // Half the cell's diagonal, rounded up to a round number: the cell fits inside.
    radiusMeters: Math.ceil((APPROXIMATE_AREA_CELL_METERS * Math.SQRT1_2) / 10) * 10,
  };
}

/**
 * Builds the public view of a listing's location. The street address and coordinates are
 * left out unless `isExactAddressPublic` is true (hidden by default, SPEC §13–14); only the
 * approximate area is given instead.
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
    approximate: isExactAddressPublic
      ? null
      : approximateArea(location.latitude, location.longitude),
  };
}
