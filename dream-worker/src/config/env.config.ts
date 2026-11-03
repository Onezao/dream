/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { z } from 'zod';

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('8072'),
  HOST: z.string().default('0.0.0.0'),
  DB_URL: z.string().min(1, 'DB_URL is required'),
  DB_POOL_MAX: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('10'),
  DB_SSL: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
});

export type WorkerConfig = z.infer<typeof workerEnvSchema>;

let cachedConfig: WorkerConfig | null = null;

export function getWorkerConfig(): WorkerConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = workerEnvSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    console.error(`[WorkerConfig] Environment variable validation failed:\n${errorDetails}`);
    process.exit(1);
  }

  cachedConfig = result.data;
  return cachedConfig;
}
