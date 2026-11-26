/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { ApiError } from '@topeetop/shared-core';
import {
  AdminAccountMapper,
  MonitorProfileMapper,
  TeacherProfileMapper,
  StudentProfileMapper,
  UserPreferenceMapper,
} from '../../src/db/index.js';
import { IdentityContextService } from '../../src/modules/identity/index.js';

describe('IdentityContextService (Unit Tests)', () => {
  let mockAdminMapper: jest.Mocked<
    Pick<AdminAccountMapper, 'findAllActiveMinimal' | 'findActiveByAccountId'>
  >;
  let mockMonitorMapper: jest.Mocked<Pick<MonitorProfileMapper, 'findAllActiveMinimal'>>;
  let mockTeacherMapper: jest.Mocked<Pick<TeacherProfileMapper, 'findAllActiveMinimal'>>;
  let mockStudentMapper: jest.Mocked<Pick<StudentProfileMapper, 'findActiveByAccountId'>>;
  let mockPreferenceMapper: jest.Mocked<
    Pick<UserPreferenceMapper, 'findByAccountId' | 'upsertPreference'>
  >;
  let currentTimeMs: number;
  let service: IdentityContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    currentTimeMs = 1_700_000_045_000; // e.g., :05s into a minute bucket (1700000040000 + 5000)

    mockAdminMapper = {
      findAllActiveMinimal: jest.fn().mockResolvedValue([]),
      findActiveByAccountId: jest.fn().mockResolvedValue(null),
    };
    mockMonitorMapper = {
      findAllActiveMinimal: jest.fn().mockResolvedValue([]),
    };
    mockTeacherMapper = {
      findAllActiveMinimal: jest.fn().mockResolvedValue([]),
    };
    mockStudentMapper = {
      findActiveByAccountId: jest.fn().mockResolvedValue([]),
    };
    mockPreferenceMapper = {
      findByAccountId: jest.fn().mockResolvedValue(null),
      upsertPreference: jest.fn(),
    };

    service = new IdentityContextService({
      adminAccountMapper: mockAdminMapper as unknown as AdminAccountMapper,
      monitorProfileMapper: mockMonitorMapper as unknown as MonitorProfileMapper,
      teacherProfileMapper: mockTeacherMapper as unknown as TeacherProfileMapper,
      studentProfileMapper: mockStudentMapper as unknown as StudentProfileMapper,
      userPreferenceMapper: mockPreferenceMapper as unknown as UserPreferenceMapper,
      now: () => currentTimeMs,
    });
  });

  // ===========================================================================
  // 1. Single-role resolution & default locale/timezone
  // ===========================================================================
  describe('Single-role resolution & default preferences', () => {
    it('should resolve natural-person parent role with zh-CN default when no specialized role exists', async () => {
      mockStudentMapper.findActiveByAccountId.mockResolvedValueOnce([
        { id: 'stu123456789', nickname: 'AliceL8', avatarKey: 'dream/students/avatars/a.webp' },
      ]);

      const ctx = await service.resolveContext('accParent0001', 'parent@topee.top');

      expect(ctx).toEqual({
        accountId: 'accParent0001',
        emailMasked: 'pa***@topee.top',
        primaryRole: 'parent',
        effectiveRoles: ['parent'],
        adminAccount: null,
        monitorProfile: null,
        teacherProfile: null,
        studentProfiles: [
          { id: 'stu123456789', nickname: 'AliceL8', avatarKey: 'dream/students/avatars/a.webp' },
        ],
        preferences: {
          locale: 'zh-CN',
          timezone: 'Asia/Shanghai',
        },
      });
    });

    it('should resolve teacher role with en-US default locale when no preference record exists', async () => {
      mockTeacherMapper.findAllActiveMinimal.mockResolvedValueOnce([
        { id: 'tch123456789', accountId: 'accTeacher01', displayName: 'Sarah', status: 'ACTIVE' },
      ]);

      const ctx = await service.resolveContext('accTeacher01', 'sarah@topee.top');

      expect(ctx.primaryRole).toBe('teacher');
      expect(ctx.effectiveRoles).toEqual(['teacher', 'parent']);
      expect(ctx.teacherProfile).toEqual({
        id: 'tch123456789',
        displayName: 'Sarah',
        status: 'ACTIVE',
      });
      expect(ctx.adminAccount).toBeNull();
      expect(ctx.monitorProfile).toBeNull();
      expect(ctx.preferences).toEqual({
        locale: 'en-US',
        timezone: 'Asia/Shanghai',
      });
    });

    it('should resolve monitor role with zh-CN default locale', async () => {
      mockMonitorMapper.findAllActiveMinimal.mockResolvedValueOnce([
        { id: 'mon123456789', accountId: 'accMonitor01', displayName: 'Monitor Lin', status: 'ACTIVE' },
      ]);

      const ctx = await service.resolveContext('accMonitor01', 'lin@topee.top');

      expect(ctx.primaryRole).toBe('monitor');
      expect(ctx.effectiveRoles).toEqual(['monitor', 'parent']);
      expect(ctx.monitorProfile).toEqual({
        id: 'mon123456789',
        displayName: 'Monitor Lin',
        status: 'ACTIVE',
      });
      expect(ctx.preferences).toEqual({
        locale: 'zh-CN',
        timezone: 'Asia/Shanghai',
      });
    });

    it('should resolve admin role with zh-CN default locale', async () => {
      mockAdminMapper.findAllActiveMinimal.mockResolvedValueOnce([
        {
          id: 'adm123456789',
          accountId: 'accAdmin0001',
          displayName: 'Platform Owner',
          status: 'ACTIVE',
          isPermanentPrimary: true,
        },
      ]);

      const ctx = await service.resolveContext('accAdmin0001', 'admin@topee.top');

      expect(ctx.primaryRole).toBe('admin');
      expect(ctx.effectiveRoles).toEqual(['admin', 'parent']);
      expect(ctx.adminAccount).toEqual({
        id: 'adm123456789',
        displayName: 'Platform Owner',
        isPermanentPrimary: true,
      });
      expect(ctx.preferences).toEqual({
        locale: 'zh-CN',
        timezone: 'Asia/Shanghai',
      });
    });

    it('should honor persisted user preferences over role defaults', async () => {
      mockTeacherMapper.findAllActiveMinimal.mockResolvedValueOnce([
        { id: 'tch123456789', accountId: 'accTeacher01', displayName: 'Sarah', status: 'ACTIVE' },
      ]);
      mockPreferenceMapper.findByAccountId.mockResolvedValueOnce({
        id: 'upf123456789',
        accountId: 'accTeacher01',
        locale: 'zh-CN',
        timezone: 'America/New_York',
      });

      const ctx = await service.resolveContext('accTeacher01', 'sarah@topee.top');

      expect(ctx.preferences).toEqual({
        locale: 'zh-CN',
        timezone: 'America/New_York',
      });
    });
  });

  // ===========================================================================
  // 2. Multi-role priority (admin > monitor > teacher > parent)
  // ===========================================================================
  describe('Multi-role priority resolution', () => {
    it('should prioritize monitor over parent when account holds monitor + parent', async () => {
      mockMonitorMapper.findAllActiveMinimal.mockResolvedValueOnce([
        { id: 'mon123456789', accountId: 'accMulti0001', displayName: 'Monitor Chen', status: 'ACTIVE' },
      ]);

      const snapshot = await service.resolveRolesFromCache('accMulti0001');

      expect(snapshot.primaryRole).toBe('monitor');
      expect(snapshot.effectiveRoles).toEqual(['monitor', 'parent']);
      expect(snapshot.monitorProfile).toEqual({
        id: 'mon123456789',
        displayName: 'Monitor Chen',
        status: 'ACTIVE',
      });
    });

    it('should prioritize admin > monitor > teacher > parent when account holds multiple roles', async () => {
      mockAdminMapper.findAllActiveMinimal.mockResolvedValueOnce([
        {
          id: 'adm123456789',
          accountId: 'accSuper0001',
          displayName: 'Super Ops',
          status: 'ACTIVE',
          isPermanentPrimary: false,
        },
      ]);
      mockMonitorMapper.findAllActiveMinimal.mockResolvedValueOnce([
        { id: 'mon123456789', accountId: 'accSuper0001', displayName: 'Monitor Super', status: 'ACTIVE' },
      ]);
      mockTeacherMapper.findAllActiveMinimal.mockResolvedValueOnce([
        { id: 'tch123456789', accountId: 'accSuper0001', displayName: 'Teacher Super', status: 'ACTIVE' },
      ]);

      const snapshot = await service.resolveRolesFromCache('accSuper0001');

      expect(snapshot.primaryRole).toBe('admin');
      expect(snapshot.effectiveRoles).toEqual(['admin', 'monitor', 'teacher', 'parent']);
      expect(snapshot.adminAccount).toEqual({
        id: 'adm123456789',
        displayName: 'Super Ops',
        isPermanentPrimary: false,
      });
      expect(snapshot.monitorProfile).toEqual({
        id: 'mon123456789',
        displayName: 'Monitor Super',
        status: 'ACTIVE',
      });
      expect(snapshot.teacherProfile).toEqual({
        id: 'tch123456789',
        displayName: 'Teacher Super',
        status: 'ACTIVE',
      });
    });

    it('should prioritize monitor > teacher > parent when account is both monitor and teacher', async () => {
      mockMonitorMapper.findAllActiveMinimal.mockResolvedValueOnce([
        { id: 'mon123456789', accountId: 'accMonTch001', displayName: 'MonTch', status: 'ACTIVE' },
      ]);
      mockTeacherMapper.findAllActiveMinimal.mockResolvedValueOnce([
        { id: 'tch123456789', accountId: 'accMonTch001', displayName: 'MonTch', status: 'ON_LEAVE' },
      ]);

      const snapshot = await service.resolveRolesFromCache('accMonTch001');

      expect(snapshot.primaryRole).toBe('monitor');
      expect(snapshot.effectiveRoles).toEqual(['monitor', 'teacher', 'parent']);
    });
  });

  // ===========================================================================
  // 3. Same-minute cache hit (0-60s)
  // ===========================================================================
  describe('0-60s minute-boundary directory cache', () => {
    it('should hit cache within the same minute (:05 -> :59.999) with 0 extra DB queries', async () => {
      currentTimeMs = 60_000 * 100 + 5_000; // :05.000

      mockAdminMapper.findAllActiveMinimal.mockResolvedValue([
        {
          id: 'adm000000001',
          accountId: 'acc001',
          displayName: 'Admin 1',
          status: 'ACTIVE',
          isPermanentPrimary: false,
        },
      ]);

      const first = await service.resolveRolesFromCache('acc001');
      expect(first.primaryRole).toBe('admin');
      expect(mockAdminMapper.findAllActiveMinimal).toHaveBeenCalledTimes(1);
      expect(mockMonitorMapper.findAllActiveMinimal).toHaveBeenCalledTimes(1);
      expect(mockTeacherMapper.findAllActiveMinimal).toHaveBeenCalledTimes(1);

      // Advance to :59.999 of the same minute bucket
      currentTimeMs = 60_000 * 100 + 59_999;

      const second = await service.resolveRolesFromCache('acc001');
      const third = await service.resolveRolesFromCache('acc002');

      expect(second.primaryRole).toBe('admin');
      expect(third.primaryRole).toBe('parent');
      expect(mockAdminMapper.findAllActiveMinimal).toHaveBeenCalledTimes(1);
      expect(mockMonitorMapper.findAllActiveMinimal).toHaveBeenCalledTimes(1);
      expect(mockTeacherMapper.findAllActiveMinimal).toHaveBeenCalledTimes(1);
    });

    // =========================================================================
    // 4. Minute-boundary :00 expiration
    // =========================================================================
    it('should automatically refresh directory when crossing minute boundary (59_999 -> 60_000)', async () => {
      currentTimeMs = 59_999;

      mockMonitorMapper.findAllActiveMinimal.mockResolvedValueOnce([
        { id: 'mon001', accountId: 'acc001', displayName: 'M1', status: 'ACTIVE' },
      ]);

      const beforeBoundary = await service.resolveRolesFromCache('acc001');
      expect(beforeBoundary.primaryRole).toBe('monitor');
      expect(mockMonitorMapper.findAllActiveMinimal).toHaveBeenCalledTimes(1);

      // Cross :00 boundary -> new minute bucket
      currentTimeMs = 60_000;
      mockMonitorMapper.findAllActiveMinimal.mockResolvedValueOnce([
        { id: 'mon001', accountId: 'acc001', displayName: 'M1', status: 'ACTIVE' },
        { id: 'mon002', accountId: 'acc002', displayName: 'M2', status: 'ACTIVE' },
      ]);

      const afterBoundary = await service.resolveRolesFromCache('acc002');
      expect(afterBoundary.primaryRole).toBe('monitor');
      expect(mockAdminMapper.findAllActiveMinimal).toHaveBeenCalledTimes(2);
      expect(mockMonitorMapper.findAllActiveMinimal).toHaveBeenCalledTimes(2);
      expect(mockTeacherMapper.findAllActiveMinimal).toHaveBeenCalledTimes(2);
    });

    // =========================================================================
    // 5. Concurrent single-flight lock at :00
    // =========================================================================
    it('should deduplicate concurrent refreshes at :00 using single-flight lock', async () => {
      currentTimeMs = 120_000;

      let resolveAdmins!: (
        val: Array<{
          id: string;
          accountId: string;
          displayName: string;
          status: 'ACTIVE';
          isPermanentPrimary: boolean;
        }>
      ) => void;
      mockAdminMapper.findAllActiveMinimal.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveAdmins = resolve;
          })
      );
      mockMonitorMapper.findAllActiveMinimal.mockResolvedValueOnce([]);
      mockTeacherMapper.findAllActiveMinimal.mockResolvedValueOnce([]);

      const pending = Promise.all([
        service.resolveRolesFromCache('acc1'),
        service.resolveRolesFromCache('acc2'),
        service.resolveRolesFromCache('acc1'),
        service.resolveRolesFromCache('acc3'),
        service.resolveRolesFromCache('acc1'),
      ]);

      // Allow microtasks to kick off the single-flight query
      await Promise.resolve();
      resolveAdmins([
        {
          id: 'adm1',
          accountId: 'acc1',
          displayName: 'Admin 1',
          status: 'ACTIVE',
          isPermanentPrimary: false,
        },
      ]);

      const results = await pending;
      expect(results[0].primaryRole).toBe('admin');
      expect(results[1].primaryRole).toBe('parent');
      expect(results[2].primaryRole).toBe('admin');
      expect(results[3].primaryRole).toBe('parent');
      expect(results[4].primaryRole).toBe('admin');

      expect(mockAdminMapper.findAllActiveMinimal).toHaveBeenCalledTimes(1);
      expect(mockMonitorMapper.findAllActiveMinimal).toHaveBeenCalledTimes(1);
      expect(mockTeacherMapper.findAllActiveMinimal).toHaveBeenCalledTimes(1);
    });

    // =========================================================================
    // 6. Manual invalidation
    // =========================================================================
    it('invalidateRoleDirectoryCache() should force directory reload on next call within the same minute', async () => {
      currentTimeMs = 60_000 * 50 + 10_000;

      mockTeacherMapper.findAllActiveMinimal.mockResolvedValueOnce([]);
      const before = await service.resolveRolesFromCache('accNewTeacher');
      expect(before.primaryRole).toBe('parent');
      expect(mockTeacherMapper.findAllActiveMinimal).toHaveBeenCalledTimes(1);

      // Invalidate cache after creating a teacher binding
      service.invalidateRoleDirectoryCache();
      mockTeacherMapper.findAllActiveMinimal.mockResolvedValueOnce([
        {
          id: 'tch999999999',
          accountId: 'accNewTeacher',
          displayName: 'New Teacher',
          status: 'ACTIVE',
        },
      ]);

      const after = await service.resolveRolesFromCache('accNewTeacher');
      expect(after.primaryRole).toBe('teacher');
      expect(mockTeacherMapper.findAllActiveMinimal).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // 7. X-Profile-Id ownership validation & IDOR guard
  // ===========================================================================
  describe('X-Profile-Id ownership & IDOR defense', () => {
    it('should return currentStudentProfileId when requestedProfileId belongs to the account', async () => {
      mockStudentMapper.findActiveByAccountId.mockResolvedValueOnce([
        { id: 'stu000000001', nickname: 'LeoW7', avatarKey: null },
        { id: 'stu000000002', nickname: 'MiaW5', avatarKey: 'dream/students/avatars/mia.webp' },
      ]);

      const ctx = await service.resolveContext('accParent01', 'p@topee.top', 'stu000000002');

      expect(ctx.currentStudentProfileId).toBe('stu000000002');
      expect(ctx.studentProfiles).toHaveLength(2);
    });

    it('should throw 403 PROFILE_ACCESS_DENIED when requestedProfileId does not belong to the account', async () => {
      mockStudentMapper.findActiveByAccountId.mockResolvedValueOnce([
        { id: 'stu000000001', nickname: 'LeoW7', avatarKey: null },
      ]);

      await expect(
        service.resolveContext('accParent01', 'p@topee.top', 'stuOther9999')
      ).rejects.toMatchObject({
        statusCode: 403,
        errorCode: 'PROFILE_ACCESS_DENIED',
        message: 'Forbidden: Student profile does not belong to your account',
      });

      try {
        mockStudentMapper.findActiveByAccountId.mockResolvedValueOnce([]);
        await service.resolveContext('accParent01', 'p@topee.top', 'stuOther9999');
        fail('Expected ApiError to be thrown');
      } catch (err) {
        expect(ApiError.isApiError(err)).toBe(true);
      }
    });
  });

  // ===========================================================================
  // 8. updatePreferences validation & persistence
  // ===========================================================================
  describe('updatePreferences', () => {
    it('should validate and persist valid locale and timezone updates', async () => {
      const updatedRecord = {
        id: 'upf123456789',
        accountId: 'acc001',
        locale: 'en-US' as const,
        timezone: 'America/Los_Angeles',
      };
      mockPreferenceMapper.upsertPreference.mockResolvedValueOnce(updatedRecord);

      const result = await service.updatePreferences('acc001', {
        locale: 'en-US',
        timezone: 'America/Los_Angeles',
      });

      expect(result).toEqual(updatedRecord);
      expect(mockPreferenceMapper.upsertPreference).toHaveBeenCalledWith('acc001', {
        locale: 'en-US',
        timezone: 'America/Los_Angeles',
      });
    });

    it('should throw 400 VALIDATION_FAILED when locale is invalid', async () => {
      await expect(
        service.updatePreferences('acc001', { locale: 'fr-FR' })
      ).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'VALIDATION_FAILED',
        message: 'Validation failed',
      });

      expect(mockPreferenceMapper.upsertPreference).not.toHaveBeenCalled();
    });

    it('should throw 400 VALIDATION_FAILED when timezone is empty or exceeds 64 chars', async () => {
      await expect(service.updatePreferences('acc001', { timezone: '' })).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'VALIDATION_FAILED',
      });

      await expect(
        service.updatePreferences('acc001', { timezone: 'A'.repeat(65) })
      ).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'VALIDATION_FAILED',
      });

      expect(mockPreferenceMapper.upsertPreference).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 9. verifyPermanentMasterAdminFromDb (bypass cache)
  // ===========================================================================
  describe('verifyPermanentMasterAdminFromDb', () => {
    it('should query DB directly and allow active permanent primary admin', async () => {
      mockAdminMapper.findActiveByAccountId.mockResolvedValueOnce({
        id: 'admPrimary001',
        accountId: 'accMaster0001',
        displayName: 'Owner',
        status: 'ACTIVE',
        isPermanentPrimary: true,
      });

      const res = await service.verifyPermanentMasterAdminFromDb('accMaster0001');
      expect(res.isPermanentPrimary).toBe(true);
      expect(mockAdminMapper.findActiveByAccountId).toHaveBeenCalledWith('accMaster0001');
    });

    it('should reject ordinary admin with 403 PERMANENT_MASTER_ADMIN_REQUIRED', async () => {
      mockAdminMapper.findActiveByAccountId.mockResolvedValueOnce({
        id: 'admOrdinary01',
        accountId: 'accOrdinary01',
        displayName: 'Ops',
        status: 'ACTIVE',
        isPermanentPrimary: false,
      });

      await expect(
        service.verifyPermanentMasterAdminFromDb('accOrdinary01')
      ).rejects.toMatchObject({
        statusCode: 403,
        errorCode: 'PERMANENT_MASTER_ADMIN_REQUIRED',
      });
    });
  });
});
