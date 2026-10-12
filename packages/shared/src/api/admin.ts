import type { Role, UserStatus } from '../enums';
import type { UserReference } from './listings';

/** Administration shapes (users and the audit log). Dates are ISO 8601 strings. */

export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  deactivatedAt: string | null;
}

export interface UserDetail extends UserSummary {
  emailVerified: boolean;
  /** Listings the user created (any status, excluding deleted drafts). */
  listingCount: number;
  permissions: { canDeactivate: boolean; canReactivate: boolean };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  /** Null for system or self-service actions. */
  actor: UserReference | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
}

/** One page of a long list, newest first. */
export interface Page<T> {
  items: T[];
  page: number;
  hasMore: boolean;
}
