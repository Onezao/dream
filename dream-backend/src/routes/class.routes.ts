/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  ClassService,
  CreateSmallGroupClassSchema,
  ConfirmActionSchema,
  CancelClassSchema,
  AdminClassQuerySchema,
  AdminUpdateClassSchema,
  ShortId,
} from '@topeetop/dream-core';
import {
  authenticateAndResolveProfile,
  requireRole,
} from '../middlewares/auth.middleware.js';
import { ClassController } from '../controllers/ClassController.js';

export interface ClassRouteOptions {
  service?: ClassService;
}

export const classRoutes: FastifyPluginAsync<ClassRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const controller = new ClassController(options?.service);
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  // 1. 公开端点（需登录态，家长/学生选班大厅）
  server.get(
    '/public/classes/small-group',
    {
      preHandler: [authenticateAndResolveProfile],
      schema: {
        querystring: z.object({
          courseTypeId: ShortId.optional(),
        }),
      },
    },
    controller.listPublicSmallGroupClasses
  );

  // 2. 班长工作台专属端点 (需 monitor 角色)
  server.get(
    '/monitor/classes',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('monitor')],
      schema: {
        querystring: z.object({
          status: z.enum(['recruiting', 'active', 'completed', 'cancelled']).optional(),
        }),
      },
    },
    controller.listMonitorClasses
  );

  server.post(
    '/monitor/classes',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('monitor')],
      schema: {
        body: CreateSmallGroupClassSchema,
      },
    },
    controller.createMonitorClass
  );

  server.post(
    '/monitor/classes/:id/force-start',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('monitor')],
      schema: {
        params: z.object({ id: ShortId }),
        body: ConfirmActionSchema,
      },
    },
    controller.forceStartMonitorClass
  );

  server.post(
    '/monitor/classes/:id/cancel',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('monitor')],
      schema: {
        params: z.object({ id: ShortId }),
        body: CancelClassSchema,
      },
    },
    controller.cancelMonitorClass
  );

  // 3. 管理员专属端点 (需 admin 角色)
  server.get(
    '/admin/classes',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('admin')],
      schema: {
        querystring: AdminClassQuerySchema,
      },
    },
    controller.adminListClasses
  );

  server.patch(
    '/admin/classes/:id',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('admin')],
      schema: {
        params: z.object({ id: ShortId }),
        body: AdminUpdateClassSchema,
      },
    },
    controller.adminUpdateClass
  );
};
