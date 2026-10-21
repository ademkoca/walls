import type { Database } from '@walls/database';
import {
  type Page,
  type PublicPartnerSummary,
  type PublicProfilePage,
  type Role,
  isProfessionalSellerType,
} from '@walls/shared';
import type { PartnerDirectoryQuery } from '@walls/validation';
import { notFound } from '../http/errors';
import type { MediaStorage } from '../media/media-storage';
import { toPage } from '../http/paging';
import { toCards } from './listing-cards';
import { advertiserType, toPublicProfile } from './public-profile-view';
import { findPublicListingsOf, findPublicPartners, findPublicUser } from './public.repository';

/** Professionals per page in the public directory. */
export const PARTNERS_PAGE_SIZE = 24;

/** Public private-seller and professional profiles (SPEC §19). */
export class PublicService {
  constructor(
    private readonly db: Database,
    private readonly media: MediaStorage,
  ) {}

  async profile(role: Role, slug: string): Promise<PublicProfilePage> {
    const user = await findPublicUser(this.db, slug, role);
    if (!user) throw notFound();
    const listings = await toCards(this.db, await findPublicListingsOf(this.db, user.id));
    const { avatarStorageKey, avatarUrl } = user;
    return {
      profile: toPublicProfile(user),
      listings,
      linkPreviewImage:
        avatarStorageKey && avatarUrl
          ? this.media.linkPreviewImage({ key: avatarStorageKey, url: avatarUrl }, 'square')
          : null,
    };
  }

  /** The directory of agents, agencies and investors, optionally of one kind (SPEC §16). */
  async partners(query: PartnerDirectoryQuery): Promise<Page<PublicPartnerSummary>> {
    const rows = await findPublicPartners(this.db, query, PARTNERS_PAGE_SIZE);
    return toPage(
      rows,
      query.page,
      ({ user, listingCount }) => {
        const sellerType = advertiserType(user);
        if (!isProfessionalSellerType(sellerType)) {
          throw new Error(`Professional ${user.id} has seller type ${sellerType}`);
        }
        return {
          slug: user.slug,
          sellerType,
          displayName: user.displayName,
          agencyName: toPublicProfile(user).agencyName,
          avatarUrl: user.avatarUrl,
          listingCount: listingCount ?? 0,
        };
      },
      PARTNERS_PAGE_SIZE,
    );
  }
}
