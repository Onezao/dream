/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

process.env.NODE_ENV = 'test';
process.env.DB_URL = process.env.DB_URL || 'postgresql://localhost:5432/dream_test';

import { generateKeyPairSync } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ApiError } from '@topeetop/shared-core';
import { JwtTokenProvider } from '@topeetop/security-core';
import {
  IdentityContextService,
  MeContextDto,
  RoleResolutionSnapshot,
} from '@topeetop/dream-core';
import { buildApp } from '../src/app.js';
import { resetConfigCache } from '../src/config/env.config.js';
import {
  requireRole,
  requirePermanentMasterAdmin,
  verifyActiveAccount,
  resetIdentityContextService,
} from '../src/middlewares/auth.middleware.js';

describe('Auth Middleware, JWKS & /me/* Routes Integration Tests', () => {
  let app: FastifyInstance;
  let mockIdentityService: jest.Mocked<IdentityContextService>;

  const accountId = 'acc123456789';

  const sampleRoleSnapshot: RoleResolutionSnapshot = {
    accountId,
    primaryRole: 'monitor',
    effectiveRoles: ['monitor', 'parent'],
    adminAccount: null,
    monitorProfile: { id: 'mon123456789', displayName: 'Monitor Alice', status: 'ACTIVE' },
    teacherProfile: null,
  };

  const sampleMeContext: MeContextDto = {
    ...sampleRoleSnapshot,
    emailMasked: 'al***@topee.top',
    studentProfiles: [
      { id: 'stu123456789', nickname: 'AliceZ12', avatarKey: null },
    ],
    preferences: {
      locale: 'zh-CN',
      timezone: 'Asia/Shanghai',
    },
  };

  beforeAll(async () => {
    resetConfigCache();
    resetIdentityContextService();

    mockIdentityService = {
      resolveRolesFromCache: jest.fn(),
      resolveContext: jest.fn(),
      updatePreferences: jest.fn(),
      invalidateRoleDirectoryCache: jest.fn(),
      verifyPermanentMasterAdminFromDb: jest.fn(),
    } as unknown as jest.Mocked<IdentityContextService>;

    app = await buildApp({
      skipDbInit: true,
      identityService: mockIdentityService,
      mountAuthPlugin: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    resetIdentityContextService();
    resetConfigCache();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Authentication Guard & /me/context', () => {
    it('should return 401 UNAUTHORIZED when Authorization header is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/me/context',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe('UNAUTHORIZED');
    });

    it('should return 401 INVALID_TOKEN when Bearer token is empty', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/me/context',
        headers: {
          authorization: 'Bearer ',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe('INVALID_TOKEN');
    });

    it('should return 200 { data } for GET /api/dream/v1/me/context with mock-access-token + x-account-id', async () => {
      mockIdentityService.resolveRolesFromCache.mockResolvedValueOnce(sampleRoleSnapshot);
      mockIdentityService.resolveContext.mockResolvedValueOnce(sampleMeContext);

      const response = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/me/context',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': accountId,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data).toEqual(sampleMeContext);
      expect(mockIdentityService.resolveRolesFromCache).toHaveBeenCalledWith(accountId);
      expect(mockIdentityService.resolveContext).toHaveBeenCalledWith(
        accountId,
        'user@topee.top',
        undefined
      );
    });

    it('should enforce X-Profile-Id ownership and reject IDOR with 403 PROFILE_ACCESS_DENIED', async () => {
      mockIdentityService.resolveContext.mockRejectedValueOnce(
        new ApiError(
          'Forbidden: Student profile does not belong to your account',
          403,
          'PROFILE_ACCESS_DENIED'
        )
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/me/context',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': accountId,
          'x-profile-id': 'stu_other001',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe('PROFILE_ACCESS_DENIED');
      expect(mockIdentityService.resolveContext).toHaveBeenCalledWith(
        accountId,
        'user@topee.top',
        'stu_other001'
      );
    });

    it('should return 200 with currentStudentProfileId when X-Profile-Id belongs to account', async () => {
      const ctxWithProfile: MeContextDto = {
        ...sampleMeContext,
        currentStudentProfileId: 'stu123456789',
      };
      mockIdentityService.resolveContext.mockResolvedValue(ctxWithProfile);

      const response = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/me/context',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': accountId,
          'x-profile-id': 'stu123456789',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.currentStudentProfileId).toBe('stu123456789');
    });
  });

  describe('2. PUT /api/dream/v1/me/preferences', () => {
    it('should return 200 { data } for valid locale and timezone update', async () => {
      mockIdentityService.resolveRolesFromCache.mockResolvedValueOnce(sampleRoleSnapshot);
      const updatedPreference = {
        id: 'pref12345678',
        accountId,
        locale: 'en-US' as const,
        timezone: 'America/New_York',
        createdAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:00:00.000Z',
      };
      mockIdentityService.updatePreferences.mockResolvedValueOnce(updatedPreference);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/dream/v1/me/preferences',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': accountId,
        },
        payload: {
          locale: 'en-US',
          timezone: 'America/New_York',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(updatedPreference);
      expect(mockIdentityService.updatePreferences).toHaveBeenCalledWith(accountId, {
        locale: 'en-US',
        timezone: 'America/New_York',
      });
    });

    it('should return 400 VALIDATION_ERROR when locale is invalid', async () => {
      mockIdentityService.resolveRolesFromCache.mockResolvedValueOnce(sampleRoleSnapshot);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/dream/v1/me/preferences',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': accountId,
        },
        payload: {
          locale: 'fr-FR',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('VALIDATION_ERROR');
      expect(mockIdentityService.updatePreferences).not.toHaveBeenCalled();
    });
  });

  describe('3. requireRole Unit Tests', () => {
    it('should reject with 403 FORBIDDEN when identity lacks allowed role', async () => {
      const guard = requireRole('admin');
      const req = {
        user: { id: accountId, email: 'alice@topee.top', roles: ['parent'] },
        identity: { ...sampleRoleSnapshot, effectiveRoles: ['monitor', 'parent'] },
      } as unknown as FastifyRequest;
      const reply = {} as FastifyReply;

      await expect(guard(req, reply)).rejects.toMatchObject({
        statusCode: 403,
        errorCode: 'FORBIDDEN',
      });
    });

    it('should pass when identity effectiveRoles includes an allowed role', async () => {
      const guard = requireRole(['admin', 'monitor']);
      const req = {
        user: { id: accountId, email: 'alice@topee.top', roles: [] },
        identity: { ...sampleRoleSnapshot, effectiveRoles: ['monitor', 'parent'] },
      } as unknown as FastifyRequest;
      const reply = {} as FastifyReply;

      await expect(guard(req, reply)).resolves.toBeUndefined();
    });

    it('should reject with 401 UNAUTHORIZED when request.user is missing', async () => {
      const guard = requireRole('parent');
      const req = {} as unknown as FastifyRequest;
      const reply = {} as FastifyReply;

      await expect(guard(req, reply)).rejects.toMatchObject({
        statusCode: 401,
        errorCode: 'UNAUTHORIZED',
      });
    });

    it('requirePermanentMasterAdmin should invoke verifyPermanentMasterAdminFromDb', async () => {
      mockIdentityService.verifyPermanentMasterAdminFromDb.mockResolvedValueOnce({
        id: 'adm001',
        accountId,
        displayName: 'Master',
        status: 'ACTIVE',
        isPermanentPrimary: true,
      });

      const req = {
        user: { id: accountId, email: 'alice@topee.top', roles: ['admin'] },
      } as unknown as FastifyRequest;

      await expect(requirePermanentMasterAdmin(req, {} as FastifyReply)).resolves.toBeUndefined();
      expect(mockIdentityService.verifyPermanentMasterAdminFromDb).toHaveBeenCalledWith(accountId);
    });
  });

  describe('4. verifyActiveAccount Guard (Strategy B)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should pass when auth-core /api/auth/v1/user returns active user', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: { id: accountId, email: 'alice@topee.top', banned_until: null },
        }),
      } as unknown as Response);

      const req = {
        headers: { authorization: 'Bearer valid-jwt' },
      } as unknown as FastifyRequest;

      await expect(verifyActiveAccount(req, {} as FastifyReply)).resolves.toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8070/api/auth/v1/user',
        expect.objectContaining({
          method: 'GET',
          headers: { authorization: 'Bearer valid-jwt' },
        })
      );
    });

    it('should throw 403 ACCOUNT_BANNED when user banned_until is in the future', async () => {
      const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: { id: accountId, banned_until: futureIso },
        }),
      } as unknown as Response);

      const req = {
        headers: { authorization: 'Bearer valid-jwt' },
      } as unknown as FastifyRequest;

      await expect(verifyActiveAccount(req, {} as FastifyReply)).rejects.toMatchObject({
        statusCode: 403,
        errorCode: 'ACCOUNT_BANNED',
      });
    });

    it('should throw 401 UNAUTHORIZED when auth-core returns 401', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as unknown as Response);

      const req = {
        headers: { authorization: 'Bearer invalid-jwt' },
      } as unknown as FastifyRequest;

      await expect(verifyActiveAccount(req, {} as FastifyReply)).rejects.toMatchObject({
        statusCode: 401,
        errorCode: 'UNAUTHORIZED',
      });
    });
  });

  describe('5. Real RS256 JWT Verification & Auth-Core / JWKS Plugin Mount', () => {
    let jwtApp: FastifyInstance;
    let jwtProvider: JwtTokenProvider;
    const savedEnv = { ...process.env };

    beforeAll(async () => {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      process.env.JWT_CURRENT_PUBLIC_KEY = publicKey;
      process.env.JWT_CURRENT_PRIVATE_KEY_CIPHER = privateKey;
      process.env.JWT_CURRENT_VERSION = 'v1';
      resetConfigCache();

      jwtProvider = new JwtTokenProvider({
        mode: 'two-slot',
        current: {
          version: 'v1',
          publicKey,
          privateKey,
        },
      });

      jwtApp = await buildApp({
        skipDbInit: true,
        identityService: mockIdentityService,
        mountAuthPlugin: true,
      });
      await jwtApp.ready();
    });

    afterAll(async () => {
      await jwtApp.close();
      process.env = savedEnv;
      resetConfigCache();
      resetIdentityContextService();
    });

    it('should verify real RS256 JWT via JwtAuthHook and return 200 on /me/context', async () => {
      mockIdentityService.resolveRolesFromCache.mockResolvedValueOnce(sampleRoleSnapshot);
      mockIdentityService.resolveContext.mockResolvedValueOnce(sampleMeContext);

      const { accessToken } = jwtProvider.signTokens({
        userId: accountId,
        email: 'alice@topee.top',
        sessionId: 'sess12345678',
      });

      const response = await jwtApp.inject({
        method: 'GET',
        url: '/api/dream/v1/me/context',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockIdentityService.resolveRolesFromCache).toHaveBeenCalledWith(accountId);
      expect(mockIdentityService.resolveContext).toHaveBeenCalledWith(
        accountId,
        'alice@topee.top',
        undefined
      );
    });

    it('should reject forged JWT with 401 UNAUTHORIZED', async () => {
      const response = await jwtApp.inject({
        method: 'GET',
        url: '/api/dream/v1/me/context',
        headers: {
          authorization: 'Bearer forged.jwt.token',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe('UNAUTHORIZED');
    });

    it('should expose JWKS keys at GET /api/auth/.well-known/jwks.json', async () => {
      const response = await jwtApp.inject({
        method: 'GET',
        url: '/api/auth/.well-known/jwks.json',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(Array.isArray(json.keys)).toBe(true);
      expect(json.keys[0]).toMatchObject({
        kid: 'v1',
        kty: 'RSA',
      });
    });

    it('should expose captcha endpoint at GET /api/auth/v1/captcha', async () => {
      const response = await jwtApp.inject({
        method: 'GET',
        url: '/api/auth/v1/captcha',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(typeof json.id).toBe('string');
      expect(typeof json.data).toBe('string');
    });

    it('should return 400 VALIDATION_ERROR on invalid /api/auth/v1/token grant_type', async () => {
      const response = await jwtApp.inject({
        method: 'POST',
        url: '/api/auth/v1/token?grant_type=invalid',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('VALIDATION_ERROR');
    });
  });
});
