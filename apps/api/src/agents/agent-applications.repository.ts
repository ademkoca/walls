import { type DbExecutor, agentApplicationFiles, agentApplications, users } from '@walls/database';
import type { ReviewStatus } from '@walls/shared';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { pageBounds } from '../http/paging';

export type AgentApplicationRow = typeof agentApplications.$inferSelect;
export type AgentApplicationFileRow = typeof agentApplicationFiles.$inferSelect;

export async function findPendingApplicationByEmail(
  db: DbExecutor,
  email: string,
): Promise<AgentApplicationRow | undefined> {
  const [row] = await db
    .select()
    .from(agentApplications)
    .where(and(eq(agentApplications.email, email), eq(agentApplications.status, 'PENDING')))
    .limit(1);
  return row;
}

export async function insertApplication(
  db: DbExecutor,
  application: typeof agentApplications.$inferInsert,
  files: Omit<typeof agentApplicationFiles.$inferInsert, 'applicationId' | 'position'>[],
): Promise<AgentApplicationRow> {
  const [created] = await db.insert(agentApplications).values(application).returning();
  await db
    .insert(agentApplicationFiles)
    .values(files.map((file, position) => ({ ...file, applicationId: created!.id, position })));
  return created!;
}

/** One page of applications with the given status, oldest first so the queue is fair. */
export async function findApplications(
  db: DbExecutor,
  filter: { status: ReviewStatus; page: number },
) {
  const { limit, offset } = pageBounds(filter.page);
  const newestFirst = filter.status !== 'PENDING';
  return db
    .select({ application: agentApplications, fileCount: count(agentApplicationFiles.id) })
    .from(agentApplications)
    .leftJoin(agentApplicationFiles, eq(agentApplicationFiles.applicationId, agentApplications.id))
    .where(eq(agentApplications.status, filter.status))
    .groupBy(agentApplications.id)
    .orderBy(
      newestFirst ? desc(agentApplications.createdAt) : asc(agentApplications.createdAt),
      asc(agentApplications.id),
    )
    .limit(limit)
    .offset(offset);
}

const reviewer = alias(users, 'reviewer');
const resultingUser = alias(users, 'resulting_user');

/** An application with its files and the names of its reviewer and resulting account. */
export async function findApplication(db: DbExecutor, id: string) {
  const [row] = await db
    .select({
      application: agentApplications,
      reviewedBy: { id: reviewer.id, displayName: reviewer.displayName },
      resultingUser: { id: resultingUser.id, displayName: resultingUser.displayName },
    })
    .from(agentApplications)
    .leftJoin(reviewer, eq(reviewer.id, agentApplications.reviewedById))
    .leftJoin(resultingUser, eq(resultingUser.id, agentApplications.resultingUserId))
    .where(eq(agentApplications.id, id))
    .limit(1);
  if (!row) return undefined;
  const files = await db
    .select()
    .from(agentApplicationFiles)
    .where(eq(agentApplicationFiles.applicationId, id))
    .orderBy(asc(agentApplicationFiles.position));
  return { ...row, files };
}

export async function lockApplication(
  db: DbExecutor,
  id: string,
): Promise<AgentApplicationRow | undefined> {
  const [row] = await db
    .select()
    .from(agentApplications)
    .where(eq(agentApplications.id, id))
    .for('update');
  return row;
}

export async function updateApplication(
  db: DbExecutor,
  id: string,
  changes: Partial<typeof agentApplications.$inferInsert>,
): Promise<void> {
  await db.update(agentApplications).set(changes).where(eq(agentApplications.id, id));
}

export async function findApplicationFile(
  db: DbExecutor,
  applicationId: string,
  fileId: string,
): Promise<AgentApplicationFileRow | undefined> {
  const [file] = await db
    .select()
    .from(agentApplicationFiles)
    .where(
      and(
        eq(agentApplicationFiles.applicationId, applicationId),
        eq(agentApplicationFiles.id, fileId),
      ),
    )
    .limit(1);
  return file;
}

export async function countPendingApplications(db: DbExecutor): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(agentApplications)
    .where(eq(agentApplications.status, 'PENDING'));
  return row?.total ?? 0;
}

/** The application an agent account was created from, with its proof files. */
export async function findApplicationOfUser(db: DbExecutor, userId: string) {
  const [application] = await db
    .select()
    .from(agentApplications)
    .where(eq(agentApplications.resultingUserId, userId))
    .limit(1);
  if (!application) return undefined;
  const files = await db
    .select()
    .from(agentApplicationFiles)
    .where(eq(agentApplicationFiles.applicationId, application.id))
    .orderBy(asc(agentApplicationFiles.position));
  return { application, files };
}
