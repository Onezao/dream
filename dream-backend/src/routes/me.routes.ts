/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  IdentityContextService,
  UpdatePreferencesSchema,
} from '@topeetop/dream-core';
import { authenticateAndResolveProfile } from '../middlewares/auth.middleware.js';
import { MeController } from '../controllers/MeController.js';

export interface MeRouteOptions {
  service?: IdentityContextService;
}

export const meRoutes: FastifyPluginAsync<MeRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const controller = new MeController(options?.service);
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
};
