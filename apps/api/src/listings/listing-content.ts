import type { DbExecutor } from '@walls/database';
import {
  type ListingContent,
  type ListingContentView,
  ListingField,
  type Price,
  PriceMode,
  type PriceView,
  fromMinorUnits,
} from '@walls/shared';
import {
  type ListingAggregate,
  type ListingRow,
  type NewListing,
  replaceAmenities,
  replaceTexts,
  updateListing,
  updateProperty,
  upsertLocation,
} from './listings.repository';

/** The stored price in the domain shape (minor units). */
export function storedPrice(listing: ListingRow): Price {
  if (
    listing.priceMode === PriceMode.FIXED &&
    listing.priceAmountMinor !== null &&
    listing.priceCurrency !== null
  ) {
    return {
      mode: PriceMode.FIXED,
      amountMinor: listing.priceAmountMinor,
      currency: listing.priceCurrency,
      period: listing.pricePeriod,
      negotiable: listing.priceNegotiable,
    };
  }
  return { mode: PriceMode.ON_REQUEST };
}

/** The live content of a listing, from its relational rows. */
export function liveContent(aggregate: ListingAggregate): ListingContent {
  const { listing, property, location } = aggregate;
  return {
    propertyType: property.propertyType,
    transactionType: listing.transactionType,
    texts: aggregate.texts.map(({ locale, title, description }) => ({
      locale,
      title,
      description,
    })),
    location: {
      country: location?.country ?? null,
      city: location?.city ?? null,
      municipality: location?.municipality ?? null,
      neighborhood: location?.neighborhood ?? null,
      street: location?.street ?? null,
      streetNumber: location?.streetNumber ?? null,
      postalCode: location?.postalCode ?? null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
    },
    attributes: {
      floorArea: property.floorArea,
      plotArea: property.plotArea,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      floor: property.floor,
      totalFloors: property.totalFloors,
      yearBuilt: property.yearBuilt,
      parkingSpaces: property.parkingSpaces,
      heatingType: property.heatingType,
      furnishedStatus: property.furnishedStatus,
    },
    amenityCodes: aggregate.amenityCodes,
    price: storedPrice(listing),
    isExactAddressPublic: listing.isExactAddressPublic,
  };
}

export function priceView(content: Pick<ListingContent, 'price'>): PriceView {
  const { price } = content;
  if (price.mode === PriceMode.ON_REQUEST) return price;
  const { amountMinor, ...rest } = price;
  return { ...rest, amount: fromMinorUnits(amountMinor, price.currency) };
}

export function contentView(content: ListingContent): ListingContentView {
  return { ...content, price: priceView(content) };
}

function priceColumns(content: ListingContent): Partial<NewListing> {
  const { price } = content;
  if (price.mode === PriceMode.ON_REQUEST) {
    return {
      priceMode: PriceMode.ON_REQUEST,
      priceAmountMinor: null,
      priceCurrency: null,
      pricePeriod: null,
      priceNegotiable: false,
    };
  }
  return {
    priceMode: PriceMode.FIXED,
    priceAmountMinor: price.amountMinor,
    priceCurrency: price.currency,
    pricePeriod: price.period,
    priceNegotiable: price.negotiable,
  };
}

/** Writes the given groups of `content` into the listing's relational rows. */
export async function writeContent(
  db: DbExecutor,
  listing: Pick<ListingRow, 'id' | 'propertyId'>,
  content: ListingContent,
  fields: ReadonlySet<ListingField>,
): Promise<void> {
  const has = (field: ListingField) => fields.has(field);
  if (has(ListingField.TEXT)) await replaceTexts(db, listing.id, content.texts);
  if (has(ListingField.LOCATION)) {
    await upsertLocation(db, { propertyId: listing.propertyId, ...content.location });
  }
  if (has(ListingField.AMENITIES)) {
    await replaceAmenities(db, listing.propertyId, content.amenityCodes);
  }
  await updateProperty(db, listing.propertyId, {
    ...(has(ListingField.PROPERTY_TYPE) ? { propertyType: content.propertyType } : {}),
    ...(has(ListingField.ATTRIBUTES) ? content.attributes : {}),
  });
  await updateListing(db, listing.id, {
    ...(has(ListingField.TRANSACTION_TYPE) ? { transactionType: content.transactionType } : {}),
    ...(has(ListingField.PRICE) ? priceColumns(content) : {}),
    ...(has(ListingField.EXACT_ADDRESS_VISIBILITY)
      ? { isExactAddressPublic: content.isExactAddressPublic }
      : {}),
  });
}
