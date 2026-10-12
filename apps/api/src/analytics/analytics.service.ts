import type { Database } from '@walls/database';
import {
  type Actor,
  ListingStatus,
  type ListingAnalytics,
  type PlatformAnalytics,
  VIEWS_CHART_DAYS,
  canViewAdministration,
  fillDays,
  lastDays,
} from '@walls/shared';
import { assertAllowed } from '../http/errors';
import { loadViewableListing } from '../listings/listings.service';
import { listingTotals, listingViewsSince, platformTotals } from './analytics.repository';

/**
 * Simple analytics (SPEC §23). Admins see the platform and every listing; sellers and
 * agents see the listings they may open in the dashboard (decision, Phase 9).
 */
export class AnalyticsService {
  constructor(private readonly db: Database) {}

  async listing(actor: Actor, id: string, now = new Date()): Promise<ListingAnalytics> {
    await loadViewableListing(this.db, actor, id);
    const days = lastDays(VIEWS_CHART_DAYS, now);
    const [totals, recent] = await Promise.all([
      listingTotals(this.db, id),
      listingViewsSince(this.db, id, days[0]!),
    ]);
    return { ...totals, viewsByDay: fillDays(days, recent) };
  }

  async platform(actor: Actor, now = new Date()): Promise<PlatformAnalytics> {
    assertAllowed(canViewAdministration(actor));
    const [firstDay] = lastDays(VIEWS_CHART_DAYS, now);
    const { byStatus, inquiries, views } = await platformTotals(this.db, firstDay!);
    const status = (value: ListingStatus) => byStatus.get(value) ?? 0;
    return {
      listings: {
        total: [...byStatus.values()].reduce((sum, value) => sum + value, 0),
        published: status(ListingStatus.PUBLISHED),
        pendingReview: status(ListingStatus.PENDING_REVIEW),
        sold: status(ListingStatus.SOLD),
        rented: status(ListingStatus.RENTED),
      },
      inquiries,
      views,
    };
  }
}
