import { Locale, Role, UserStatus, enumValues } from '@walls/shared';
import { z } from 'zod';
import { displayNameSchema, emailSchema } from './auth';
import { reasonSchema } from './common';

/** Deactivating an account always needs a reason; it is audited and emailed to the user. */
export const deactivateUserInputSchema = z.strictObject({
  reason: reasonSchema,
});
export type DeactivateUserInput = z.infer<typeof deactivateUserInputSchema>;

/** Reactivating an account also needs a reason (SPEC §2.1). */
export const reactivateUserInputSchema = z.strictObject({
  reason: reasonSchema,
});
export type ReactivateUserInput = z.infer<typeof reactivateUserInputSchema>;

export const ADMIN_LIST_LIMITS = {
  searchMaxLength: 100,
  maxPage: 10_000,
} as const;

const pageSchema = z.coerce.number().int().min(1).max(ADMIN_LIST_LIMITS.maxPage).default(1);

/**
 * User list filter; `q` matches name or email. `assignable=true` keeps the professionals a
 * listing can be assigned to (agents and agencies).
 */
export const userListQuerySchema = z.strictObject({
  role: z.enum(enumValues(Role)).optional(),
  status: z.enum(enumValues(UserStatus)).optional(),
  assignable: z
    .literal('true')
    .transform(() => true)
    .optional(),
  q: z.string().trim().max(ADMIN_LIST_LIMITS.searchMaxLength).optional(),
  page: pageSchema,
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

/** A Super Admin invites an Admin, who sets their own password from the emailed link. */
export const inviteAdminInputSchema = z.strictObject({
  email: emailSchema,
  displayName: displayNameSchema,
  locale: z.enum(enumValues(Locale)),
});
export type InviteAdminInput = z.infer<typeof inviteAdminInputSchema>;

export const auditLogQuerySchema = z.strictObject({
  entityType: z.string().trim().max(50).optional(),
  entityId: z.string().trim().max(100).optional(),
  actorId: z.uuid().optional(),
  page: pageSchema,
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
