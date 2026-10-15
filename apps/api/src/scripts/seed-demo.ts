/**
 * Demo data for testing search, filters and sorting on the preview site (never for the live
 * site): made-up private sellers and approved agents, and about fifty published listings
 * with Unsplash photos. Every listing passes the same content and submission checks as a
 * real one, but is written straight to the database, so no emails are sent.
 *
 * Usage (both ask for confirmation, `--yes` skips it):
 *   DEMO_PASSWORD=<password for every demo account> pnpm demo:seed
 *   pnpm demo:seed --remove
 *
 * Reads DATABASE_URL and CLOUDINARY_* (without Cloudinary, photos go to LOCAL_MEDIA_DIR).
 * Demo accounts use Resend's test mailbox (see DEMO_EMAIL_PREFIX); a Super Admin must
 * exist, and is recorded as the reviewer who approved the listings and agents.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  type Database,
  type DbExecutor,
  agentApplications,
  auditLogs,
  createDatabase,
  emailOutbox,
  inquiries,
  listingAssignments,
  listingMedia,
  listingRevisions,
  listingStatusHistory,
  listingViewsDaily,
  listings,
  properties,
  users,
} from '@walls/database';
import {
  Currency,
  ListingStatus,
  Locale,
  MediaType,
  PriceMode,
  ReviewStatus,
  Role,
  UserStatus,
  checkListingImage,
  checkSubmissionRequirements,
  contentSubmissionSnapshot,
  listingSlugBase,
  mergeListingContent,
  nextFreeSlug,
  sellerTypeForRole,
  slugify,
} from '@walls/shared';
import { listingInputSchema, newPasswordSchema } from '@walls/validation';
import { and, eq, inArray, like, or } from 'drizzle-orm';
import { z } from 'zod';
import { findSlugsLike } from '../auth/auth.repository';
import { hashPassword } from '../auth/passwords';
import { liveContent, writeContent } from '../listings/listing-content';
import { ALL_CONTENT_FIELDS } from '../listings/listings.service';
import {
  findListingAggregate,
  findListingSlugsLike,
  insertListing,
  insertMedia,
  insertProperty,
  insertStatusHistory,
  updateListing,
  upsertLocation,
} from '../listings/listings.repository';
import { CloudinaryMediaStorage } from '../media/cloudinary-media-storage';
import { inspectImage } from '../media/image-inspection';
import { LocalDiskMediaStorage } from '../media/local-disk-media-storage';
import type { MediaStorage } from '../media/media-storage';
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_EMAIL_PREFIX,
  DEMO_LISTINGS,
  DEMO_MEDIA_PREFIX,
  DEMO_PLACES,
  DEMO_USERS,
  type DemoListing,
  PHOTO_PLAN,
  PHOTO_POOLS,
  type PhotoPool,
  UNSPLASH_IMAGE_PATHS,
  demoEmail,
} from './demo-data';
import { demoDescription } from './demo-text';

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** Downloaded photos are kept here, so a second run does not download them again. */
const PHOTO_CACHE = path.join(API_ROOT, '.demo-photos');
/** Wide enough for the listing image rules (1024 × 768) in landscape photos. */
const PHOTO_WIDTH = 1600;
const PHOTO_QUALITY = 80;
const PARALLEL_DOWNLOADS = 6;
const PARALLEL_DELETES = 8;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** The newest listing was published this long ago; each older one about a day earlier. */
const NEWEST_AGE_MS = 3 * HOUR_MS;
const LISTING_SPACING_MS = 1.2 * DAY_MS;
/** Drafts are created, then submitted, a little before publication. */
const DRAFT_AGE_MS = 2 * DAY_MS;
const SUBMITTED_AGE_MS = DAY_MS;
const VIEW_HISTORY_DAYS = 30;
const MAX_DAILY_VIEWS = 18;
const MAX_DAILY_VIEWS_FEATURED = 45;
/** Spreads listings at the same place over a few hundred metres. */
const COORDINATE_JITTER = 0.004;

const envSchema = z.object({
  DATABASE_URL: z.url(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  LOCAL_MEDIA_DIR: z.string().min(1).default('.media'),
});
type Env = z.infer<typeof envSchema>;

/** Deterministic pseudo-random numbers (mulberry32), so every run seeds the same data. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function storageFor(env: Env): { storage: MediaStorage; description: string } {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey } = env;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  if (cloudName && apiKey && apiSecret) {
    return {
      storage: new CloudinaryMediaStorage({ cloudName, apiKey, apiSecret }),
      description: `Cloudinary account "${cloudName}", folder ${DEMO_MEDIA_PREFIX}`,
    };
  }
  if (cloudName || apiKey || apiSecret) {
    throw new Error('Set all three CLOUDINARY_* variables, or none for local files');
  }
  const directory = path.resolve(API_ROOT, env.LOCAL_MEDIA_DIR);
  return {
    storage: new LocalDiskMediaStorage(directory),
    description: `local folder ${directory}`,
  };
}

/** The database and host from the URL; never the password. */
function databaseName(url: string): string {
  const { hostname, pathname } = new URL(url);
  return `database "${pathname.slice(1)}" on ${hostname}`;
}

async function confirm(question: string, skip: boolean): Promise<boolean> {
  if (skip) return true;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await prompt.question(`${question} Type "yes" to continue: `)).trim() === 'yes';
  } finally {
    prompt.close();
  }
}

async function inBatches<T>(items: readonly T[], size: number, run: (item: T) => Promise<void>) {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map(run));
  }
}

const isDemoEmail = like(users.email, `${DEMO_EMAIL_PREFIX}%${DEMO_EMAIL_DOMAIN}`);

async function findDemoUsers(db: DbExecutor) {
  return db.select({ id: users.id, email: users.email }).from(users).where(isDemoEmail);
}

// ---------------------------------------------------------------------------------------
// Photos

/** Hands out photos from each pool in turn, so neighbouring listings look different. */
function photoPicker() {
  const next = new Map<PhotoPool, number>();
  return (pool: PhotoPool): string => {
    const photos = PHOTO_POOLS[pool];
    const index = next.get(pool) ?? 0;
    next.set(pool, index + 1);
    return photos[index % photos.length]!;
  };
}

async function loadPhoto(id: string): Promise<Buffer> {
  const file = path.join(PHOTO_CACHE, `${id}.jpg`);
  try {
    return await readFile(file);
  } catch {
    // Not downloaded yet.
    const imagePath = UNSPLASH_IMAGE_PATHS[id];
    if (!imagePath) throw new Error(`Photo ${id} is missing from UNSPLASH_IMAGE_PATHS`);
    const response = await fetch(
      `https://images.unsplash.com/${imagePath}?w=${PHOTO_WIDTH}&q=${PHOTO_QUALITY}&fm=jpg`,
    );
    if (!response.ok) throw new Error(`Photo ${id}: download failed with HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    await writeFile(file, data);
    return data;
  }
}

/** Downloads (or reads from the cache) every photo and checks it against the listing rules. */
async function loadPhotos(ids: ReadonlySet<string>): Promise<Map<string, Buffer>> {
  await mkdir(PHOTO_CACHE, { recursive: true });
  const photos = new Map<string, Buffer>();
  await inBatches([...ids], PARALLEL_DOWNLOADS, async (id) => {
    const data = await loadPhoto(id);
    const measured = inspectImage(data);
    const issues = measured ? checkListingImage(measured) : ['UNSUPPORTED_TYPE'];
    if (issues.length > 0)
      throw new Error(`Photo ${id} breaks the image rules: ${issues.join(', ')}`);
    photos.set(id, data);
  });
  return photos;
}

// ---------------------------------------------------------------------------------------
// Seeding

async function createDemoUsers(
  db: Database,
  password: string,
  reviewerId: string,
): Promise<Map<string, { id: string; role: Role }>> {
  const created = new Map<string, { id: string; role: Role }>();
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const user of DEMO_USERS) {
      const base = slugify(user.displayName);
      const [row] = await tx
        .insert(users)
        .values({
          email: demoEmail(user),
          passwordHash: await hashPassword(password),
          role: user.role,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: now,
          preferredLocale: Locale.SR,
          displayName: user.displayName,
          slug: nextFreeSlug(base, new Set(await findSlugsLike(tx, base))),
          bio: user.bio,
          agencyName: user.agencyName ?? null,
          phone: user.phone,
          isPhonePublic: user.isPhonePublic,
          isEmailPublic: user.isEmailPublic,
        })
        .returning({ id: users.id });
      created.set(user.key, { id: row!.id, role: user.role });

      if (user.role === Role.REAL_ESTATE_AGENT) {
        // Agents are public only after an approved application (SPEC §2.1).
        await tx.insert(agentApplications).values({
          fullName: user.displayName,
          email: demoEmail(user),
          phone: user.phone,
          agencyName: user.agencyName ?? null,
          status: ReviewStatus.APPROVED,
          reviewedById: reviewerId,
          reviewedAt: now,
          resultingUserId: row!.id,
        });
      }
    }
  });
  return created;
}

function listingInput(listing: DemoListing, index: number) {
  const place = DEMO_PLACES[listing.at];
  const jitter = random(index + 1);
  const offset = () => (jitter() - 0.5) * COORDINATE_JITTER;
  const texts = [Locale.SR, Locale.EN].flatMap((locale) => {
    const title = locale === Locale.SR ? listing.title[0] : listing.title[1];
    const description = demoDescription(listing, locale);
    return title && description ? [{ locale, title, description }] : [];
  });
  return listingInputSchema.parse({
    propertyType: listing.type,
    transactionType: listing.deal,
    texts,
    location: {
      country: 'RS',
      city: place.city,
      municipality: place.municipality,
      neighborhood: place.neighborhood,
      street: place.street,
      streetNumber: listing.number,
      postalCode: place.postalCode,
      latitude: Number((place.latitude + offset()).toFixed(6)),
      longitude: Number((place.longitude + offset()).toFixed(6)),
    },
    attributes: {
      floorArea: listing.area ?? null,
      plotArea: listing.plot ?? null,
      bedrooms: listing.beds ?? null,
      bathrooms: listing.baths ?? null,
      floor: listing.floor ?? null,
      totalFloors: listing.floors ?? null,
      yearBuilt: listing.year ?? null,
      parkingSpaces: listing.parking ?? null,
      heatingType: listing.heating ?? null,
      furnishedStatus: listing.furnished ?? null,
    },
    amenityCodes: [...listing.features],
    price: listing.price
      ? {
          mode: PriceMode.FIXED,
          amount: listing.price.amount,
          currency: listing.price.currency ?? Currency.EUR,
          period: listing.price.period ?? null,
          negotiable: listing.price.negotiable ?? false,
        }
      : { mode: PriceMode.ON_REQUEST },
    isExactAddressPublic: listing.exact ?? false,
  });
}

/** Daily views for the last month, so listing statistics have something to show. */
function viewRows(listingId: string, listing: DemoListing, publishedAt: Date, index: number) {
  const roll = random(1000 + index);
  const max = listing.featured ? MAX_DAILY_VIEWS_FEATURED : MAX_DAILY_VIEWS;
  const rows: { listingId: string; day: string; views: number }[] = [];
  for (let age = VIEW_HISTORY_DAYS - 1; age >= 0; age -= 1) {
    const day = new Date(Date.now() - age * DAY_MS);
    if (day < publishedAt) continue;
    rows.push({ listingId, day: day.toISOString().slice(0, 10), views: Math.floor(roll() * max) });
  }
  return rows;
}

async function createDemoListing(
  db: Database,
  storage: MediaStorage,
  context: {
    listing: DemoListing;
    index: number;
    photos: readonly Buffer[];
    creator: { id: string; role: Role };
    assignedAgentId: string | null;
    reviewerId: string;
  },
): Promise<string[]> {
  const { listing, index, creator, reviewerId } = context;
  const listingId = randomUUID();
  const publishedAt = new Date(Date.now() - NEWEST_AGE_MS - index * LISTING_SPACING_MS);
  const createdAt = new Date(publishedAt.getTime() - DRAFT_AGE_MS);
  const submittedAt = new Date(publishedAt.getTime() - SUBMITTED_AGE_MS);

  const stored = await Promise.all(
    context.photos.map((data) =>
      storage.put({
        key: `${DEMO_MEDIA_PREFIX}/${listingId}/${randomUUID()}`,
        data,
        contentType: inspectImage(data)!.mimeType,
      }),
    ),
  );

  try {
    await db.transaction(async (tx) => {
      const property = await insertProperty(tx, { createdById: creator.id, createdAt });
      await upsertLocation(tx, { propertyId: property.id });
      const row = await insertListing(tx, {
        id: listingId,
        propertyId: property.id,
        createdById: creator.id,
        sellerType: sellerTypeForRole(creator.role)!,
        createdAt,
      });

      const base = liveContent((await findListingAggregate(tx, listingId))!);
      const merged = mergeListingContent(base, listingInput(listing, index));
      if (!merged.ok) throw new Error(`${listing.title[0]}: ${merged.message}`);
      const issues = checkSubmissionRequirements(
        contentSubmissionSnapshot(merged.content, stored.length),
      );
      if (issues.length > 0) {
        throw new Error(`${listing.title[0]}: ${issues.map((issue) => issue.field).join(', ')}`);
      }
      await writeContent(tx, row, merged.content, ALL_CONTENT_FIELDS);

      for (const [position, file] of stored.entries()) {
        const measured = inspectImage(context.photos[position]!)!;
        await insertMedia(tx, {
          listingId,
          type: MediaType.IMAGE,
          storageKey: file.key,
          url: file.url,
          sortOrder: position,
          isPrimary: position === 0,
          ...measured,
          approvedAt: publishedAt,
          createdAt,
        });
      }

      const slugBase = listingSlugBase(listing.title[0], DEMO_PLACES[listing.at].city);
      await updateListing(tx, listingId, {
        status: ListingStatus.PUBLISHED,
        slug: nextFreeSlug(slugBase, new Set(await findListingSlugsLike(tx, slugBase))),
        publishedAt,
        isFeatured: listing.featured ?? false,
        assignedAgentId: context.assignedAgentId,
      });

      const history = [
        { toStatus: ListingStatus.DRAFT, actorId: creator.id, createdAt },
        {
          fromStatus: ListingStatus.DRAFT,
          toStatus: ListingStatus.PENDING_REVIEW,
          actorId: creator.id,
          createdAt: submittedAt,
        },
        {
          fromStatus: ListingStatus.PENDING_REVIEW,
          toStatus: ListingStatus.PUBLISHED,
          actorId: reviewerId,
          createdAt: publishedAt,
        },
      ];
      for (const entry of history) await insertStatusHistory(tx, { listingId, ...entry });

      if (context.assignedAgentId) {
        await tx.insert(listingAssignments).values({
          listingId,
          agentId: context.assignedAgentId,
          assignedById: reviewerId,
          createdAt: publishedAt,
        });
      }
      const views = viewRows(listingId, listing, publishedAt, index);
      if (views.length > 0) await tx.insert(listingViewsDaily).values(views);
    });
  } catch (error) {
    await Promise.allSettled(stored.map((file) => storage.delete(file.key)));
    throw error;
  }
  return stored.map((file) => file.key);
}

async function seed(db: Database, env: Env, skipConfirmation: boolean): Promise<void> {
  const password = newPasswordSchema.safeParse(process.env.DEMO_PASSWORD ?? '');
  if (!password.success) {
    throw new Error(
      'Set DEMO_PASSWORD to the password for every demo account (at least the minimum length)',
    );
  }
  if ((await findDemoUsers(db)).length > 0) {
    throw new Error('Demo data already exists. Run `pnpm demo:seed --remove` first.');
  }
  const [reviewer] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.role, Role.SUPER_ADMIN), eq(users.status, UserStatus.ACTIVE)))
    .orderBy(users.createdAt)
    .limit(1);
  if (!reviewer) throw new Error('No active Super Admin: create one with `pnpm admin:create`');

  const { storage, description } = storageFor(env);
  console.info(
    `Seeding ${DEMO_USERS.length} demo users and ${DEMO_LISTINGS.length} listings into ` +
      `${databaseName(env.DATABASE_URL)}.\nPhotos: ${description}.\n` +
      `Approved by: ${reviewer.email}.`,
  );
  if (!(await confirm('Continue?', skipConfirmation))) {
    console.info('Nothing changed.');
    return;
  }

  const pick = photoPicker();
  const plans = DEMO_LISTINGS.map((listing) => PHOTO_PLAN[listing.type].map((pool) => pick(pool)));
  console.info('Loading photos…');
  const photos = await loadPhotos(new Set(plans.flat()));

  const created = await createDemoUsers(db, password.data, reviewer.id);
  console.info(`Created ${created.size} demo users.`);

  for (const [index, listing] of DEMO_LISTINGS.entries()) {
    const creator = created.get(listing.by);
    const agent = listing.assign ? created.get(listing.assign) : undefined;
    if (!creator || (listing.assign && !agent)) {
      throw new Error(`${listing.title[0]}: unknown demo user`);
    }
    await createDemoListing(db, storage, {
      listing,
      index,
      photos: plans[index]!.map((id) => photos.get(id)!),
      creator,
      assignedAgentId: agent?.id ?? null,
      reviewerId: reviewer.id,
    });
    console.info(`  ${index + 1}/${DEMO_LISTINGS.length} ${listing.title[0]}`);
  }

  console.info(
    `\nDone. Sign in as any demo user with DEMO_PASSWORD:\n` +
      DEMO_USERS.map((user) => `  ${user.role.padEnd(18)} ${demoEmail(user)}`).join('\n'),
  );
}

// ---------------------------------------------------------------------------------------
// Removal

/**
 * Deletes the demo users and everything that refers to them: their listings (with photos,
 * inquiries and statistics), applications, sessions, audit entries and unsent emails, and
 * their assignments to other listings. Real users' own records are kept.
 */
async function remove(db: Database, env: Env, skipConfirmation: boolean): Promise<void> {
  const demoUsers = await findDemoUsers(db);
  if (demoUsers.length === 0) {
    console.info('No demo data found.');
    return;
  }
  const { storage, description } = storageFor(env);
  const ids = demoUsers.map((user) => user.id);
  const listingRows = await db
    .select({ id: listings.id })
    .from(listings)
    .where(inArray(listings.createdById, ids));
  console.info(
    `Removing ${demoUsers.length} demo users and their ${listingRows.length} listings from ` +
      `${databaseName(env.DATABASE_URL)}.\nPhotos: ${description}.`,
  );
  if (!(await confirm('Continue?', skipConfirmation))) {
    console.info('Nothing changed.');
    return;
  }

  const keys = await db.transaction(async (tx) => {
    const listingIds = listingRows.map((row) => row.id);
    const media =
      listingIds.length > 0
        ? await tx
            .select({ key: listingMedia.storageKey })
            .from(listingMedia)
            .where(inArray(listingMedia.listingId, listingIds))
        : [];
    const avatars = await tx
      .select({ key: users.avatarStorageKey })
      .from(users)
      .where(inArray(users.id, ids));

    await tx.delete(auditLogs).where(inArray(auditLogs.actorId, ids));
    await tx
      .delete(inquiries)
      .where(
        or(
          inArray(inquiries.recipientUserId, ids),
          inArray(inquiries.assignedAgentId, ids),
          inArray(inquiries.senderUserId, ids),
        ),
      );
    await tx
      .delete(listingAssignments)
      .where(
        or(inArray(listingAssignments.agentId, ids), inArray(listingAssignments.assignedById, ids)),
      );
    await tx
      .update(listings)
      .set({ assignedAgentId: null })
      .where(inArray(listings.assignedAgentId, ids));
    await tx.delete(listingStatusHistory).where(inArray(listingStatusHistory.actorId, ids));
    await tx
      .delete(listingRevisions)
      .where(
        or(inArray(listingRevisions.updatedById, ids), inArray(listingRevisions.reviewedById, ids)),
      );
    await tx.delete(listings).where(inArray(listings.createdById, ids));
    await tx.delete(properties).where(inArray(properties.createdById, ids));
    await tx.delete(agentApplications).where(
      or(
        inArray(agentApplications.resultingUserId, ids),
        inArray(
          agentApplications.email,
          demoUsers.map((user) => user.email),
        ),
      ),
    );
    await tx
      .delete(emailOutbox)
      .where(like(emailOutbox.recipientEmail, `${DEMO_EMAIL_PREFIX}%${DEMO_EMAIL_DOMAIN}`));
    await tx.delete(users).where(inArray(users.id, ids));

    return [
      ...media.map((row) => row.key),
      ...avatars.flatMap((row) => (row.key ? [row.key] : [])),
    ];
  });

  let failed = 0;
  await inBatches(keys, PARALLEL_DELETES, async (key) => {
    await storage.delete(key).catch(() => {
      failed += 1;
    });
  });
  console.info(
    `Removed. Deleted ${keys.length - failed} of ${keys.length} stored photos` +
      (failed > 0 ? ' (delete the rest from the storage by hand).' : '.'),
  );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { remove: { type: 'boolean' }, yes: { type: 'boolean' } },
  });
  const env = envSchema.parse(process.env);
  const { db, close } = createDatabase({ url: env.DATABASE_URL, maxConnections: 1 });
  try {
    if (values.remove) await remove(db, env, values.yes ?? false);
    else await seed(db, env, values.yes ?? false);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await close();
  }
}

await main();
