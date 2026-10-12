import { AGENT_PROOF_RULES, FileIssue } from '@walls/shared';
import {
  agentApplicationInputSchema,
  idParamSchema,
  rejectionInputSchema,
  reviewQueueQuerySchema,
} from '@walls/validation';
import { type RequestHandler, type Response, Router } from 'express';
import multer from 'multer';
import { authenticated, requireAuth } from '../http/auth-context';
import { invalidFile, validationFailed } from '../http/errors';
import { type RateLimitRule, limitByIp } from '../http/security';
import { parseBody } from '../http/validate';
import type { AgentApplicationsService } from './agent-applications.service';

const STATUS_ACCEPTED = 202;
const FILES_FIELD = 'files';
/** Text fields of the application form (see agentApplicationInputSchema). */
const MAX_TEXT_FIELDS = 10;
const NON_ASCII_OR_QUOTE = /[^\x20-\x7e]|["\\]/g;

/** Proof files are kept in memory (at most 5 × 10 MB) and checked from their content. */
function proofUpload(): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    // Browsers send file names as UTF-8 (e.g. "članska karta.pdf").
    defParamCharset: 'utf8',
    limits: {
      fileSize: AGENT_PROOF_RULES.maxBytes,
      files: AGENT_PROOF_RULES.maxFiles,
      fields: MAX_TEXT_FIELDS,
    },
  }).array(FILES_FIELD, AGENT_PROOF_RULES.maxFiles);

  return (req, res, next) => {
    upload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(
          error.code === 'LIMIT_FILE_SIZE'
            ? invalidFile([{ name: '', issues: [FileIssue.FILE_TOO_LARGE] }])
            : validationFailed(
                [FILES_FIELD],
                `Send at most ${AGENT_PROOF_RULES.maxFiles} files in the "files" field`,
              ),
        );
        return;
      }
      next(error);
    });
  };
}

/** Opens the file in the browser, with a header-safe name (RFC 6266 / 5987). */
function sendPrivateFile(
  res: Response,
  file: { data: Buffer; mimeType: string; fileName: string },
): void {
  const asciiName = file.fileName.replace(NON_ASCII_OR_QUOTE, '_');
  res
    .status(200)
    .type(file.mimeType)
    .set({
      'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
    })
    .send(file.data);
}

export function agentApplicationsRoutes(deps: {
  applications: AgentApplicationsService;
  submitRateLimit: RateLimitRule;
}): Router {
  const { applications } = deps;
  const router = Router();
  const applicationId = (params: { id?: string }) => idParamSchema.parse(params.id);

  // Public: anyone may apply. The response never reveals whether the email is registered.
  router.post('/', limitByIp(deps.submitRateLimit), proofUpload(), async (req, res) => {
    const input = parseBody(agentApplicationInputSchema, req);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    await applications.submit(
      input,
      files.map((file) => ({ originalName: file.originalname, data: file.buffer })),
    );
    res.status(STATUS_ACCEPTED).end();
  });

  // Everything below is for Admins and Super Admins; the service checks the role.
  router.use(authenticated);

  router.get('/', async (req, res) => {
    const query = reviewQueueQuerySchema.parse(req.query);
    res.json(await applications.list(requireAuth(req).actor, query));
  });

  router.get('/:id', async (req, res) => {
    res.json({
      application: await applications.get(requireAuth(req).actor, applicationId(req.params)),
    });
  });

  router.get('/:id/files/:fileId', async (req, res) => {
    const file = await applications.file(
      requireAuth(req).actor,
      applicationId(req.params),
      idParamSchema.parse(req.params.fileId),
    );
    sendPrivateFile(res, file);
  });

  router.post('/:id/approve', async (req, res) => {
    res.json({
      application: await applications.approve(requireAuth(req).actor, applicationId(req.params)),
    });
  });

  router.post('/:id/reject', async (req, res) => {
    const { reason } = parseBody(rejectionInputSchema, req);
    res.json({
      application: await applications.reject(
        requireAuth(req).actor,
        applicationId(req.params),
        reason,
      ),
    });
  });

  return router;
}
