/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { FileUploadService, UploadUrlSchema } from '@topeetop/dream-core';
import { authenticateAndResolveProfile } from '../middlewares/auth.middleware.js';
import { FileUploadController } from '../controllers/FileUploadController.js';

export interface FileUploadRouteOptions {
  service?: FileUploadService;
}

export const fileUploadRoutes: FastifyPluginAsync<FileUploadRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const controller = new FileUploadController(options?.service);
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  // 预签名直传凭证获取接口（仅需登录用户权限）
  server.post(
    '/files/upload-url',
    {
      preHandler: [authenticateAndResolveProfile],
      schema: {
        body: UploadUrlSchema,
      },
    },
    controller.getPresignedUploadUrl
  );
};
