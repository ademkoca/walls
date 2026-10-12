import { type DbExecutor, auditLogs } from '@walls/database';

/** Stable identifiers of audited actions (SPEC §25). */
export const AuditAction = {
  USER_REGISTERED: 'USER_REGISTERED',
  USER_EMAIL_VERIFIED: 'USER_EMAIL_VERIFIED',
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
  USER_ACCOUNT_SET_UP: 'USER_ACCOUNT_SET_UP',
  USER_INVITED: 'USER_INVITED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntity = {
  USER: 'USER',
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
