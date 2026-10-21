import { randomUUID } from 'node:crypto';
import type { Database, DbExecutor } from '@walls/database';
import {
  AGENT_PROOF_RULES,
  type Actor,
  type AgentApplicationDetail,
  type AgentApplicationSummary,
  AUTH_PAGE_PATHS,
  DenialReason,
  FOR_PROFESSIONALS_PATH,
  type Page,
  type ProfessionalSellerType,
  ReviewStatus,
  Role,
  canReviewAgentMatters,
  checkProofFile,
  hasAgencyName,
  isProfessionalSellerType,
} from '@walls/shared';
import type { AgentApplicationInput, ReviewQueueQuery } from '@walls/validation';
import { AuditAction, AuditEntity, recordAudit } from '../audit/audit-log';
import { findUserByEmail } from '../auth/auth.repository';
import type { AuthService } from '../auth/auth.service';
import type { Config } from '../config';
import { enqueueEmail } from '../email/outbox';
import { EmailTemplate } from '../email/templates';
import { isUniqueViolation } from '../http/database-errors';
import {
  assertAllowed,
  emailInUse,
  errorFromDenial,
  invalidFile,
  notFound,
  validationFailed,
} from '../http/errors';
import { toPage } from '../http/paging';
import { webPageUrl } from '../http/web-links';
import type { Logger } from '../logger';
import { DOCUMENT_EXTENSIONS, detectDocumentType } from '../media/document-inspection';
import type { PrivateFileStorage } from '../media/private-file-storage';
import {
  type AgentApplicationRow,
  countPendingApplications,
  findApplication,
  findApplicationFile,
  findApplications,
  findPendingApplicationByEmail,
  insertApplication,
  lockApplication,
  updateApplication,
} from './agent-applications.repository';

/** A proof file as received in the multipart request. */
export interface UploadedFile {
  originalName: string;
  data: Buffer;
}

const FILE_NAME_MAX_LENGTH = 200;
const CONTROL_CHARACTERS = /\p{Cc}/gu;
const STORAGE_PREFIX = 'agent-applications';

/** A file name safe to store and show; it is never used as a storage key. */
function cleanFileName(name: string): string {
  const cleaned = name.replace(CONTROL_CHARACTERS, '').trim().slice(0, FILE_NAME_MAX_LENGTH);
  return cleaned || 'file';
}

/** The database only stores professional types on applications; this narrows the type. */
function professionalType(application: AgentApplicationRow): ProfessionalSellerType {
  if (!isProfessionalSellerType(application.sellerType)) {
    throw new Error(`Application ${application.id} has no professional seller type`);
  }
  return application.sellerType;
}

function toSummary(application: AgentApplicationRow, fileCount: number): AgentApplicationSummary {
  return {
    id: application.id,
    sellerType: professionalType(application),
    fullName: application.fullName,
    email: application.email,
    agencyName: application.agencyName,
    status: application.status,
    fileCount,
    createdAt: application.createdAt.toISOString(),
  };
}

/**
 * The "For professionals" application of agents, agencies and investors (SPEC §2.1): public
 * submission with private proof files, and review by Admins / Super Admins. Approval creates
 * the professional account, which the applicant activates from an emailed setup link.
 */
export class AgentApplicationsService {
  constructor(
    private readonly db: Database,
    private readonly config: Config,
    private readonly auth: AuthService,
    private readonly files: PrivateFileStorage,
    private readonly logger: Logger,
  ) {}

  private link(locale: AgentApplicationRow['locale'], path: string): string {
    return webPageUrl(this.config.webOrigin, locale, path);
  }

  /** Validates every file from its content before anything is stored. */
  private inspect(uploads: readonly UploadedFile[]) {
    if (uploads.length < AGENT_PROOF_RULES.minFiles) {
      throw validationFailed(['files'], 'At least one proof file is required');
    }
    if (uploads.length > AGENT_PROOF_RULES.maxFiles) {
      throw validationFailed(['files'], `At most ${AGENT_PROOF_RULES.maxFiles} files are allowed`);
    }
    const inspected = uploads.map((upload) => ({
      ...upload,
      fileName: cleanFileName(upload.originalName),
      mimeType: detectDocumentType(upload.data),
    }));
    const problems = inspected
      .map((file) => ({
        name: file.fileName,
        issues: checkProofFile({ mimeType: file.mimeType, bytes: file.data.length }),
      }))
      .filter((problem) => problem.issues.length > 0);
    if (problems.length > 0) throw invalidFile(problems);
    return inspected.map((file) => ({ ...file, mimeType: file.mimeType! }));
  }

  /**
   * Emails the applicant why the application was not saved: the address already has an
   * account, or already has an application in review. The response is the same as for a
   * saved application, so it never reveals which addresses are registered.
   */
  private async refuse(db: DbExecutor, input: AgentApplicationInput): Promise<boolean> {
    if (await findUserByEmail(db, input.email)) {
      await enqueueEmail(db, {
        template: EmailTemplate.AGENT_APPLICATION_EMAIL_IN_USE,
        to: input.email,
        locale: input.locale,
        payload: {
          fullName: input.fullName,
          loginLink: this.link(input.locale, AUTH_PAGE_PATHS.login),
          applyLink: this.link(input.locale, FOR_PROFESSIONALS_PATH),
        },
      });
      return true;
    }
    if (await findPendingApplicationByEmail(db, input.email)) {
      await enqueueEmail(db, {
        template: EmailTemplate.AGENT_APPLICATION_DUPLICATE,
        to: input.email,
        locale: input.locale,
        payload: { fullName: input.fullName },
      });
      return true;
    }
    return false;
  }

  async submit(input: AgentApplicationInput, uploads: readonly UploadedFile[]): Promise<void> {
    const proofFiles = this.inspect(uploads);
    if (await this.db.transaction((tx) => this.refuse(tx, input))) return;

    const applicationId = randomUUID();
    const stored: { key: string; file: (typeof proofFiles)[number] }[] = [];
    try {
      for (const file of proofFiles) {
        const key = `${STORAGE_PREFIX}/${applicationId}/${randomUUID()}.${DOCUMENT_EXTENSIONS[file.mimeType]}`;
        await this.files.put({ key, data: file.data, contentType: file.mimeType });
        stored.push({ key, file });
      }
      await this.db.transaction(async (tx) => {
        // Checked again under the transaction: an account or application may have appeared.
        if (
          (await findUserByEmail(tx, input.email)) ||
          (await findPendingApplicationByEmail(tx, input.email))
        ) {
          throw new RefusedApplication();
        }
        await insertApplication(
          tx,
          {
            id: applicationId,
            sellerType: input.sellerType,
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            // Only individual agents name the agency they work for.
            agencyName: (hasAgencyName(input.sellerType) && input.agencyName) || null,
            locale: input.locale,
          },
          stored.map(({ key, file }) => ({
            storageKey: key,
            originalFileName: file.fileName,
            mimeType: file.mimeType,
            bytes: file.data.length,
          })),
        );
        await recordAudit(tx, {
          actorId: null,
          action: AuditAction.AGENT_APPLICATION_SUBMITTED,
          entityType: AuditEntity.AGENT_APPLICATION,
          entityId: applicationId,
          after: { sellerType: input.sellerType, fileCount: stored.length },
        });
        await enqueueEmail(tx, {
          template: EmailTemplate.AGENT_APPLICATION_RECEIVED,
          to: input.email,
          locale: input.locale,
          payload: { fullName: input.fullName },
        });
      });
    } catch (error) {
      await this.deleteFiles(stored.map(({ key }) => key));
      // RefusedApplication, or a concurrent application from the same address won the race.
      if (
        error instanceof RefusedApplication ||
        isUniqueViolation(error, 'agent_applications_one_pending_per_email')
      ) {
        await this.db.transaction((tx) => this.refuse(tx, input));
        return;
      }
      throw error;
    }
  }

  private async deleteFiles(keys: readonly string[]): Promise<void> {
    const results = await Promise.allSettled(keys.map((key) => this.files.delete(key)));
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error({ err: result.reason }, 'Failed to delete an agent proof file');
      }
    }
  }

  async list(actor: Actor, query: ReviewQueueQuery): Promise<Page<AgentApplicationSummary>> {
    assertAllowed(canReviewAgentMatters(actor));
    const rows = await findApplications(this.db, query);
    return toPage(rows, query.page, (row) => toSummary(row.application, row.fileCount));
  }

  async get(actor: Actor, id: string): Promise<AgentApplicationDetail> {
    assertAllowed(canReviewAgentMatters(actor));
    const found = await findApplication(this.db, id);
    if (!found) throw notFound();
    const { application, files } = found;
    const pending = application.status === ReviewStatus.PENDING;
    return {
      ...toSummary(application, files.length),
      phone: application.phone,
      locale: application.locale,
      files: files.map((file) => ({
        id: file.id,
        fileName: file.originalFileName,
        mimeType: file.mimeType,
        bytes: file.bytes,
      })),
      rejectionReason: application.rejectionReason,
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
      reviewedBy: found.reviewedBy?.id ? found.reviewedBy : null,
      resultingUser: found.resultingUser?.id ? found.resultingUser : null,
      emailInUse: pending && (await findUserByEmail(this.db, application.email)) !== undefined,
      canReview: pending,
    };
  }

  /** A proof file's content, for Admins only (SPEC §19: never public). */
  async file(
    actor: Actor,
    applicationId: string,
    fileId: string,
  ): Promise<{ data: Buffer; mimeType: string; fileName: string }> {
    assertAllowed(canReviewAgentMatters(actor));
    const file = await findApplicationFile(this.db, applicationId, fileId);
    if (!file) throw notFound();
    return {
      data: await this.files.get(file.storageKey),
      mimeType: file.mimeType,
      fileName: file.originalFileName,
    };
  }

  private async lockPending(db: DbExecutor, actor: Actor, id: string) {
    assertAllowed(canReviewAgentMatters(actor));
    const application = await lockApplication(db, id);
    if (!application) throw notFound();
    if (application.status !== ReviewStatus.PENDING) {
      throw errorFromDenial(DenialReason.INVALID_STATE);
    }
    return application;
  }

  /**
   * Approves an application: creates the professional account (agent, agency or investor)
   * from the application's details and emails the applicant a link to set their password
   * (SPEC §2.1, §3).
   */
  async approve(actor: Actor, id: string): Promise<AgentApplicationDetail> {
    await this.db.transaction(async (tx) => {
      const application = await this.lockPending(tx, actor, id);
      if (await findUserByEmail(tx, application.email)) throw emailInUse();

      const user = await this.auth.inviteInTransaction(
        tx,
        {
          email: application.email,
          displayName: application.fullName,
          role: Role.REAL_ESTATE_AGENT,
          sellerType: professionalType(application),
          locale: application.locale,
          phone: application.phone,
          agencyName: application.agencyName,
        },
        actor.id,
        EmailTemplate.AGENT_APPLICATION_APPROVED,
      );
      await updateApplication(tx, id, {
        status: ReviewStatus.APPROVED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        resultingUserId: user.id,
      });
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.AGENT_APPLICATION_APPROVED,
        entityType: AuditEntity.AGENT_APPLICATION,
        entityId: id,
        before: { status: application.status },
        after: { status: ReviewStatus.APPROVED, userId: user.id },
      });
    });
    return this.get(actor, id);
  }

  /** Rejects an application; the reason is emailed to the applicant. No account is created. */
  async reject(actor: Actor, id: string, reason: string): Promise<AgentApplicationDetail> {
    await this.db.transaction(async (tx) => {
      const application = await this.lockPending(tx, actor, id);
      await updateApplication(tx, id, {
        status: ReviewStatus.REJECTED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        rejectionReason: reason,
      });
      await recordAudit(tx, {
        actorId: actor.id,
        action: AuditAction.AGENT_APPLICATION_REJECTED,
        entityType: AuditEntity.AGENT_APPLICATION,
        entityId: id,
        before: { status: application.status },
        after: { status: ReviewStatus.REJECTED },
        reason,
      });
      await enqueueEmail(tx, {
        template: EmailTemplate.AGENT_APPLICATION_REJECTED,
        to: application.email,
        locale: application.locale,
        payload: { fullName: application.fullName, reason },
      });
    });
    return this.get(actor, id);
  }

  async pendingCount(): Promise<number> {
    return countPendingApplications(this.db);
  }
}

/** Rolls back the insert transaction when the application must be refused after all. */
class RefusedApplication extends Error {}
