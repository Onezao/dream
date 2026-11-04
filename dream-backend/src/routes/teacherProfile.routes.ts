/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  TeacherProfileService,
  CreateTeacherProfileSchema,
  UpdateTeacherProfileSchema,
  AdminUpsertTeacherSchema,
  AdminUpsertMonitorSchema,
  ShortId,
} from '@topeetop/dream-core';
import {
  authenticateAndResolveProfile,
  requireRole,
} from '../middlewares/auth.middleware.js';
import { TeacherProfileController } from '../controllers/TeacherProfileController.js';

export interface TeacherProfileRouteOptions {
  service?: TeacherProfileService;
}

export const teacherProfileRoutes: FastifyPluginAsync<TeacherProfileRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const controller = new TeacherProfileController(options?.service);
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  // 1. 公开端点（需登录态）
  server.get(
    '/public/teachers',
    {
      preHandler: [authenticateAndResolveProfile],
      schema: {
        querystring: z.object({
          levelId: ShortId.optional(),
          courseTypeId: ShortId.optional(),
        }),
      },
    },
    controller.listPublicTeachers
  );

  server.get(
    '/public/teachers/:id',
    {
      preHandler: [authenticateAndResolveProfile],
      schema: {
        params: z.object({ id: ShortId }),
      },
    },
    controller.getPublicTeacherById
  );

  server.get(
    '/public/dictionaries/course-types',
    { preHandler: [authenticateAndResolveProfile] },
    controller.listCourseTypes
  );

  server.get(
    '/public/dictionaries/teacher-levels',
    { preHandler: [authenticateAndResolveProfile] },
    controller.listTeacherLevels
  );

  // 2. 班长工作台专属端点 (需 monitor 角色)
  server.get(
    '/monitor/teachers',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('monitor')],
    },
    controller.listMonitorTeachers
  );

  server.post(
    '/monitor/teachers',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('monitor')],
      schema: {
        body: CreateTeacherProfileSchema,
      },
    },
    controller.createMonitorTeacher
  );

  server.patch(
    '/monitor/teachers/:id',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('monitor')],
      schema: {
        params: z.object({ id: ShortId }),
        body: UpdateTeacherProfileSchema,
      },
    },
    controller.updateMonitorTeacher
  );

  server.delete(
    '/monitor/teachers/:id',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('monitor')],
      schema: {
        params: z.object({ id: ShortId }),
      },
    },
    controller.deleteMonitorTeacher
  );

  // 3. 管理员专属端点 (需 admin 角色)
  server.get(
    '/admin/teachers',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('admin')],
    },
    controller.adminListTeachers
  );

  server.post(
    '/admin/teachers',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('admin')],
      schema: {
        body: AdminUpsertTeacherSchema,
      },
    },
    controller.adminUpsertTeacher
  );

  server.patch(
    '/admin/teachers/:id',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('admin')],
      schema: {
        params: z.object({ id: ShortId }),
        body: AdminUpsertTeacherSchema,
      },
    },
    controller.adminUpsertTeacher
  );

  server.post(
    '/admin/monitors',
    {
      preHandler: [authenticateAndResolveProfile, requireRole('admin')],
      schema: {
        body: AdminUpsertMonitorSchema,
      },
    },
    controller.adminUpsertMonitor
  );
};
