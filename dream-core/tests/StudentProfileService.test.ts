/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { DatabaseService, ApiError, executeTx as defaultExecuteTx } from '@topeetop/shared-core';
import { StudentProfileMapper } from '../src/db/StudentProfileMapper.js';
import { StudentProfileService } from '../src/modules/profile/StudentProfileService.js';
import type { StudentProfileRecord } from '../src/types/studentProfile.types.js';
import type {
  CreateStudentProfileInput,
  UpdateStudentProfileInput,
} from '../src/modules/profile/types.js';

jest.mock('@topeetop/shared-core', () => {
  const actual = jest.requireActual('@topeetop/shared-core');
  return {
    ...actual,
    executeTx: jest.fn(),
  };
});

describe('StudentProfileService', () => {
  let service: StudentProfileService;
  let mockMapper: jest.Mocked<StudentProfileMapper>;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockClient: PoolClient;

  const mockRecord: StudentProfileRecord = {
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
    createdAt: new Date('2026-11-04T10:00:00Z'),
    updatedAt: new Date('2026-11-04T10:00:00Z'),
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    } as unknown as PoolClient;

    mockMapper = {
      create: jest.fn(),
      findById: jest.fn(),
      findByAccountId: jest.fn(),
      findByNickname: jest.fn(),
      countActiveByAccountId: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      lockAccountScope: jest.fn(),
    } as unknown as jest.Mocked<StudentProfileMapper>;

    mockDb = {
      executeTx: jest.fn().mockImplementation(async (callback) => callback(mockClient)),
      executeQuery: jest.fn(),
      getOne: jest.fn(),
      getPool: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<DatabaseService>;

    service = new StudentProfileService(mockMapper, mockDb, {
      cdnBaseUrl: 'https://cdn.topee.top',
    });
  });

  describe('createProfile', () => {
    const validDto: CreateStudentProfileInput = {
      realName: '张小明',
      englishName: 'Alice',
      surnameInitial: 'z',
      age: 12,
      nicknameSuffix: 'a',
      gender: 'female',
      birthDate: '2014-05-20',
      avatarKey: 'dream/students/avatars/2026/11/04/abc123456789.png',
      preferredCourseTypeIds: ['ct1234567890'],
    };

    it('should create student profile successfully with assembled nickname and CDN url', async () => {
      mockMapper.countActiveByAccountId.mockResolvedValueOnce(0);
      mockMapper.findByNickname.mockResolvedValueOnce(null);
      mockMapper.create.mockResolvedValueOnce({
        ...mockRecord,
        nickname: 'AliceZ12a',
      });

      const result = await service.createProfile('acc123456789', validDto);

      expect(mockDb.executeTx).toHaveBeenCalledTimes(1);
      expect(mockMapper.lockAccountScope).toHaveBeenCalledWith('acc123456789', mockClient);
      expect(mockMapper.countActiveByAccountId).toHaveBeenCalledWith('acc123456789', mockClient);
      expect(mockMapper.findByNickname).toHaveBeenCalledWith('AliceZ12a', mockClient, true);
      expect(mockMapper.create).toHaveBeenCalledWith(
        {
          accountId: 'acc123456789',
          realName: '张小明',
          englishName: 'Alice',
          surnameInitial: 'Z',
          age: 12,
          nickname: 'AliceZ12a',
          gender: 'female',
          birthDate: '2014-05-20',
          avatarKey: 'dream/students/avatars/2026/11/04/abc123456789.png',
          preferredCourseTypeIds: ['ct1234567890'],
        },
        mockClient
      );

      expect(result.id).toBe('sp1234567890');
      expect(result.nickname).toBe('AliceZ12a');
      expect(result.avatarUrl).toBe(
        'https://cdn.topee.top/dream/students/avatars/2026/11/04/abc123456789.png'
      );
    });

    it('should apply defaults when optional fields are omitted', async () => {
      mockMapper.countActiveByAccountId.mockResolvedValueOnce(2);
      mockMapper.findByNickname.mockResolvedValueOnce(null);
      mockMapper.create.mockResolvedValueOnce({
        ...mockRecord,
        nickname: 'BobL10',
        gender: 'undisclosed',
        birthDate: null,
        avatarKey: null,
        preferredCourseTypeIds: [],
      });

      const result = await service.createProfile('acc123456789', {
        realName: '李雷',
        englishName: 'Bob',
        surnameInitial: 'L',
        age: 10,
      });

      expect(result.gender).toBe('undisclosed');
      expect(result.birthDate).toBeNull();
      expect(result.avatarKey).toBeNull();
      expect(result.avatarUrl).toBeNull();
      expect(result.preferredCourseTypeIds).toEqual([]);
    });

    it('should throw INVALID_NICKNAME 400 when englishName is invalid', async () => {
      await expect(
        service.createProfile('acc123456789', {
          ...validDto,
          englishName: '123Invalid',
        })
      ).rejects.toThrow(ApiError);

      try {
        await service.createProfile('acc123456789', {
          ...validDto,
          englishName: '123Invalid',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(400);
        expect((err as ApiError).errorCode).toBe('INVALID_NICKNAME');
      }
    });

    it('should throw INVALID_NICKNAME 400 when surnameInitial is invalid', async () => {
      await expect(
        service.createProfile('acc123456789', {
          ...validDto,
          surnameInitial: '9',
        })
      ).rejects.toThrow(ApiError);
    });

    it('should throw INVALID_NICKNAME 400 when age is out of bounds or non-integer', async () => {
      await expect(
        service.createProfile('acc123456789', {
          ...validDto,
          age: 0,
        })
      ).rejects.toThrow(ApiError);

      await expect(
        service.createProfile('acc123456789', {
          ...validDto,
          age: 100,
        })
      ).rejects.toThrow(ApiError);

      await expect(
        service.createProfile('acc123456789', {
          ...validDto,
          age: 10.5,
        })
      ).rejects.toThrow(ApiError);
    });

    it('should throw INVALID_NICKNAME 400 when suffix is invalid', async () => {
      await expect(
        service.createProfile('acc123456789', {
          ...validDto,
          nicknameSuffix: 'toolong123',
        })
      ).rejects.toThrow(ApiError);
    });

    it('should throw PROFILE_LIMIT_EXCEEDED 409 when account already has 10 active profiles', async () => {
      mockMapper.countActiveByAccountId.mockResolvedValueOnce(10);

      try {
        await service.createProfile('acc123456789', validDto);
        fail('Expected error not thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(409);
        expect((err as ApiError).errorCode).toBe('PROFILE_LIMIT_EXCEEDED');
      }
    });

    it('should throw NICKNAME_ALREADY_EXISTS 409 when nickname pre-check fails', async () => {
      mockMapper.countActiveByAccountId.mockResolvedValueOnce(3);
      mockMapper.findByNickname.mockResolvedValueOnce(mockRecord);

      try {
        await service.createProfile('acc123456789', validDto);
        fail('Expected error not thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(409);
        expect((err as ApiError).errorCode).toBe('NICKNAME_ALREADY_EXISTS');
      }
    });

    it('should translate PG 23505 unique violation error to NICKNAME_ALREADY_EXISTS 409', async () => {
      mockMapper.countActiveByAccountId.mockResolvedValueOnce(1);
      mockMapper.findByNickname.mockResolvedValueOnce(null);

      const pgUniqueError = new Error('duplicate key value violates unique constraint');
      (pgUniqueError as unknown as { code: string }).code = '23505';
      mockMapper.create.mockRejectedValueOnce(pgUniqueError);

      try {
        await service.createProfile('acc123456789', validDto);
        fail('Expected error not thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(409);
        expect((err as ApiError).errorCode).toBe('NICKNAME_ALREADY_EXISTS');
      }
    });

    it('should rethrow unknown database errors without translating', async () => {
      mockMapper.countActiveByAccountId.mockResolvedValueOnce(1);
      mockMapper.findByNickname.mockResolvedValueOnce(null);

      const dbError = new Error('connection closed abruptly');
      mockMapper.create.mockRejectedValueOnce(dbError);

      await expect(service.createProfile('acc123456789', validDto)).rejects.toThrow(
        'connection closed abruptly'
      );
    });
  });

  describe('getProfilesByAccountId', () => {
    it('should return list of mapped DTOs with meta', async () => {
      const record2: StudentProfileRecord = {
        ...mockRecord,
        id: 'sp2222222222',
        englishName: 'Bob',
        nickname: 'BobZ10',
        age: 10,
      };

      mockMapper.findByAccountId.mockResolvedValueOnce([mockRecord, record2]);

      const response = await service.getProfilesByAccountId('acc123456789');

      expect(mockMapper.findByAccountId).toHaveBeenCalledWith('acc123456789');
      expect(response.data).toHaveLength(2);
      expect(response.data[0].id).toBe('sp1234567890');
      expect(response.data[1].id).toBe('sp2222222222');
      expect(response.meta).toEqual({ total: 2, limit: 10 });
    });

    it('should return empty list when no profiles found', async () => {
      mockMapper.findByAccountId.mockResolvedValueOnce([]);

      const response = await service.getProfilesByAccountId('acc_empty');
      expect(response.data).toEqual([]);
      expect(response.meta).toEqual({ total: 0, limit: 10 });
    });
  });

  describe('getProfileById', () => {
    it('should return mapped DTO when profile exists and accountId matches', async () => {
      mockMapper.findById.mockResolvedValueOnce(mockRecord);

      const result = await service.getProfileById('sp1234567890', 'acc123456789');

      expect(mockMapper.findById).toHaveBeenCalledWith('sp1234567890');
      expect(result.id).toBe('sp1234567890');
      expect(result.realName).toBe('张小明');
    });

    it('should throw PROFILE_NOT_FOUND 404 when profile does not exist', async () => {
      mockMapper.findById.mockResolvedValueOnce(null);

      await expect(
        service.getProfileById('sp_nonexistent', 'acc123456789')
      ).rejects.toThrow(ApiError);

      try {
        await service.getProfileById('sp_nonexistent', 'acc123456789');
      } catch (err) {
        expect((err as ApiError).statusCode).toBe(404);
        expect((err as ApiError).errorCode).toBe('PROFILE_NOT_FOUND');
      }
    });

    it('should throw PROFILE_NOT_FOUND 404 on IDOR attempt (different accountId)', async () => {
      mockMapper.findById.mockResolvedValueOnce(mockRecord);

      try {
        await service.getProfileById('sp1234567890', 'acc_other_parent');
        fail('Expected error not thrown');
      } catch (err) {
        expect((err as ApiError).statusCode).toBe(404);
        expect((err as ApiError).errorCode).toBe('PROFILE_NOT_FOUND');
      }
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateStudentProfileInput = {
      realName: '张大明',
      gender: 'male',
      birthDate: '2014-06-01',
      avatarKey: 'dream/students/avatars/2026/11/04/new_avatar.png',
      preferredCourseTypeIds: ['ct9999999999'],
    };

    it('should update profile fields without nickname recalculation when age/suffix untouched', async () => {
      mockMapper.findById.mockResolvedValueOnce(mockRecord);
      mockMapper.update.mockResolvedValueOnce({
        ...mockRecord,
        realName: '张大明',
        gender: 'male',
      });

      const result = await service.updateProfile('sp1234567890', 'acc123456789', updateDto);

      expect(mockMapper.findById).toHaveBeenCalledWith('sp1234567890');
      expect(mockMapper.update).toHaveBeenCalledWith(
        'sp1234567890',
        'acc123456789',
        expect.objectContaining({
          realName: '张大明',
          gender: 'male',
        })
      );
      expect(result.realName).toBe('张大明');
    });

    it('should recalculate nickname and check uniqueness when age or suffix changes', async () => {
      mockMapper.findById.mockResolvedValueOnce(mockRecord);
      mockMapper.findByNickname.mockResolvedValueOnce(null);
      mockMapper.update.mockResolvedValueOnce({
        ...mockRecord,
        age: 13,
        nickname: 'AliceZ13',
      });

      const result = await service.updateProfile('sp1234567890', 'acc123456789', {
        age: 13,
      });

      expect(mockMapper.findByNickname).toHaveBeenCalledWith('AliceZ13', undefined, true);
      expect(mockMapper.update).toHaveBeenCalledWith(
        'sp1234567890',
        'acc123456789',
        expect.objectContaining({
          age: 13,
          nickname: 'AliceZ13',
        })
      );
      expect(result.age).toBe(13);
      expect(result.nickname).toBe('AliceZ13');
    });

    it('should allow recalculation if the existing nickname belongs to the same profile', async () => {
      mockMapper.findById.mockResolvedValueOnce(mockRecord);
      mockMapper.findByNickname.mockResolvedValueOnce(mockRecord); // Same ID: sp1234567890
      mockMapper.update.mockResolvedValueOnce(mockRecord);

      const result = await service.updateProfile('sp1234567890', 'acc123456789', {
        age: 12, // Same age
      });

      expect(result.id).toBe('sp1234567890');
    });

    it('should throw NICKNAME_ALREADY_EXISTS 409 when new nickname is already taken by another profile', async () => {
      mockMapper.findById.mockResolvedValueOnce(mockRecord);
      mockMapper.findByNickname.mockResolvedValueOnce({
        ...mockRecord,
        id: 'sp_other_kid_99',
      });

      try {
        await service.updateProfile('sp1234567890', 'acc123456789', { age: 14 });
        fail('Expected error not thrown');
      } catch (err) {
        expect((err as ApiError).statusCode).toBe(409);
        expect((err as ApiError).errorCode).toBe('NICKNAME_ALREADY_EXISTS');
      }
    });

    it('should throw INVALID_NICKNAME 400 when age is invalid in update', async () => {
      mockMapper.findById.mockResolvedValueOnce(mockRecord);

      await expect(
        service.updateProfile('sp1234567890', 'acc123456789', { age: 0 })
      ).rejects.toThrow(ApiError);
    });

    it('should throw PROFILE_NOT_FOUND 404 when profile does not exist or IDOR attempt', async () => {
      mockMapper.findById.mockResolvedValueOnce(null);

      await expect(
        service.updateProfile('sp_none', 'acc123456789', updateDto)
      ).rejects.toThrow(ApiError);

      mockMapper.findById.mockResolvedValueOnce(mockRecord);
      await expect(
        service.updateProfile('sp1234567890', 'acc_hacker', updateDto)
      ).rejects.toThrow(ApiError);
    });

    it('should translate PG 23505 unique violation in update to NICKNAME_ALREADY_EXISTS', async () => {
      mockMapper.findById.mockResolvedValueOnce(mockRecord);
      mockMapper.findByNickname.mockResolvedValueOnce(null);

      const pgUniqueError = new Error('duplicate key');
      (pgUniqueError as unknown as { code: string }).code = '23505';
      mockMapper.update.mockRejectedValueOnce(pgUniqueError);

      try {
        await service.updateProfile('sp1234567890', 'acc123456789', { age: 15 });
        fail('Expected error not thrown');
      } catch (err) {
        expect((err as ApiError).statusCode).toBe(409);
        expect((err as ApiError).errorCode).toBe('NICKNAME_ALREADY_EXISTS');
      }
    });
  });

  describe('deleteProfile', () => {
    it('should soft delete profile and return success true', async () => {
      mockMapper.softDelete.mockResolvedValueOnce(true);

      const result = await service.deleteProfile('sp1234567890', 'acc123456789');

      expect(mockMapper.softDelete).toHaveBeenCalledWith('sp1234567890', 'acc123456789');
      expect(result).toEqual({ success: true });
    });

    it('should throw PROFILE_NOT_FOUND 404 when profile does not exist or IDOR', async () => {
      mockMapper.softDelete.mockResolvedValueOnce(false);

      try {
        await service.deleteProfile('sp_nonexistent', 'acc123456789');
        fail('Expected error not thrown');
      } catch (err) {
        expect((err as ApiError).statusCode).toBe(404);
        expect((err as ApiError).errorCode).toBe('PROFILE_NOT_FOUND');
      }
    });
  });

  describe('checkNicknameAvailability', () => {
    it('should return available: false when nickname format is invalid', async () => {
      expect(await service.checkNicknameAvailability('abc')).toEqual({ available: false });
      expect(await service.checkNicknameAvailability('12345')).toEqual({ available: false });
      expect(await service.checkNicknameAvailability('Alice')).toEqual({ available: false });
      expect(mockMapper.findByNickname).not.toHaveBeenCalled();
    });

    it('should return available: false when nickname already exists', async () => {
      mockMapper.findByNickname.mockResolvedValueOnce(mockRecord);

      const result = await service.checkNicknameAvailability('AliceZ12');
      expect(mockMapper.findByNickname).toHaveBeenCalledWith('AliceZ12', undefined, true);
      expect(result).toEqual({ available: false });
    });

    it('should return available: true when nickname format valid and not taken', async () => {
      mockMapper.findByNickname.mockResolvedValueOnce(null);

      const result = await service.checkNicknameAvailability('AliceZ12');
      expect(result).toEqual({ available: true });
    });
  });

  describe('lookupProfileForTransfer', () => {
    it('should return strictly desensitized DTO when profile exists and active', async () => {
      mockMapper.findByNickname.mockResolvedValueOnce(mockRecord);

      const result = await service.lookupProfileForTransfer('AliceZ12');

      expect(mockMapper.findByNickname).toHaveBeenCalledWith('AliceZ12', undefined, false);
      expect(result).toEqual({
        id: 'sp1234567890',
        nickname: 'AliceZ12',
        avatarUrl:
          'https://cdn.topee.top/dream/students/avatars/2026/11/04/abc123456789.png',
      });
      // Verifying strict desensitization
      expect((result as unknown as Record<string, unknown>).realName).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).accountId).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).birthDate).toBeUndefined();
    });

    it('should return null when profile not found or soft-deleted', async () => {
      mockMapper.findByNickname.mockResolvedValueOnce(null);

      const result = await service.lookupProfileForTransfer('UnknownZ10');
      expect(result).toBeNull();
    });
  });

  describe('CDN avatarUrl handling and fallback execution', () => {
    it('should return raw avatarKey when cdnBaseUrl is not configured', async () => {
      const rawService = new StudentProfileService(mockMapper, mockDb);
      mockMapper.findById.mockResolvedValueOnce(mockRecord);

      const result = await rawService.getProfileById('sp1234567890', 'acc123456789');
      expect(result.avatarUrl).toBe('dream/students/avatars/2026/11/04/abc123456789.png');
    });

    it('should fallback to defaultExecuteTx when db is not injected', async () => {
      const noDbService = new StudentProfileService(mockMapper);
      (defaultExecuteTx as jest.Mock).mockImplementationOnce(async (callback) =>
        callback(mockClient)
      );
      mockMapper.countActiveByAccountId.mockResolvedValueOnce(0);
      mockMapper.findByNickname.mockResolvedValueOnce(null);
      mockMapper.create.mockResolvedValueOnce(mockRecord);

      const result = await noDbService.createProfile('acc123456789', {
        realName: '张小明',
        englishName: 'Alice',
        surnameInitial: 'Z',
        age: 12,
      });

      expect(defaultExecuteTx).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('sp1234567890');
    });
  });
});
