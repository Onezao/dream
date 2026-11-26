/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AdminGovernanceService,
  GrantAdminSchema,
  IdentityContextService,
  LookupAccountByEmailSchema,
  RevokeAdminSchema,
  RoleInvalidationNotifier,
  UpdateAdminDisplayNameSchema,
} from '@topeetop/dream-core';
import {
  authenticateAndResolveProfile,
  requirePermanentMasterAdmin,
  requireRole,
  verifyActiveAccount,
} from '../middlewares/auth.middleware.js';
import { AdminAccountController } from '../controllers/AdminAccountController.js';

export interface AdminRouteOptions {
  adminGovernanceService?: AdminGovernanceService;
  identityService?: IdentityContextService;
  roleInvalidationNotifier?: RoleInvalidationNotifier;
}

const AdminIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(16),
});

export const adminRoutes: FastifyPluginAsync<AdminRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const controller = new AdminAccountController({
    adminGovernanceService: options?.adminGovernanceService,
    identityService: options?.identityService,
    roleInvalidationNotifier: options?.roleInvalidationNotifier,
  });
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  server.addHook('preHandler', authenticateAndResolveProfile);

  server.get(
    '/admin/admins',
    {
      preHandler: [requireRole('admin')],
    },
    controller.listAdmins
  );

  server.post(
    '/admin/admins/lookup',
    {
      preHandler: [requirePermanentMasterAdmin, verifyActiveAccount],
      schema: {
        body: LookupAccountByEmailSchema,
      },
    },
    controller.lookupByEmail
  );

  server.post(
    '/admin/admins',
    {
      preHandler: [requirePermanentMasterAdmin, verifyActiveAccount],
      schema: {
        body: GrantAdminSchema,
      },
    },
    controller.grantAdmin
  );

  server.patch(
    '/admin/admins/:id',
    {
      preHandler: [requirePermanentMasterAdmin, verifyActiveAccount],
      schema: {
        params: AdminIdParamsSchema,
        body: UpdateAdminDisplayNameSchema,
      },
    },
    controller.updateDisplayName
  );

  server.post(
    '/admin/admins/:id/revoke',
    {
      preHandler: [requirePermanentMasterAdmin, verifyActiveAccount],
      schema: {
        params: AdminIdParamsSchema,
        body: RevokeAdminSchema,
      },
    },
    controller.revokeAdmin
  );
};
