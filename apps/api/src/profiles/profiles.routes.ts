import { AVATAR_IMAGE_RULES } from '@walls/shared';
import {
  emailChangeInputSchema,
  idParamSchema,
  profileInputSchema,
  rejectionInputSchema,
  reviewQueueQuerySchema,
  verifyEmailInputSchema,
} from '@walls/validation';
import { Router } from 'express';
import { authenticated, requireAuth } from '../http/auth-context';
import { validationFailed } from '../http/errors';
import { type RateLimitRule, limitByIp } from '../http/security';
import { UPLOAD_FIELD, singleImageUpload } from '../http/uploads';
import { parseBody } from '../http/validate';
import type { ProfileChangesService } from './profile-changes.service';
import type { ProfilesService } from './profiles.service';

/** The signed-in user's own profile (`/me`). */
export function myProfileRoutes(deps: {
  profiles: ProfilesService;
  sensitiveRateLimit: RateLimitRule;
  uploadRateLimit: RateLimitRule;
}): Router {
  const { profiles } = deps;
  const router = Router();
  router.use(authenticated);

  router.get('/profile', async (req, res) => {
    res.json({ profile: await profiles.get(requireAuth(req).actor) });
  });

  router.put('/profile', async (req, res) => {
    const input = parseBody(profileInputSchema, req);
    res.json({ profile: await profiles.update(requireAuth(req).actor, input) });
  });

  router.post(
    '/profile/avatar',
    limitByIp(deps.uploadRateLimit),
    singleImageUpload(AVATAR_IMAGE_RULES.maxBytes),
    async (req, res) => {
      if (!req.file) throw validationFailed([UPLOAD_FIELD], 'An image file is required');
      res.json({ profile: await profiles.uploadAvatar(requireAuth(req).actor, req.file.buffer) });
    },
  );

  router.delete('/profile/avatar', async (req, res) => {
    res.json({ profile: await profiles.removeAvatar(requireAuth(req).actor) });
  });

  router.delete('/profile/change-request', async (req, res) => {
    res.json({ profile: await profiles.discardChangeRequest(requireAuth(req).actor) });
  });

  // Checks the password and sends email, so it is rate-limited like login.
  router.post('/email-change', limitByIp(deps.sensitiveRateLimit), async (req, res) => {
    const input = parseBody(emailChangeInputSchema, req);
    res.json({ profile: await profiles.requestEmailChange(requireAuth(req).actor, input) });
  });

  router.delete('/email-change', async (req, res) => {
    res.json({ profile: await profiles.cancelEmailChange(requireAuth(req).actor) });
  });

  return router;
}

/** Public: the link emailed to a new address works without signing in. */
export function confirmEmailChangeRoutes(deps: {
  profiles: ProfilesService;
  sensitiveRateLimit: RateLimitRule;
}): Router {
  const router = Router();
  router.post('/', limitByIp(deps.sensitiveRateLimit), async (req, res) => {
    const { token } = parseBody(verifyEmailInputSchema, req);
    res.json(await deps.profiles.confirmEmailChange(token));
  });
  return router;
}

/** Admin review of agents' profile changes. */
export function profileChangesRoutes(changes: ProfileChangesService): Router {
  const router = Router();
  router.use(authenticated);
  const requestId = (params: { id?: string }) => idParamSchema.parse(params.id);

  router.get('/', async (req, res) => {
    const query = reviewQueueQuerySchema.parse(req.query);
    res.json(await changes.list(requireAuth(req).actor, query));
  });

  router.get('/:id', async (req, res) => {
    res.json({ request: await changes.get(requireAuth(req).actor, requestId(req.params)) });
  });

  router.post('/:id/approve', async (req, res) => {
    res.json({ request: await changes.approve(requireAuth(req).actor, requestId(req.params)) });
  });

  router.post('/:id/reject', async (req, res) => {
    const { reason } = parseBody(rejectionInputSchema, req);
    res.json({
      request: await changes.reject(requireAuth(req).actor, requestId(req.params), reason),
    });
  });

  return router;
}
