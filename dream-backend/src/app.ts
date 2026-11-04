/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiError, initializeDatabase, closePool } from '@topeetop/shared-core';
import { StudentProfileService } from '@topeetop/dream-core';
import { loadConfig } from './config/env.config.js';
import { studentProfileRoutes } from './routes/studentProfile.routes.js';

export interface BuildAppOptions {
  service?: StudentProfileService;
  skipDbInit?: boolean;
}

export async function buildApp(options?: BuildAppOptions) {
  const config = loadConfig();

  // 1. 初始化数据库连接池 (委托至 @topeetop/shared-core，单 Schema dream)
  if (!options?.skipDbInit && config.NODE_ENV !== 'test') {
    initializeDatabase({
      connectionString: config.DB_URL,
      max: config.DB_POOL_MAX,
      ssl: config.DB_USE_SSL,
    });
  }

  // 2. 初始化 Fastify 实例并挂载 Zod Type Provider
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // 3. 注册全局插件 (CORS 等)
  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Profile-Id', 'X-Account-Id'],
  });

  // 4. 全局健康检查接口
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'dream-backend',
      timestamp: new Date().toISOString(),
    };
  });

  // 5. 全局异常拦截器 (统合 ApiError 标准格式，必须在路由注册前挂载以使插件上下文继承)
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

    app.log.error(error);
    return reply.status(500).send({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  });

  // 6. 挂载业务路由
  await app.register(studentProfileRoutes, {
    prefix: '/api/dream/v1',
    service: options?.service,
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
