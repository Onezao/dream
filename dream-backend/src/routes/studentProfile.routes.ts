/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  StudentProfileService,
  CreateStudentProfileSchema,
  UpdateStudentProfileSchema,
  ShortId,
} from '@topeetop/dream-core';
import { authenticateAndResolveProfile } from '../middlewares/auth.middleware.js';
import { StudentProfileController } from '../controllers/StudentProfileController.js';

export interface StudentProfileRouteOptions {
  service?: StudentProfileService;
}

export const studentProfileRoutes: FastifyPluginAsync<StudentProfileRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const controller = new StudentProfileController(options?.service);
  const server = fastify.withTypeProvider<ZodTypeProvider>();

  // 全局挂载认证中间件，拦截无 Token 请求
  server.addHook('preHandler', authenticateAndResolveProfile);

  // 1. 列表获取当前家长的所有有效学员档案
  server.get('/parent/student-profiles', controller.listProfiles);

  // 2. 规范昵称实时查重
  server.get(
    '/parent/nicknames/availability',
    {
      schema: {
        querystring: z.object({
          nickname: z.string().min(1),
        }),
      },
    },
    controller.checkNicknameAvailability
  );

  // 3. 跨家长课程转让脱敏精确检索 (置于 :id 之前避免被路由参数通配)
  server.get(
    '/parent/student-profiles/lookup',
    {
      schema: {
        querystring: z.object({
          nickname: z.string().min(1),
        }),
      },
    },
    controller.lookupProfileForTransfer
  );

  // 4. 创建学员档案
  server.post(
    '/parent/student-profiles',
    {
      schema: {
        body: CreateStudentProfileSchema,
      },
    },
    controller.createProfile
  );

  // 5. 获取单个学员档案
  server.get(
    '/parent/student-profiles/:id',
    {
      schema: {
        params: z.object({
          id: ShortId,
        }),
      },
    },
    controller.getProfile
  );

  // 6. 更新学员档案
  server.patch(
    '/parent/student-profiles/:id',
    {
      schema: {
        params: z.object({
          id: ShortId,
        }),
        body: UpdateStudentProfileSchema,
      },
    },
    controller.updateProfile
  );

  // 7. 软删除学员档案
  server.delete(
    '/parent/student-profiles/:id',
    {
      schema: {
        params: z.object({
          id: ShortId,
        }),
      },
    },
    controller.deleteProfile
  );
};
