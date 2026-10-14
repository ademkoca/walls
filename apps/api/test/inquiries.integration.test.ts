import { auditLogs, inquiries } from '@walls/database';
import {
  type InquiryCounts,
  type InquiryDetail,
  type InquirySummary,
  type Page,
  Role,
  type SentInquiry,
} from '@walls/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, uniqueEmail } from './helpers';
import { LISTINGS, detailOf, submittedListing } from './listing-fixtures';

const ctx = createTestContext();
afterAll(ctx.close);

type User = Awaited<ReturnType<typeof ctx.signedInUser>>;
let admin: User;
beforeAll(async () => {
  admin = await ctx.signedInUser(Role.ADMIN);
});

async function publishedListing(owner: User) {
  const id = await submittedListing(owner.client);
  const approved = await admin.client.post(`${LISTINGS}/${id}/approve`);
  expect(approved.status).toBe(200);
  return { id, slug: detailOf(approved).slug! };
}

const inquiry = (overrides: Record<string, string> = {}) => ({
  name: 'Marija Petrović',
  email: uniqueEmail(),
  phone: '+381 64 111 2222',
  message: 'Da li je stan još dostupan?\nMogu da dođem u subotu.',
  ...overrides,
});

const send = (slug: string, body: object) =>
  ctx.client().post(`/api/v1/public/listings/${slug}/inquiries`, body);

const listOf = async (user: User, status = 'NEW') =>
  (await user.client.get(`/api/v1/inquiries?status=${status}`)).body as Page<InquirySummary>;

const countsOf = async (user: User) =>
  ((await user.client.get('/api/v1/inquiries/counts')).body as { counts: InquiryCounts }).counts;

describe('sending an inquiry (SPEC §20)', () => {
  it('stores it for the advertiser and emails them, with replies going to the visitor', async () => {
    const seller = await ctx.signedInUser();
    const { id, slug } = await publishedListing(seller);
    const body = inquiry();
    const response = await send(slug, body);
    expect(response.status).toBe(201);

    const email = await ctx.lastEmailTo(seller.user.email);
    expect(email?.subject).toContain('Trosoban stan na Vračaru');
    expect(email?.replyTo).toBe(body.email);
    expect(email?.text).toContain('Mogu da dođem u subotu.');
    expect(email?.text).toContain('/dashboard/inquiries/');

    const [item] = (await listOf(seller)).items;
    expect(item).toMatchObject({
      listing: { id, title: 'Trosoban stan na Vračaru', slug, status: 'PUBLISHED' },
      visitorName: 'Marija Petrović',
      preview: 'Da li je stan još dostupan? Mogu da dođem u subotu.',
      status: 'NEW',
      canManage: true,
    });
    const detail = (await seller.client.get(`/api/v1/inquiries/${item!.id}`)).body as {
      inquiry: InquiryDetail;
    };
    expect(detail.inquiry).toMatchObject({
      visitorEmail: body.email,
      visitorPhone: '+381 64 111 2222',
      message: body.message,
      recipient: { id: seller.user.id },
      assignedAgent: null,
      canReply: true,
    });

    // Admins read and manage it (status), but only the recipient replies (decision, 2026-10-14).
    const asAdmin = (await admin.client.get(`/api/v1/inquiries/${item!.id}`)).body as {
      inquiry: InquiryDetail;
    };
    expect(asAdmin.inquiry).toMatchObject({ canManage: true, canReply: false });
    expect(asAdmin.inquiry.visitorEmail).toBe(body.email);
  });

  it('routes to the assigned agent only; the creator can read it but not change it', async () => {
    const seller = await ctx.signedInUser();
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const { id, slug } = await publishedListing(seller);
    await admin.client.put(`${LISTINGS}/${id}/assignment`, { agentId: agent.user.id });
    expect((await send(slug, inquiry())).status).toBe(201);

    expect((await ctx.lastEmailTo(agent.user.email))?.subject).toContain('Trosoban');
    expect((await ctx.lastEmailTo(seller.user.email))?.subject ?? '').not.toContain('inquiry');
    expect((await ctx.lastEmailTo(seller.user.email))?.subject ?? '').not.toContain('upit');

    const [forAgent] = (await listOf(agent)).items;
    expect(forAgent?.canManage).toBe(true);
    expect(await countsOf(agent)).toEqual({ new: 1 });
    const [forSeller] = (await listOf(seller)).items;
    expect(forSeller).toMatchObject({ id: forAgent!.id, canManage: false });
    expect(await countsOf(seller)).toEqual({ new: 0 });

    const path = `/api/v1/inquiries/${forAgent!.id}`;
    expect((await seller.client.put(`${path}/status`, { status: 'CLOSED' })).status).toBe(403);
    const detail = (await seller.client.get(path)).body as { inquiry: InquiryDetail };
    expect(detail.inquiry).toMatchObject({
      recipient: { id: agent.user.id },
      assignedAgent: { id: agent.user.id },
      canManage: false,
      canReply: false,
    });
    const asAgent = (await agent.client.get(path)).body as { inquiry: InquiryDetail };
    expect(asAgent.inquiry.canReply).toBe(true);
    const stranger = await ctx.signedInUser();
    expect((await stranger.client.get(path)).status).toBe(403);
    expect((await listOf(stranger)).items).toEqual([]);
  });

  it('goes to the creator when the assigned agent was deactivated (decision, Phase 9)', async () => {
    const seller = await ctx.signedInUser();
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const { id, slug } = await publishedListing(seller);
    await admin.client.put(`${LISTINGS}/${id}/assignment`, { agentId: agent.user.id });
    await admin.client.post(`/api/v1/users/${agent.user.id}/deactivate`, { reason: 'Prevara.' });
    expect((await send(slug, inquiry())).status).toBe(201);

    const [item] = (await listOf(seller)).items;
    expect(item?.canManage).toBe(true);
    const [row] = await ctx.db.select().from(inquiries).where(eq(inquiries.listingId, id));
    expect(row).toMatchObject({ recipientUserId: seller.user.id, assignedAgentId: agent.user.id });
  });

  it('silently drops inquiries with the trap field filled in', async () => {
    const seller = await ctx.signedInUser();
    const { id, slug } = await publishedListing(seller);
    const response = await send(slug, inquiry({ website: 'https://spam.example' }));
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ received: true });
    expect(await ctx.db.select().from(inquiries).where(eq(inquiries.listingId, id))).toEqual([]);
  });

  it('limits inquiries per email address and listing, ignoring letter case', async () => {
    const seller = await ctx.signedInUser();
    const { slug } = await publishedListing(seller);
    const email = uniqueEmail();
    for (let index = 0; index < 3; index += 1) {
      expect((await send(slug, inquiry({ email }))).status).toBe(201);
    }
    const limited = await send(slug, inquiry({ email: email.toUpperCase() }));
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect((await send(slug, inquiry())).status).toBe(201);
  });

  it('limits inquiries per IP address', async () => {
    const limited = createTestContext({ inquiryRateLimit: { windowMs: 60_000, limit: 2 } });
    try {
      const seller = await ctx.signedInUser();
      const { slug } = await publishedListing(seller);
      const path = `/api/v1/public/listings/${slug}/inquiries`;
      expect((await limited.client().post(path, inquiry())).status).toBe(201);
      expect((await limited.client().post(path, inquiry())).status).toBe(201);
      expect((await limited.client().post(path, inquiry())).status).toBe(429);
    } finally {
      await limited.close();
    }
  });

  it('rejects invalid input and listings that are not public', async () => {
    const seller = await ctx.signedInUser();
    const { id, slug } = await publishedListing(seller);
    expect((await send(slug, inquiry({ email: 'nope' }))).status).toBe(400);
    expect((await send(slug, { ...inquiry(), recipientUserId: seller.user.id })).status).toBe(400);
    expect((await send('no-such-listing', inquiry())).status).toBe(404);

    // Sold listings are no longer public, so they take no inquiries.
    await admin.client.post(`${LISTINGS}/${id}/mark-sold`);
    expect((await send(slug, inquiry())).status).toBe(404);
  });
});

describe('managing inquiries', () => {
  it('lets the recipient and admins change the status, which is audited', async () => {
    const seller = await ctx.signedInUser();
    const { slug } = await publishedListing(seller);
    await send(slug, inquiry());
    const [item] = (await listOf(seller)).items;
    const path = `/api/v1/inquiries/${item!.id}/status`;

    const contacted = await seller.client.put(path, { status: 'CONTACTED' });
    expect(contacted.status).toBe(200);
    expect((contacted.body as { inquiry: InquiryDetail }).inquiry.status).toBe('CONTACTED');
    expect((await listOf(seller)).items).toEqual([]);
    expect((await listOf(seller, 'CONTACTED')).items.map((entry) => entry.id)).toEqual([item!.id]);

    expect((await admin.client.put(path, { status: 'CLOSED' })).status).toBe(200);
    expect((await seller.client.put(path, { status: 'DONE' })).status).toBe(400);

    const audit = await ctx.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, 'INQUIRY'), eq(auditLogs.entityId, item!.id)));
    expect(audit.map((entry) => [entry.actorId, entry.after])).toEqual(
      expect.arrayContaining([
        [seller.user.id, { status: 'CONTACTED' }],
        [admin.user.id, { status: 'CLOSED' }],
      ]),
    );
  });

  it('shows admins every inquiry, and their count of new ones', async () => {
    const seller = await ctx.signedInUser();
    const { slug } = await publishedListing(seller);
    const before = (await countsOf(admin)).new;
    await send(slug, inquiry());
    expect((await countsOf(admin)).new).toBe(before + 1);
    const ids = (await listOf(admin)).items.map((entry) => entry.listing.slug);
    expect(ids).toContain(slug);
  });
});

describe('inquiries from signed-in sellers and agents (decision, Phase 9)', () => {
  const sentOf = async (user: User) =>
    (await user.client.get('/api/v1/inquiries/sent')).body as Page<SentInquiry>;

  it('sends under the account, keeps a "Sent" history without the status', async () => {
    const seller = await ctx.signedInUser();
    const { id, slug } = await publishedListing(seller);
    const buyer = await ctx.signedInUser();
    const path = `/api/v1/public/listings/${slug}/inquiries`;
    const sent = await buyer.client.post(
      path,
      inquiry({ name: 'Someone Else', email: 'other@example.com' }),
    );
    expect(sent.status).toBe(201);

    const [item] = (await sentOf(buyer)).items;
    expect(item).toMatchObject({
      listing: { id, title: 'Trosoban stan na Vračaru', slug, status: 'PUBLISHED' },
      recipientName: seller.user.displayName,
      message: 'Da li je stan još dostupan?\nMogu da dođem u subotu.',
    });
    // The status is the recipient's business.
    expect(Object.keys(item!).sort()).toEqual([
      'createdAt',
      'id',
      'listing',
      'message',
      'recipientName',
    ]);

    // The recipient sees the account's name and email, whatever the form said.
    const detail = (await seller.client.get(`/api/v1/inquiries/${item!.id}`)).body as {
      inquiry: InquiryDetail;
    };
    expect(detail.inquiry).toMatchObject({
      visitorName: buyer.user.displayName,
      visitorEmail: buyer.user.email,
      fromRegisteredUser: true,
    });
    expect((await ctx.lastEmailTo(seller.user.email))?.replyTo).toBe(buyer.user.email);

    // Nobody else sees it as sent, and the sender cannot open the recipient's view.
    expect((await sentOf(seller)).items).toEqual([]);
    expect((await buyer.client.get(`/api/v1/inquiries/${item!.id}`)).status).toBe(403);
  });

  it('keeps a history for agents too, but not for admins', async () => {
    const seller = await ctx.signedInUser();
    const { slug } = await publishedListing(seller);
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const path = `/api/v1/public/listings/${slug}/inquiries`;
    expect((await agent.client.post(path, inquiry())).status).toBe(201);
    expect((await sentOf(agent)).items).toHaveLength(1);

    const body = inquiry();
    expect((await admin.client.post(path, body)).status).toBe(201);
    expect((await admin.client.get('/api/v1/inquiries/sent')).status).toBe(403);
    const [row] = await ctx.db
      .select()
      .from(inquiries)
      .where(eq(inquiries.visitorEmail, body.email));
    expect(row).toMatchObject({ senderUserId: null, visitorName: body.name });
  });

  it('refuses inquiries about your own listing, as creator or assigned agent', async () => {
    const seller = await ctx.signedInUser();
    const agent = await ctx.signedInUser(Role.REAL_ESTATE_AGENT);
    const { id, slug } = await publishedListing(seller);
    await admin.client.put(`${LISTINGS}/${id}/assignment`, { agentId: agent.user.id });
    const path = `/api/v1/public/listings/${slug}/inquiries`;
    expect((await seller.client.post(path, inquiry())).status).toBe(403);
    expect((await agent.client.post(path, inquiry())).status).toBe(403);
  });

  it('leaves anonymous inquiries unlinked', async () => {
    const seller = await ctx.signedInUser();
    const { id, slug } = await publishedListing(seller);
    expect((await send(slug, inquiry())).status).toBe(201);
    const [row] = await ctx.db.select().from(inquiries).where(eq(inquiries.listingId, id));
    expect(row?.senderUserId).toBeNull();
  });
});
