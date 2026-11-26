/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { FastifyInstance } from 'fastify';
import {
  CacheServiceFactory,
  JwtAuthHook,
  LoggerFactory,
  executeQuery,
  setSharedConfig,
} from '@topeetop/shared-core';
import { CaptchaProvider, JwtTokenProvider, type JwtConfig } from '@topeetop/security-core';
import { EnvSecureConf } from '@topeetop/env-secure-conf';
import {
  DbPollerManager,
  NotificationManager,
  SseHub,
  createNotificationFastifyPlugin,
  createNotificationManager,
} from '@topeetop/notification-core';
import {
  AuthController,
  AuthService,
  PolicyController,
  StorageService,
  SystemConfigService,
  ValidationService,
  VerificationCodeController,
  VerificationCodeService,
  createAuthFastifyPlugin,
  createJwksFastifyPlugin,
} from '@topeetop/auth-core';
import type { AppConfig } from '../config/env.config.js';
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

function decryptSecretIfNeeded(rawValue?: string): string | undefined {
  if (!rawValue) {
    return undefined;
  }
  const trimmed = rawValue.trim();
  if (trimmed.startsWith('-----BEGIN')) {
    return normalizePem(trimmed);
  }
  const masterKey = process.env.SECRET_MASTER_KEY;
  if (!masterKey) {
    return normalizePem(trimmed);
  }
  return normalizePem(EnvSecureConf.decrypt(trimmed, masterKey));
}

export interface NotificationInfrastructure {
  notificationManager: NotificationManager;
  pollerManager: DbPollerManager;
  sseHub: SseHub;
}

/**
 * 构建 NotificationManager（含 TaskRelay + Brevo 邮件与 notification.messages 入库能力）及 SSE 基础设施
 */
export function createNotificationInfrastructure(
  config: AppConfig,
  jwtProvider: JwtTokenProvider,
  options?: { enableEmailProvider?: boolean }
): NotificationInfrastructure {
  const logger = LoggerFactory.create('notification-core');
  const relayBaseUrl = config.TASK_RELAY_ENDPOINT?.trim();
  const relayPsk = config.TASK_RELAY_TOKEN?.trim();
  const emailApiKey = config.EMAIL_API_KEY?.trim();
  const shouldEnableEmail =
    (options?.enableEmailProvider ?? true) && Boolean(relayBaseUrl && relayPsk && emailApiKey);

  const notificationManager = createNotificationManager(
    {
      ...(shouldEnableEmail && relayBaseUrl && relayPsk
        ? {
            relay: {
              baseUrl: relayBaseUrl,
              psk: relayPsk,
              enabled: true,
            },
            email: {
              provider: 'brevo',
              apiKey: emailApiKey,
              from: config.EMAIL_SENDER_EMAIL,
              senderEmail: config.EMAIL_SENDER_EMAIL,
              senderName: config.EMAIL_SENDER_NAME,
            } as any,
          }
        : {}),
    },
    (sql: string, params?: unknown[]) => executeQuery(sql, params as any[]),
    logger
  );

  const pollerManager = new DbPollerManager();
  const sseHub = new SseHub(pollerManager, jwtProvider);

  return {
    notificationManager,
    pollerManager,
    sseHub,
  };
}

/**
 * 注册 /api/notification/v1 SSE 推送与 Ticket 签发路由（POST /ticket 走 JwtAuthHook，GET /events 走 ticket 查询参数验签）
 */
export async function registerNotificationPlugin(
  app: FastifyInstance,
  config: AppConfig,
  jwtProvider: JwtTokenProvider,
  options?: { skipPollerInit?: boolean }
): Promise<NotificationInfrastructure> {
  const infra = createNotificationInfrastructure(config, jwtProvider);

  if (!options?.skipPollerInit && config.NODE_ENV !== 'test') {
    infra.pollerManager.init(
      (sql: string, params?: unknown[]) => executeQuery(sql, params as any[]),
      { pollIntervalMs: 3000 }
    );
    app.addHook('onClose', async () => {
      infra.pollerManager.stopPolling();
    });
  }

  await app.register(
    async (notificationScope) => {
      notificationScope.addHook('preHandler', async (request, reply) => {
        if (request.method === 'POST' && request.url.includes('/ticket')) {
          await JwtAuthHook(request, reply);
          const userObj = request.user as Record<string, unknown> | undefined;
          if (userObj && !userObj.userId && typeof userObj.id === 'string') {
            userObj.userId = userObj.id;
          }
        }
      });

      await notificationScope.register(
        createNotificationFastifyPlugin({
          sseHub: infra.sseHub,
          jwtProvider,
          ticketExpiresIn: '10s',
        })
      );
    },
    { prefix: '/api/notification/v1' }
  );

  return infra;
}

/**
 * 从环境变量构建 JwtTokenProvider（支持 two-slot 密钥轮换与密文私钥解密）
 */
export function createJwtProviderFromConfig(config: AppConfig): JwtTokenProvider | null {
  if (!config.JWT_CURRENT_PUBLIC_KEY) {
    return null;
  }

  const currentPublicKey = normalizePem(config.JWT_CURRENT_PUBLIC_KEY);
  const currentPrivateKey =
    config.JWT_CURRENT_PRIVATE_KEY ||
    decryptSecretIfNeeded(process.env.JWT_CURRENT_PRIVATE_KEY_CIPHER || process.env.JWT_PRIVATE_KEY);
  const previousPublicKey = (config.JWT_PREVIOUS_PUBLIC_KEY || process.env.JWT_PREVIOUS_PUBLIC_KEY)
    ? normalizePem(config.JWT_PREVIOUS_PUBLIC_KEY || process.env.JWT_PREVIOUS_PUBLIC_KEY!)
    : undefined;

  const jwtConfig: JwtConfig = {
    mode: 'two-slot',
    current: {
      version: config.JWT_CURRENT_VERSION,
      publicKey: currentPublicKey,
      ...(currentPrivateKey ? { privateKey: currentPrivateKey } : {}),
    },
    ...(previousPublicKey
      ? {
          previous: {
            version: config.JWT_PREVIOUS_VERSION || process.env.JWT_PREVIOUS_VERSION || 'v0',
            publicKey: previousPublicKey,
          },
        }
      : {}),
  };

  setSharedConfig({
    dbUrl: config.DB_URL,
    jwt: {
      publicKey: currentPublicKey,
      privateKey: currentPrivateKey,
      kid: config.JWT_CURRENT_VERSION,
    },
    useSsl: config.DB_USE_SSL,
  });

  return new JwtTokenProvider(jwtConfig);
}

/**
 * 在 Fastify 实例上挂载 container.tokenProvider，供 @topeetop/shared-core JwtAuthHook 读取
 */
export function decorateJwtContainer(app: FastifyInstance, jwtProvider: JwtTokenProvider): void {
  if (app.hasDecorator('container')) {
    const existing = ((app as any).container ?? {}) as Record<string, unknown>;
    existing.tokenProvider = jwtProvider;
    existing.jwt = jwtProvider;
    return;
  }
  app.decorate('container', {
    tokenProvider: jwtProvider,
    jwt: jwtProvider,
  });
}

/**
 * 初始化并挂载 @topeetop/auth-core 认证与 JWKS 插件
 */
export async function registerAuthCorePlugin(
  app: FastifyInstance,
  config: AppConfig,
  notificationManager?: NotificationManager
): Promise<void> {
  const jwtProvider = createJwtProviderFromConfig(config);
  if (!jwtProvider) {
    throw new Error(
      'JWT_CURRENT_PUBLIC_KEY is required when MOUNT_AUTH_PLUGIN is enabled'
    );
  }

  decorateJwtContainer(app, jwtProvider);

  const logger = LoggerFactory.create('auth-core');
  const dbAdapter = {
    executeQuery: (query: unknown, params?: unknown[]) =>
      executeQuery(query as any, params as any[]),
  };

  const cache = CacheServiceFactory.create({
    driver: process.env.CACHE_DRIVER === 'redis' ? 'redis' : 'memory',
    redisUrl: process.env.REDIS_URL,
  });

  const captchaProvider = new CaptchaProvider();
  const systemConfigService = new SystemConfigService({ db: dbAdapter });
  const validationService = new ValidationService({ systemConfig: systemConfigService });
  const storageService = new StorageService({
    bucket: config.S3_BUCKET || 'dream-avatars',
    publicDomain: config.S3_PUBLIC_DOMAIN || '',
    region: config.S3_REGION || 'auto',
    endpoint: config.S3_ENDPOINT || 'https://s3.placeholder.local',
    accessKeyId:
      config.S3_ACCESS_KEY_ID ||
      decryptSecretIfNeeded(process.env.S3_ACCESS_KEY_ID_CIPHER) ||
      process.env.S3_ACCESS_KEY_ID ||
      'placeholder',
    secretAccessKey:
      config.S3_SECRET_ACCESS_KEY ||
      decryptSecretIfNeeded(process.env.S3_SECRET_ACCESS_KEY_CIPHER) ||
      process.env.S3_SECRET_ACCESS_KEY ||
      'placeholder',
  });

  const hasTaskRelayEmail = Boolean(
    config.TASK_RELAY_ENDPOINT && config.TASK_RELAY_TOKEN && config.EMAIL_API_KEY
  );
  const activeNotificationManager =
    notificationManager ??
    createNotificationInfrastructure(config, jwtProvider, {
      enableEmailProvider: hasTaskRelayEmail,
    }).notificationManager;

  const notificationAdapter = {
    sendEmail: async (to: string, subject: string, html: string, text?: string) => {
      if (hasTaskRelayEmail) {
        return activeNotificationManager.sendEmail(to, subject, html, text);
      }
      if (config.NODE_ENV === 'production') {
        throw new Error(
          'TASK_RELAY_ENDPOINT, TASK_RELAY_TOKEN, and EMAIL_API_KEY are required for production email delivery'
        );
      }
      logger.info(`[DEV EMAIL] to=${to} subject=${subject}`);
      return { mocked: true };
    },
    sendSmsVerificationCode: async (to: string, _code: string, _validMins?: number) => {
      if (config.NODE_ENV === 'production') {
        throw new Error('SMS login/verification is disabled in Dream');
      }
      logger.info(`[DEV SMS] to=${to}`);
      return { mocked: true };
    },
  };

  const verificationCodeService = new VerificationCodeService({
    db: dbAdapter,
    cache,
    notification: notificationAdapter,
    systemConfig: systemConfigService,
    logger,
  });

  const authService = new AuthService({
    db: dbAdapter,
    cache,
    jwt: jwtProvider,
    captcha: captchaProvider,
    notification: notificationAdapter,
    verificationCode: verificationCodeService,
    systemConfig: systemConfigService,
    validation: validationService,
    storage: storageService,
    logger,
  });

  const authController = new AuthController(authService);
  const policyController = new PolicyController({
    getByFilename: async (filename: string) => {
      const rows = await executeQuery<{
        id: string;
        filename: string;
        version: number;
        title_zh_cn: string;
        content_zh_cn: string;
        title_en_us: string;
        content_en_us: string;
        updated_at: string;
      }>(
        `SELECT id, filename, version, title_zh_cn, content_zh_cn, title_en_us, content_en_us, updated_at 
         FROM cms.documents 
         WHERE filename = $1 AND status = 'published' 
         ORDER BY version DESC 
         LIMIT 1`,
        [filename]
      );
      return rows[0] || null;
    },
  });
  const verificationCodeController = new VerificationCodeController(
    verificationCodeService,
    authService
  );

  await app.register(
    async (authScope) => {
      authScope.setValidatorCompiler(({ schema }) => {
        return (data) => {
          const result = (schema as any).safeParse(data);
          if (result.success) {
            return { value: result.data };
          }
          const issues = result.error?.issues ?? result.error?.errors ?? [];
          const validationError: any = new Error('Validation failed');
          validationError.validation = issues;
          return { error: validationError };
        };
      });

      await authScope.register(
        createAuthFastifyPlugin({
          authController,
          policyController,
          verificationCodeController,
          authHook: JwtAuthHook,
        })
      );
    },
    { prefix: '/api/auth/v1' }
  );

  await app.register(createJwksFastifyPlugin(jwtProvider), {
    prefix: '/api/auth/.well-known',
  });
}
