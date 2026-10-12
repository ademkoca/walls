import { createHmac } from 'node:crypto';
import type { Database } from '@walls/database';
import { type Actor, analyticsDay, isReviewer } from '@walls/shared';
import { countView, deleteVisitorsBefore, findViewableListing } from './analytics.repository';

/** Crawlers, link previews, monitors and scripts: their visits are not views (decision, Phase 9). */
const NOT_A_VISITOR =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|monitor|pingdom|lighthouse|curl|wget|python|java\/|go-http|axios|node-fetch|okhttp/i;

export function isAutomatedClient(userAgent: string): boolean {
  return userAgent.trim() === '' || NOT_A_VISITOR.test(userAgent);
}

/**
 * An anonymous, per-day visitor fingerprint: HMAC of IP address and browser, keyed with a
 * secret that changes every day. Nothing that identifies the visitor is stored, and the
 * same visitor gets an unrelated value the next day.
 */
export function visitorHash(secret: string, day: string, ip: string, userAgent: string): string {
  const dailyKey = createHmac('sha256', secret).update(`listing-views:${day}`).digest();
  return createHmac('sha256', dailyKey).update(`${ip}\n${userAgent}`).digest('base64url');
}

export interface Viewer {
  ip: string;
  userAgent: string;
  /** The signed-in user, if any. */
  actor: Actor | null;
}

/**
 * Listing views (SPEC §23), counted once per visitor per day. Views by the listing's own
 * creator or assigned agent and by Admins are not counted, nor are automated clients.
 */
export class ListingViewsService {
  private cleanedDay: string | null = null;

  constructor(
    private readonly db: Database,
    private readonly secret: string,
  ) {}

  async record(slug: string, viewer: Viewer, now = new Date()): Promise<boolean> {
    if (isAutomatedClient(viewer.userAgent)) return false;
    const listing = await findViewableListing(this.db, slug);
    if (!listing) return false;
    const { actor } = viewer;
    if (
      actor &&
      (isReviewer(actor) ||
        actor.id === listing.createdById ||
        actor.id === listing.assignedAgentId)
    ) {
      return false;
    }

    const day = analyticsDay(now);
    if (this.cleanedDay !== day) {
      await deleteVisitorsBefore(this.db, day);
      this.cleanedDay = day;
    }
    const hash = visitorHash(this.secret, day, viewer.ip, viewer.userAgent);
    return this.db.transaction((tx) => countView(tx, listing.id, day, hash));
  }
}
