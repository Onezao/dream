/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { DatabaseService } from '@topeetop/shared-core';
import {
  AdminAccountMapper,
  AuditLogMapper,
  UserPreferenceMapper,
  MonitorProfileMapper,
  TeacherProfileMapper,
  StudentProfileMapper,
} from '../../src/db/index.js';

function createMockClient(): { client: PoolClient; queryMock: jest.Mock } {
  const queryMock = jest.fn();
  const client = {
    query: queryMock,
    release: jest.fn(),
  } as unknown as PoolClient;
  return { client, queryMock };
}

describe('Identity & Preference Mappers (DI Unit Tests)', () => {
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      executeQuery: jest.fn(),
      getOne: jest.fn(),
    } as unknown as jest.Mocked<DatabaseService>;
  });

  // ===========================================================================
  // 1. AdminAccountMapper
  // ===========================================================================
  describe('AdminAccountMapper', () => {
    let mapper: AdminAccountMapper;

    beforeEach(() => {
      mapper = new AdminAccountMapper(mockDb);
    });

    it('findAllActiveMinimal should query dream.admin_accounts with ACTIVE, is_permanent_primary, display_name and deleted_at IS NULL filters', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([
        {
          id: 'adm123456789',
          account_id: 'acc123456789',
          display_name: 'Master Admin',
          status: 'ACTIVE',
          is_permanent_primary: true,
        },
      ]);

      const result = await mapper.findAllActiveMinimal();

      expect(result).toEqual([
        {
          id: 'adm123456789',
          accountId: 'acc123456789',
          displayName: 'Master Admin',
          status: 'ACTIVE',
          isPermanentPrimary: true,
        },
      ]);
      expect(mockDb.executeQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockDb.executeQuery.mock.calls[0];
      expect(sql).toContain('FROM dream.admin_accounts');
      expect(sql).toContain("status = 'ACTIVE'");
      expect(sql).toContain('deleted_at IS NULL');
      expect(sql).toContain('is_permanent_primary');
      expect(params).toEqual([]);
    });

    it('findActiveByAccountId should return minimal admin record including isPermanentPrimary when active', async () => {
      mockDb.getOne.mockResolvedValueOnce({
        id: 'adm123456789',
        account_id: 'acc123456789',
        display_name: 'Master Admin',
        status: 'ACTIVE',
        is_permanent_primary: true,
      });

      const result = await mapper.findActiveByAccountId('acc123456789');

      expect(result).toEqual({
        id: 'adm123456789',
        accountId: 'acc123456789',
        displayName: 'Master Admin',
        status: 'ACTIVE',
        isPermanentPrimary: true,
      });
      const [sql, params] = mockDb.getOne.mock.calls[0];
      expect(sql).toContain('FROM dream.admin_accounts');
      expect(sql).toContain("account_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL");
      expect(sql).toContain('LIMIT 1');
      expect(params).toEqual(['acc123456789']);
    });

    it('findActiveByAccountId should return null when no matching active admin exists', async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      const result = await mapper.findActiveByAccountId('acc000000000');
      expect(result).toBeNull();
    });

    it('listAll should order permanent primary first, then ACTIVE, then REVOKED', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([
        {
          id: 'adm000000001',
          account_id: 'acc000000001',
          display_name: 'Owner',
          status: 'ACTIVE',
          is_permanent_primary: true,
          note: null,
          granted_by: null,
          granted_at: '2026-11-20T00:00:00Z',
          revoked_by: null,
          revoked_at: null,
          created_at: '2026-11-20T00:00:00Z',
          updated_at: '2026-11-20T00:00:00Z',
          deleted_at: null,
        },
      ]);

      const rows = await mapper.listAll();
      expect(rows).toHaveLength(1);
      expect(rows[0].isPermanentPrimary).toBe(true);
      expect(rows[0].displayName).toBe('Owner');
      const [sql] = mockDb.executeQuery.mock.calls[0];
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('is_permanent_primary DESC');
    });

    it('create, reactivate, updateDisplayName, and revoke should enforce V1.1 constraints', async () => {
      const { client, queryMock } = createMockClient();
      const baseRow = {
        id: 'adm111111111',
        account_id: 'acc222222222',
        display_name: 'Ops One',
        status: 'ACTIVE',
        is_permanent_primary: false,
        note: null,
        granted_by: 'acc000000001',
        granted_at: new Date('2026-11-24T00:00:00Z'),
        revoked_by: null,
        revoked_at: null,
        created_at: new Date('2026-11-24T00:00:00Z'),
        updated_at: new Date('2026-11-24T00:00:00Z'),
        deleted_at: null,
      };

      queryMock
        .mockResolvedValueOnce({ rows: [baseRow] })
        .mockResolvedValueOnce({ rows: [{ ...baseRow, display_name: 'Ops Two' }] })
        .mockResolvedValueOnce({ rows: [{ ...baseRow, status: 'REVOKED', revoked_by: 'acc000000001' }] });

      const created = await mapper.create(
        { accountId: 'acc222222222', displayName: 'Ops One', grantedBy: 'acc000000001' },
        client
      );
      expect(created.accountId).toBe('acc222222222');

      const renamed = await mapper.updateDisplayName('adm111111111', 'Ops Two', client);
      expect(renamed?.displayName).toBe('Ops Two');

      const revoked = await mapper.revoke('adm111111111', 'acc000000001', client);
      expect(revoked?.status).toBe('REVOKED');
      const [revokeSql] = queryMock.mock.calls[2];
      expect(revokeSql).toContain('is_permanent_primary = FALSE');
    });

    it('should forward PoolClient in transaction queries', async () => {
      const { client, queryMock } = createMockClient();
      queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 'adm123456789',
            account_id: 'acc123456789',
            display_name: 'Ops',
            status: 'ACTIVE',
            is_permanent_primary: false,
          },
        ],
      });

      const result = await mapper.findActiveByAccountId('acc123456789', client);
      expect(result?.id).toBe('adm123456789');
      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(mockDb.getOne).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 1b. AuditLogMapper
  // ===========================================================================
  describe('AuditLogMapper', () => {
    let mapper: AuditLogMapper;

    beforeEach(() => {
      mapper = new AuditLogMapper(mockDb);
    });

    it('append should insert immutable audit record into dream.audit_logs with 12-char id', async () => {
      mockDb.getOne.mockResolvedValueOnce({
        id: 'aud123456789',
        actor_account_id: 'acc000000001',
        module: 'M0A',
        action: 'ADMIN_REVOKED',
        target_type: 'admin_account',
        target_id: 'adm222222222',
        before_state: { status: 'ACTIVE' },
        after_state: { status: 'REVOKED' },
        trace_id: 'trace-xyz',
        created_at: new Date('2026-11-24T00:00:00Z'),
      });

      const record = await mapper.append({
        actorAccountId: 'acc000000001',
        module: 'M0A',
        action: 'ADMIN_REVOKED',
        targetType: 'admin_account',
        targetId: 'adm222222222',
        beforeState: { status: 'ACTIVE' },
        afterState: { status: 'REVOKED' },
        traceId: 'trace-xyz',
      });

      expect(record.action).toBe('ADMIN_REVOKED');
      expect(record.traceId).toBe('trace-xyz');
      const [sql, params] = mockDb.getOne.mock.calls[0];
      expect(sql).toContain('INSERT INTO dream.audit_logs');
      expect(typeof (params?.[0])).toBe('string');
      expect((params?.[0] as string).length).toBe(12);
    });
  });

  // ===========================================================================
  // 2. UserPreferenceMapper
  // ===========================================================================
  describe('UserPreferenceMapper', () => {
    let mapper: UserPreferenceMapper;

    beforeEach(() => {
      mapper = new UserPreferenceMapper(mockDb);
    });

    it('findByAccountId should query dream.user_preferences and return camelCase record', async () => {
      mockDb.getOne.mockResolvedValueOnce({
        id: 'upf123456789',
        account_id: 'acc123456789',
        locale: 'en-US',
        timezone: 'America/New_York',
        created_at: new Date('2026-11-18T10:00:00Z'),
        updated_at: new Date('2026-11-18T10:00:00Z'),
      });

      const result = await mapper.findByAccountId('acc123456789');

      expect(result).toEqual({
        id: 'upf123456789',
        accountId: 'acc123456789',
        locale: 'en-US',
        timezone: 'America/New_York',
      });
      const [sql, params] = mockDb.getOne.mock.calls[0];
      expect(sql).toContain('FROM dream.user_preferences');
      expect(sql).toContain('WHERE account_id = $1');
      expect(params).toEqual(['acc123456789']);
    });

    it('findByAccountId should return null when preference does not exist', async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      const result = await mapper.findByAccountId('acc000000000');
      expect(result).toBeNull();
    });

    it('upsertPreference should generate 12-char ID and perform ON CONFLICT upsert on dream.user_preferences', async () => {
      mockDb.getOne.mockResolvedValueOnce({
        id: 'upf987654321',
        account_id: 'acc123456789',
        locale: 'en-US',
        timezone: 'Asia/Shanghai',
        created_at: new Date('2026-11-18T10:00:00Z'),
        updated_at: new Date('2026-11-18T10:00:00Z'),
      });

      const result = await mapper.upsertPreference('acc123456789', {
        locale: 'en-US',
      });

      expect(result).toEqual({
        id: 'upf987654321',
        accountId: 'acc123456789',
        locale: 'en-US',
        timezone: 'Asia/Shanghai',
      });

      expect(mockDb.getOne).toHaveBeenCalledTimes(1);
      const [sql, rawParams] = mockDb.getOne.mock.calls[0];
      const params = rawParams ?? [];
      expect(sql).toContain('INSERT INTO dream.user_preferences');
      expect(sql).toContain('ON CONFLICT (account_id) DO UPDATE SET');
      expect(sql).toContain('locale = COALESCE($3, dream.user_preferences.locale)');
      expect(sql).toContain('timezone = COALESCE($4, dream.user_preferences.timezone)');
      expect(sql).toContain('RETURNING *');

      expect(typeof params[0]).toBe('string');
      expect((params[0] as string).length).toBe(12);
      expect(params[1]).toBe('acc123456789');
      expect(params[2]).toBe('en-US');
      expect(params[3]).toBeNull();
    });

    it('upsertPreference should throw English error when no row is returned', async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      await expect(
        mapper.upsertPreference('acc123456789', { timezone: 'UTC' })
      ).rejects.toThrow('Failed to upsert user preference record: no row returned');
    });
  });

  // ===========================================================================
  // 3. MonitorProfileMapper
  // ===========================================================================
  describe('MonitorProfileMapper', () => {
    let mapper: MonitorProfileMapper;

    beforeEach(() => {
      mapper = new MonitorProfileMapper(mockDb);
    });

    it('findAllActiveMinimal should filter status IN (ACTIVE, HANDOVER_FROZEN) and deleted_at IS NULL with dream. prefix', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([
        {
          id: 'mp1234567890',
          account_id: 'acc123456789',
          display_name: 'Sarah 班长',
          status: 'ACTIVE',
        },
      ]);

      const result = await mapper.findAllActiveMinimal();

      expect(result).toEqual([
        {
          id: 'mp1234567890',
          accountId: 'acc123456789',
          displayName: 'Sarah 班长',
          status: 'ACTIVE',
        },
      ]);
      const [sql, params] = mockDb.executeQuery.mock.calls[0];
      expect(sql).toContain('SELECT id, account_id, display_name, status');
      expect(sql).toContain('FROM dream.monitor_profiles');
      expect(sql).toContain("WHERE status IN ('ACTIVE', 'HANDOVER_FROZEN') AND deleted_at IS NULL");
      expect(params).toEqual([]);
    });

    it('hasBlockingByAccountId should return true when ACTIVE or HANDOVER_FROZEN monitor exists', async () => {
      mockDb.getOne.mockResolvedValueOnce({ '?column?': 1 });

      const blocking = await mapper.hasBlockingByAccountId('acc123456789');
      expect(blocking).toBe(true);
      const [sql, params] = mockDb.getOne.mock.calls[0];
      expect(sql).toContain("status IN ('ACTIVE', 'HANDOVER_FROZEN')");
      expect(params).toEqual(['acc123456789']);
    });

    it('findActiveByAccountId should filter status = ACTIVE and deleted_at IS NULL', async () => {
      mockDb.getOne.mockResolvedValueOnce({
        id: 'mp1234567890',
        account_id: 'acc123456789',
        display_name: 'Sarah 班长',
        phone: '+8613800000000',
        created_at: new Date('2026-11-04T10:00:00Z'),
        updated_at: new Date('2026-11-04T10:00:00Z'),
        deleted_at: null,
      });

      const result = await mapper.findActiveByAccountId('acc123456789');

      expect(result?.id).toBe('mp1234567890');
      expect(result?.accountId).toBe('acc123456789');
      const [sql, params] = mockDb.getOne.mock.calls[0];
      expect(sql).toContain('FROM dream.monitor_profiles');
      expect(sql).toContain("WHERE account_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL");
      expect(params).toEqual(['acc123456789']);
    });
  });

  // ===========================================================================
  // 4. TeacherProfileMapper
  // ===========================================================================
  describe('TeacherProfileMapper', () => {
    let mapper: TeacherProfileMapper;

    beforeEach(() => {
      mapper = new TeacherProfileMapper(mockDb);
    });

    it('findAllActiveMinimal should filter account_id IS NOT NULL, status IN (ACTIVE, ON_LEAVE, RESIGNING), deleted_at IS NULL', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([
        {
          id: 'tp1234567890',
          account_id: 'acc999999999',
          display_name: 'Emma Johnson',
          status: 'ON_LEAVE',
        },
      ]);

      const result = await mapper.findAllActiveMinimal();

      expect(result).toEqual([
        {
          id: 'tp1234567890',
          accountId: 'acc999999999',
          displayName: 'Emma Johnson',
          status: 'ON_LEAVE',
        },
      ]);
      const [sql, params] = mockDb.executeQuery.mock.calls[0];
      expect(sql).toContain('SELECT id, account_id, display_name, status');
      expect(sql).toContain('FROM dream.teacher_profiles');
      expect(sql).toContain('account_id IS NOT NULL');
      expect(sql).toContain("status IN ('ACTIVE', 'ON_LEAVE', 'RESIGNING')");
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual([]);
    });

    it('hasBlockingByAccountId should return true when ACTIVE, ON_LEAVE, or RESIGNING teacher exists', async () => {
      mockDb.getOne.mockResolvedValueOnce({ '?column?': 1 });

      const blocking = await mapper.hasBlockingByAccountId('acc999999999');
      expect(blocking).toBe(true);
      const [sql, params] = mockDb.getOne.mock.calls[0];
      expect(sql).toContain("status IN ('ACTIVE', 'ON_LEAVE', 'RESIGNING')");
      expect(params).toEqual(['acc999999999']);
    });
  });

  // ===========================================================================
  // 5. StudentProfileMapper
  // ===========================================================================
  describe('StudentProfileMapper', () => {
    let mapper: StudentProfileMapper;

    beforeEach(() => {
      mapper = new StudentProfileMapper(mockDb);
    });

    it('findActiveByAccountId should filter account_id, status = ACTIVE, deleted_at IS NULL ordered by created_at ASC', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([
        {
          id: 'sp1234567890',
          nickname: 'AliceZ12',
          avatar_key: 'dream/students/avatars/2026/11/04/abc.png',
        },
        {
          id: 'sp0987654321',
          nickname: 'BobZ09',
          avatar_key: null,
        },
      ]);

      const result = await mapper.findActiveByAccountId('acc123456789');

      expect(result).toEqual([
        {
          id: 'sp1234567890',
          nickname: 'AliceZ12',
          avatarKey: 'dream/students/avatars/2026/11/04/abc.png',
        },
        {
          id: 'sp0987654321',
          nickname: 'BobZ09',
          avatarKey: null,
        },
      ]);
      const [sql, params] = mockDb.executeQuery.mock.calls[0];
      expect(sql).toContain('SELECT id, nickname, avatar_key');
      expect(sql).toContain('FROM dream.student_profiles');
      expect(sql).toContain("WHERE account_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL");
      expect(sql).toContain('ORDER BY created_at ASC');
      expect(params).toEqual(['acc123456789']);
    });

    it('isOwnedByAccount should return true when active owned student profile exists', async () => {
      mockDb.getOne.mockResolvedValueOnce({ '?column?': 1 });

      const owned = await mapper.isOwnedByAccount('sp1234567890', 'acc123456789');

      expect(owned).toBe(true);
      const [sql, params] = mockDb.getOne.mock.calls[0];
      expect(sql).toContain('SELECT 1');
      expect(sql).toContain('FROM dream.student_profiles');
      expect(sql).toContain(
        "WHERE id = $1 AND account_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL"
      );
      expect(sql).toContain('LIMIT 1');
      expect(params).toEqual(['sp1234567890', 'acc123456789']);
    });

    it('isOwnedByAccount should return false when profile does not belong to account or is not ACTIVE', async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      const owned = await mapper.isOwnedByAccount('sp1234567890', 'acc999999999');
      expect(owned).toBe(false);
    });

    it('countOfficialActiveByAccountId should count ACTIVE student profiles only', async () => {
      mockDb.getOne.mockResolvedValueOnce({ total: 2 });

      const count = await mapper.countOfficialActiveByAccountId('acc123456789');
      expect(count).toBe(2);
      const [sql, params] = mockDb.getOne.mock.calls[0];
      expect(sql).toContain("account_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL");
      expect(params).toEqual(['acc123456789']);
    });

    it('isOwnedByAccount should support PoolClient in transaction', async () => {
      const { client, queryMock } = createMockClient();
      queryMock.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const owned = await mapper.isOwnedByAccount('sp1234567890', 'acc123456789', client);
      expect(owned).toBe(true);
      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(mockDb.getOne).not.toHaveBeenCalled();
    });
  });
});
