import {
  type Actor,
  type ListingAccessContext,
  type ListingDetail,
  type ListingSubmissionSnapshot,
  type ListingSummary,
  type Price,
  PriceMode,
  type PriceView,
  availableListingActions,
  canDeleteDraft,
  canEditListing,
  checkSubmissionRequirements,
  fromMinorUnits,
} from '@walls/shared';
import type { ListingAggregate, ListingRow, ListingSummaryRow } from './listings.repository';

export function accessContext(listing: ListingRow): ListingAccessContext {
  return {
    createdById: listing.createdById,
    assignedAgentId: listing.assignedAgentId,
    status: listing.status,
    transactionType: listing.transactionType,
    deletedAt: listing.deletedAt,
  };
}

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

function priceView(listing: ListingRow): PriceView {
  const price = storedPrice(listing);
  if (price.mode === PriceMode.ON_REQUEST) return price;
  const { amountMinor, ...rest } = price;
  return { ...rest, amount: fromMinorUnits(amountMinor, price.currency) };
}

export function submissionSnapshot(aggregate: ListingAggregate): ListingSubmissionSnapshot {
  const { listing, property, location } = aggregate;
  return {
    propertyType: property.propertyType,
    transactionType: listing.transactionType,
    texts: aggregate.texts,
    location: {
      country: location?.country ?? null,
      city: location?.city ?? null,
      street: location?.street ?? null,
      streetNumber: location?.streetNumber ?? null,
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
    },
    price: storedPrice(listing),
    imageCount: aggregate.images.length,
  };
}

export function toListingDetail(aggregate: ListingAggregate, actor: Actor): ListingDetail {
  const { listing, property, location } = aggregate;
  const context = accessContext(listing);
  const edit = canEditListing(actor, context);

  return {
    id: listing.id,
    status: listing.status,
    sellerType: listing.sellerType,
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
    price: priceView(listing),
    isExactAddressPublic: listing.isExactAddressPublic,
    rejectionReason: listing.rejectionReason,
    images: aggregate.images.map((image) => ({
      id: image.id,
      url: image.url,
      isPrimary: image.isPrimary,
      width: image.width,
      height: image.height,
    })),
    permissions: {
      editMode: edit.allowed ? edit.mode : null,
      canDelete: canDeleteDraft(actor, context).allowed,
      actions: availableListingActions(actor, context),
    },
    submissionIssues: checkSubmissionRequirements(submissionSnapshot(aggregate)),
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

export function toListingSummary(row: ListingSummaryRow): ListingSummary {
  return {
    id: row.listing.id,
    status: row.listing.status,
    propertyType: row.propertyType,
    transactionType: row.listing.transactionType,
    title: row.title?.trim() ? row.title : null,
    city: row.city,
    coverImageUrl: row.coverImageUrl,
    imageCount: row.imageCount,
    updatedAt: row.listing.updatedAt.toISOString(),
  };
}
