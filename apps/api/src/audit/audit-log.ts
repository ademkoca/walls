import { type DbExecutor, auditLogs } from '@walls/database';

/** Stable identifiers of audited actions (SPEC §25). */
export const AuditAction = {
  USER_REGISTERED: 'USER_REGISTERED',
  USER_EMAIL_VERIFIED: 'USER_EMAIL_VERIFIED',
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
  USER_ACCOUNT_SET_UP: 'USER_ACCOUNT_SET_UP',
  USER_INVITED: 'USER_INVITED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  LISTING_CREATED: 'LISTING_CREATED',
  LISTING_SUBMITTED: 'LISTING_SUBMITTED',
  LISTING_REVISED: 'LISTING_REVISED',
  LISTING_DRAFT_DELETED: 'LISTING_DRAFT_DELETED',
  LISTING_APPROVED: 'LISTING_APPROVED',
  LISTING_REJECTED: 'LISTING_REJECTED',
  LISTING_MARKED_SOLD: 'LISTING_MARKED_SOLD',
  LISTING_MARKED_RENTED: 'LISTING_MARKED_RENTED',
  LISTING_ARCHIVED: 'LISTING_ARCHIVED',
  LISTING_FEATURED: 'LISTING_FEATURED',
  LISTING_UNFEATURED: 'LISTING_UNFEATURED',
  LISTING_AGENT_ASSIGNED: 'LISTING_AGENT_ASSIGNED',
  LISTING_AGENT_UNASSIGNED: 'LISTING_AGENT_UNASSIGNED',
  LISTING_PERMANENTLY_DELETED: 'LISTING_PERMANENTLY_DELETED',
  /** Minor edit of a published listing, applied immediately (SPEC §6). */
  LISTING_UPDATED_LIVE: 'LISTING_UPDATED_LIVE',
  LISTING_IMAGES_REORDERED: 'LISTING_IMAGES_REORDERED',
  LISTING_REVISION_SAVED: 'LISTING_REVISION_SAVED',
  LISTING_REVISION_WITHDRAWN: 'LISTING_REVISION_WITHDRAWN',
  LISTING_REVISION_APPROVED: 'LISTING_REVISION_APPROVED',
  LISTING_REVISION_REJECTED: 'LISTING_REVISION_REJECTED',
  LISTING_REVISION_DISCARDED: 'LISTING_REVISION_DISCARDED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntity = {
  USER: 'USER',
  LISTING: 'LISTING',
} as const;
export type AuditEntity = (typeof AuditEntity)[keyof typeof AuditEntity];

export interface AuditEntry {
  /** Null for system or self-service actions without an authenticated actor. */
  actorId: string | null;
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
}

/** Records an audit entry; call inside the transaction of the audited change. */
export async function recordAudit(db: DbExecutor, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values(entry);
}
