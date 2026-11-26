/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import crypto from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiError, initializeDatabase, closePool } from '@topeetop/shared-core';
import { maskPII, telemetryContext } from '@topeetop/telemetry-core';
import type { NotificationManager } from '@topeetop/notification-core';
import {
  AccountLifecycleService,
  AdminGovernanceService,
  AvatarUploadService,
  IdentityContextService,
} from '@topeetop/dream-core';
import { loadConfig, loadConfigAsync } from './config/env.config.js';
import { setIdentityContextService } from './middlewares/auth.middleware.js';
import { NotificationRoleInvalidationNotifier } from './adapters/roleInvalidation.notifier.js';
import {
  createJwtProviderFromConfig,
  decorateJwtContainer,
  registerAuthCorePlugin,
  registerNotificationPlugin,
} from './plugins/authCore.plugin.js';
import { meRoutes } from './routes/me.routes.js';
import { adminRoutes } from './routes/admin.routes.js';

export interface BuildAppOptions {
  identityService?: IdentityContextService;
  adminGovernanceService?: AdminGovernanceService;
  accountLifecycleService?: AccountLifecycleService;
  avatarUploadService?: AvatarUploadService;
  mountAuthPlugin?: boolean;
  mountNotificationPlugin?: boolean;
  skipDbInit?: boolean;
}

export async function buildApp(options?: BuildAppOptions) {
  const config = await loadConfigAsync();

  // 1. 初始化数据库连接池 (委托至 @topeetop/shared-core，单 Schema dream)
  if (!options?.skipDbInit && config.NODE_ENV !== 'test') {
    initializeDatabase({
      connectionString: config.DB_URL,
      max: config.DB_POOL_MAX,
      ssl: config.DB_USE_SSL,
    });
  }

  // 2. 初始化身份上下文服务单例 (共享 0-60s 整点分钟角色目录缓存)
  if (options?.identityService) {
    setIdentityContextService(options.identityService);
  }

  // 3. 初始化 Fastify 实例并挂载 Zod Type Provider
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // 透传 W3C / 请求级 x-trace-id 至 @topeetop/telemetry-core AsyncLocalStorage
  app.addHook('onRequest', (request, reply, done) => {
    const incomingTrace = request.headers['x-trace-id'];
    const traceId =
      typeof incomingTrace === 'string' && incomingTrace.trim()
        ? incomingTrace.trim()
        : crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    reply.header('x-trace-id', traceId);
    telemetryContext.run({ traceId }, done);
  });

  // 4. 注册全局插件 (CORS 等)
  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Profile-Id', 'X-Account-Id', 'X-Trace-Id'],
  });

  // 5. 全局健康检查接口
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'dream-backend',
      timestamp: new Date().toISOString(),
    };
  });

  // 6. 全局异常拦截器 (统合 ApiError 标准格式 + maskPII 脱敏日志)
  app.setErrorHandler((error, _request, reply) => {
    if (ApiError.isApiError(error) || error instanceof ApiError) {
      const apiErr = error as ApiError;
      return reply.status(apiErr.statusCode).send({
        error: apiErr.message,
        code: (apiErr as any).code || apiErr.errorCode || 'BUSINESS_ERROR',
        timestamp: new Date().toISOString(),
      });
    }

    if ((error as any).validation) {
      return reply.status(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: (error as any).validation,
        timestamp: new Date().toISOString(),
      });
    }

    app.log.error(maskPII({ message: (error as Error)?.message, name: (error as Error)?.name }));
    return reply.status(500).send({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  });

  // 7. 挂载 @topeetop/notification-core SSE 插件与 @topeetop/auth-core 认证/JWKS 插件
  const jwtProvider = createJwtProviderFromConfig(config);
  let notificationManager: NotificationManager | null = null;

  const shouldMountNotification =
    options?.mountNotificationPlugin ?? (Boolean(jwtProvider) && !options?.skipDbInit);
  if (shouldMountNotification && jwtProvider) {
    const infra = await registerNotificationPlugin(app, config, jwtProvider, {
      skipPollerInit: options?.skipDbInit || config.NODE_ENV === 'test',
    });
    notificationManager = infra.notificationManager;
  }

  const shouldMountAuthPlugin =
    options?.mountAuthPlugin ??
    (config.MOUNT_AUTH_PLUGIN && config.NODE_ENV !== 'test' && !options?.skipDbInit);

  if (shouldMountAuthPlugin) {
    await registerAuthCorePlugin(app, config, notificationManager ?? undefined);
  } else if (jwtProvider) {
    decorateJwtContainer(app, jwtProvider);
  }

  const roleInvalidationNotifier = new NotificationRoleInvalidationNotifier(
    () => notificationManager
  );

  // 8. 挂载业务路由
  await app.register(meRoutes, {
    prefix: '/api/dream/v1',
    service: options?.identityService,
    accountLifecycleService: options?.accountLifecycleService,
    avatarUploadService: options?.avatarUploadService,
  });

  await app.register(adminRoutes, {
    prefix: '/api/dream/v1',
    adminGovernanceService: options?.adminGovernanceService,
    identityService: options?.identityService,
    roleInvalidationNotifier,
  });

  return app;
}

// 独立启动入口
if (process.env.NODE_ENV !== 'test') {
  const start = async () => {
    const config = loadConfig();
    const app = await buildApp();

    try {
      await app.listen({ port: config.PORT, host: config.HOST });
      console.log(`🚀 dream-backend running at http://${config.HOST}:${config.PORT}`);
    } catch (err) {
      app.log.error(err);
      await closePool();
      process.exit(1);
    }
  };

  start();
}
