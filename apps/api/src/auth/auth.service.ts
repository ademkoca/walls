import type { Database, DbExecutor } from '@walls/database';
import { AUTH_PAGE_PATHS, type Actor, type Locale, Role, UserStatus, slugify } from '@walls/shared';
import type { LoginInput, RegisterInput, SetPasswordInput } from '@walls/validation';
import { AuditAction, AuditEntity, recordAudit } from '../audit/audit-log';
import type { Config } from '../config';
import { enqueueEmail } from '../email/outbox';
import { EmailTemplate } from '../email/templates';
import { AppError, ErrorCode, invalidToken } from '../http/errors';
import { webPageUrl } from '../http/web-links';
import {
  type UserRow,
  consumeToken,
  deleteSession,
  deleteSessionsForUser,
  deleteUnusedTokens,
  extendSession,
  findSessionWithUser,
  findSlugsLike,
  findUserByEmail,
  findUserById,
  insertAuthToken,
  insertSession,
  insertUser,
  updateUser,
} from './auth.repository';
import { hashPassword, timingSafeDummyHash, verifyPassword } from './passwords';
import { SESSION_POLICY, TOKEN_TTL_HOURS, expiresInHours } from './token-policy';
import { generateToken, hashToken } from './tokens';

const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_CONFLICT = 409;
const FALLBACK_SLUG = 'user';
const USER_AGENT_MAX_LENGTH = 500;

/** The signed-in user as returned to clients. Never includes the password hash. */
export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  displayName: string;
  slug: string;
  preferredLocale: Locale;
  emailVerified: boolean;
}

export function toCurrentUser(user: UserRow): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    slug: user.slug,
    preferredLocale: user.preferredLocale,
    emailVerified: user.emailVerifiedAt !== null,
  };
}

export function toActor(user: UserRow): Actor {
  return {
    id: user.id,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
  };
}

export interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface InviteInput {
  email: string;
  displayName: string;
  role: Role;
  locale: Locale;
}

const invalidCredentials = () =>
  new AppError(
    STATUS_UNAUTHORIZED,
    ErrorCode.INVALID_CREDENTIALS,
    'Email or password is incorrect',
  );

export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly config: Pick<Config, 'sessionSecret' | 'webOrigin'>,
  ) {}

  private hash(token: string): string {
    return hashToken(token, this.config.sessionSecret);
  }

  private link(locale: Locale, path: string, query: Record<string, string> = {}): string {
    return webPageUrl(this.config.webOrigin, locale, path, query);
  }

  /** A slug based on the display name that no other user has, e.g. ana-anic-2. */
  private async uniqueSlug(db: DbExecutor, displayName: string): Promise<string> {
    const base = slugify(displayName) || FALLBACK_SLUG;
    const taken = new Set(await findSlugsLike(db, base));
    if (!taken.has(base)) return base;
    let suffix = 2;
    while (taken.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }

  /** Issues a fresh single-use token; previously emailed links of the same type stop working. */
  private async issueToken(
    db: DbExecutor,
    userId: string,
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'ACCOUNT_SETUP',
  ): Promise<string> {
    const token = generateToken();
    await deleteUnusedTokens(db, userId, type);
    await insertAuthToken(db, {
      userId,
      type,
      tokenHash: this.hash(token),
      expiresAt: expiresInHours(TOKEN_TTL_HOURS[type]),
    });
    return token;
  }

  private async sendVerificationEmail(db: DbExecutor, user: UserRow): Promise<void> {
    const token = await this.issueToken(db, user.id, 'EMAIL_VERIFICATION');
    await enqueueEmail(db, {
      template: EmailTemplate.EMAIL_VERIFICATION,
      to: user.email,
      locale: user.preferredLocale,
      payload: {
        displayName: user.displayName,
        link: this.link(user.preferredLocale, AUTH_PAGE_PATHS.verifyEmail, { token }),
      },
    });
  }

  /**
   * Private-seller registration (SPEC §3). The response never reveals whether the email
   * is taken. Re-registering an unverified email only resends the link; it never changes
   * the stored password, so nobody can take over a pending registration.
   */
  async register(input: RegisterInput): Promise<void> {
    const passwordHash = await hashPassword(input.password);
    await this.db.transaction(async (tx) => {
      const existing = await findUserByEmail(tx, input.email);

      if (!existing) {
        const user = await insertUser(tx, {
          email: input.email,
          passwordHash,
          role: Role.PRIVATE_SELLER,
          status: UserStatus.PENDING_VERIFICATION,
          displayName: input.displayName,
          slug: await this.uniqueSlug(tx, input.displayName),
          preferredLocale: input.locale,
        });
        await recordAudit(tx, {
          actorId: user.id,
          action: AuditAction.USER_REGISTERED,
          entityType: AuditEntity.USER,
          entityId: user.id,
          after: { role: user.role, status: user.status },
        });
        await this.sendVerificationEmail(tx, user);
        return;
      }

      if (existing.status === UserStatus.PENDING_VERIFICATION) {
        await this.sendVerificationEmail(tx, existing);
        return;
      }

      await enqueueEmail(tx, {
        template: EmailTemplate.ACCOUNT_EXISTS,
        to: existing.email,
        locale: existing.preferredLocale,
        payload: {
          loginLink: this.link(existing.preferredLocale, AUTH_PAGE_PATHS.login),
          resetLink: this.link(existing.preferredLocale, AUTH_PAGE_PATHS.forgotPassword),
        },
      });
    });
  }

  async resendVerification(email: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const user = await findUserByEmail(tx, email);
      if (user?.status === UserStatus.PENDING_VERIFICATION)
        await this.sendVerificationEmail(tx, user);
    });
  }

  /** Activates a private-seller account (SPEC §2.1: active after email verification). */
  async verifyEmail(token: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const consumed = await consumeToken(tx, 'EMAIL_VERIFICATION', this.hash(token));
      const user = consumed && (await findUserById(tx, consumed.userId));
      if (!user || user.status !== UserStatus.PENDING_VERIFICATION) throw invalidToken();

      await updateUser(tx, user.id, { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() });
      await recordAudit(tx, {
        actorId: user.id,
        action: AuditAction.USER_EMAIL_VERIFIED,
        entityType: AuditEntity.USER,
        entityId: user.id,
        before: { status: user.status },
        after: { status: UserStatus.ACTIVE },
      });
    });
  }

  async login(
    input: LoginInput,
    meta: SessionMeta,
  ): Promise<{ user: CurrentUser; sessionToken: string; expiresAt: Date }> {
    const user = await findUserByEmail(this.db, input.email);
    // Always run one hash comparison so unknown emails are not faster to reject.
    const passwordMatches = await verifyPassword(
      input.password,
      user?.passwordHash ?? (await timingSafeDummyHash()),
    );
    if (!user?.passwordHash || !passwordMatches) throw invalidCredentials();

    // Status is revealed only to someone who knows the correct password.
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new AppError(
        STATUS_FORBIDDEN,
        ErrorCode.EMAIL_NOT_VERIFIED,
        'Please verify your email address first',
      );
    }
    if (user.status === UserStatus.DEACTIVATED) {
      throw new AppError(
        STATUS_FORBIDDEN,
        ErrorCode.ACCOUNT_DEACTIVATED,
        'This account has been deactivated',
      );
    }
    if (user.status !== UserStatus.ACTIVE) throw invalidCredentials();

    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_POLICY.ttlMs);
    await insertSession(this.db, {
      userId: user.id,
      tokenHash: this.hash(sessionToken),
      expiresAt,
      ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent.slice(0, USER_AGENT_MAX_LENGTH) } : {}),
    });
    return { user: toCurrentUser(user), sessionToken, expiresAt };
  }

  async logout(sessionId: string): Promise<void> {
    await deleteSession(this.db, sessionId);
  }

  /**
   * Resolves a session cookie. Expired sessions are deleted; sessions of accounts that are
   * no longer active (e.g. deactivated) stop working immediately. Sessions slide: they are
   * extended when less than half of their lifetime remains.
   */
  async authenticate(
    sessionToken: string,
  ): Promise<{ actor: Actor; user: UserRow; sessionId: string; renewedExpiresAt?: Date } | null> {
    const found = await findSessionWithUser(this.db, this.hash(sessionToken));
    if (!found) return null;
    const { session, user } = found;
    const now = Date.now();

    if (session.expiresAt.getTime() <= now) {
      await deleteSession(this.db, session.id);
      return null;
    }
    if (user.status !== UserStatus.ACTIVE) return null;

    const result = { actor: toActor(user), user, sessionId: session.id };
    if (session.expiresAt.getTime() - now < SESSION_POLICY.renewWhenRemainingMs) {
      const renewedExpiresAt = new Date(now + SESSION_POLICY.ttlMs);
      await extendSession(this.db, session.id, renewedExpiresAt);
      return { ...result, renewedExpiresAt };
    }
    return result;
  }

  /** Always succeeds from the caller's view, so the response never reveals whether the email exists. */
  async requestPasswordReset(email: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const user = await findUserByEmail(tx, email);
      if (user?.status !== UserStatus.ACTIVE) return;
      const token = await this.issueToken(tx, user.id, 'PASSWORD_RESET');
      await enqueueEmail(tx, {
        template: EmailTemplate.PASSWORD_RESET,
        to: user.email,
        locale: user.preferredLocale,
        payload: {
          link: this.link(user.preferredLocale, AUTH_PAGE_PATHS.resetPassword, { token }),
        },
      });
    });
  }

  /** Sets a new password, signs the user out everywhere and notifies them. */
  async resetPassword(input: SetPasswordInput): Promise<void> {
    const passwordHash = await hashPassword(input.password);
    await this.db.transaction(async (tx) => {
      const consumed = await consumeToken(tx, 'PASSWORD_RESET', this.hash(input.token));
      const user = consumed && (await findUserById(tx, consumed.userId));
      if (!user || user.status !== UserStatus.ACTIVE) throw invalidToken();

      await updateUser(tx, user.id, { passwordHash });
      await deleteSessionsForUser(tx, user.id);
      await recordAudit(tx, {
        actorId: user.id,
        action: AuditAction.USER_PASSWORD_RESET,
        entityType: AuditEntity.USER,
        entityId: user.id,
      });
      await enqueueEmail(tx, {
        template: EmailTemplate.PASSWORD_CHANGED,
        to: user.email,
        locale: user.preferredLocale,
        payload: { resetLink: this.link(user.preferredLocale, AUTH_PAGE_PATHS.forgotPassword) },
      });
    });
  }

  /**
   * Creates an account that its owner activates by setting a password from an emailed
   * link. Used for Super Admin bootstrap now, and for approved agents and invited admins
   * later. Passwords are never sent or shared (SPEC §3).
   */
  async inviteUser(input: InviteInput, invitedById: string | null): Promise<UserRow> {
    return this.db.transaction(async (tx) => {
      if (await findUserByEmail(tx, input.email)) {
        throw new AppError(
          STATUS_CONFLICT,
          ErrorCode.CONFLICT,
          'A user with this email already exists',
        );
      }
      const user = await insertUser(tx, {
        email: input.email,
        role: input.role,
        status: UserStatus.PENDING_SETUP,
        displayName: input.displayName,
        slug: await this.uniqueSlug(tx, input.displayName),
        preferredLocale: input.locale,
      });
      const token = await this.issueToken(tx, user.id, 'ACCOUNT_SETUP');
      await recordAudit(tx, {
        actorId: invitedById,
        action: AuditAction.USER_INVITED,
        entityType: AuditEntity.USER,
        entityId: user.id,
        after: { role: user.role, status: user.status },
      });
      await enqueueEmail(tx, {
        template: EmailTemplate.ACCOUNT_SETUP,
        to: user.email,
        locale: user.preferredLocale,
        payload: {
          displayName: user.displayName,
          link: this.link(user.preferredLocale, AUTH_PAGE_PATHS.setupAccount, { token }),
        },
      });
      return user;
    });
  }

  /** Completes an invited account: sets the password and activates it. */
  async setupAccount(input: SetPasswordInput): Promise<void> {
    const passwordHash = await hashPassword(input.password);
    await this.db.transaction(async (tx) => {
      const consumed = await consumeToken(tx, 'ACCOUNT_SETUP', this.hash(input.token));
      const user = consumed && (await findUserById(tx, consumed.userId));
      if (!user || user.status !== UserStatus.PENDING_SETUP) throw invalidToken();

      await updateUser(tx, user.id, {
        passwordHash,
        status: UserStatus.ACTIVE,
        // Redeeming the emailed link proves control of the address.
        emailVerifiedAt: new Date(),
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: AuditAction.USER_ACCOUNT_SET_UP,
        entityType: AuditEntity.USER,
        entityId: user.id,
        before: { status: user.status },
        after: { status: UserStatus.ACTIVE },
      });
    });
  }
}
