import { type DbExecutor, auditLogs, listings, users } from '@walls/database';
import { ASSIGNABLE_SELLER_TYPES, type Role, type UserStatus } from '@walls/shared';
import { type SQL, and, count, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm';

import { ADMIN_PAGE_SIZE } from '../http/paging';

export interface UserFilter {
  role?: Role;
  status?: UserStatus;
  /** Only agents and agencies, whom listings can be assigned to. */
  assignable?: boolean;
  q?: string;
  page: number;
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

/** One page of users, newest first, plus one extra row to tell whether more exist. */
export async function findUsers(db: DbExecutor, filter: UserFilter) {
  const conditions: SQL[] = [];
  if (filter.role) conditions.push(eq(users.role, filter.role));
  if (filter.status) conditions.push(eq(users.status, filter.status));
  if (filter.assignable) conditions.push(inArray(users.sellerType, ASSIGNABLE_SELLER_TYPES));
  if (filter.q) {
    const pattern = `%${escapeLike(filter.q)}%`;
    conditions.push(or(ilike(users.displayName, pattern), ilike(users.email, pattern))!);
  }
  return db
    .select()
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset((filter.page - 1) * ADMIN_PAGE_SIZE);
}

export async function countListingsCreatedBy(db: DbExecutor, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(listings)
    .where(and(eq(listings.createdById, userId), isNull(listings.deletedAt)));
  return row?.total ?? 0;
}

export async function lockUser(db: DbExecutor, id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).for('update');
  return user;
}

export interface AuditFilter {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  page: number;
}

/** One page of audit entries, newest first, with the actor's name; one extra row signals more. */
export async function findAuditEntries(db: DbExecutor, filter: AuditFilter) {
  const conditions: SQL[] = [];
  if (filter.entityType) conditions.push(eq(auditLogs.entityType, filter.entityType));
  if (filter.entityId) conditions.push(eq(auditLogs.entityId, filter.entityId));
  if (filter.actorId) conditions.push(eq(auditLogs.actorId, filter.actorId));
  return db
    .select({
      entry: auditLogs,
      actor: { id: users.id, displayName: users.displayName },
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(ADMIN_PAGE_SIZE + 1)
    .offset((filter.page - 1) * ADMIN_PAGE_SIZE);
}
