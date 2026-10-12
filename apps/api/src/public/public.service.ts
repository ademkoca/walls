import type { Database } from '@walls/database';
import type { Page, PublicAgentSummary, PublicProfilePage, Role } from '@walls/shared';
import { notFound } from '../http/errors';
import { toPage } from '../http/paging';
import { toCards } from './listing-cards';
import { toPublicProfile } from './public-profile-view';
import { findPublicAgents, findPublicListingsOf, findPublicUser } from './public.repository';

/** Agents per page in the public directory. */
export const AGENTS_PAGE_SIZE = 24;

/** Public seller and agent profiles (SPEC §19). */
export class PublicService {
  constructor(private readonly db: Database) {}

  async profile(role: Role, slug: string): Promise<PublicProfilePage> {
    const user = await findPublicUser(this.db, slug, role);
    if (!user) throw notFound();
    const listings = await toCards(this.db, await findPublicListingsOf(this.db, user.id));
    return { profile: toPublicProfile(user), listings };
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
