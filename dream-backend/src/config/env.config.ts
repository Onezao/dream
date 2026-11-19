/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { SecretManagerFactory, EnvSecureConf } from '@topeetop/env-secure-conf';

import crypto from 'crypto';

function normalizePem(value: string): string {
  let pem = value.replace(/\\n/g, '\n').trim();
  if (pem.includes('-----BEGIN RSA PUBLIC KEY-----')) {
    try {
      pem = crypto.createPublicKey(pem).export({ type: 'spki', format: 'pem' }).toString().trim();
    } catch {
      // Keep original
    }
  }
  return pem;
}

/**
 * 依据优先级从候选目录加载环境变量文件 (.env.dev / .env / CONFIG_PATH)
 */
function loadDotenvFiles(): void {
  const dir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  const searchDirs = [
    dir,
    path.resolve(dir, '..'),
    path.resolve(dir, '../..'),
    process.cwd(),
    path.resolve(process.cwd(), 'dream-backend'),
  ];

  const configPath = process.env.CONFIG_PATH;
  if (configPath && fs.existsSync(configPath)) {
    dotenv.config({ path: configPath });
    return;
  }

  const envFileCandidates = process.env.NODE_ENV === 'production'
    ? ['prod.env', '.env.prod', '.env']
    : ['.env.dev', '.env'];

  for (const targetDir of searchDirs) {
    for (const file of envFileCandidates) {
      const fullPath = path.resolve(targetDir, file);
      if (fs.existsSync(fullPath)) {
        dotenv.config({ path: fullPath });
      }
    }
  }

  // 兜底再次调用全局 dotenv
  dotenv.config();
}

// 初始化时优先执行环境变量读取
loadDotenvFiles();

let _secretLoaderInstance: EnvSecureConf | null = null;
export function getSecretLoader(): EnvSecureConf {
  if (!_secretLoaderInstance) {
    const masterKey =
      process.env.SECRET_MASTER_KEY?.trim() ||
      (process.env.NODE_ENV === 'test' ? 'test-master-key-min-16chars' : undefined);
    _secretLoaderInstance = SecretManagerFactory.create(masterKey ? { masterKey } : undefined);
  }
  return _secretLoaderInstance;
}

export const secretLoader = {
  getSecret: (key: string) => getSecretLoader().getSecret(key),
};

const envBoolean = (defaultValue: boolean) =>
  z
    .preprocess((val) => {
      if (typeof val === 'string') {
        const normalized = val.trim().toLowerCase();
        if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === '') {
          return false;
        }
        if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
          return true;
        }
      }
      return val;
    }, z.boolean())
    .default(defaultValue);

/**
 * 解密环境变量：优先读取 *_CIPHER 并使用 SECRET_MASTER_KEY 进行 AES 解密；
 * 若无密文或解密失败，平滑降级读取对应明文环境变量（对齐 @topeetop/env-secure-conf 规范）
 */
export function resolveSecretValue(
  cipherKey: string,
  plainKey?: string,
  options?: { isPem?: boolean }
): string | undefined {
  const cipherVal = process.env[cipherKey]?.trim();
  const plainVal = plainKey ? process.env[plainKey]?.trim() : undefined;
  const masterKey = process.env.SECRET_MASTER_KEY?.trim();

  if (cipherVal) {
    if (options?.isPem && cipherVal.startsWith('-----BEGIN')) {
      return normalizePem(cipherVal);
    }
    if (masterKey) {
      try {
        const decrypted = EnvSecureConf.decrypt(cipherVal, masterKey);
        return options?.isPem ? normalizePem(decrypted) : decrypted;
      } catch (err: unknown) {
        console.warn(
          `[Config] 解密 ${cipherKey} 失败，降级读取明文 ${plainKey || ''}:`,
          (err as Error).message
        );
      }
    } else {
      console.warn(`[Config] 检测到 ${cipherKey} 但未配置 SECRET_MASTER_KEY，降级读取明文。`);
    }
  }

  if (plainVal) {
    return options?.isPem ? normalizePem(plainVal) : plainVal;
  }

  return undefined;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8070),
  HOST: z.string().default('0.0.0.0'),
  APP_TIMEZONE: z.string().default('Asia/Shanghai'),
  SECRET_MASTER_KEY: z.string().optional(),

  // Database (DB_URL_CIPHER 解密或直接 DB_URL)
  DB_URL: z.string().min(1, 'DB_URL or DB_URL_CIPHER is required'),
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_USE_SSL: envBoolean(false),

  // CORS & Network
  CORS_ORIGIN: z.string().default('*'),
  MOUNT_AUTH_PLUGIN: envBoolean(true),
  AUTH_BASE_URL: z.string().default('http://127.0.0.1:8070'),

  // Cache
  CACHE_DRIVER: z.enum(['redis', 'memory', 'db']).default('redis'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT (Two-Slot: Current & Previous)
  JWT_CURRENT_VERSION: z.string().default('v2'),
  JWT_CURRENT_PUBLIC_KEY: z.string().optional(),
  JWT_CURRENT_PRIVATE_KEY: z.string().optional(),
  JWT_PREVIOUS_VERSION: z.string().optional(),
  JWT_PREVIOUS_PUBLIC_KEY: z.string().optional(),

  // S3 / R2 Cloudflare
  S3_BUCKET: z.string().default('topee-st'),
  S3_REGION: z.string().default('auto'),
  S3_ENDPOINT: z.string().default('https://06c8433e36655d05fb8093031bd61394.r2.cloudflarestorage.com/'),
  S3_PUBLIC_DOMAIN: z.string().default('https://st.topee.top'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Notification (Email & SMS)
  EMAIL_PROVIDER: z.string().default('brevo'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_SENDER_EMAIL: z.string().default('hai@topee.top'),
  EMAIL_SENDER_NAME: z.string().default('Topee'),
  SMS_PROVIDER: z.string().default('aliyun'),
  SMS_ACCESS_KEY_ID: z.string().optional(),
  SMS_ACCESS_KEY_SECRET: z.string().optional(),
  SMS_SIGN_NAME: z.string().default('速通互联验证码'),
  SMS_TEMPLATE_CODE: z.string().default('100001'),

  // Task Relay
  TASK_RELAY_ENDPOINT: z.string().optional(),
  TASK_RELAY_TOKEN: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;
let loadPromise: Promise<AppConfig> | null = null;

function buildRawResolvedEnv(): Record<string, unknown> {
  const dbUrl = resolveSecretValue('DB_URL_CIPHER', 'DB_URL');
  const jwtPrivateKey =
    resolveSecretValue('JWT_CURRENT_PRIVATE_KEY_CIPHER', 'JWT_CURRENT_PRIVATE_KEY', { isPem: true }) ||
    resolveSecretValue('JWT_CURRENT_PRIVATE_KEY_CIPHER', 'JWT_PRIVATE_KEY', { isPem: true });
  const jwtPublicKey = process.env.JWT_CURRENT_PUBLIC_KEY
    ? normalizePem(process.env.JWT_CURRENT_PUBLIC_KEY)
    : undefined;
  const jwtPrevPublicKey = process.env.JWT_PREVIOUS_PUBLIC_KEY
    ? normalizePem(process.env.JWT_PREVIOUS_PUBLIC_KEY)
    : undefined;

  const s3AccessKeyId = resolveSecretValue('S3_ACCESS_KEY_ID_CIPHER', 'S3_ACCESS_KEY_ID');
  const s3SecretKey = resolveSecretValue('S3_SECRET_ACCESS_KEY_CIPHER', 'S3_SECRET_ACCESS_KEY');
  const emailApiKey = resolveSecretValue('EMAIL_API_KEY_CIPHER', 'EMAIL_API_KEY');
  const smsSecret = resolveSecretValue('SMS_ACCESS_KEY_SECRET_CIPHER', 'SMS_ACCESS_KEY_SECRET');

  return {
    ...process.env,
    DB_URL: dbUrl,
    JWT_CURRENT_PRIVATE_KEY: jwtPrivateKey,
    JWT_CURRENT_PUBLIC_KEY: jwtPublicKey,
    JWT_PREVIOUS_PUBLIC_KEY: jwtPrevPublicKey,
    S3_ACCESS_KEY_ID: s3AccessKeyId,
    S3_SECRET_ACCESS_KEY: s3SecretKey,
    EMAIL_API_KEY: emailApiKey,
    SMS_ACCESS_KEY_SECRET: smsSecret,
  };
}

/**
 * 同步加载并校验环境变量单例
 */
export function loadConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  loadDotenvFiles();
  const rawEnv = buildRawResolvedEnv();
  const result = envSchema.safeParse(rawEnv);

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

/**
 * 异步初始化入口（支持并发竞态保护单例，对齐 tech_env_config.md 标准规范）
 */
export async function loadConfigAsync(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    return loadConfig();
  })();

  return loadPromise;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
  loadPromise = null;
}
