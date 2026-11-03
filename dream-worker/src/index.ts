/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initDb, closeDb } from '@topeetop/dream-core';
import { getWorkerConfig } from './config/env.config';
import { createScheduler } from './scheduler';

async function bootstrap() {
  const config = getWorkerConfig();

  // Initialize DB pool
  initDb({
    connectionString: config.DB_URL,
    max: config.DB_POOL_MAX,
    ssl: config.DB_SSL ? { rejectUnauthorized: false } : false,
  });

  const app = Fastify({ logger: config.NODE_ENV === 'development' });
  await app.register(cors, { origin: true });

  const scheduler = createScheduler();
  scheduler.start();

  // Health check endpoint
  app.get('/health', async () => {
    return {
      service: 'dream-worker',
      status: 'UP',
      timestamp: new Date().toISOString(),
    };
  });

  const server = await app.listen({ port: config.PORT, host: config.HOST });
  console.info(`[dream-worker] Worker service listening on ${server}`);

  const shutdown = async (signal: string) => {
    console.info(`[dream-worker] Received ${signal}. Gracefully terminating...`);
    scheduler.stop();
    await app.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[dream-worker] Fatal bootstrap error:', err);
  process.exit(1);
});
