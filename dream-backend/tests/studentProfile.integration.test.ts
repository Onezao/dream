/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

process.env.NODE_ENV = 'test';
process.env.DB_URL = process.env.DB_URL || 'postgresql://localhost:5432/dream_test';

import type { FastifyInstance } from 'fastify';
import { ApiError } from '@topeetop/shared-core';
import type {
  StudentProfileDto,
  StudentLookupDto,
  StudentProfileListResponse,
} from '@topeetop/dream-core';
import { StudentProfileService } from '@topeetop/dream-core';
import { buildApp } from '../src/app.js';

describe('StudentProfile Integration Tests', () => {
  let app: FastifyInstance;
  let mockService: jest.Mocked<StudentProfileService>;

  const accountId = 'acc123456789';
  const authHeaders = {
    authorization: 'Bearer mock-access-token',
    'x-account-id': accountId,
  };

  const sampleProfile: StudentProfileDto = {
    id: 'sp1234567890',
    accountId,
    realName: '张小明',
    englishName: 'Alice',
    surnameInitial: 'Z',
    age: 12,
    nickname: 'AliceZ12',
    gender: 'female',
    birthDate: '2014-05-20',
    avatarKey: 'dream/students/avatars/2026/11/04/abc123456789.png',
    avatarUrl: 'https://cdn.example.com/dream/students/avatars/2026/11/04/abc123456789.png',
    preferredCourseTypeIds: ['ct1234567890'],
    createdAt: '2026-11-04T10:00:00.000Z',
    updatedAt: '2026-11-04T10:00:00.000Z',
  };

  beforeAll(async () => {
    mockService = {
      getProfilesByAccountId: jest.fn(),
      createProfile: jest.fn(),
      getProfileById: jest.fn(),
      updateProfile: jest.fn(),
      deleteProfile: jest.fn(),
      checkNicknameAvailability: jest.fn(),
      lookupProfileForTransfer: jest.fn(),
    } as unknown as jest.Mocked<StudentProfileService>;

    app = await buildApp({ service: mockService, skipDbInit: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Authentication & PreHandler Guard', () => {
    it('should return 401 UNAUTHORIZED when Authorization header is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/parent/student-profiles',
      });

      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.code).toBe('UNAUTHORIZED');
      expect(json.error).toMatch(/token is required/i);
    });

    it('should return 401 INVALID_TOKEN when Bearer token is empty', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/parent/student-profiles',
        headers: {
          authorization: 'Bearer ',
        },
      });

      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.code).toBe('INVALID_TOKEN');
    });
  });

  describe('2. GET /parent/student-profiles (List Profiles)', () => {
    it('should return 200 with profile list and meta for current account', async () => {
      const mockResult: StudentProfileListResponse = {
        data: [sampleProfile],
        meta: { total: 1, limit: 10 },
      };
      mockService.getProfilesByAccountId.mockResolvedValueOnce(mockResult);

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/parent/student-profiles',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].id).toBe('sp1234567890');
      expect(json.meta.total).toBe(1);
      expect(mockService.getProfilesByAccountId).toHaveBeenCalledWith(accountId);
    });
  });

  describe('3. POST /parent/student-profiles (Create Profile)', () => {
    const validPayload = {
      realName: '张小明',
      englishName: 'Alice',
      surnameInitial: 'Z',
      age: 12,
      gender: 'female' as const,
      birthDate: '2014-05-20',
      preferredCourseTypeIds: ['ct1234567890'],
    };

    it('should return 201 and created profile on valid input', async () => {
      mockService.createProfile.mockResolvedValueOnce(sampleProfile);

      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/parent/student-profiles',
        headers: authHeaders,
        payload: validPayload,
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.data.id).toBe('sp1234567890');
      expect(json.data.nickname).toBe('AliceZ12');
      expect(mockService.createProfile).toHaveBeenCalledWith(
        accountId,
        expect.objectContaining({
          realName: '张小明',
          englishName: 'Alice',
          surnameInitial: 'Z',
          age: 12,
        })
      );
    });

    it('should return 400 VALIDATION_ERROR when required fields are missing or invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/parent/student-profiles',
        headers: authHeaders,
        payload: {
          realName: '',
          englishName: 'Alice123', // contains numbers
          age: 120, // out of range
        },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(mockService.createProfile).not.toHaveBeenCalled();
    });

    it('should return 409 NICKNAME_ALREADY_EXISTS when nickname conflict occurs', async () => {
      mockService.createProfile.mockRejectedValueOnce(
        new ApiError('Student nickname is already taken', 409, 'NICKNAME_ALREADY_EXISTS')
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/parent/student-profiles',
        headers: authHeaders,
        payload: validPayload,
      });

      expect(res.statusCode).toBe(409);
      const json = res.json();
      expect(json.code).toBe('NICKNAME_ALREADY_EXISTS');
      expect(json.error).toBe('Student nickname is already taken');
    });

    it('should return 409 PROFILE_LIMIT_EXCEEDED when account profile limit is reached', async () => {
      mockService.createProfile.mockRejectedValueOnce(
        new ApiError(
          'Student profile limit (10) reached for this account',
          409,
          'PROFILE_LIMIT_EXCEEDED'
        )
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/parent/student-profiles',
        headers: authHeaders,
        payload: validPayload,
      });

      expect(res.statusCode).toBe(409);
      const json = res.json();
      expect(json.code).toBe('PROFILE_LIMIT_EXCEEDED');
    });
  });

  describe('4. GET /parent/student-profiles/:id (Get Single Profile)', () => {
    it('should return 200 and profile when found', async () => {
      mockService.getProfileById.mockResolvedValueOnce(sampleProfile);

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/parent/student-profiles/sp1234567890',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.id).toBe('sp1234567890');
      expect(mockService.getProfileById).toHaveBeenCalledWith('sp1234567890', accountId);
    });

    it('should return 400 VALIDATION_ERROR when id parameter is invalid length', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/parent/student-profiles/short_id',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(mockService.getProfileById).not.toHaveBeenCalled();
    });

    it('should return 404 PROFILE_NOT_FOUND when profile is not found or owned by other (IDOR)', async () => {
      mockService.getProfileById.mockRejectedValueOnce(
        new ApiError('Student profile not found', 404, 'PROFILE_NOT_FOUND')
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/parent/student-profiles/sp9999999999',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(404);
      const json = res.json();
      expect(json.code).toBe('PROFILE_NOT_FOUND');
    });
  });

  describe('5. PATCH /parent/student-profiles/:id (Update Profile)', () => {
    it('should return 200 and updated profile on valid update', async () => {
      const updatedProfile = { ...sampleProfile, realName: '张小强', age: 13, nickname: 'AliceZ13' };
      mockService.updateProfile.mockResolvedValueOnce(updatedProfile);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/dream/v1/parent/student-profiles/sp1234567890',
        headers: authHeaders,
        payload: {
          realName: '张小强',
          age: 13,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.realName).toBe('张小强');
      expect(json.data.age).toBe(13);
      expect(mockService.updateProfile).toHaveBeenCalledWith(
        'sp1234567890',
        accountId,
        expect.objectContaining({ realName: '张小强', age: 13 })
      );
    });

    it('should return 400 VALIDATION_ERROR when update payload is invalid', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/dream/v1/parent/student-profiles/sp1234567890',
        headers: authHeaders,
        payload: {
          nicknameSuffix: 'INVALID_SUFFIX_TOO_LONG_AND_UPPERCASE',
        },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 PROFILE_NOT_FOUND when updating non-existent or IDOR profile', async () => {
      mockService.updateProfile.mockRejectedValueOnce(
        new ApiError('Student profile not found', 404, 'PROFILE_NOT_FOUND')
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/dream/v1/parent/student-profiles/sp9999999999',
        headers: authHeaders,
        payload: { realName: '新名字' },
      });

      expect(res.statusCode).toBe(404);
      const json = res.json();
      expect(json.code).toBe('PROFILE_NOT_FOUND');
    });

    it('should return 409 NICKNAME_ALREADY_EXISTS when update produces a duplicate nickname', async () => {
      mockService.updateProfile.mockRejectedValueOnce(
        new ApiError('Student nickname is already taken', 409, 'NICKNAME_ALREADY_EXISTS')
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/dream/v1/parent/student-profiles/sp1234567890',
        headers: authHeaders,
        payload: { age: 14 },
      });

      expect(res.statusCode).toBe(409);
      const json = res.json();
      expect(json.code).toBe('NICKNAME_ALREADY_EXISTS');
    });
  });

  describe('6. DELETE /parent/student-profiles/:id (Soft Delete Profile)', () => {
    it('should return 200 { data: { success: true } } on successful soft delete', async () => {
      mockService.deleteProfile.mockResolvedValueOnce({ success: true });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/dream/v1/parent/student-profiles/sp1234567890',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.success).toBe(true);
      expect(mockService.deleteProfile).toHaveBeenCalledWith('sp1234567890', accountId);
    });

    it('should return 404 PROFILE_NOT_FOUND when deleting non-existent profile', async () => {
      mockService.deleteProfile.mockRejectedValueOnce(
        new ApiError('Student profile not found', 404, 'PROFILE_NOT_FOUND')
      );

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/dream/v1/parent/student-profiles/sp9999999999',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(404);
      const json = res.json();
      expect(json.code).toBe('PROFILE_NOT_FOUND');
    });
  });

  describe('7. GET /parent/nicknames/availability (Nickname Availability)', () => {
    it('should return 200 { available: true } when nickname is available', async () => {
      mockService.checkNicknameAvailability.mockResolvedValueOnce({ available: true });

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/parent/nicknames/availability?nickname=AliceZ12',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.available).toBe(true);
      expect(mockService.checkNicknameAvailability).toHaveBeenCalledWith('AliceZ12');
    });

    it('should return 200 { available: false } when nickname is taken', async () => {
      mockService.checkNicknameAvailability.mockResolvedValueOnce({ available: false });

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/parent/nicknames/availability?nickname=BobZ10',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.available).toBe(false);
    });

    it('should return 400 VALIDATION_ERROR when nickname query parameter is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/parent/nicknames/availability',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('8. GET /parent/student-profiles/lookup (Transfer Lookup)', () => {
    it('should return 200 with masked profile info when student is found', async () => {
      const lookupDto: StudentLookupDto = {
        id: 'sp1234567891',
        nickname: 'BobZ10',
        avatarUrl: 'https://cdn.example.com/avatar.png',
      };
      mockService.lookupProfileForTransfer.mockResolvedValueOnce(lookupDto);

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/parent/student-profiles/lookup?nickname=BobZ10',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.id).toBe('sp1234567891');
      expect(json.data.nickname).toBe('BobZ10');
      expect(mockService.lookupProfileForTransfer).toHaveBeenCalledWith('BobZ10');
    });

    it('should return 200 with null when student is not found', async () => {
      mockService.lookupProfileForTransfer.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/parent/student-profiles/lookup?nickname=NotExistZ99',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data).toBeNull();
    });

    it('should return 400 VALIDATION_ERROR when nickname parameter is empty', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/parent/student-profiles/lookup?nickname=',
        headers: authHeaders,
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.code).toBe('VALIDATION_ERROR');
    });
  });
});
