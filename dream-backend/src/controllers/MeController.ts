/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { ApiError } from '@topeetop/shared-core';
import {
  IdentityContextService,
  UpdatePreferencesInput,
} from '@topeetop/dream-core';
import { AuthUser, getIdentityContextService } from '../middlewares/auth.middleware.js';

export class MeController {
  private readonly service: IdentityContextService;

  constructor(service?: IdentityContextService) {
    this.service = service ?? getIdentityContextService();
  }

  private getAuthenticatedUser(request: FastifyRequest): AuthUser {
    const user = request.user as AuthUser | undefined;
    if (!user?.id) {
      throw new ApiError('Authentication token is required', 401, 'UNAUTHORIZED');
    }
    return user;
  }

  /**
   * 获取当前账号完整上下文（四角色解析 + 名下学员档案 + 偏好设置）
   */
  getContext = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = this.getAuthenticatedUser(request);
    const data = await this.service.resolveContext(
      user.id,
      user.email ?? '',
      request.currentProfileId
    );
    return reply.status(200).send({ data });
  };

  /**
   * 更新当前账号语言与时区偏好
   */
  updatePreferences = async (
    request: FastifyRequest<{ Body: UpdatePreferencesInput }>,
    reply: FastifyReply
  ): Promise<void> => {
    const user = this.getAuthenticatedUser(request);
    const data = await this.service.updatePreferences(user.id, request.body);
    return reply.status(200).send({ data });
  };
}
