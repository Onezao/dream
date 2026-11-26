/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { z } from 'zod';
import { SecretManagerFactory, EnvSecureConf } from '@topeetop/env-secure-conf';

const CRITICAL_SECRETS: ReadonlyArray<{ plain: string; cipher: string }> = [
  { plain: 'DB_URL', cipher: 'DB_URL_CIPHER' },
  { plain: 'JWT_CURRENT_PRIVATE_KEY', cipher: 'JWT_CURRENT_PRIVATE_KEY_CIPHER' },
  { plain: 'S3_SECRET_ACCESS_KEY', cipher: 'S3_SECRET_ACCESS_KEY_CIPHER' },
  { plain: 'EMAIL_API_KEY', cipher: 'EMAIL_API_KEY_CIPHER' },
  { plain: 'TASK_RELAY_TOKEN', cipher: 'TASK_RELAY_TOKEN_CIPHER' },
];

const CIPHER_SECRET_KEYS = [
  'DB_URL_CIPHER',
  'JWT_CURRENT_PRIVATE_KEY_CIPHER',
  'JWT_CURRENT_PUBLIC_KEY_CIPHER',
  'JWT_PREVIOUS_PUBLIC_KEY_CIPHER',
  'S3_ACCESS_KEY_ID_CIPHER',
  'S3_SECRET_ACCESS_KEY_CIPHER',
  'EMAIL_API_KEY_CIPHER',
  'SMS_ACCESS_KEY_SECRET_CIPHER',
  'TASK_RELAY_TOKEN_CIPHER',
] as const;

/**
 * 脱敏数据库连接串（仅用于启动安全日志）
 */
export function maskDbUrl(url: string): string {
  return url.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
}

/**
 * 规范化 PEM/DER 格式的非对称密钥（兼容单行转义 `\n`、PKCS#1、PKCS#8/SPKI 及无头 Base64）
 */
export function normalizePemKey(
  rawKey: string | undefined,
  labelHint: 'auto' | 'public' | 'private' = 'auto'
): string | undefined {
  if (!rawKey || typeof rawKey !== 'string') {
    return rawKey;
  }

  const trimmed = rawKey.replace(/\\n/g, '\n').trim();
  const isPublic = labelHint === 'public' || (/PUBLIC/i.test(trimmed) && !/PRIVATE/i.test(trimmed));

  try {
    if (isPublic) {
      const pubObj = crypto.createPublicKey(trimmed);
      if (trimmed.includes('-----BEGIN RSA PUBLIC KEY-----')) {
        return pubObj.export({ type: 'spki', format: 'pem' }).toString().trim();
      }
      return trimmed;
    }
    crypto.createPrivateKey(trimmed);
    return trimmed;
  } catch {
    // Continue to structural PEM reconstruction
  }

  const body = trimmed
    .replace(/-----BEGIN[^-]+-----/g, '')
    .replace(/-----END[^-]+-----/g, '')
    .replace(/[\r\n\s"']/g, '');

  if (!body) {
    return trimmed;
  }

  const lines: string[] = [];
  for (let i = 0; i < body.length; i += 64) {
    lines.push(body.substring(i, i + 64));
  }
  const formattedBody = lines.join('\n');

  const assemble = (type: string) =>
    `-----BEGIN ${type}-----\n${formattedBody}\n-----END ${type}-----\n`;

  const candidates = isPublic
    ? ['PUBLIC KEY', 'RSA PUBLIC KEY']
    : ['PRIVATE KEY', 'RSA PRIVATE KEY'];

  for (const type of candidates) {
    const pem = assemble(type);
    try {
      if (isPublic) {
        const keyObj = crypto.createPublicKey(pem);
        return keyObj.export({ type: 'spki', format: 'pem' }).toString().trim();
      }
      crypto.createPrivateKey(pem);
      return pem.trim();
    } catch {
      // Try next PEM header
    }
  }

  try {
    const der = Buffer.from(body, 'base64');
    if (isPublic) {
      try {
        return crypto
          .createPublicKey({ key: der, format: 'der', type: 'spki' })
          .export({ type: 'spki', format: 'pem' })
          .toString()
          .trim();
      } catch {
        return crypto
          .createPublicKey({ key: der, format: 'der', type: 'pkcs1' })
          .export({ type: 'spki', format: 'pem' })
          .toString()
          .trim();
      }
    } else {
      try {
        return crypto
          .createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
          .export({ type: 'pkcs8', format: 'pem' })
          .toString()
          .trim();
      } catch {
        return crypto
          .createPrivateKey({ key: der, format: 'der', type: 'pkcs1' })
          .export({ type: 'pkcs8', format: 'pem' })
          .toString()
          .trim();
      }
    }
  } catch {
    return assemble(candidates[0]).trim();
  }
}

/**
 * 依据运行环境加载 .env 文件（Prod/Docker 支持 /mnt/config/prod.env 或 CONFIG_PATH）
 */
function loadDotenvFiles(): void {
  const configPathValue = process.env.CONFIG_PATH?.trim();
  const isProdOrDocker = process.env.NODE_ENV === 'production' || Boolean(configPathValue);

  if (isProdOrDocker) {
    const targetPath = configPathValue || '/mnt/config/prod.env';
    if (fs.existsSync(targetPath)) {
      const result = dotenv.config({ path: targetPath });
      if (result.error) {
        console.error(`[Config] Dotenv failed to load ${targetPath}: ${result.error.message}`);
      } else {
        const keyCount = Object.keys(result.parsed || {}).length;
        console.log(`[Config] Mode: Prod/Docker. Loaded ${keyCount} keys from ${targetPath}`);
      }
    } else if (configPathValue) {
      console.warn(`[Config] Mode: Prod/Docker. Missing config file: ${targetPath}`);
    }
    return;
  }

  const dir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  const searchDirs = [
    dir,
    path.resolve(dir, '..'),
    path.resolve(dir, '../..'),
    process.cwd(),
    path.resolve(process.cwd(), 'dream-backend'),
  ];

  for (const targetDir of searchDirs) {
    for (const file of ['.env.dev', '.env']) {
      const fullPath = path.resolve(targetDir, file);
      if (fs.existsSync(fullPath)) {
        dotenv.config({ path: fullPath });
      }
    }
  }

  dotenv.config();
}

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

function assertProductionCipherPolicy(): void {
  const isStrictProd = process.env.NODE_ENV === 'production' && !process.env.PREVIEW_MODE;
  if (!isStrictProd) {
    return;
  }

  for (const secret of CRITICAL_SECRETS) {
    if (process.env[secret.plain] && !process.env[secret.cipher]) {
      console.error(
        `[Config] FATAL: Plaintext ${secret.plain} is prohibited in production. Use ${secret.cipher} instead.`
      );
      process.exit(1);
    }
  }
}

/**
 * 同步解密密文：生产环境解密失败直接 Fail-Fast 阻断启动
 */
export function resolveSecretValue(
  cipherKey: string,
  plainKey?: string,
  options?: { keyType?: 'auto' | 'public' | 'private'; isPem?: boolean }
): string | undefined {
  const cipherVal = process.env[cipherKey]?.trim();
  const plainVal = plainKey ? process.env[plainKey]?.trim() : undefined;
  const masterKey = process.env.SECRET_MASTER_KEY?.trim();
  const isStrictProd = process.env.NODE_ENV === 'production' && !process.env.PREVIEW_MODE;
  const labelHint = options?.keyType ?? (options?.isPem ? 'auto' : undefined);

  if (cipherVal) {
    if (labelHint && cipherVal.startsWith('-----BEGIN')) {
      return normalizePemKey(cipherVal, labelHint);
    }
    if (masterKey) {
      try {
        const decrypted = EnvSecureConf.decrypt(cipherVal, masterKey);
        return labelHint ? normalizePemKey(decrypted, labelHint) : decrypted;
      } catch (err: unknown) {
        console.error(
          `[Config] Failed to decrypt ${cipherKey}: ${(err as Error).message}`
        );
        if (isStrictProd) {
          process.exit(1);
        }
      }
    } else {
      console.warn(`[Config] Detected ${cipherKey} without SECRET_MASTER_KEY.`);
      if (isStrictProd) {
        process.exit(1);
      }
    }
  }

  if (plainVal) {
    return labelHint ? normalizePemKey(plainVal, labelHint) : plainVal;
  }

  return undefined;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  isProd: z.boolean().default(false),
  PORT: z.coerce.number().positive().default(8070),
  HOST: z.string().default('0.0.0.0'),
  APP_TIMEZONE: z.string().default('Asia/Shanghai'),
  SECRET_MASTER_KEY: z.string().optional(),

  // Database (DB_URL_CIPHER 解密或直接 DB_URL)
  DB_URL: z.string().min(1, 'DB_URL or DB_URL_CIPHER is required'),
  DB_POOL_MAX: z.coerce.number().positive().default(10),
  DB_IDLE_TIMEOUT_MILLIS: z.coerce.number().positive().default(20000),
  DB_USE_SSL: envBoolean(false),

  // CORS & Network
  CORS_ORIGIN: z.string().default('*'),
  MOUNT_AUTH_PLUGIN: envBoolean(true),
  AUTH_BASE_URL: z.string().default('http://127.0.0.1:8070'),

  // Cache
  CACHE_DRIVER: z.enum(['redis', 'memory', 'db']).default('redis'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT (Two-Slot: Current & Previous)
  JWT_CURRENT_VERSION: z.string().min(1).default('v2'),
  JWT_CURRENT_PUBLIC_KEY: z.string().optional(),
  JWT_CURRENT_PRIVATE_KEY: z.string().optional(),
  JWT_PREVIOUS_VERSION: z.string().optional(),
  JWT_PREVIOUS_PUBLIC_KEY: z.string().optional(),

  // S3 / R2 Cloudflare
  S3_BUCKET: z.string().min(1).default('topee-st'),
  S3_REGION: z.string().default('auto'),
  S3_ENDPOINT: z.string().default('https://06c8433e36655d05fb8093031bd61394.r2.cloudflarestorage.com/'),
  S3_PUBLIC_DOMAIN: z.string().default('https://st.topee.top'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: envBoolean(false),

  // Notification (Email & SMS)
  EMAIL_PROVIDER: z.string().default('brevo'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_SENDER_EMAIL: z
    .preprocess((val) => (typeof val === 'string' ? val.replace(/['"]/g, '').trim() : val), z.string().email())
    .default('hai@topee.top'),
  EMAIL_SENDER_NAME: z.string().default('Topee'),
  SMS_PROVIDER: z.string().default('aliyun'),
  SMS_ACCESS_KEY_ID: z.string().optional(),
  SMS_ACCESS_KEY_SECRET: z.string().optional(),
  SMS_SIGN_NAME: z.string().default('速通互联验证码'),
  SMS_TEMPLATE_CODE: z.string().default('100001'),

  // Task Relay
  TASK_RELAY_ENDPOINT: z.string().optional(),
  TASK_RELAY_TOKEN: z.string().optional(),
  TASK_RELAY_QUEUE_NAME: z.string().default('dream-queue-dev'),

  // Telemetry
  TELEMETRY_PROVIDER: z.enum(['GCP', 'TENCENT', 'CONSOLE', 'LOCAL']).default('CONSOLE'),
  GCP_PROJECT_ID: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;
let loadPromise: Promise<AppConfig> | null = null;

function buildRawResolvedEnv(decryptedOverrides?: Map<string, string | undefined>): Record<string, unknown> {
  const pickCipherOrResolve = (
    cipherKey: (typeof CIPHER_SECRET_KEYS)[number],
    plainKey?: string,
    keyType?: 'public' | 'private'
  ): string | undefined => {
    if (decryptedOverrides) {
      const resolvedCipher = decryptedOverrides.get(cipherKey);
      if (resolvedCipher) {
        return keyType ? normalizePemKey(resolvedCipher, keyType) : resolvedCipher;
      }
      const fallbackPlain = plainKey ? process.env[plainKey]?.trim() : undefined;
      return keyType ? normalizePemKey(fallbackPlain, keyType) : fallbackPlain;
    }
    return resolveSecretValue(cipherKey, plainKey, keyType ? { keyType } : undefined);
  };

  const dbUrl = pickCipherOrResolve('DB_URL_CIPHER', 'DB_URL');
  const jwtPrivateKey =
    pickCipherOrResolve('JWT_CURRENT_PRIVATE_KEY_CIPHER', 'JWT_CURRENT_PRIVATE_KEY', 'private') ||
    (decryptedOverrides
      ? normalizePemKey(process.env.JWT_PRIVATE_KEY?.trim(), 'private')
      : resolveSecretValue('JWT_CURRENT_PRIVATE_KEY_CIPHER', 'JWT_PRIVATE_KEY', { keyType: 'private' }));
  const jwtPublicKey =
    pickCipherOrResolve('JWT_CURRENT_PUBLIC_KEY_CIPHER', 'JWT_CURRENT_PUBLIC_KEY', 'public');
  const jwtPrevPublicKey =
    pickCipherOrResolve('JWT_PREVIOUS_PUBLIC_KEY_CIPHER', 'JWT_PREVIOUS_PUBLIC_KEY', 'public');

  const s3AccessKeyId =
    pickCipherOrResolve('S3_ACCESS_KEY_ID_CIPHER', 'S3_ACCESS_KEY_ID') ||
    process.env.R2_ACCESS_KEY_ID?.trim();
  const s3SecretKey =
    pickCipherOrResolve('S3_SECRET_ACCESS_KEY_CIPHER', 'S3_SECRET_ACCESS_KEY') ||
    process.env.R2_SECRET_ACCESS_KEY?.trim();

  const emailApiKey = pickCipherOrResolve('EMAIL_API_KEY_CIPHER', 'EMAIL_API_KEY');
  const smsSecret = pickCipherOrResolve('SMS_ACCESS_KEY_SECRET_CIPHER', 'SMS_ACCESS_KEY_SECRET');
  const taskRelayToken = pickCipherOrResolve('TASK_RELAY_TOKEN_CIPHER', 'TASK_RELAY_TOKEN');

  return {
    ...process.env,
    isProd: process.env.NODE_ENV === 'production',
    PORT: process.env.BACKEND_PORT || process.env.PORT,
    DB_URL: dbUrl,
    AUTH_BASE_URL: process.env.AUTH_BASE_URL || process.env.AUTH_API_BASE_URL,
    JWT_CURRENT_PRIVATE_KEY: jwtPrivateKey,
    JWT_CURRENT_PUBLIC_KEY: jwtPublicKey,
    JWT_PREVIOUS_PUBLIC_KEY: jwtPrevPublicKey,
    S3_BUCKET: process.env.S3_BUCKET || process.env.R2_BUCKET,
    S3_REGION: process.env.S3_REGION || process.env.R2_REGION,
    S3_ENDPOINT: process.env.S3_ENDPOINT || process.env.R2_ENDPOINT,
    S3_PUBLIC_DOMAIN:
      process.env.S3_PUBLIC_DOMAIN || process.env.R2_PUBLIC_DOMAIN || process.env.R2_PUBLIC_URL,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE ?? process.env.R2_FORCE_PATH_STYLE,
    S3_ACCESS_KEY_ID: s3AccessKeyId,
    S3_SECRET_ACCESS_KEY: s3SecretKey,
    EMAIL_API_KEY: emailApiKey,
    SMS_ACCESS_KEY_SECRET: smsSecret,
    TASK_RELAY_TOKEN: taskRelayToken,
  };
}

function finalizeConfig(rawEnv: Record<string, unknown>): AppConfig {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    console.error('[Config] FATAL: Environment configuration validation failed:');
    for (const issue of result.error.issues) {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  const config = result.data;
  process.env.DB_URL = config.DB_URL;
  if (config.TASK_RELAY_TOKEN) {
    process.env.TASK_RELAY_TOKEN = config.TASK_RELAY_TOKEN;
  }

  if (config.NODE_ENV !== 'test') {
    console.log(`[Config] DB_URL ready: ${maskDbUrl(config.DB_URL)}`);
  }

  cachedConfig = config;
  return config;
}

/**
 * 同步加载并校验环境变量单例
 */
export function loadConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  loadDotenvFiles();
  assertProductionCipherPolicy();
  const rawEnv = buildRawResolvedEnv();
  return finalizeConfig(rawEnv);
}

/**
 * 异步并发解密加载入口（通过 SecretManagerFactory.getSecret 并行解密关键密文）
 */
export async function loadConfigAsync(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    loadDotenvFiles();
    assertProductionCipherPolicy();

    const isStrictProd = process.env.NODE_ENV === 'production' && !process.env.PREVIEW_MODE;
    const loader = getSecretLoader();
    const results = await Promise.allSettled(
      CIPHER_SECRET_KEYS.map((key) => {
        const rawVal = process.env[key]?.trim();
        if (!rawVal) {
          return Promise.resolve(undefined);
        }
        if (rawVal.startsWith('-----BEGIN')) {
          return Promise.resolve(rawVal);
        }
        return loader.getSecret(key);
      })
    );

    const decrypted = new Map<string, string | undefined>();
    results.forEach((res, index) => {
      const key = CIPHER_SECRET_KEYS[index];
      if (res.status === 'fulfilled') {
        decrypted.set(key, res.value);
      } else {
        console.error(`[Config] FATAL: Failed to decrypt cipher secret (${key})`);
        if (isStrictProd) {
          process.exit(1);
        }
      }
    });

    const rawEnv = buildRawResolvedEnv(decrypted);
    return finalizeConfig(rawEnv);
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
  _secretLoaderInstance = null;
}
