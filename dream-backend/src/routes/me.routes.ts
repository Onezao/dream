/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  AccountLifecycleService,
  AvatarUploadService,
  DeactivateAccountSchema,
  IdentityContextService,
  RequestAvatarUploadUrlSchema,
  UpdatePreferencesSchema,
} from '@topeetop/dream-core';
import {
  authenticateAndResolveProfile,
  verifyActiveAccount,
} from '../middlewares/auth.middleware.js';
import { MeController } from '../controllers/MeController.js';

export interface MeRouteOptions {
  service?: IdentityContextService;
  accountLifecycleService?: AccountLifecycleService;
  avatarUploadService?: AvatarUploadService;
}

export const meRoutes: FastifyPluginAsync<MeRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const controller = new MeController({
    identityService: options?.service,
    accountLifecycleService: options?.accountLifecycleService,
    avatarUploadService: options?.avatarUploadService,
  });
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  server.addHook('preHandler', authenticateAndResolveProfile);

  server.get('/me/context', controller.getContext);

  server.put(
    '/me/preferences',
    {
      schema: {
        body: UpdatePreferencesSchema,
      },
    },
    controller.updatePreferences
  );

  server.post(
    '/me/avatar/upload-url',
    {
      schema: {
        body: RequestAvatarUploadUrlSchema,
      },
    },
    controller.requestAvatarUploadUrl
  );

  server.post(
    '/me/deactivate',
    {
      preHandler: [verifyActiveAccount],
      schema: {
        body: DeactivateAccountSchema,
      },
    },
    controller.deactivateAccount
  );
};
