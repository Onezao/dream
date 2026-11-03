/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8070),
  HOST: z.string().default('0.0.0.0'),
  DB_URL: z.string().min(1, 'DB_URL is required'),
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_USE_SSL: z.coerce.boolean().default(false),
  JWT_SECRET: z.string().min(8).default('dream_dev_jwt_secret_must_be_changed_in_prod'),
  CORS_ORIGIN: z.string().default('*'),
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment configuration validation failed:');
    for (const issue of result.error.issues) {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}
