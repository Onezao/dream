/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { ApiError } from '@topeetop/shared-core';
import { telemetryContext } from '@topeetop/telemetry-core';
import {
  AccountLifecycleService,
  AvatarUploadService,
  IdentityContextService,
} from '@topeetop/dream-core';
import { AuthUser, getIdentityContextService } from '../middlewares/auth.middleware.js';
import { AuthAccountAdapter } from '../adapters/authAccount.adapter.js';
import { getConfig } from '../config/env.config.js';

export interface MeControllerDeps {
  identityService?: IdentityContextService;
  accountLifecycleService?: AccountLifecycleService;
  avatarUploadService?: AvatarUploadService;
}

export class MeController {
  private readonly identityService: IdentityContextService;
  private readonly accountLifecycleService: AccountLifecycleService;
  private readonly avatarUploadService: AvatarUploadService;

  constructor(deps: MeControllerDeps | IdentityContextService = {}) {
    if (deps instanceof IdentityContextService) {
      this.identityService = deps;
      this.accountLifecycleService = new AccountLifecycleService({
        identityContextService: deps,
        authAccountPort: new AuthAccountAdapter(),
      });
      this.avatarUploadService = this.createDefaultAvatarUploadService();
    } else {
      const resolvedIdentity = deps.identityService ?? getIdentityContextService();
      this.identityService = resolvedIdentity;
      this.accountLifecycleService =
        deps.accountLifecycleService ??
        new AccountLifecycleService({
          identityContextService: resolvedIdentity,
          authAccountPort: new AuthAccountAdapter(),
        });
      this.avatarUploadService =
        deps.avatarUploadService ?? this.createDefaultAvatarUploadService();
    }
  }

  private createDefaultAvatarUploadService(): AvatarUploadService {
    const config = getConfig();
    return new AvatarUploadService({
      storageConfig: {
        bucket: config.S3_BUCKET,
        region: config.S3_REGION,
        endpoint: config.S3_ENDPOINT,
        publicDomain: config.S3_PUBLIC_DOMAIN,
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  private getAuthenticatedUser(request: FastifyRequest): AuthUser {
    const user = request.user as AuthUser | undefined;
    if (!user?.id) {
      throw new ApiError('Authentication token is required', 401, 'UNAUTHORIZED');
    }
    return user;
  }

  private resolveTraceId(request: FastifyRequest): string | undefined {
    const fromContext = telemetryContext.getTraceId();
    if (fromContext) {
      return fromContext;
    }
    const header = request.headers['x-trace-id'];
    return typeof header === 'string' && header ? header : request.id;
  }

  /**
   * 获取当前账号完整上下文（四角色解析 + 永久主管理员标识 + 学员档案 + 偏好设置）
   */
  getContext = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = this.getAuthenticatedUser(request);
    const data = await this.identityService.resolveContext(
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
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const user = this.getAuthenticatedUser(request);
    const data = await this.identityService.updatePreferences(user.id, request.body);
    return reply.status(200).send({ data });
  };

  /**
   * 获取个人头像 WebP S3 预签名 PUT 直传链接
   */
  requestAvatarUploadUrl = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const user = this.getAuthenticatedUser(request);
    const data = await this.avatarUploadService.createAvatarUploadUrl(user.id, request.body);
    return reply.status(200).send({ data });
  };

  /**
   * 账号自助注销（校验 M0A/M1A/M1B 全清零后停用登录并吊销全端会话）
   */
  deactivateAccount = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const user = this.getAuthenticatedUser(request);
    const data = await this.accountLifecycleService.deactivateSelf(
      user.id,
      user.email ?? '',
      request.body,
      this.resolveTraceId(request)
    );
    return reply.status(200).send({ data });
  };
}
