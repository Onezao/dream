/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { ApiError } from '@topeetop/shared-core';
import {
  StudentProfileService,
  CreateStudentProfileInput,
  UpdateStudentProfileInput,
} from '@topeetop/dream-core';
import type { AuthUser } from '../middlewares/auth.middleware.js';

export class StudentProfileController {
  private readonly service: StudentProfileService;

  constructor(service?: StudentProfileService) {
    this.service = service ?? new StudentProfileService();
  }

  private getAuthenticatedAccountId(request: FastifyRequest): string {
    const user = request.user as AuthUser | undefined;
    if (!user?.id) {
      throw new ApiError('Authentication token is required', 401, 'UNAUTHORIZED');
    }
    return user.id;
  }

  /**
   * 1. 列表获取当前家长的所有学员档案
   */
  listProfiles = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const accountId = this.getAuthenticatedAccountId(request);
    const result = await this.service.getProfilesByAccountId(accountId);
    return reply.status(200).send({
      data: result.data,
      meta: result.meta,
    });
  };

  /**
   * 2. 创建学员档案
   */
  createProfile = async (
    request: FastifyRequest<{ Body: CreateStudentProfileInput }>,
    reply: FastifyReply
  ): Promise<void> => {
    const accountId = this.getAuthenticatedAccountId(request);
    const profile = await this.service.createProfile(accountId, request.body);
    return reply.status(201).send({
      data: profile,
    });
  };

  /**
   * 3. 获取单个学员档案 (防越权 IDOR)
   */
  getProfile = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const accountId = this.getAuthenticatedAccountId(request);
    const profile = await this.service.getProfileById(request.params.id, accountId);
    return reply.status(200).send({
      data: profile,
    });
  };

  /**
   * 4. 更新学员档案
   */
  updateProfile = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateStudentProfileInput }>,
    reply: FastifyReply
  ): Promise<void> => {
    const accountId = this.getAuthenticatedAccountId(request);
    const profile = await this.service.updateProfile(request.params.id, accountId, request.body);
    return reply.status(200).send({
      data: profile,
    });
  };

  /**
   * 5. 软删除学员档案
   */
  deleteProfile = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const accountId = this.getAuthenticatedAccountId(request);
    await this.service.deleteProfile(request.params.id, accountId);
    return reply.status(200).send({
      data: { success: true },
    });
  };

  /**
   * 6. 规范昵称实时查重
   */
  checkNicknameAvailability = async (
    request: FastifyRequest<{ Querystring: { nickname: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await this.service.checkNicknameAvailability(request.query.nickname);
    return reply.status(200).send({
      data: result,
    });
  };

  /**
   * 7. 跨家长课程转让脱敏检索学员档案
   */
  lookupProfileForTransfer = async (
    request: FastifyRequest<{ Querystring: { nickname: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await this.service.lookupProfileForTransfer(request.query.nickname);
    return reply.status(200).send({
      data: result,
    });
  };
}
