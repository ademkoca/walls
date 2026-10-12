import { type DbExecutor, authTokens, userSessions, users } from '@walls/database';
import { and, eq, gt, isNull, like, or, sql } from 'drizzle-orm';

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuthTokenType = (typeof authTokens.$inferSelect)['type'];

export async function findUserByEmail(db: DbExecutor, email: string): Promise<UserRow | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
}

export async function insertUser(db: DbExecutor, user: NewUser): Promise<UserRow> {
  const [created] = await db.insert(users).values(user).returning();
  return created!;
}

export async function updateUser(
  db: DbExecutor,
  userId: string,
  changes: Partial<NewUser>,
): Promise<void> {
  await db.update(users).set(changes).where(eq(users.id, userId));
}

/** Slugs already taken that `base` could collide with: `base` itself and `base-N`. */
export async function findSlugsLike(db: DbExecutor, base: string): Promise<string[]> {
  const rows = await db
    .select({ slug: users.slug })
    .from(users)
    .where(or(eq(users.slug, base), like(users.slug, `${base}-%`)));
  return rows.map((row) => row.slug);
}

export async function insertAuthToken(
  db: DbExecutor,
  token: {
    userId: string;
    type: AuthTokenType;
    tokenHash: string;
    expiresAt: Date;
    newEmail?: string;
  },
): Promise<void> {
  await db.insert(authTokens).values(token);
}

/** Removes a user's unused tokens of one type, so only the newest emailed link works. */
export async function deleteUnusedTokens(
  db: DbExecutor,
  userId: string,
  type: AuthTokenType,
): Promise<void> {
  await db
    .delete(authTokens)
    .where(
      and(eq(authTokens.userId, userId), eq(authTokens.type, type), isNull(authTokens.usedAt)),
    );
}

/**
 * Marks a valid (unused, unexpired) token as used and returns its user. Done in one
 * UPDATE so the same link cannot be redeemed twice concurrently.
 */
export async function consumeToken(
  db: DbExecutor,
  type: AuthTokenType,
  tokenHash: string,
): Promise<{ userId: string; newEmail: string | null } | undefined> {
  const [token] = await db
    .update(authTokens)
    .set({ usedAt: sql`now()` })
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, sql`now()`),
      ),
    )
    .returning({ userId: authTokens.userId, newEmail: authTokens.newEmail });
  return token;
}

export async function findUserById(db: DbExecutor, userId: string): Promise<UserRow | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user;
}

export async function insertSession(
  db: DbExecutor,
  session: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> {
  await db.insert(userSessions).values(session);
}

export async function findSessionWithUser(db: DbExecutor, tokenHash: string) {
  const [row] = await db
    .select({ session: userSessions, user: users })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(eq(userSessions.tokenHash, tokenHash))
    .limit(1);
  return row;
}

export async function extendSession(
  db: DbExecutor,
  sessionId: string,
  expiresAt: Date,
): Promise<void> {
  await db
    .update(userSessions)
    .set({ expiresAt, lastSeenAt: sql`now()` })
    .where(eq(userSessions.id, sessionId));
}

export async function deleteSession(db: DbExecutor, sessionId: string): Promise<void> {
  await db.delete(userSessions).where(eq(userSessions.id, sessionId));
}

export async function deleteSessionsForUser(db: DbExecutor, userId: string): Promise<void> {
  await db.delete(userSessions).where(eq(userSessions.userId, userId));
}

/** The address a user is changing to, while its verification link is still valid. */
export async function findPendingEmailChange(
  db: DbExecutor,
  userId: string,
): Promise<string | null> {
  const [token] = await db
    .select({ newEmail: authTokens.newEmail })
    .from(authTokens)
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.type, 'EMAIL_CHANGE'),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, sql`now()`),
      ),
    )
    .limit(1);
  return token?.newEmail ?? null;
}
