import type { Database, DbExecutor } from '@walls/database';
import {
  AUTH_PAGE_PATHS,
  AVATAR_IMAGE_RULES,
  AuthProvider,
  type CurrentUser,
  DEFAULT_LOCALE,
  type GooglePendingSignup,
  GoogleSignInIntent,
  GoogleSignInOutcome,
  type Locale,
  Role,
  SellerType,
  UserStatus,
  hasPublicProfile,
  isGoogleAuthoritativeFor,
} from '@walls/shared';
import type { GoogleSignupInput, GoogleStartQuery } from '@walls/validation';
import { AuditAction, AuditEntity, recordAudit } from '../../audit/audit-log';
import type { Config } from '../../config';
import { enqueueEmail } from '../../email/outbox';
import { EmailTemplate } from '../../email/templates';
import { isUniqueViolation } from '../../http/database-errors';
import { AppError, ErrorCode, emailInUse, invalidToken } from '../../http/errors';
import type { Logger } from '../../logger';
import type { ProfilesService } from '../../profiles/profiles.service';
import { lockUser } from '../../users/users.repository';
import {
  type UserRow,
  consumeToken,
  deleteUnusedTokens,
  findIdentityOfUser,
  findUserByEmail,
  findUserById,
  findUserByIdentity,
  findValidToken,
  insertAuthToken,
  insertIdentity,
  insertUser,
  markSessionReauthenticated,
  updateUser,
} from '../auth.repository';
import { type AuthService, type SessionMeta, toActor, toCurrentUser } from '../auth.service';
import { TOKEN_TTL_HOURS, expiresInHours } from '../token-policy';
import { generateToken } from '../tokens';
import { googleRedirectUri } from './create-identity-provider';
import { type ExternalIdentity, type IdentityProvider, pkceChallenge } from './identity-provider';

const DEFAULT_AFTER_SIGN_IN = '/dashboard';
const PROFILE_PATH = '/dashboard/profile';
const STATUS_FORBIDDEN = 403;
const STATUS_CONFLICT = 409;
const PICTURE_TIMEOUT_MS = 10_000;
/** Google serves profile pictures at any size; ask for one above the avatar minimum. */
const PICTURE_SIZE = '=s512-c';
const PICTURE_HOST_SUFFIX = '.googleusercontent.com';

/** What the browser keeps (sealed, in a cookie) between leaving for Google and coming back. */
export interface RoundTrip {
  state: string;
  nonce: string;
  codeVerifier: string;
  intent: GoogleSignInIntent;
  locale: Locale;
  /** Web app path to return to after signing in or confirming. */
  next: string | null;
  /** The setup link's token, for the SETUP intent. */
  token: string | null;
}

/** A Google account without a Walls account, while its owner chooses what to do. */
export interface PendingSignup {
  identity: ExternalIdentity;
  locale: Locale;
}

export interface CallbackParams {
  code?: string | undefined;
  state?: string | undefined;
  error?: string | undefined;
}

export interface CallbackResult {
  redirectTo: string;
  /** A new session to set as the session cookie. */
  session?: { sessionToken: string; expiresAt: Date };
  /** To keep (sealed, in a cookie) for the choice page. */
  pendingSignup?: PendingSignup;
}

/** Ends a round trip on the page it started from, with an outcome the page explains. */
class GoogleRefusal extends Error {
  constructor(readonly outcome: GoogleSignInOutcome) {
    super(`Google sign-in refused: ${outcome}`);
    this.name = 'GoogleRefusal';
  }
}

const refuse = (outcome: GoogleSignInOutcome) => new GoogleRefusal(outcome);

/** The parts of a Google account a connection stores. */
type ConnectedIdentity = Pick<ExternalIdentity, 'subject' | 'email'>;

/**
 * "Continue with Google" (SPEC §3.1). Google vouches for an account; this service decides
 * what that means for Walls:
 *
 * - a connected Google account signs in to its Walls account;
 * - an existing Walls account with the same address is connected automatically when Google is
 *   the authority for the address (Gmail, Google Workspace), otherwise after a link emailed to
 *   that address is confirmed. Connecting finishes a pending signup: an unverified account is
 *   verified (and its password, set by whoever registered, removed), an invited account set up;
 * - an unknown address goes to a choice page: a private-seller account, or the professional
 *   application. Professionals are never created here; they still need Admin approval.
 */
export class GoogleSignInService {
  constructor(
    private readonly db: Database,
    private readonly config: Pick<Config, 'webOrigin'>,
    private readonly auth: AuthService,
    private readonly profiles: ProfilesService,
    private readonly provider: IdentityProvider,
    private readonly logger: Logger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private get redirectUri(): string {
    return googleRedirectUri(this.config.webOrigin);
  }

  /** Starts a round trip: where to send the browser, and what it must bring back. */
  start(query: GoogleStartQuery): { authorizationUrl: string; roundTrip: RoundTrip } {
    const roundTrip: RoundTrip = {
      state: generateToken(),
      nonce: generateToken(),
      codeVerifier: generateToken(),
      intent: query.intent,
      locale: query.locale,
      next: query.next ?? null,
      token: query.token ?? null,
    };
    const authorizationUrl = this.provider.authorizationUrl({
      redirectUri: this.redirectUri,
      state: roundTrip.state,
      nonce: roundTrip.nonce,
      codeChallenge: pkceChallenge(roundTrip.codeVerifier),
    });
    return { authorizationUrl, roundTrip };
  }

  /** Google's callback. `signedIn` is the browser's current session, if any. */
  async finish(
    params: CallbackParams,
    roundTrip: RoundTrip | null,
    signedIn: { userId: string; sessionId: string } | null,
    meta: SessionMeta,
  ): Promise<CallbackResult> {
    if (!roundTrip) {
      return { redirectTo: this.loginPage(DEFAULT_LOCALE, GoogleSignInOutcome.FAILED) };
    }
    try {
      const identity = await this.verifiedIdentity(params, roundTrip);
      switch (roundTrip.intent) {
        case GoogleSignInIntent.REAUTHENTICATE:
          return await this.reauthenticate(identity, roundTrip, signedIn);
        case GoogleSignInIntent.SETUP:
          return await this.setUp(identity, roundTrip, meta);
        case GoogleSignInIntent.SIGN_IN:
          return await this.signIn(identity, roundTrip, meta);
      }
    } catch (error) {
      if (!(error instanceof GoogleRefusal)) throw error;
      return { redirectTo: this.startPage(roundTrip, error.outcome) };
    }
  }

  private async verifiedIdentity(
    params: CallbackParams,
    roundTrip: RoundTrip,
  ): Promise<ExternalIdentity> {
    if (params.error) {
      throw refuse(
        params.error === 'access_denied'
          ? GoogleSignInOutcome.CANCELLED
          : GoogleSignInOutcome.FAILED,
      );
    }
    // `state` ties the callback to the browser that started the round trip (CSRF).
    if (!params.code || params.state !== roundTrip.state) throw refuse(GoogleSignInOutcome.FAILED);

    let identity: ExternalIdentity;
    try {
      identity = await this.provider.exchangeCode({
        code: params.code,
        redirectUri: this.redirectUri,
        codeVerifier: roundTrip.codeVerifier,
        nonce: roundTrip.nonce,
      });
    } catch (error) {
      this.logger.warn({ err: error }, 'Google sign-in: the code could not be redeemed');
      throw refuse(GoogleSignInOutcome.FAILED);
    }
    if (!identity.emailVerified) throw refuse(GoogleSignInOutcome.EMAIL_NOT_VERIFIED);
    return identity;
  }

  private async signIn(
    identity: ExternalIdentity,
    roundTrip: RoundTrip,
    meta: SessionMeta,
  ): Promise<CallbackResult> {
    const connected = await findUserByIdentity(this.db, AuthProvider.GOOGLE, identity.subject);
    if (connected) {
      if (connected.status === UserStatus.DEACTIVATED)
        throw refuse(GoogleSignInOutcome.DEACTIVATED);
      if (connected.status !== UserStatus.ACTIVE) throw refuse(GoogleSignInOutcome.FAILED);
      return this.signedIn(connected, roundTrip, meta);
    }

    const user = await findUserByEmail(this.db, identity.email);
    if (!user) {
      return {
        redirectTo: this.auth.link(roundTrip.locale, AUTH_PAGE_PATHS.continueWithGoogle),
        pendingSignup: { identity, locale: roundTrip.locale },
      };
    }
    if (user.status === UserStatus.DEACTIVATED) throw refuse(GoogleSignInOutcome.DEACTIVATED);
    if (await findIdentityOfUser(this.db, user.id, AuthProvider.GOOGLE)) {
      throw refuse(GoogleSignInOutcome.OTHER_GOOGLE_ACCOUNT);
    }
    if (!isGoogleAuthoritativeFor(identity.email, identity.hostedDomain)) {
      await this.sendConnectLink(user, identity);
      throw refuse(GoogleSignInOutcome.LINK_SENT);
    }
    return this.connectAndSignIn(user.id, identity, roundTrip, meta);
  }

  /**
   * An invited account (approved professional, Admin) set up with Google from its setup link.
   * The link proves control of the address, so the Google account only has to match it.
   */
  private async setUp(
    identity: ExternalIdentity,
    roundTrip: RoundTrip,
    meta: SessionMeta,
  ): Promise<CallbackResult> {
    const tokenHash = roundTrip.token && this.auth.hash(roundTrip.token);
    const token = tokenHash && (await findValidToken(this.db, 'ACCOUNT_SETUP', tokenHash));
    const user = token && (await findUserById(this.db, token.userId));
    if (!tokenHash || !user || user.status !== UserStatus.PENDING_SETUP) {
      throw refuse(GoogleSignInOutcome.SETUP_LINK_INVALID);
    }
    if (user.email.toLowerCase() !== identity.email.toLowerCase()) {
      throw refuse(GoogleSignInOutcome.WRONG_ACCOUNT);
    }
    return this.connectAndSignIn(user.id, identity, roundTrip, meta, async (tx) => {
      if (!(await consumeToken(tx, 'ACCOUNT_SETUP', tokenHash))) {
        throw refuse(GoogleSignInOutcome.SETUP_LINK_INVALID);
      }
    });
  }

  /** A signed-in user confirms with their connected Google account before changing their email. */
  private async reauthenticate(
    identity: ExternalIdentity,
    roundTrip: RoundTrip,
    signedIn: { userId: string; sessionId: string } | null,
  ): Promise<CallbackResult> {
    if (!signedIn) throw refuse(GoogleSignInOutcome.FAILED);
    const connected = await findUserByIdentity(this.db, AuthProvider.GOOGLE, identity.subject);
    if (connected?.id !== signedIn.userId) throw refuse(GoogleSignInOutcome.WRONG_ACCOUNT);
    await markSessionReauthenticated(this.db, signedIn.sessionId);
    return { redirectTo: this.startPage(roundTrip, GoogleSignInOutcome.REAUTHENTICATED) };
  }

  private async connectAndSignIn(
    userId: string,
    identity: ExternalIdentity,
    roundTrip: RoundTrip,
    meta: SessionMeta,
    beforeConnecting?: (tx: DbExecutor) => Promise<void>,
  ): Promise<CallbackResult> {
    const { user, activated } = await this.db.transaction(async (tx) => {
      await beforeConnecting?.(tx);
      return this.connect(tx, userId, identity);
    });
    const result = await this.signedIn(user, roundTrip, meta);
    if (activated) await this.copyPicture(user, identity.picture);
    return result;
  }

  private async signedIn(
    user: UserRow,
    roundTrip: RoundTrip,
    meta: SessionMeta,
  ): Promise<CallbackResult> {
    const session = await this.auth.createSession(this.db, user.id, meta);
    return {
      redirectTo: this.auth.link(roundTrip.locale, roundTrip.next ?? DEFAULT_AFTER_SIGN_IN),
      session,
    };
  }

  /**
   * Connects a Google account to a Walls account, finishing a pending signup, and returns the
   * account as it is now. Audited; an account that was already active is told by email.
   */
  private async connect(
    tx: DbExecutor,
    userId: string,
    identity: ConnectedIdentity,
  ): Promise<{ user: UserRow; activated: boolean }> {
    const user = await lockUser(tx, userId);
    if (!user) throw refuse(GoogleSignInOutcome.FAILED);
    if (user.status === UserStatus.DEACTIVATED) throw refuse(GoogleSignInOutcome.DEACTIVATED);
    if (await findIdentityOfUser(tx, user.id, AuthProvider.GOOGLE)) {
      throw refuse(GoogleSignInOutcome.OTHER_GOOGLE_ACCOUNT);
    }
    if (await findUserByIdentity(tx, AuthProvider.GOOGLE, identity.subject)) {
      throw refuse(GoogleSignInOutcome.GOOGLE_ACCOUNT_IN_USE);
    }
    try {
      await insertIdentity(tx, {
        userId: user.id,
        provider: AuthProvider.GOOGLE,
        providerUserId: identity.subject,
        email: identity.email,
      });
    } catch (error) {
      // Connected elsewhere at the same moment.
      if (isUniqueViolation(error)) throw refuse(GoogleSignInOutcome.GOOGLE_ACCOUNT_IN_USE);
      throw error;
    }

    const now = new Date();
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      // Google proved the address. The password was chosen by whoever registered it, who
      // may not be the address's owner, so it is removed ("Forgot password" sets a new one).
      await updateUser(tx, user.id, {
        status: UserStatus.ACTIVE,
        emailVerifiedAt: now,
        passwordHash: null,
      });
      await deleteUnusedTokens(tx, user.id, 'EMAIL_VERIFICATION');
      await recordAudit(tx, {
        actorId: user.id,
        action: AuditAction.USER_EMAIL_VERIFIED,
        entityType: AuditEntity.USER,
        entityId: user.id,
        before: { status: user.status },
        after: { status: UserStatus.ACTIVE, method: AuthProvider.GOOGLE, passwordRemoved: true },
      });
    } else if (user.status === UserStatus.PENDING_SETUP) {
      await updateUser(tx, user.id, { status: UserStatus.ACTIVE, emailVerifiedAt: now });
      await deleteUnusedTokens(tx, user.id, 'ACCOUNT_SETUP');
      await recordAudit(tx, {
        actorId: user.id,
        action: AuditAction.USER_ACCOUNT_SET_UP,
        entityType: AuditEntity.USER,
        entityId: user.id,
        before: { status: user.status },
        after: { status: UserStatus.ACTIVE, method: AuthProvider.GOOGLE },
      });
    } else {
      await enqueueEmail(tx, {
        template: EmailTemplate.GOOGLE_CONNECTED,
        to: user.email,
        locale: user.preferredLocale,
        payload: {
          displayName: user.displayName,
          googleEmail: identity.email,
          resetLink: this.auth.link(user.preferredLocale, AUTH_PAGE_PATHS.forgotPassword),
        },
      });
    }
    await recordAudit(tx, {
      actorId: user.id,
      action: AuditAction.USER_GOOGLE_CONNECTED,
      entityType: AuditEntity.USER,
      entityId: user.id,
      after: { googleEmail: identity.email },
    });

    const activated = user.status !== UserStatus.ACTIVE;
    return { user: (await findUserById(tx, user.id))!, activated };
  }

  /**
   * Emails the Walls account's address a link that connects the Google account. Used when
   * Google is not the authority for the address, so it cannot prove who owns the mailbox.
   */
  private async sendConnectLink(user: UserRow, identity: ExternalIdentity): Promise<void> {
    const token = generateToken();
    await this.db.transaction(async (tx) => {
      await deleteUnusedTokens(tx, user.id, 'GOOGLE_LINK');
      await insertAuthToken(tx, {
        userId: user.id,
        type: 'GOOGLE_LINK',
        tokenHash: this.auth.hash(token),
        provider: AuthProvider.GOOGLE,
        providerUserId: identity.subject,
        providerEmail: identity.email,
        expiresAt: expiresInHours(TOKEN_TTL_HOURS.GOOGLE_LINK),
      });
      await enqueueEmail(tx, {
        template: EmailTemplate.GOOGLE_LINK_CONFIRMATION,
        to: user.email,
        locale: user.preferredLocale,
        payload: {
          displayName: user.displayName,
          googleEmail: identity.email,
          link: this.auth.link(user.preferredLocale, AUTH_PAGE_PATHS.connectGoogle, { token }),
        },
      });
    });
  }

  /** Redeems an emailed link: connects the Google account. Signing in is the next step. */
  async confirmConnectLink(token: string): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        const consumed = await consumeToken(tx, 'GOOGLE_LINK', this.auth.hash(token));
        if (!consumed?.providerUserId || !consumed.providerEmail) throw invalidToken();
        await this.connect(tx, consumed.userId, {
          subject: consumed.providerUserId,
          email: consumed.providerEmail,
        });
      });
    } catch (error) {
      if (!(error instanceof GoogleRefusal)) throw error;
      throw error.outcome === GoogleSignInOutcome.DEACTIVATED
        ? new AppError(STATUS_FORBIDDEN, ErrorCode.ACCOUNT_DEACTIVATED, 'Account deactivated')
        : new AppError(STATUS_CONFLICT, ErrorCode.CONFLICT, 'Already connected to Google');
    }
  }

  /** What the choice page shows. */
  describePending(pending: PendingSignup): GooglePendingSignup {
    return { email: pending.identity.email, name: pending.identity.name };
  }

  /**
   * Creates a private-seller account for a Google account (SPEC §3.1): active at once, since
   * Google proved the address, and without a password. Only private sellers are created here.
   */
  async register(
    pending: PendingSignup,
    input: GoogleSignupInput,
    meta: SessionMeta,
  ): Promise<{ user: CurrentUser; sessionToken: string; expiresAt: Date }> {
    const { identity } = pending;
    let user: UserRow;
    try {
      user = await this.db.transaction(async (tx) => {
        if (await findUserByEmail(tx, identity.email)) throw emailInUse();
        if (await findUserByIdentity(tx, AuthProvider.GOOGLE, identity.subject)) {
          throw new AppError(STATUS_CONFLICT, ErrorCode.CONFLICT, 'Already connected to Google');
        }
        const created = await insertUser(tx, {
          email: identity.email,
          role: Role.PRIVATE_SELLER,
          sellerType: SellerType.PRIVATE_SELLER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          displayName: input.displayName,
          slug: await this.auth.uniqueSlug(tx, input.displayName),
          preferredLocale: input.locale,
        });
        await insertIdentity(tx, {
          userId: created.id,
          provider: AuthProvider.GOOGLE,
          providerUserId: identity.subject,
          email: identity.email,
        });
        await recordAudit(tx, {
          actorId: created.id,
          action: AuditAction.USER_REGISTERED,
          entityType: AuditEntity.USER,
          entityId: created.id,
          after: { role: created.role, status: created.status, method: AuthProvider.GOOGLE },
        });
        return created;
      });
    } catch (error) {
      // Two tabs creating the same account at once.
      if (isUniqueViolation(error)) throw emailInUse();
      throw error;
    }
    const session = await this.auth.createSession(this.db, user.id, meta);
    await this.copyPicture(user, identity.picture);
    return { user: toCurrentUser(user), ...session };
  }

  /**
   * Copies the Google profile picture into Walls' media storage (never linked to Google)
   * for an account with a public profile and no picture yet. Professionals' pictures become
   * a profile change for Admin approval, like any other (SPEC §4). Best effort.
   */
  private async copyPicture(user: UserRow, picture: string | null): Promise<void> {
    if (!picture || !hasPublicProfile(user.role) || user.avatarUrl) return;
    try {
      const data = await this.downloadPicture(picture);
      if (data) await this.profiles.uploadAvatar(toActor(user), data);
    } catch (error) {
      this.logger.warn(
        { err: error, userId: user.id },
        'Could not copy the Google profile picture',
      );
    }
  }

  private async downloadPicture(address: string): Promise<Buffer | null> {
    const url = new URL(address);
    if (url.protocol !== 'https:' || !url.hostname.endsWith(PICTURE_HOST_SUFFIX)) return null;
    url.pathname = url.pathname.replace(/=s\d+(-c)?$/, PICTURE_SIZE);
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(PICTURE_TIMEOUT_MS) });
    if (!response.ok) return null;
    const data = Buffer.from(await response.arrayBuffer());
    return data.length <= AVATAR_IMAGE_RULES.maxBytes ? data : null;
  }

  private loginPage(locale: Locale, outcome: GoogleSignInOutcome): string {
    return this.auth.link(locale, AUTH_PAGE_PATHS.login, { google: outcome });
  }

  /** The page a round trip started from, which explains `outcome`. */
  private startPage(roundTrip: RoundTrip, outcome: GoogleSignInOutcome): string {
    switch (roundTrip.intent) {
      case GoogleSignInIntent.SETUP:
        return roundTrip.token
          ? this.auth.link(roundTrip.locale, AUTH_PAGE_PATHS.setupAccount, {
              token: roundTrip.token,
              google: outcome,
            })
          : this.loginPage(roundTrip.locale, outcome);
      case GoogleSignInIntent.REAUTHENTICATE:
        return this.auth.link(roundTrip.locale, roundTrip.next ?? PROFILE_PATH, {
          google: outcome,
        });
      case GoogleSignInIntent.SIGN_IN:
        return this.loginPage(roundTrip.locale, outcome);
    }
  }
}
