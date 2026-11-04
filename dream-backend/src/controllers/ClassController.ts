/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  ClassService,
  CreateSmallGroupClassInput,
  CancelClassInput,
  AdminClassQueryInput,
  AdminUpdateClassInput,
} from '@topeetop/dream-core';

export class ClassController {
  constructor(private readonly service: ClassService = new ClassService()) {}

  /**
   * 家长/公共端：招募中小班课公开选班列表
   */
  listPublicSmallGroupClasses = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const data = await this.service.listPublicSmallGroupClasses(request.query as any);
    reply.status(200).send({
      data,
      meta: { total: data.length },
    });
  };

  /**
   * 班长端：所辖小班课列表
   */
  listMonitorClasses = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const monitorAccountId = request.user.id;
    const query = request.query as { status?: any };
    const data = await this.service.listMonitorClasses(monitorAccountId, query.status);
    reply.status(200).send({ data });
  };

  /**
   * 班长端：创建招募中小班课
   */
  createMonitorClass = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const monitorAccountId = request.user.id;
    const data = await this.service.createSmallGroupClass(
      monitorAccountId,
      request.body as CreateSmallGroupClassInput
    );
    reply.status(201).send({ data });
  };

  /**
   * 班长端：强制开班（未达最低开班人数时手动开班）
   */
  forceStartMonitorClass = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const monitorAccountId = request.user.id;
    const params = request.params as { id: string };
    const data = await this.service.forceStartClass(params.id, monitorAccountId);
    reply.status(200).send({ data });
  };

  /**
   * 班长端：取消小班课（录入取消原因并解散退还）
   */
  cancelMonitorClass = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const monitorAccountId = request.user.id;
    const params = request.params as { id: string };
    const body = request.body as CancelClassInput;
    const data = await this.service.cancelClass(params.id, monitorAccountId, body.reason);
    reply.status(200).send({ data });
  };

  /**
   * 管理员端：全平台班级统一管理与分页列表
   */
  adminListClasses = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const result = await this.service.adminListClasses(request.query as AdminClassQueryInput);
    reply.status(200).send({
      data: result.data,
      meta: result.meta,
    });
  };

  /**
   * 管理员端：统一调配/更新班级
   */
  adminUpdateClass = async (
    request: FastifyRequest<any>,
    reply: FastifyReply
  ): Promise<void> => {
    const params = request.params as { id: string };
    const data = await this.service.adminUpdateClass(
      params.id,
      request.body as AdminUpdateClassInput
    );
    reply.status(200).send({ data });
  };
}
