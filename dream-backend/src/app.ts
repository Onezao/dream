/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { ApiError } from '@topeetop/shared-core';
import { initDb, closeDb } from '@topeetop/dream-core';
import { loadConfig } from './config/env.config.js';

export async function buildApp() {
  const config = loadConfig();

  // 1. 初始化数据库连接池 (单 Schema dream)
  initDb({
    connectionString: config.DB_URL,
    max: config.DB_POOL_MAX,
    ssl: config.DB_USE_SSL,
  });

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

  // 5. 全局异常拦截器 (统合 ApiError 标准格式)
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: (error as any).code || 'BUSINESS_ERROR',
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
      await closeDb();
      process.exit(1);
    }
  };

  start();
}
