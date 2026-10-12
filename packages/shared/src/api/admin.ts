import type { Role, UserStatus } from '../enums';
import type { UserReference } from './listings';
import type { AgentApplicationFileView } from './profiles';

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
  /**
   * For agents: the approved application their account was created from, kept with its
   * private proof files as evidence of eligibility (SPEC §2.1).
   */
  agentApplication: {
    id: string;
    reviewedAt: string | null;
    files: AgentApplicationFileView[];
  } | null;
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
