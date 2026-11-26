/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

process.env.NODE_ENV = 'test';
process.env.DB_URL = process.env.DB_URL || 'postgresql://localhost:5432/dream_test';

import { generateKeyPairSync } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { ApiError, DatabaseService } from '@topeetop/shared-core';
import {
  AccountLifecycleService,
  AdminGovernanceService,
  AvatarUploadService,
  IdentityContextService,
  RoleResolutionSnapshot,
} from '@topeetop/dream-core';
import { buildApp } from '../src/app.js';
import { AuthAccountAdapter } from '../src/adapters/authAccount.adapter.js';
import { resetConfigCache } from '../src/config/env.config.js';
import { resetIdentityContextService } from '../src/middlewares/auth.middleware.js';

describe('Admin Governance, Account Lifecycle, Avatar Upload & SSE Ticket Tests', () => {
  let app: FastifyInstance;
  let mockIdentityService: jest.Mocked<IdentityContextService>;
  let mockAdminGovernanceService: jest.Mocked<AdminGovernanceService>;
  let mockAccountLifecycleService: jest.Mocked<AccountLifecycleService>;
  let mockAvatarUploadService: jest.Mocked<AvatarUploadService>;

  const originalFetch = global.fetch;

  const masterSnapshot: RoleResolutionSnapshot = {
    accountId: 'accMaster001',
    primaryRole: 'admin',
    effectiveRoles: ['admin', 'parent'],
    adminAccount: { id: 'admMaster001', displayName: 'Master', isPermanentPrimary: true },
    monitorProfile: null,
    teacherProfile: null,
  };

  const ordinarySnapshot: RoleResolutionSnapshot = {
    accountId: 'accOrdinary1',
    primaryRole: 'admin',
    effectiveRoles: ['admin', 'monitor', 'parent'],
    adminAccount: { id: 'admOrdinary1', displayName: 'Ops', isPermanentPrimary: false },
    monitorProfile: { id: 'mon001', displayName: 'Ops Monitor', status: 'ACTIVE' },
    teacherProfile: null,
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

    mockAdminGovernanceService = {
      listAdmins: jest.fn(),
      lookupAccountByEmail: jest.fn(),
      grantAdmin: jest.fn(),
      updateAdminDisplayName: jest.fn(),
      revokeOrdinaryAdmin: jest.fn(),
    } as unknown as jest.Mocked<AdminGovernanceService>;

    mockAccountLifecycleService = {
      deactivateSelf: jest.fn(),
    } as unknown as jest.Mocked<AccountLifecycleService>;

    mockAvatarUploadService = {
      createAvatarUploadUrl: jest.fn(),
    } as unknown as jest.Mocked<AvatarUploadService>;

    app = await buildApp({
      skipDbInit: true,
      identityService: mockIdentityService,
      adminGovernanceService: mockAdminGovernanceService,
      accountLifecycleService: mockAccountLifecycleService,
      avatarUploadService: mockAvatarUploadService,
      mountAuthPlugin: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await app.close();
    resetIdentityContextService();
    resetConfigCache();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('1. /api/dream/v1/admin/admins Governance Routes', () => {
    it('GET /admin/admins should reject non-admin callers with 403 FORBIDDEN', async () => {
      mockIdentityService.resolveRolesFromCache.mockResolvedValueOnce({
        accountId: 'accParent001',
        primaryRole: 'parent',
        effectiveRoles: ['parent'],
        adminAccount: null,
        monitorProfile: null,
        teacherProfile: null,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/admin/admins',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': 'accParent001',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('FORBIDDEN');
    });

    it('GET /admin/admins should allow ordinary admin with canManage=false', async () => {
      mockIdentityService.resolveRolesFromCache.mockResolvedValueOnce(ordinarySnapshot);
      mockAdminGovernanceService.listAdmins.mockResolvedValueOnce({
        canManage: false,
        items: [],
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/admin/admins',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': 'accOrdinary1',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.canManage).toBe(false);
    });

    it('POST /admin/admins should reject ordinary admin with 403 PERMANENT_MASTER_ADMIN_REQUIRED', async () => {
      mockIdentityService.resolveRolesFromCache.mockResolvedValueOnce(ordinarySnapshot);
      mockIdentityService.verifyPermanentMasterAdminFromDb.mockRejectedValueOnce(
        new ApiError(
          'Forbidden: Permanent primary master admin required',
          403,
          'PERMANENT_MASTER_ADMIN_REQUIRED'
        )
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/admin/admins',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': 'accOrdinary1',
        },
        payload: {
          email: 'newops@topee.top',
          displayName: 'New Ops',
          confirmText: 'newops@topee.top',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('PERMANENT_MASTER_ADMIN_REQUIRED');
    });

    it('POST /admin/admins should reject banned master admin via Strategy B verifyActiveAccount', async () => {
      mockIdentityService.resolveRolesFromCache.mockResolvedValueOnce(masterSnapshot);
      mockIdentityService.verifyPermanentMasterAdminFromDb.mockResolvedValueOnce({
        id: 'admMaster001',
        accountId: 'accMaster001',
        displayName: 'Master',
        status: 'ACTIVE',
        isPermanentPrimary: true,
      });
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: 'accMaster001',
            banned_until: new Date(Date.now() + 60_000).toISOString(),
          },
        }),
      } as unknown as Response);

      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/admin/admins',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': 'accMaster001',
        },
        payload: {
          email: 'newops@topee.top',
          displayName: 'New Ops',
          confirmText: 'newops@topee.top',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('ACCOUNT_BANNED');
    });

    it('POST /admin/admins, PATCH /:id, and POST /:id/revoke should succeed for verified permanent master admin', async () => {
      const dto = {
        id: 'admOrd000001',
        accountId: 'accOrd000001',
        displayName: 'Leo Ops',
        emailMasked: 'le***@topee.top',
        isPermanentPrimary: false,
        status: 'ACTIVE' as const,
        coRoles: ['monitor' as const, 'parent' as const],
        grantedByName: 'Master',
        grantedAt: '2026-11-24T00:00:00.000Z',
        revokedByName: null,
        revokedAt: null,
      };

      const setupActiveMaster = () => {
        mockIdentityService.resolveRolesFromCache.mockResolvedValueOnce(masterSnapshot);
        mockIdentityService.verifyPermanentMasterAdminFromDb.mockResolvedValueOnce({
          id: 'admMaster001',
          accountId: 'accMaster001',
          displayName: 'Master',
          status: 'ACTIVE',
          isPermanentPrimary: true,
        });
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ user: { id: 'accMaster001', banned_until: null } }),
        } as unknown as Response);
      };

      setupActiveMaster();
      mockAdminGovernanceService.grantAdmin.mockResolvedValueOnce(dto);
      const grantRes = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/admin/admins',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': 'accMaster001',
          'x-trace-id': 'trace-test-001',
        },
        payload: {
          email: 'leo@topee.top',
          displayName: 'Leo Ops',
          confirmText: 'leo@topee.top',
        },
      });
      expect(grantRes.statusCode).toBe(201);
      expect(grantRes.headers['x-trace-id']).toBe('trace-test-001');
      expect(grantRes.json().data.id).toBe('admOrd000001');

      setupActiveMaster();
      mockAdminGovernanceService.updateAdminDisplayName.mockResolvedValueOnce({
        ...dto,
        displayName: 'Leo Senior',
      });
      const patchRes = await app.inject({
        method: 'PATCH',
        url: '/api/dream/v1/admin/admins/admOrd000001',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': 'accMaster001',
        },
        payload: { displayName: 'Leo Senior' },
      });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json().data.displayName).toBe('Leo Senior');

      setupActiveMaster();
      mockAdminGovernanceService.revokeOrdinaryAdmin.mockResolvedValueOnce({
        ...dto,
        status: 'REVOKED',
      });
      const revokeRes = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/admin/admins/admOrd000001/revoke',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': 'accMaster001',
        },
        payload: { confirmText: 'Leo Senior' },
      });
      expect(revokeRes.statusCode).toBe(200);
      expect(revokeRes.json().data.status).toBe('REVOKED');
    });
  });

  describe('2. /me/avatar/upload-url & /me/deactivate', () => {
    it('POST /me/avatar/upload-url should validate image/webp and return presigned upload info', async () => {
      mockIdentityService.resolveRolesFromCache.mockResolvedValueOnce(ordinarySnapshot);
      mockAvatarUploadService.createAvatarUploadUrl.mockResolvedValueOnce({
        uploadUrl: 'https://r2.example.com/upload',
        key: 'dream/accounts/avatars/2026/11/24/abc123456789.webp',
        publicUrl: 'https://st.topee.top/dream/accounts/avatars/2026/11/24/abc123456789.webp',
        expiresInSeconds: 300,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/me/avatar/upload-url',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': 'accOrdinary1',
        },
        payload: { contentType: 'image/webp', fileSizeBytes: 120_000 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.expiresInSeconds).toBe(300);
    });

    it('POST /me/deactivate should require verifyActiveAccount and invoke deactivateSelf', async () => {
      mockIdentityService.resolveRolesFromCache.mockResolvedValueOnce({
        accountId: 'accParent001',
        primaryRole: 'parent',
        effectiveRoles: ['parent'],
        adminAccount: null,
        monitorProfile: null,
        teacherProfile: null,
      });
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: { id: 'accParent001', banned_until: null } }),
      } as unknown as Response);
      mockAccountLifecycleService.deactivateSelf.mockResolvedValueOnce({ deactivated: true });

      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/me/deactivate',
        headers: {
          authorization: 'Bearer mock-access-token',
          'x-account-id': 'accParent001',
          'x-email': 'parent@topee.top',
        },
        payload: { confirmEmail: 'parent@topee.top' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual({ deactivated: true });
      expect(mockAccountLifecycleService.deactivateSelf).toHaveBeenCalledWith(
        'accParent001',
        'parent@topee.top',
        { confirmEmail: 'parent@topee.top' },
        expect.any(String)
      );
    });
  });

  describe('3. AuthAccountAdapter Unit Tests & SSE Ticket Route', () => {
    it('AuthAccountAdapter should delegate findByEmail, findByIds, and deactivation via auth-core UserProvider/SessionProvider without raw SQL', async () => {
      const mockDb = {
        executeQuery: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'accOld01',
              email: 'ops@topee.top',
              email_confirmed_at: new Date('2026-10-01T00:00:00Z'),
              banned_until: null,
              deleted_at: new Date('2026-10-15T00:00:00Z'),
              created_at: new Date('2026-10-01T00:00:00Z'),
              failed_login_attempts: 0,
            },
            {
              id: 'acc001',
              email: 'ops@topee.top',
              email_confirmed_at: new Date('2026-11-01T00:00:00Z'),
              banned_until: null,
              deleted_at: null,
              created_at: new Date('2026-11-01T00:00:00Z'),
              failed_login_attempts: 0,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'acc001',
              email: 'ops@topee.top',
              email_confirmed_at: new Date('2026-11-01T00:00:00Z'),
              banned_until: null,
              deleted_at: null,
              failed_login_attempts: 0,
            },
          ]),
      } as unknown as DatabaseService;

      const adapter = new AuthAccountAdapter(mockDb);
      const found = await adapter.findByEmail('OPS@Topee.Top');
      expect(found?.id).toBe('acc001');
      expect(found?.accountStatus).toBe('ACTIVE');
      expect((mockDb.executeQuery as jest.Mock).mock.calls[0][1]).toEqual(['ops@topee.top']);

      const byIds = await adapter.findByIds(['acc001', 'acc001']);
      expect(byIds.size).toBe(1);
      expect(byIds.get('acc001')?.email).toBe('ops@topee.top');
      expect(mockDb.executeQuery).toHaveBeenCalledTimes(2);

      const queryMock = jest.fn().mockResolvedValue({ rows: [] });
      const client = { query: queryMock } as unknown as PoolClient;
      await adapter.deactivateAccountAndRevokeSessions('acc001', client);
      expect(queryMock).toHaveBeenCalledTimes(3);
      expect(queryMock.mock.calls[0][0]).toContain('UPDATE tauth.users');
      expect(queryMock.mock.calls[1][0]).toContain('DELETE FROM tauth.sessions');
    });

    it('POST /api/notification/v1/ticket should issue an SSE ticket for valid RS256 Bearer JWT', async () => {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const savedEnv = { ...process.env };
      process.env.JWT_CURRENT_PUBLIC_KEY = publicKey;
      process.env.JWT_CURRENT_PRIVATE_KEY_CIPHER = privateKey;
      process.env.JWT_CURRENT_VERSION = 'v1';
      resetConfigCache();

      const { JwtTokenProvider } = await import('@topeetop/security-core');
      const jwtProvider = new JwtTokenProvider({
        mode: 'two-slot',
        current: { version: 'v1', publicKey, privateKey },
      });

      const sseApp = await buildApp({
        skipDbInit: true,
        identityService: mockIdentityService,
        mountAuthPlugin: false,
        mountNotificationPlugin: true,
      });
      await sseApp.ready();

      const { accessToken } = jwtProvider.signTokens({
        userId: 'accOrdinary1',
        email: 'ops@topee.top',
        sessionId: 'sess001',
      });

      const res = await sseApp.inject({
        method: 'POST',
        url: '/api/notification/v1/ticket',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      expect(typeof res.json().data.ticket).toBe('string');

      await sseApp.close();
      process.env = savedEnv;
      resetConfigCache();
    });
  });
});
