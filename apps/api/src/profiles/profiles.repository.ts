import { type DbExecutor, profileChangeRequests, users } from '@walls/database';
import type { ReviewStatus } from '@walls/shared';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { pageBounds } from '../http/paging';

export type ChangeRequestRow = typeof profileChangeRequests.$inferSelect;
export type NewChangeRequest = typeof profileChangeRequests.$inferInsert;

/** The user's newest change request: the pending one, or else the latest reviewed one. */
export async function findLatestChangeRequest(
  db: DbExecutor,
  userId: string,
): Promise<ChangeRequestRow | undefined> {
  const [row] = await db
    .select()
    .from(profileChangeRequests)
    .where(eq(profileChangeRequests.userId, userId))
    .orderBy(desc(profileChangeRequests.createdAt), desc(profileChangeRequests.id))
    .limit(1);
  return row;
}

/** The pending request of a user, locked for the rest of the transaction. */
export async function lockPendingChangeRequest(
  db: DbExecutor,
  userId: string,
): Promise<ChangeRequestRow | undefined> {
  const [row] = await db
    .select()
    .from(profileChangeRequests)
    .where(
      and(eq(profileChangeRequests.userId, userId), eq(profileChangeRequests.status, 'PENDING')),
    )
    .for('update');
  return row;
}

export async function lockChangeRequest(
  db: DbExecutor,
  id: string,
): Promise<ChangeRequestRow | undefined> {
  const [row] = await db
    .select()
    .from(profileChangeRequests)
    .where(eq(profileChangeRequests.id, id))
    .for('update');
  return row;
}

export async function insertChangeRequest(db: DbExecutor, request: NewChangeRequest) {
  await db.insert(profileChangeRequests).values(request);
}

export async function updateChangeRequest(
  db: DbExecutor,
  id: string,
  changes: Partial<NewChangeRequest>,
): Promise<void> {
  await db.update(profileChangeRequests).set(changes).where(eq(profileChangeRequests.id, id));
}

export async function deleteChangeRequest(db: DbExecutor, id: string): Promise<void> {
  await db.delete(profileChangeRequests).where(eq(profileChangeRequests.id, id));
}

const reviewer = alias(users, 'reviewer');

/** One page of requests with the given status and their users; pending ones oldest first. */
export async function findChangeRequests(
  db: DbExecutor,
  filter: { status: ReviewStatus; page: number },
) {
  const { limit, offset } = pageBounds(filter.page);
  const order =
    filter.status === 'PENDING'
      ? asc(profileChangeRequests.updatedAt)
      : desc(profileChangeRequests.updatedAt);
  return db
    .select({ request: profileChangeRequests, user: users })
    .from(profileChangeRequests)
    .innerJoin(users, eq(users.id, profileChangeRequests.userId))
    .where(eq(profileChangeRequests.status, filter.status))
    .orderBy(order, asc(profileChangeRequests.id))
    .limit(limit)
    .offset(offset);
}

export async function findChangeRequest(db: DbExecutor, id: string) {
  const [row] = await db
    .select({
      request: profileChangeRequests,
      user: users,
      reviewedBy: { id: reviewer.id, displayName: reviewer.displayName },
    })
    .from(profileChangeRequests)
    .innerJoin(users, eq(users.id, profileChangeRequests.userId))
    .leftJoin(reviewer, eq(reviewer.id, profileChangeRequests.reviewedById))
    .where(eq(profileChangeRequests.id, id))
    .limit(1);
  return row;
}

export async function countPendingChangeRequests(db: DbExecutor): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(profileChangeRequests)
    .where(eq(profileChangeRequests.status, 'PENDING'));
  return row?.total ?? 0;
}
