import {
  auditLogQuerySchema,
  deactivateUserInputSchema,
  idParamSchema,
  inviteAdminInputSchema,
  reactivateUserInputSchema,
  userListQuerySchema,
} from '@walls/validation';
import { Router } from 'express';
import { authenticated, requireAuth } from '../http/auth-context';
import { parseBody } from '../http/validate';
import type { UsersService } from './users.service';

const STATUS_CREATED = 201;

export function usersRoutes(users: UsersService): Router {
  const router = Router();
  router.use(authenticated);

  router.get('/', async (req, res) => {
    res.json(await users.list(requireAuth(req).actor, userListQuerySchema.parse(req.query)));
  });

  router.post('/admins', async (req, res) => {
    const input = parseBody(inviteAdminInputSchema, req);
    res
      .status(STATUS_CREATED)
      .json({ user: await users.inviteAdmin(requireAuth(req).actor, input) });
  });

  router.get('/:id', async (req, res) => {
    res.json({ user: await users.get(requireAuth(req).actor, idParamSchema.parse(req.params.id)) });
  });

  router.post('/:id/deactivate', async (req, res) => {
    const { reason } = parseBody(deactivateUserInputSchema, req);
    const id = idParamSchema.parse(req.params.id);
    res.json({ user: await users.deactivate(requireAuth(req).actor, id, reason) });
  });

  router.post('/:id/reactivate', async (req, res) => {
    const { reason } = parseBody(reactivateUserInputSchema, req);
    const id = idParamSchema.parse(req.params.id);
    res.json({ user: await users.reactivate(requireAuth(req).actor, id, reason) });
  });

  return router;
}

export function auditLogRoutes(users: UsersService): Router {
  const router = Router();
  router.use(authenticated);
  router.get('/', async (req, res) => {
    res.json(await users.auditLog(requireAuth(req).actor, auditLogQuerySchema.parse(req.query)));
  });
  return router;
}
