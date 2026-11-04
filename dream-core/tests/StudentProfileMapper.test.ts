/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { DatabaseService, executeQuery as sharedExecuteQuery, getOne as sharedGetOne } from '@topeetop/shared-core';
import { StudentProfileMapper } from '../src/db/StudentProfileMapper.js';
import {
  StudentProfileRow,
  CreateStudentProfileDbInput,
  UpdateStudentProfileDbInput,
  formatBirthDate,
  parseCourseTypeIds,
  mapRowToStudentProfileRecord,
} from '../src/types/studentProfile.types.js';

jest.mock('@topeetop/shared-core', () => {
  const actual = jest.requireActual('@topeetop/shared-core');
  return {
    ...actual,
    executeQuery: jest.fn(),
    getOne: jest.fn(),
  };
});

describe('StudentProfileMapper', () => {
  let mapper: StudentProfileMapper;
  let mockDb: jest.Mocked<DatabaseService>;

  const mockDbRow: StudentProfileRow = {
    id: 'sp1234567890',
    account_id: 'acc123456789',
    real_name: '张小明',
    english_name: 'Alice',
    surname_initial: 'Z',
    age: 12,
    nickname: 'AliceZ12',
    gender: 'female',
    birth_date: '2014-05-20',
    avatar_key: 'dream/students/avatars/2026/11/04/abc123456789.png',
    preferred_course_type_ids: ['ct1234567890'],
    created_at: new Date('2026-11-04T10:00:00Z'),
    updated_at: new Date('2026-11-04T10:00:00Z'),
    deleted_at: null,
  };

  function createMockClient(): { client: PoolClient; queryMock: jest.Mock } {
    const queryMock = jest.fn();
    const client = {
      query: queryMock,
      release: jest.fn(),
    } as unknown as PoolClient;
    return { client, queryMock };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      executeQuery: jest.fn(),
      getOne: jest.fn(),
      executeTx: jest.fn(),
      getPool: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<DatabaseService>;

    mapper = new StudentProfileMapper(mockDb);
  });

  describe('create', () => {
    it('should create student profile record with all fields and explicit ID', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockDbRow);

      const input: CreateStudentProfileDbInput = {
        id: 'sp1234567890',
        accountId: 'acc123456789',
        realName: '张小明',
        englishName: 'Alice',
        surnameInitial: 'Z',
        age: 12,
        nickname: 'AliceZ12',
        gender: 'female',
        birthDate: '2014-05-20',
        avatarKey: 'dream/students/avatars/2026/11/04/abc123456789.png',
        preferredCourseTypeIds: ['ct1234567890'],
      };

      const result = await mapper.create(input);

      expect(mockDb.getOne).toHaveBeenCalledTimes(1);
      const call = mockDb.getOne.mock.calls[0];
      const sql: string = call[0] as string;
      const params: unknown[] = call[1] as unknown[];

      expect(sql).toContain('INSERT INTO dream.student_profiles');
      expect(sql).toContain('RETURNING *');
      expect(params[0]).toBe('sp1234567890');
      expect(params[1]).toBe('acc123456789');
      expect(params[2]).toBe('张小明');
      expect(params[3]).toBe('Alice');
      expect(params[4]).toBe('Z');
      expect(params[5]).toBe(12);
      expect(params[6]).toBe('AliceZ12');
      expect(params[7]).toBe('female');
      expect(params[8]).toBe('2014-05-20');
      expect(params[9]).toBe('dream/students/avatars/2026/11/04/abc123456789.png');
      expect(params[10]).toBe(JSON.stringify(['ct1234567890']));

      expect(result.id).toBe('sp1234567890');
      expect(result.accountId).toBe('acc123456789');
      expect(result.nickname).toBe('AliceZ12');
      expect(result.preferredCourseTypeIds).toEqual(['ct1234567890']);
    });

    it('should generate 12-char Short UUID and apply defaults when optional fields are omitted', async () => {
      mockDb.getOne.mockResolvedValueOnce({
        ...mockDbRow,
        gender: 'undisclosed',
        birth_date: null,
        avatar_key: null,
        preferred_course_type_ids: [],
      });

      const input: CreateStudentProfileDbInput = {
        accountId: 'acc123456789',
        realName: '李雷',
        englishName: 'Leo',
        surnameInitial: 'L',
        age: 10,
        nickname: 'LeoL10',
      };

      const result = await mapper.create(input);

      expect(mockDb.getOne).toHaveBeenCalledTimes(1);
      const params: unknown[] = mockDb.getOne.mock.calls[0][1] as unknown[];

      // Auto-generated 12-char ID
      expect(typeof params[0]).toBe('string');
      expect((params[0] as string).length).toBe(12);
      expect(params[7]).toBe('undisclosed');
      expect(params[8]).toBeNull();
      expect(params[9]).toBeNull();
      expect(params[10]).toBe('[]');

      expect(result.gender).toBe('undisclosed');
      expect(result.birthDate).toBeNull();
      expect(result.avatarKey).toBeNull();
      expect(result.preferredCourseTypeIds).toEqual([]);
    });

    it('should use provided PoolClient in transaction', async () => {
      const { client, queryMock } = createMockClient();
      queryMock.mockResolvedValueOnce({
        rows: [mockDbRow],
        rowCount: 1,
      });

      const input: CreateStudentProfileDbInput = {
        id: 'sp1234567890',
        accountId: 'acc123456789',
        realName: '张小明',
        englishName: 'Alice',
        surnameInitial: 'Z',
        age: 12,
        nickname: 'AliceZ12',
      };

      const result = await mapper.create(input, client);

      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(mockDb.getOne).not.toHaveBeenCalled();
      expect(result.id).toBe('sp1234567890');
    });

    it('should throw error when database returns no row', async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      const input: CreateStudentProfileDbInput = {
        accountId: 'acc123456789',
        realName: '张小明',
        englishName: 'Alice',
        surnameInitial: 'Z',
        age: 12,
        nickname: 'AliceZ12',
      };

      await expect(mapper.create(input)).rejects.toThrow(
        'Failed to create student profile record: no row returned'
      );
    });

    it('should let unique violation error (23505) bubble up for duplicate nickname', async () => {
      const uniqueViolationError = new Error('duplicate key value violates unique constraint');
      (uniqueViolationError as unknown as { code: string }).code = '23505';
      mockDb.getOne.mockRejectedValueOnce(uniqueViolationError);

      const input: CreateStudentProfileDbInput = {
        accountId: 'acc123456789',
        realName: '张小明',
        englishName: 'Alice',
        surnameInitial: 'Z',
        age: 12,
        nickname: 'AliceZ12',
      };

      await expect(mapper.create(input)).rejects.toThrow(
        'duplicate key value violates unique constraint'
      );
    });
  });

  describe('findById', () => {
    it('should return mapped record when entity exists and is active', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockDbRow);

      const result = await mapper.findById('sp1234567890');

      expect(mockDb.getOne).toHaveBeenCalledTimes(1);
      const sql: string = mockDb.getOne.mock.calls[0][0] as string;
      const params: unknown[] = mockDb.getOne.mock.calls[0][1] as unknown[];

      expect(sql).toContain('WHERE id = $1 AND deleted_at IS NULL');
      expect(params).toEqual(['sp1234567890']);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('sp1234567890');
      expect(result?.englishName).toBe('Alice');
    });

    it('should return null when entity not found or soft-deleted', async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      const result = await mapper.findById('sp_nonexistent');

      expect(result).toBeNull();
    });

    it('should use provided PoolClient when passed', async () => {
      const { client, queryMock } = createMockClient();
      queryMock.mockResolvedValueOnce({
        rows: [mockDbRow],
        rowCount: 1,
      });

      const result = await mapper.findById('sp1234567890', client);

      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(mockDb.getOne).not.toHaveBeenCalled();
      expect(result?.id).toBe('sp1234567890');
    });
  });

  describe('findByAccountId', () => {
    it('should return active student profiles ordered by created_at ASC', async () => {
      const row2: StudentProfileRow = {
        ...mockDbRow,
        id: 'sp2222222222',
        english_name: 'Bob',
        nickname: 'BobZ10',
        age: 10,
      };

      mockDb.executeQuery.mockResolvedValueOnce([mockDbRow, row2]);

      const results = await mapper.findByAccountId('acc123456789');

      expect(mockDb.executeQuery).toHaveBeenCalledTimes(1);
      const sql: string = mockDb.executeQuery.mock.calls[0][0] as string;
      const params: unknown[] = mockDb.executeQuery.mock.calls[0][1] as unknown[];

      expect(sql).toContain('WHERE account_id = $1 AND deleted_at IS NULL');
      expect(sql).toContain('ORDER BY created_at ASC');
      expect(params).toEqual(['acc123456789']);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('sp1234567890');
      expect(results[1].id).toBe('sp2222222222');
    });

    it('should return empty array when account has no active profiles', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([]);

      const results = await mapper.findByAccountId('acc_empty');
      expect(results).toEqual([]);
    });

    it('should use provided PoolClient in findByAccountId', async () => {
      const { client, queryMock } = createMockClient();
      queryMock.mockResolvedValueOnce({
        rows: [mockDbRow],
        rowCount: 1,
      });

      const results = await mapper.findByAccountId('acc123456789', client);

      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(mockDb.executeQuery).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });
  });

  describe('findByNickname', () => {
    it('should perform case-insensitive query for active student profile by default', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockDbRow);

      const result = await mapper.findByNickname('alicez12');

      expect(mockDb.getOne).toHaveBeenCalledTimes(1);
      const sql: string = mockDb.getOne.mock.calls[0][0] as string;
      const params: unknown[] = mockDb.getOne.mock.calls[0][1] as unknown[];

      expect(sql).toContain('WHERE LOWER(nickname) = LOWER($1) AND deleted_at IS NULL');
      expect(params).toEqual(['alicez12']);
      expect(result?.nickname).toBe('AliceZ12');
    });

    it('should include deleted records when includeDeleted is true', async () => {
      const deletedRow: StudentProfileRow = {
        ...mockDbRow,
        deleted_at: new Date('2026-11-04T12:00:00Z'),
      };
      mockDb.getOne.mockResolvedValueOnce(deletedRow);

      const result = await mapper.findByNickname('alicez12', undefined, true);

      expect(mockDb.getOne).toHaveBeenCalledTimes(1);
      const sql: string = mockDb.getOne.mock.calls[0][0] as string;
      expect(sql).not.toContain('AND deleted_at IS NULL');
      expect(result?.deletedAt).not.toBeNull();
    });

    it('should return null when nickname is not found', async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      const result = await mapper.findByNickname('unknown123');
      expect(result).toBeNull();
    });
  });

  describe('countActiveByAccountId', () => {
    it('should return parsed count of active profiles', async () => {
      mockDb.getOne.mockResolvedValueOnce({ total: 3 });

      const count = await mapper.countActiveByAccountId('acc123456789');

      expect(mockDb.getOne).toHaveBeenCalledTimes(1);
      const sql: string = mockDb.getOne.mock.calls[0][0] as string;
      expect(sql).toContain('SELECT COUNT(*)::int AS total');
      expect(sql).toContain('WHERE account_id = $1 AND deleted_at IS NULL');
      expect(count).toBe(3);
    });

    it('should return 0 when no rows returned or count is 0', async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      const count = await mapper.countActiveByAccountId('acc_none');
      expect(count).toBe(0);
    });
  });

  describe('update', () => {
    it('should dynamically update provided fields and enforce IDOR account_id check', async () => {
      const updatedRow: StudentProfileRow = {
        ...mockDbRow,
        real_name: '张大明',
        age: 13,
        nickname: 'AliceZ13',
        preferred_course_type_ids: ['ct9999999999'],
      };

      mockDb.getOne.mockResolvedValueOnce(updatedRow);

      const updateData: UpdateStudentProfileDbInput = {
        realName: '张大明',
        age: 13,
        nickname: 'AliceZ13',
        preferredCourseTypeIds: ['ct9999999999'],
      };

      const result = await mapper.update('sp1234567890', 'acc123456789', updateData);

      expect(mockDb.getOne).toHaveBeenCalledTimes(1);
      const sql: string = mockDb.getOne.mock.calls[0][0] as string;
      const params: unknown[] = mockDb.getOne.mock.calls[0][1] as unknown[];

      expect(sql).toContain('UPDATE dream.student_profiles');
      expect(sql).toContain('WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL');
      expect(sql).toContain('real_name = $3');
      expect(sql).toContain('age = $4');
      expect(sql).toContain('nickname = $5');
      expect(sql).toContain('preferred_course_type_ids = $6::jsonb');
      expect(sql).toContain('updated_at = NOW()');

      expect(params[0]).toBe('sp1234567890');
      expect(params[1]).toBe('acc123456789');
      expect(params[2]).toBe('张大明');
      expect(params[3]).toBe(13);
      expect(params[4]).toBe('AliceZ13');
      expect(params[5]).toBe(JSON.stringify(['ct9999999999']));

      expect(result?.realName).toBe('张大明');
      expect(result?.age).toBe(13);
      expect(result?.nickname).toBe('AliceZ13');
      expect(result?.preferredCourseTypeIds).toEqual(['ct9999999999']);
    });

    it('should return existing record when empty update data is provided', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockDbRow);

      const result = await mapper.update('sp1234567890', 'acc123456789', {});

      expect(mockDb.getOne).toHaveBeenCalledTimes(1);
      const sql: string = mockDb.getOne.mock.calls[0][0] as string;
      expect(sql).toContain('FROM dream.student_profiles');
      expect(sql).toContain('WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL');
      expect(result?.id).toBe('sp1234567890');
    });

    it('should return null when profile does not exist or accountId does not match (IDOR)', async () => {
      mockDb.getOne.mockResolvedValueOnce(null);

      const result = await mapper.update('sp1234567890', 'acc_wrong_parent', {
        realName: '新名字',
      });

      expect(result).toBeNull();
    });

    it('should update gender, birthDate and avatarKey correctly', async () => {
      mockDb.getOne.mockResolvedValueOnce(mockDbRow);

      await mapper.update('sp1234567890', 'acc123456789', {
        gender: 'male',
        birthDate: new Date('2015-01-01'),
        avatarKey: 'new_avatar_key.jpg',
      });

      const params: unknown[] = mockDb.getOne.mock.calls[0][1] as unknown[];
      expect(params).toContain('male');
      expect(params).toContain('2015-01-01');
      expect(params).toContain('new_avatar_key.jpg');
    });
  });

  describe('softDelete', () => {
    it('should soft delete with accountId and return true when row affected', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([{ id: 'sp1234567890' }]);

      const success = await mapper.softDelete('sp1234567890', 'acc123456789');

      expect(mockDb.executeQuery).toHaveBeenCalledTimes(1);
      const sql: string = mockDb.executeQuery.mock.calls[0][0] as string;
      const params: unknown[] = mockDb.executeQuery.mock.calls[0][1] as unknown[];

      expect(sql).toContain('UPDATE dream.student_profiles');
      expect(sql).toContain('SET deleted_at = NOW(), updated_at = NOW()');
      expect(sql).toContain('WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL');
      expect(params).toEqual(['sp1234567890', 'acc123456789']);
      expect(success).toBe(true);
    });

    it('should return false when target not found or account mismatch', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([]);

      const success = await mapper.softDelete('sp1234567890', 'acc_wrong');
      expect(success).toBe(false);
    });

    it('should support single-arg softDelete inherited from BaseMapper', async () => {
      mockDb.executeQuery.mockResolvedValueOnce([{ id: 'sp1234567890' }]);

      const success = await mapper.softDelete('sp1234567890');

      expect(mockDb.executeQuery).toHaveBeenCalledTimes(1);
      const sql: string = mockDb.executeQuery.mock.calls[0][0] as string;
      const params: unknown[] = mockDb.executeQuery.mock.calls[0][1] as unknown[];

      expect(sql).toContain('WHERE id = $1 AND deleted_at IS NULL');
      expect(params).toEqual(['sp1234567890']);
      expect(success).toBe(true);
    });
  });

  describe('lockAccountScope', () => {
    it('should execute pg_advisory_xact_lock on the provided client with accountId', async () => {
      const { client, queryMock } = createMockClient();
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await mapper.lockAccountScope('acc123456789', client);

      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(queryMock).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1));', [
        'acc123456789',
      ]);
    });
  });

  describe('fallback mode without DI', () => {
    it('should use shared-core default singleton when db is not injected', async () => {
      const fallbackMapper = new StudentProfileMapper();
      (sharedGetOne as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await fallbackMapper.findById('sp1234567890');

      expect(sharedGetOne).toHaveBeenCalledTimes(1);
      expect(result?.id).toBe('sp1234567890');
    });

    it('should use shared-core default executeQuery for array queries when db is not injected', async () => {
      const fallbackMapper = new StudentProfileMapper();
      (sharedExecuteQuery as jest.Mock).mockResolvedValueOnce([mockDbRow]);

      const results = await fallbackMapper.findByAccountId('acc123456789');

      expect(sharedExecuteQuery).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
    });
  });

  describe('helper functions and edge cases', () => {
    it('formatBirthDate should handle Date, string, null and undefined', () => {
      expect(formatBirthDate(new Date('2020-03-15T00:00:00Z'))).toBe('2020-03-15');
      expect(formatBirthDate('2020-03-15T12:34:56.789Z')).toBe('2020-03-15');
      expect(formatBirthDate('2020-03-15')).toBe('2020-03-15');
      expect(formatBirthDate(null)).toBeNull();
      expect(formatBirthDate(undefined)).toBeNull();
    });

    it('parseCourseTypeIds should handle arrays, JSON strings, and invalid payloads', () => {
      expect(parseCourseTypeIds(['ct1', 'ct2'])).toEqual(['ct1', 'ct2']);
      expect(parseCourseTypeIds(JSON.stringify(['ct1', 'ct2']))).toEqual(['ct1', 'ct2']);
      expect(parseCourseTypeIds(null)).toEqual([]);
      expect(parseCourseTypeIds(undefined)).toEqual([]);
      expect(parseCourseTypeIds('invalid-json')).toEqual([]);
      expect(parseCourseTypeIds({ not: 'an-array' })).toEqual([]);
      expect(parseCourseTypeIds([1, 2, 'ct3'])).toEqual(['ct3']);
    });

    it('mapRowToStudentProfileRecord should handle string timestamps and null deleted_at', () => {
      const rowWithStringDates: StudentProfileRow = {
        ...mockDbRow,
        created_at: '2026-11-04T10:00:00Z',
        updated_at: '2026-11-04T10:00:00Z',
        deleted_at: '2026-11-04T12:00:00Z',
        birth_date: new Date('2014-05-20T00:00:00Z'),
      };

      const record = mapRowToStudentProfileRecord(rowWithStringDates);
      expect(record.createdAt).toBeInstanceOf(Date);
      expect(record.updatedAt).toBeInstanceOf(Date);
      expect(record.deletedAt).toBeInstanceOf(Date);
      expect(record.birthDate).toBe('2014-05-20');
    });
  });
});
