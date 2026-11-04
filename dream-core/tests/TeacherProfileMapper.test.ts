/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { DatabaseService } from '@topeetop/shared-core';
import {
  CourseTypeMapper,
  TeacherLevelMapper,
  MonitorProfileMapper,
  TeacherProfileMapper,
} from '../src/db/index.js';
import {
  CourseTypeRow,
  TeacherLevelRow,
  MonitorProfileRow,
  TeacherProfileRow,
  TeacherProfileWithDetailsRow,
  CreateCourseTypeDbInput,
  CreateTeacherLevelDbInput,
  CreateMonitorProfileDbInput,
  CreateTeacherProfileDbInput,
} from '../src/types/index.js';

jest.mock('@topeetop/shared-core', () => {
  const actual = jest.requireActual('@topeetop/shared-core');
  return {
    ...actual,
    executeQuery: jest.fn(),
    getOne: jest.fn(),
  };
});

function createMockClient(): { client: PoolClient; queryMock: jest.Mock } {
  const queryMock = jest.fn();
  const client = {
    query: queryMock,
    release: jest.fn(),
  } as unknown as PoolClient;
  return { client, queryMock };
}

describe('TeacherProfile Mappers Test Suite', () => {
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      executeQuery: jest.fn(),
      getOne: jest.fn(),
      executeTx: jest.fn(),
      getPool: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<DatabaseService>;
  });

  // ===========================================================================
  // 1. CourseTypeMapper
  // ===========================================================================
  describe('CourseTypeMapper', () => {
    let mapper: CourseTypeMapper;

    const mockRow: CourseTypeRow = {
      id: 'ct1234567890',
      name: '自然拼读',
      sort_order: 1,
      is_active: true,
      created_at: new Date('2026-11-04T10:00:00Z'),
      updated_at: new Date('2026-11-04T10:00:00Z'),
    };

    beforeEach(() => {
      mapper = new CourseTypeMapper(mockDb);
    });

    it('should create a course type with generated/provided ID', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const input: CreateCourseTypeDbInput = {
        name: '自然拼读',
        sortOrder: 1,
        isActive: true,
      };

      const result = await mapper.create(input);

      expect(mockDb.getOne).toHaveBeenCalledTimes(1);
      const [sql, params] = mockDb.getOne.mock.calls[0];
      expect(sql).toContain('INSERT INTO dream.course_types');
      expect((params as unknown[])[1]).toBe('自然拼读');
      expect(result.id).toBe('ct1234567890');
      expect(result.name).toBe('自然拼读');
      expect(result.sortOrder).toBe(1);
      expect(result.isActive).toBe(true);
    });

    it('should throw if creation returns no row', async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      await expect(
        mapper.create({ name: '语法进阶' })
      ).rejects.toThrow('Failed to create course type record');
    });

    it('should find by id', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const result = await mapper.findById('ct1234567890');
      expect(result?.name).toBe('自然拼读');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['ct1234567890']
      );
    });

    it('should find by name', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const result = await mapper.findByName('自然拼读');
      expect(result?.id).toBe('ct1234567890');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE name = $1'),
        ['自然拼读']
      );
    });

    it('should find by ids returning empty array when input is empty', async () => {
      const result = await mapper.findByIds([]);
      expect(result).toEqual([]);
      expect(mockDb.executeQuery).not.toHaveBeenCalled();
    });

    it('should find by ids using ANY($1::text[])', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([mockRow]);

      const result = await mapper.findByIds(['ct1234567890']);
      expect(result).toHaveLength(1);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ANY($1::text[])'),
        [['ct1234567890']]
      );
    });

    it('should list all with activeOnly filter', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([mockRow]);

      const activeList = await mapper.listAll({ activeOnly: true });
      expect(activeList).toHaveLength(1);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = true'),
        []
      );

      mockDb.executeQuery.mockResolvedValueOnce([mockRow]);
      const allList = await mapper.listAll();
      expect(allList).toHaveLength(1);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.not.stringContaining('WHERE is_active = true'),
        []
      );
    });

    it('should update course type fields', async () => {
      const updatedRow: CourseTypeRow = {
        ...mockRow,
        name: '自然拼读 Level 2',
        sort_order: 2,
        is_active: false,
      };
      mockDb.getOne.mockResolvedValueOnce(updatedRow);

      const result = await mapper.update('ct1234567890', {
        name: '自然拼读 Level 2',
        sortOrder: 2,
        isActive: false,
      });

      expect(result?.name).toBe('自然拼读 Level 2');
      expect(result?.sortOrder).toBe(2);
      expect(result?.isActive).toBe(false);
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE dream.course_types'),
        ['ct1234567890', '自然拼读 Level 2', 2, false]
      );
    });

    it('should fallback to findById if update data has no fields', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const result = await mapper.update('ct1234567890', {});
      expect(result?.id).toBe('ct1234567890');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT *'),
        ['ct1234567890']
      );
    });

    it('should physical delete course type', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([{ id: 'ct1234567890' }]);

      const ok = await mapper.delete('ct1234567890');
      expect(ok).toBe(true);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM dream.course_types'),
        ['ct1234567890']
      );
    });

    it('should support PoolClient in queries', async () => {
      const { client, queryMock } = createMockClient();
      queryMock.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await mapper.findById('ct1234567890', client);
      expect(result?.id).toBe('ct1234567890');
      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(mockDb.getOne).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 2. TeacherLevelMapper
  // ===========================================================================
  describe('TeacherLevelMapper', () => {
    let mapper: TeacherLevelMapper;

    const mockRow: TeacherLevelRow = {
      id: 'tl1234567890',
      name: '高级外教 (Senior)',
      sort_order: 1,
      is_active: true,
      created_at: new Date('2026-11-04T10:00:00Z'),
      updated_at: new Date('2026-11-04T10:00:00Z'),
    };

    beforeEach(() => {
      mapper = new TeacherLevelMapper(mockDb);
    });

    it('should create a teacher level', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const input: CreateTeacherLevelDbInput = {
        name: '高级外教 (Senior)',
        sortOrder: 1,
        isActive: true,
      };

      const result = await mapper.create(input);
      expect(result.id).toBe('tl1234567890');
      expect(result.name).toBe('高级外教 (Senior)');
    });

    it('should find by id and by name', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);
      const res1 = await mapper.findById('tl1234567890');
      expect(res1?.id).toBe('tl1234567890');

      mockDb.getOne.mockResolvedValueOnce(mockRow);
      const res2 = await mapper.findByName('高级外教 (Senior)');
      expect(res2?.id).toBe('tl1234567890');
    });

    it('should find by ids returning empty array when input is empty', async () => {
      const result = await mapper.findByIds([]);
      expect(result).toEqual([]);
    });

    it('should find by ids using ANY($1::text[])', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([mockRow]);

      const result = await mapper.findByIds(['tl1234567890']);
      expect(result).toHaveLength(1);
    });

    it('should list all and filter activeOnly', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([mockRow]);

      const list = await mapper.listAll({ activeOnly: true });
      expect(list).toHaveLength(1);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = true'),
        []
      );
    });

    it('should update teacher level', async () => {
      const updatedRow = { ...mockRow, name: '资深外教 (Lead)' };
      mockDb.getOne.mockResolvedValueOnce(updatedRow);

      const result = await mapper.update('tl1234567890', { name: '资深外教 (Lead)' });
      expect(result?.name).toBe('资深外教 (Lead)');
    });

    it('should fallback to findById when update has no fields', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);
      const result = await mapper.update('tl1234567890', {});
      expect(result?.id).toBe('tl1234567890');
    });

    it('should physical delete teacher level', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([{ id: 'tl1234567890' }]);

      const ok = await mapper.delete('tl1234567890');
      expect(ok).toBe(true);
    });

    it('should support PoolClient in queries', async () => {
      const { client, queryMock } = createMockClient();
      queryMock.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await mapper.findById('tl1234567890', client);
      expect(result?.id).toBe('tl1234567890');
    });
  });

  // ===========================================================================
  // 3. MonitorProfileMapper
  // ===========================================================================
  describe('MonitorProfileMapper', () => {
    let mapper: MonitorProfileMapper;

    const mockRow: MonitorProfileRow = {
      id: 'mp1234567890',
      account_id: 'acc123456789',
      display_name: 'Sarah 班长',
      phone: '+8613800000000',
      created_at: new Date('2026-11-04T10:00:00Z'),
      updated_at: new Date('2026-11-04T10:00:00Z'),
      deleted_at: null,
    };

    beforeEach(() => {
      mapper = new MonitorProfileMapper(mockDb);
    });

    it('should create monitor profile record', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const input: CreateMonitorProfileDbInput = {
        accountId: 'acc123456789',
        displayName: 'Sarah 班长',
        phone: '+8613800000000',
      };

      const result = await mapper.create(input);
      expect(result.id).toBe('mp1234567890');
      expect(result.accountId).toBe('acc123456789');
      expect(result.displayName).toBe('Sarah 班长');
      expect(result.phone).toBe('+8613800000000');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dream.monitor_profiles'),
        expect.arrayContaining(['acc123456789', 'Sarah 班长'])
      );
    });

    it('should find by id (excluding soft deleted)', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const result = await mapper.findById('mp1234567890');
      expect(result?.id).toBe('mp1234567890');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND deleted_at IS NULL'),
        ['mp1234567890']
      );
    });

    it('should find by account_id (excluding soft deleted)', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const result = await mapper.findByAccountId('acc123456789');
      expect(result?.id).toBe('mp1234567890');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE account_id = $1 AND deleted_at IS NULL'),
        ['acc123456789']
      );
    });

    it('should list all active monitors', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([mockRow]);

      const result = await mapper.listAll();
      expect(result).toHaveLength(1);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE deleted_at IS NULL'),
        []
      );
    });

    it('should update monitor profile', async () => {
      const updatedRow = { ...mockRow, display_name: 'Sarah 首席班长' };
      mockDb.getOne.mockResolvedValueOnce(updatedRow);

      const result = await mapper.update('mp1234567890', {
        displayName: 'Sarah 首席班长',
      });
      expect(result?.displayName).toBe('Sarah 首席班长');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE dream.monitor_profiles'),
        ['mp1234567890', 'Sarah 首席班长']
      );
    });

    it('should soft delete monitor profile', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([{ id: 'mp1234567890' }]);

      const ok = await mapper.softDelete('mp1234567890');
      expect(ok).toBe(true);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE dream.monitor_profiles'),
        ['mp1234567890']
      );
    });

    it('should support PoolClient in queries', async () => {
      const { client, queryMock } = createMockClient();
      queryMock.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await mapper.findById('mp1234567890', client);
      expect(result?.id).toBe('mp1234567890');
      expect(queryMock).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // 4. TeacherProfileMapper
  // ===========================================================================
  describe('TeacherProfileMapper', () => {
    let mapper: TeacherProfileMapper;

    const mockRow: TeacherProfileRow = {
      id: 'tp1234567890',
      account_id: 'acc999999999',
      display_name: 'Emma Johnson',
      level_id: 'tl1234567890',
      monitor_profile_id: 'mp1234567890',
      skill_course_type_ids: ['ct1234567890'],
      intro_zh: '毕业于牛津大学，拥有5年少儿英语教学经验。',
      intro_en: 'Graduated from Oxford with 5 years experience.',
      photo_key: 'dream/teachers/photos/2026/11/04/abc123456789.webp',
      video_key: 'dream/teachers/videos/2026/11/04/def123456789.mp4',
      classin_qr_key: 'dream/teachers/classin_qr/2026/11/04/ghi123456789.webp',
      resigned_at: null,
      created_at: new Date('2026-11-04T10:00:00Z'),
      updated_at: new Date('2026-11-04T10:00:00Z'),
      deleted_at: null,
    };

    const mockDetailsRow: TeacherProfileWithDetailsRow = {
      ...mockRow,
      level_name: '高级外教 (Senior)',
      monitor_display_name: 'Sarah 班长',
    };

    beforeEach(() => {
      mapper = new TeacherProfileMapper(mockDb);
    });

    it('should create teacher profile record with all fields', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const input: CreateTeacherProfileDbInput = {
        accountId: 'acc999999999',
        displayName: 'Emma Johnson',
        levelId: 'tl1234567890',
        monitorProfileId: 'mp1234567890',
        skillCourseTypeIds: ['ct1234567890'],
        introZh: '毕业于牛津大学，拥有5年少儿英语教学经验。',
        introEn: 'Graduated from Oxford with 5 years experience.',
        photoKey: 'dream/teachers/photos/2026/11/04/abc123456789.webp',
        videoKey: 'dream/teachers/videos/2026/11/04/def123456789.mp4',
        classinQrKey: 'dream/teachers/classin_qr/2026/11/04/ghi123456789.webp',
      };

      const result = await mapper.create(input);

      expect(mockDb.getOne).toHaveBeenCalledTimes(1);
      const [sql, params] = mockDb.getOne.mock.calls[0];
      expect(sql).toContain('INSERT INTO dream.teacher_profiles');
      expect((params as unknown[])[1]).toBe('acc999999999');
      expect((params as unknown[])[2]).toBe('Emma Johnson');
      expect((params as unknown[])[5]).toBe(JSON.stringify(['ct1234567890']));
      expect(result.id).toBe('tp1234567890');
      expect(result.displayName).toBe('Emma Johnson');
      expect(result.skillCourseTypeIds).toEqual(['ct1234567890']);
    });

    it('should find by id (active only)', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const result = await mapper.findById('tp1234567890');
      expect(result?.id).toBe('tp1234567890');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND deleted_at IS NULL'),
        ['tp1234567890']
      );
    });

    it('should find by account_id', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const result = await mapper.findByAccountId('acc999999999');
      expect(result?.id).toBe('tp1234567890');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE account_id = $1 AND deleted_at IS NULL'),
        ['acc999999999']
      );
    });

    it('should find by monitor_profile_id', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([mockRow]);

      const result = await mapper.findByMonitorProfileId('mp1234567890');
      expect(result).toHaveLength(1);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE monitor_profile_id = $1 AND deleted_at IS NULL'),
        ['mp1234567890']
      );
    });

    it('should update teacher profile as admin/general', async () => {
      const updatedRow = { ...mockRow, display_name: 'Emma J.' };
      mockDb.getOne.mockResolvedValueOnce(updatedRow);

      const result = await mapper.update('tp1234567890', {
        displayName: 'Emma J.',
        skillCourseTypeIds: ['ct9999999999'],
      });

      expect(result?.displayName).toBe('Emma J.');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE dream.teacher_profiles'),
        expect.arrayContaining(['tp1234567890', 'Emma J.', JSON.stringify(['ct9999999999'])])
      );
    });

    it('should fallback to findById if update data has no fields', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const result = await mapper.update('tp1234567890', {});
      expect(result?.id).toBe('tp1234567890');
    });

    it('should update by monitor with IDOR isolation', async () => {
      const updatedRow = { ...mockRow, display_name: 'Emma Updated' };
      mockDb.getOne.mockResolvedValueOnce(updatedRow);

      const result = await mapper.updateByMonitor('tp1234567890', 'mp1234567890', {
        displayName: 'Emma Updated',
      });

      expect(result?.displayName).toBe('Emma Updated');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND monitor_profile_id = $2 AND deleted_at IS NULL'),
        ['tp1234567890', 'mp1234567890', 'Emma Updated']
      );
    });

    it('should handle updateByMonitor no-op query', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockRow);

      const result = await mapper.updateByMonitor('tp1234567890', 'mp1234567890', {});
      expect(result?.id).toBe('tp1234567890');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND monitor_profile_id = $2 AND deleted_at IS NULL'),
        ['tp1234567890', 'mp1234567890']
      );
    });

    it('should soft delete by monitor with IDOR isolation', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([{ id: 'tp1234567890' }]);

      const ok = await mapper.softDeleteByMonitor('tp1234567890', 'mp1234567890');
      expect(ok).toBe(true);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND monitor_profile_id = $2 AND deleted_at IS NULL'),
        ['tp1234567890', 'mp1234567890']
      );
    });

    it('should query public list without filters', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([mockDetailsRow]);

      const list = await mapper.findPublicList();
      expect(list).toHaveLength(1);
      expect(list[0].levelName).toBe('高级外教 (Senior)');
      expect(list[0].monitorDisplayName).toBe('Sarah 班长');

      const [sql, params] = mockDb.executeQuery.mock.calls[0];
      expect(sql).toContain('JOIN dream.teacher_levels');
      expect(sql).toContain('JOIN dream.monitor_profiles');
      expect(sql).toContain('tp.resigned_at IS NULL');
      expect(sql).toContain('tp.deleted_at IS NULL');
      expect(params).toEqual([]);
    });

    it('should query public list with levelId and courseTypeId filters', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([mockDetailsRow]);

      const list = await mapper.findPublicList({
        levelId: 'tl1234567890',
        courseTypeId: 'ct1234567890',
      });

      expect(list).toHaveLength(1);
      const [sql, params] = mockDb.executeQuery.mock.calls[0];
      expect(sql).toContain('tp.level_id = $1');
      expect(sql).toContain('tp.skill_course_type_ids @> $2::jsonb');
      expect(params).toEqual(['tl1234567890', JSON.stringify(['ct1234567890'])]);
    });

    it('should query public by id', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockDetailsRow);

      const result = await mapper.findPublicById('tp1234567890');
      expect(result?.id).toBe('tp1234567890');
      expect(result?.levelName).toBe('高级外教 (Senior)');
      expect(result?.monitorDisplayName).toBe('Sarah 班长');
      expect(mockDb.getOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tp.id = $1'),
        ['tp1234567890']
      );
    });

    it('should find all with details for admin', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([mockDetailsRow]);

      const list = await mapper.findAllWithDetails();
      expect(list).toHaveLength(1);
      expect(mockDb.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN dream.teacher_levels'),
        []
      );
    });

    it('should support PoolClient in queries', async () => {
      const { client, queryMock } = createMockClient();
      queryMock.mockResolvedValueOnce({ rows: [mockDetailsRow] });

      const result = await mapper.findPublicById('tp1234567890', client);
      expect(result?.id).toBe('tp1234567890');
      expect(queryMock).toHaveBeenCalledTimes(1);
    });
  });
});
