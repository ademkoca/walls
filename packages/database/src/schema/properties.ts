import { sql } from 'drizzle-orm';
import {
  char,
  check,
  doublePrecision,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  furnishedStatusEnum,
  heatingTypeEnum,
  id,
  propertyTypeEnum,
  timestamps,
  timestamptz,
} from './columns';
import { users } from './users';

const area = () => numeric({ precision: 12, scale: 2, mode: 'number' });

/**
 * The physical real-estate asset. A property can have several listings, e.g. one for
 * sale and one for rent (SPEC §7). Attributes are nullable so drafts can be incomplete;
 * submission requirements are enforced by the domain layer.
 */
export const properties = pgTable(
  'properties',
  {
    id: id(),
    propertyType: propertyTypeEnum(),
    createdById: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Usable floor area in m². */
    floorArea: area(),
    /** Plot (land) area in m². */
    plotArea: area(),
    bedrooms: smallint(),
    bathrooms: smallint(),
    /** 0 is the ground floor; negative values are below ground. */
    floor: smallint(),
    totalFloors: smallint(),
    yearBuilt: smallint(),
    parkingSpaces: smallint(),
    heatingType: heatingTypeEnum(),
    furnishedStatus: furnishedStatusEnum(),
    ...timestamps(),
  },
  (table) => [
    index().on(table.createdById),
    check('properties_floor_area_positive', sql`${table.floorArea} > 0`),
    check('properties_plot_area_positive', sql`${table.plotArea} > 0`),
    check('properties_rooms_non_negative', sql`${table.bedrooms} >= 0 AND ${table.bathrooms} >= 0`),
    check('properties_total_floors_positive', sql`${table.totalFloors} >= 1`),
    check('properties_floor_within_total', sql`${table.floor} <= ${table.totalFloors}`),
    check('properties_parking_non_negative', sql`${table.parkingSpaces} >= 0`),
  ],
);

/** Structured location (SPEC §13). One row per property; fields nullable for drafts. */
export const propertyLocations = pgTable(
  'property_locations',
  {
    propertyId: uuid()
      .primaryKey()
      .references(() => properties.id, { onDelete: 'cascade' }),
    /** ISO 3166-1 alpha-2 code, e.g. RS. */
    country: char({ length: 2 }),
    city: text(),
    municipality: text(),
    neighborhood: text(),
    postalCode: text(),
    street: text(),
    streetNumber: text(),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    updatedAt: timestamptz()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index().on(table.city, table.municipality),
    check('property_locations_latitude', sql`${table.latitude} BETWEEN -90 AND 90`),
    check('property_locations_longitude', sql`${table.longitude} BETWEEN -180 AND 180`),
  ],
);

/** Reusable amenity/feature catalogue (SPEC §10). Labels live in translation files. */
export const amenities = pgTable('amenities', {
  /** Stable identifier, e.g. AIR_CONDITIONING. */
  code: text().primaryKey(),
  sortOrder: integer().notNull(),
});

export const propertyAmenities = pgTable(
  'property_amenities',
  {
    propertyId: uuid()
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    amenityCode: text()
      .notNull()
      .references(() => amenities.code, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({ columns: [table.propertyId, table.amenityCode] }),
    index().on(table.amenityCode),
  ],
);
