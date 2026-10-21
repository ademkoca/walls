import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import type { Database } from '../src/client';
import { listings, properties, users } from '../src/schema';

type NewUser = typeof users.$inferInsert;
type NewListing = typeof listings.$inferInsert;

/** The seller type that matches a role by default: advertisers have one, admins do not. */
function defaultSellerType(role: NewUser['role']): NewUser['sellerType'] {
  if (role === 'PRIVATE_SELLER') return 'PRIVATE_SELLER';
  if (role === 'REAL_ESTATE_AGENT') return 'REAL_ESTATE_AGENT';
  return null;
}

export async function insertUser(db: Database, overrides: Partial<NewUser> = {}) {
  const unique = randomUUID();
  const role = overrides.role ?? 'PRIVATE_SELLER';
  const [user] = await db
    .insert(users)
    .values({
      email: `${unique}@example.com`,
      role,
      sellerType: defaultSellerType(role),
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      displayName: 'Test User',
      slug: `user-${unique}`,
      ...overrides,
    })
    .returning();
  return user!;
}

export async function insertListing(db: Database, overrides: Partial<NewListing> = {}) {
  const creatorId = overrides.createdById ?? (await insertUser(db)).id;
  const [property] = await db
    .insert(properties)
    .values({ createdById: creatorId, propertyType: 'APARTMENT' })
    .returning();
  const [listing] = await db
    .insert(listings)
    .values({
      propertyId: property!.id,
      createdById: creatorId,
      sellerType: 'PRIVATE_SELLER',
      transactionType: 'SALE',
      ...overrides,
    })
    .returning();
  return listing!;
}

/** Asserts that a query fails with the given Postgres constraint or error message. */
export async function expectDbError(
  query: PromiseLike<unknown>,
  expected: { constraint: string } | { message: RegExp },
): Promise<void> {
  const error: unknown = await Promise.resolve(query).then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error, 'expected the query to fail').not.toBeNull();
  const cause = ((error as { cause?: unknown }).cause ?? error) as {
    constraint_name?: string;
    message?: string;
  };
  if ('constraint' in expected) {
    expect(cause.constraint_name).toBe(expected.constraint);
  } else {
    expect(cause.message).toMatch(expected.message);
  }
}
