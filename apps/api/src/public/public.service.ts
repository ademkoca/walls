import type { Database } from '@walls/database';
import {
  Locale,
  type Page,
  type PublicAgentSummary,
  type PublicListingCard,
  type PublicProfilePage,
  Role,
  isPhoneAlwaysPublic,
  toPublicPhoneContact,
} from '@walls/shared';
import type { UserRow } from '../auth/auth.repository';
import { notFound } from '../http/errors';
import { toPage } from '../http/paging';
import { priceView, storedPrice } from '../listings/listing-content';
import { findPublicAgents, findPublicListingsOf, findPublicUser } from './public.repository';

/** Agents per page in the public directory. */
export const AGENTS_PAGE_SIZE = 24;

type ListingRow = Awaited<ReturnType<typeof findPublicListingsOf>>[number];

function toCard({ listing, property, location, texts, coverUrl }: ListingRow): PublicListingCard {
  const text = (locale: Locale) => texts.find((entry) => entry.locale === locale)?.title ?? null;
  return {
    id: listing.id,
    // Published listings always have a slug and publication date (database constraint).
    slug: listing.slug!,
    title: { sr: text(Locale.SR) ?? '', en: text(Locale.EN) },
    propertyType: property.propertyType!,
    transactionType: listing.transactionType!,
    price: priceView({ price: storedPrice(listing) }),
    city: location?.city ?? null,
    municipality: location?.municipality ?? null,
    neighborhood: location?.neighborhood ?? null,
    coverImageUrl: coverUrl,
    floorArea: property.floorArea,
    plotArea: property.plotArea,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    publishedAt: listing.publishedAt!.toISOString(),
  };
}

/**
 * Public seller and agent profiles (SPEC §19). Only approved public fields are exposed:
 * never internal data, application documents, or an email the user did not make public.
 */
export class PublicService {
  constructor(private readonly db: Database) {}

  async profile(role: Role, slug: string): Promise<PublicProfilePage> {
    const user = await findPublicUser(this.db, slug, role);
    if (!user) throw notFound();
    const listings = await findPublicListingsOf(this.db, user.id);
    return { profile: toPublicProfile(user), listings: listings.map(toCard) };
  }

  async agents(page: number): Promise<Page<PublicAgentSummary>> {
    const rows = await findPublicAgents(this.db, page, AGENTS_PAGE_SIZE);
    return toPage(
      rows,
      page,
      ({ user, listingCount }) => ({
        slug: user.slug,
        displayName: user.displayName,
        agencyName: user.agencyName,
        avatarUrl: user.avatarUrl,
        listingCount: listingCount ?? 0,
      }),
      AGENTS_PAGE_SIZE,
    );
  }
}

function toPublicProfile(user: UserRow) {
  const phoneIsPublic = isPhoneAlwaysPublic(user.role) || user.isPhonePublic;
  return {
    slug: user.slug,
    role: user.role,
    displayName: user.displayName,
    bio: user.bio,
    agencyName: user.role === Role.REAL_ESTATE_AGENT ? user.agencyName : null,
    avatarUrl: user.avatarUrl,
    phone: phoneIsPublic ? toPublicPhoneContact(user.phone, user.phoneVerificationStatus) : null,
    email: user.isEmailPublic ? user.email : null,
    // Agent accounts exist only after an Admin approved the application (SPEC §2.1).
    approvedAgent: user.role === Role.REAL_ESTATE_AGENT,
    memberSince: user.createdAt.toISOString(),
  };
}
