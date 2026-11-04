/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiError } from '@topeetop/shared-core';
import {
  TeacherProfileService,
  CreateTeacherProfileInput,
  UpdateTeacherProfileInput,
  AdminUpsertTeacherInput,
  AdminUpsertMonitorInput,
} from '@topeetop/dream-core';

export class TeacherProfileController {
  constructor(
    private readonly service: TeacherProfileService = new TeacherProfileService()
  ) {}

  /**
   * 家长/公共端：教师卡片脱敏列表
   */
  listPublicTeachers = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const data = await this.service.listPublicTeachers(request.query as any);
    reply.status(200).send({
      data,
      meta: { total: data.length },
    });
  };

  /**
   * 家长/公共端：教师卡片脱敏详情
   */
  getPublicTeacherById = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const params = request.params as { id: string };
    const data = await this.service.getPublicTeacherById(params.id);
    if (!data) {
      throw new ApiError('Teacher profile not found', 404, 'NOT_FOUND');
    }
    reply.status(200).send({ data });
  };

  /**
   * 公共字典：课程类型列表
   */
  listCourseTypes = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const data = await this.service.listCourseTypes(true);
    reply.status(200).send({ data });
  };

  /**
   * 公共字典：教师定级列表
   */
  listTeacherLevels = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const data = await this.service.listTeacherLevels(true);
    reply.status(200).send({ data });
  };

  /**
   * 班长端：获取名下教师列表
   */
  listMonitorTeachers = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const monitorAccountId = request.user.id;
    const data = await this.service.listTeachersByMonitor(monitorAccountId);
    reply.status(200).send({ data });
  };

  /**
   * 班长端：新增所辖外教
   */
  createMonitorTeacher = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const monitorAccountId = request.user.id;
    const data = await this.service.createTeacher(
      monitorAccountId,
      request.body as CreateTeacherProfileInput
    );
    reply.status(201).send({ data });
  };

  /**
   * 班长端：更新所辖外教
   */
  updateMonitorTeacher = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const monitorAccountId = request.user.id;
    const params = request.params as { id: string };
    const data = await this.service.updateTeacher(
      monitorAccountId,
      params.id,
      request.body as UpdateTeacherProfileInput
    );
    reply.status(200).send({ data });
  };

  /**
   * 班长端：软删除所辖外教
   */
  deleteMonitorTeacher = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const monitorAccountId = request.user.id;
    const params = request.params as { id: string };
    await this.service.deleteTeacher(monitorAccountId, params.id);
    reply.status(200).send({ data: { success: true } });
  };

  /**
   * 管理员端：全量教师列表
   */
  adminListTeachers = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const data = await this.service.adminListTeachers();
    reply.status(200).send({ data });
  };

  /**
   * 管理员端：新增/更新教师档案 (支持改绑负责班长)
   */
  adminUpsertTeacher = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const params = (request.params as { id?: string }) || {};
    const teacherId = params.id || null;
    const data = await this.service.adminUpsertTeacher(
      teacherId,
      request.body as AdminUpsertTeacherInput
    );
    reply.status(teacherId ? 200 : 201).send({ data });
  };

  /**
   * 管理员端：新增/更新班长档案
   */
  adminUpsertMonitor = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const data = await this.service.adminUpsertMonitor(
      request.body as AdminUpsertMonitorInput
    );
    reply.status(200).send({ data });
  };
}
