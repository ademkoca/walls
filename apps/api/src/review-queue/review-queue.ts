import { type Database, listingRevisions, listings } from '@walls/database';
import {
  ListingStatus,
  ReviewStatus,
  type ReviewQueueCounts,
  canViewAdministration,
} from '@walls/shared';
import { and, count, eq, isNull } from 'drizzle-orm';
import { Router } from 'express';
import type { AgentApplicationsService } from '../agents/agent-applications.service';
import { authenticated, requireAuth } from '../http/auth-context';
import { assertAllowed } from '../http/errors';
import type { ProfileChangesService } from '../profiles/profile-changes.service';

async function countWaitingListings(db: Database) {
  const [listingRow, revisionRow] = await Promise.all([
    db
      .select({ total: count() })
      .from(listings)
      .where(and(eq(listings.status, ListingStatus.PENDING_REVIEW), isNull(listings.deletedAt))),
    db
      .select({ total: count() })
      .from(listingRevisions)
      .where(eq(listingRevisions.status, ReviewStatus.PENDING)),
  ]);
  return { listings: listingRow[0]?.total ?? 0, listingRevisions: revisionRow[0]?.total ?? 0 };
}

/** Items waiting for Admins, shown as counts in the dashboard navigation. */
export function reviewQueueRoutes(deps: {
  db: Database;
  applications: AgentApplicationsService;
  profileChanges: ProfileChangesService;
}): Router {
  const router = Router();
  router.use(authenticated);
  router.get('/counts', async (req, res) => {
    assertAllowed(canViewAdministration(requireAuth(req).actor));
    const [waiting, agentApplications, profileChanges] = await Promise.all([
      countWaitingListings(deps.db),
      deps.applications.pendingCount(),
      deps.profileChanges.pendingCount(),
    ]);
    const counts: ReviewQueueCounts = { ...waiting, agentApplications, profileChanges };
    res.json({ counts });
  });
  return router;
}
