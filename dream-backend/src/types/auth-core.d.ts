/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

declare module '@topeetop/auth-core' {
  import type { FastifyPluginAsync } from 'fastify';
  import type { ICacheStore, ILogger } from '@topeetop/shared-core';
  import type { JwtTokenProvider, CaptchaProvider } from '@topeetop/security-core';

  export interface AuthDbAdapter {
    executeQuery: (query: unknown, params?: unknown[]) => Promise<any[]>;
  }

  export class UserProvider {
    constructor(deps: { executeQuery: (query: string, params?: unknown[]) => Promise<any[]> });
    findUserById(id: string): Promise<any[]>;
    findUserByEmailOrPhone(params: { email?: string; phone?: string }): Promise<any[]>;
    softDeleteUser(id: string): Promise<any[]>;
  }

  export class SessionProvider {
    constructor(deps: { executeQuery: (query: string, params?: unknown[]) => Promise<any[]> });
    deleteSessionsByUserId(userId: string): Promise<any[]>;
  }

  export class SystemConfigService {
    constructor(deps: { db: AuthDbAdapter });
  }

  export class ValidationService {
    constructor(deps: { systemConfig: SystemConfigService });
  }

  export interface StorageConfig {
    bucket: string;
    publicDomain: string;
    region?: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
  }

  export class StorageService {
    constructor(config: StorageConfig);
  }

  export class VerificationCodeService {
    constructor(deps: {
      db: AuthDbAdapter;
      cache: ICacheStore;
      notification: any;
      systemConfig: SystemConfigService;
      contentService?: any;
      logger?: ILogger;
    });
  }

  export class AuthService {
    constructor(deps: {
      db: AuthDbAdapter;
      cache: ICacheStore;
      jwt: JwtTokenProvider;
      captcha: CaptchaProvider;
      notification: any;
      verificationCode: VerificationCodeService;
      systemConfig: SystemConfigService;
      validation: ValidationService;
      storage: StorageService;
      logger: ILogger;
    });
  }

  export class AuthController {
    constructor(authService: AuthService);
  }

  export class PolicyController {
    constructor(documentService: { getByFilename: (key: string) => Promise<any> });
  }

  export class VerificationCodeController {
    constructor(
      verificationCodeService: VerificationCodeService,
      authService: AuthService
    );
  }

  export function createAuthFastifyPlugin(deps: {
    authController: AuthController;
    policyController: PolicyController;
    verificationCodeController: VerificationCodeController;
    authHook?: any;
  }): FastifyPluginAsync;

  export function createJwksFastifyPlugin(jwtProvider: JwtTokenProvider): FastifyPluginAsync;
}
