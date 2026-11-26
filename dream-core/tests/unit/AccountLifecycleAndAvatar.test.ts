/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { DatabaseService } from '@topeetop/shared-core';
import { AdminAccountMapper } from '../../src/db/AdminAccountMapper.js';
import { AuditLogMapper } from '../../src/db/AuditLogMapper.js';
import { MonitorProfileMapper } from '../../src/db/MonitorProfileMapper.js';
import { StudentProfileMapper } from '../../src/db/StudentProfileMapper.js';
import { TeacherProfileMapper } from '../../src/db/TeacherProfileMapper.js';
import {
  AccountLifecycleService,
  AuthAccountPort,
  AvatarUploadService,
  IdentityContextService,
} from '../../src/modules/identity/index.js';

describe('AccountLifecycleService & AvatarUploadService (Unit Tests)', () => {
  let mockClient: PoolClient;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockAdminMapper: jest.Mocked<Pick<AdminAccountMapper, 'findActiveByAccountId'>>;
  let mockMonitorMapper: jest.Mocked<Pick<MonitorProfileMapper, 'hasBlockingByAccountId'>>;
  let mockTeacherMapper: jest.Mocked<Pick<TeacherProfileMapper, 'hasBlockingByAccountId'>>;
  let mockStudentMapper: jest.Mocked<
    Pick<StudentProfileMapper, 'lockAccountScope' | 'countOfficialActiveByAccountId'>
  >;
  let mockAuditMapper: jest.Mocked<Pick<AuditLogMapper, 'append'>>;
  let mockIdentityService: jest.Mocked<Pick<IdentityContextService, 'invalidateRoleDirectoryCache'>>;
  let mockAuthPort: jest.Mocked<AuthAccountPort>;
  let lifecycleService: AccountLifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { query: jest.fn(), release: jest.fn() } as unknown as PoolClient;
    mockDb = {
      executeTx: jest.fn(async (cb: (client: PoolClient) => Promise<unknown>) => cb(mockClient)),
    } as unknown as jest.Mocked<DatabaseService>;

    mockAdminMapper = {
      findActiveByAccountId: jest.fn().mockResolvedValue(null),
    };
    mockMonitorMapper = {
      hasBlockingByAccountId: jest.fn().mockResolvedValue(false),
    };
    mockTeacherMapper = {
      hasBlockingByAccountId: jest.fn().mockResolvedValue(false),
    };
    mockStudentMapper = {
      lockAccountScope: jest.fn().mockResolvedValue(undefined),
      countOfficialActiveByAccountId: jest.fn().mockResolvedValue(0),
    };
    mockAuditMapper = {
      append: jest.fn().mockResolvedValue({ id: 'aud000000001' }),
    };
    mockIdentityService = {
      invalidateRoleDirectoryCache: jest.fn(),
    };
    mockAuthPort = {
      findByEmail: jest.fn(),
      findByIds: jest.fn(),
      deactivateAccountAndRevokeSessions: jest.fn().mockResolvedValue(undefined),
    };

    lifecycleService = new AccountLifecycleService({
      db: mockDb,
      adminAccountMapper: mockAdminMapper as unknown as AdminAccountMapper,
      monitorProfileMapper: mockMonitorMapper as unknown as MonitorProfileMapper,
      teacherProfileMapper: mockTeacherMapper as unknown as TeacherProfileMapper,
      studentProfileMapper: mockStudentMapper as unknown as StudentProfileMapper,
      auditLogMapper: mockAuditMapper as unknown as AuditLogMapper,
      identityContextService: mockIdentityService as unknown as IdentityContextService,
      authAccountPort: mockAuthPort,
    });
  });

  describe('AccountLifecycleService.deactivateSelf', () => {
    it('should reject mismatched confirmation email', async () => {
      await expect(
        lifecycleService.deactivateSelf('accUser0001', 'user@topee.top', {
          confirmEmail: 'other@topee.top',
        })
      ).rejects.toMatchObject({ statusCode: 400, errorCode: 'CONFIRMATION_MISMATCH' });
    });

    it('should block permanent primary master admin deactivation with 403 PERMANENT_MASTER_ADMIN_PROTECTED', async () => {
      mockAdminMapper.findActiveByAccountId.mockResolvedValueOnce({
        id: 'adm001',
        accountId: 'accMaster001',
        displayName: 'Owner',
        status: 'ACTIVE',
        isPermanentPrimary: true,
      });

      await expect(
        lifecycleService.deactivateSelf('accMaster001', 'owner@topee.top', {
          confirmEmail: 'owner@topee.top',
        })
      ).rejects.toMatchObject({ statusCode: 403, errorCode: 'PERMANENT_MASTER_ADMIN_PROTECTED' });
    });

    it('should block ordinary active admin, active students, active/frozen monitor, and active/on-leave/resigning teacher', async () => {
      mockAdminMapper.findActiveByAccountId.mockResolvedValueOnce({
        id: 'adm002',
        accountId: 'accOrd001',
        displayName: 'Ops',
        status: 'ACTIVE',
        isPermanentPrimary: false,
      });
      await expect(
        lifecycleService.deactivateSelf('accOrd001', 'ops@topee.top', {
          confirmEmail: 'ops@topee.top',
        })
      ).rejects.toMatchObject({ statusCode: 409, errorCode: 'DEACTIVATE_BLOCKED_ACTIVE_ADMIN' });

      mockStudentMapper.countOfficialActiveByAccountId.mockResolvedValueOnce(1);
      await expect(
        lifecycleService.deactivateSelf('accParent1', 'p@topee.top', { confirmEmail: 'p@topee.top' })
      ).rejects.toMatchObject({ statusCode: 409, errorCode: 'DEACTIVATE_BLOCKED_ACTIVE_STUDENTS' });

      mockMonitorMapper.hasBlockingByAccountId.mockResolvedValueOnce(true);
      await expect(
        lifecycleService.deactivateSelf('accMon001', 'm@topee.top', { confirmEmail: 'm@topee.top' })
      ).rejects.toMatchObject({ statusCode: 409, errorCode: 'DEACTIVATE_BLOCKED_ACTIVE_MONITOR' });

      mockTeacherMapper.hasBlockingByAccountId.mockResolvedValueOnce(true);
      await expect(
        lifecycleService.deactivateSelf('accTch001', 't@topee.top', { confirmEmail: 't@topee.top' })
      ).rejects.toMatchObject({ statusCode: 409, errorCode: 'DEACTIVATE_BLOCKED_ACTIVE_TEACHER' });
    });

    it('should deactivate account, revoke sessions, append audit log, and clear cache when all clearances pass', async () => {
      const res = await lifecycleService.deactivateSelf(
        'accClean001',
        'clean@topee.top',
        { confirmEmail: 'CLEAN@TOPEE.TOP' },
        'trace-deact-1'
      );

      expect(res).toEqual({ deactivated: true });
      expect(mockStudentMapper.lockAccountScope).toHaveBeenCalledWith('accClean001', mockClient);
      expect(mockAuthPort.deactivateAccountAndRevokeSessions).toHaveBeenCalledWith(
        'accClean001',
        mockClient
      );
      expect(mockAuditMapper.append).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'M0A',
          action: 'ACCOUNT_DEACTIVATED',
          targetId: 'accClean001',
          traceId: 'trace-deact-1',
        }),
        mockClient
      );
      expect(mockIdentityService.invalidateRoleDirectoryCache).toHaveBeenCalledTimes(1);
    });
  });

  describe('AvatarUploadService.createAvatarUploadUrl', () => {
    it('should validate image/webp <= 2MB and return 300s presigned PUT upload descriptor', async () => {
      const presignMock = jest.fn().mockResolvedValue('https://r2.signed.example/put');
      const avatarService = new AvatarUploadService({
        storageConfig: {
          bucket: 'topee-st',
          region: 'auto',
          endpoint: 'https://r2.example.com',
          publicDomain: 'https://st.topee.top/',
        },
        presignPutUrl: presignMock,
        now: () => new Date('2026-11-24T12:00:00Z'),
      });

      const dto = await avatarService.createAvatarUploadUrl('accUser001', {
        contentType: 'image/webp',
        fileSizeBytes: 512_000,
      });

      expect(dto.uploadUrl).toBe('https://r2.signed.example/put');
      expect(dto.expiresInSeconds).toBe(300);
      expect(dto.key).toMatch(/^dream\/accounts\/avatars\/2026\/11\/24\/[A-Za-z0-9]{12}\.webp$/);
      expect(dto.publicUrl).toBe(`https://st.topee.top/${dto.key}`);
      expect(presignMock).toHaveBeenCalledWith(dto.key, 'image/webp', 300);
    });

    it('should reject non-webp or files exceeding 2MB with 400 VALIDATION_FAILED', async () => {
      const avatarService = new AvatarUploadService({
        storageConfig: {
          bucket: 'topee-st',
          region: 'auto',
          endpoint: 'https://r2.example.com',
          publicDomain: 'https://st.topee.top',
        },
        presignPutUrl: jest.fn(),
      });

      await expect(
        avatarService.createAvatarUploadUrl('accUser001', {
          contentType: 'image/png',
          fileSizeBytes: 1000,
        })
      ).rejects.toMatchObject({ statusCode: 400, errorCode: 'VALIDATION_FAILED' });

      await expect(
        avatarService.createAvatarUploadUrl('accUser001', {
          contentType: 'image/webp',
          fileSizeBytes: 3 * 1024 * 1024,
        })
      ).rejects.toMatchObject({ statusCode: 400, errorCode: 'VALIDATION_FAILED' });
    });
  });
});
