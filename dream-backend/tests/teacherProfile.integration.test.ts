/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

process.env.NODE_ENV = 'test';
process.env.DB_URL = process.env.DB_URL || 'postgresql://localhost:5432/dream_test';

import type { FastifyInstance } from 'fastify';
import { ApiError } from '@topeetop/shared-core';
import {
  TeacherProfileService,
  FileUploadService,
  TeacherCardDto,
  TeacherDetailDto,
} from '@topeetop/dream-core';
import { buildApp } from '../src/app.js';

describe('TeacherProfile Integration Tests', () => {
  let app: FastifyInstance;
  let mockTeacherService: jest.Mocked<TeacherProfileService>;
  let mockFileUploadService: jest.Mocked<FileUploadService>;

  const monitorHeaders = {
    authorization: 'Bearer mock-monitor-token',
    'x-account-id': 'acc_monitor_01',
    'x-roles': 'monitor',
  };

  const adminHeaders = {
    authorization: 'Bearer mock-admin-token',
    'x-account-id': 'acc_admin_01',
    'x-roles': 'admin',
  };

  const parentHeaders = {
    authorization: 'Bearer mock-parent-token',
    'x-account-id': 'acc_parent_01',
    'x-roles': 'parent',
  };

  const sampleTeacherCard: TeacherCardDto = {
    id: 'tea123456789',
    displayName: 'Teacher Sarah',
    levelName: '资深外教',
    monitorDisplayName: '班长Alice',
    skillCourseTypes: [{ id: 'ct1234567890', name: '自然拼读' }],
    introZh: '拥有8年少儿英语教学经验',
    introEn: '8 years of teaching experience for kids',
    photoUrl: 'https://cdn.example.com/photo.webp',
    videoUrl: 'https://cdn.example.com/video.mp4',
    classinQrUrl: 'https://cdn.example.com/qr.webp',
  };

  const sampleTeacherDetail: TeacherDetailDto = {
    id: 'tea123456789',
    accountId: null,
    displayName: 'Teacher Sarah',
    levelId: 'lvl123456789',
    levelName: '资深外教',
    monitorProfileId: 'mon123456789',
    monitorDisplayName: '班长Alice',
    skillCourseTypeIds: ['ct1234567890'],
    introZh: '拥有8年少儿英语教学经验',
    introEn: '8 years of teaching experience for kids',
    photoKey: 'dream/teachers/photos/2026/11/04/abc123456789.webp',
    photoUrl: 'https://cdn.example.com/photo.webp',
    videoKey: 'dream/teachers/videos/2026/11/04/abc123456789.mp4',
    videoUrl: 'https://cdn.example.com/video.mp4',
    classinQrKey: 'dream/teachers/classin_qr/2026/11/04/abc123456789.webp',
    classinQrUrl: 'https://cdn.example.com/qr.webp',
    resignedAt: null,
    createdAt: '2026-11-04T10:00:00.000Z',
    updatedAt: '2026-11-04T10:00:00.000Z',
  };

  beforeAll(async () => {
    mockTeacherService = {
      listPublicTeachers: jest.fn(),
      getPublicTeacherById: jest.fn(),
      listCourseTypes: jest.fn(),
      listTeacherLevels: jest.fn(),
      listTeachersByMonitor: jest.fn(),
      createTeacher: jest.fn(),
      updateTeacher: jest.fn(),
      deleteTeacher: jest.fn(),
      adminListTeachers: jest.fn(),
      adminUpsertTeacher: jest.fn(),
      adminUpsertMonitor: jest.fn(),
    } as unknown as jest.Mocked<TeacherProfileService>;

    mockFileUploadService = {
      getPresignedUploadUrl: jest.fn(),
      getPublicUrl: jest.fn(),
    } as unknown as jest.Mocked<FileUploadService>;

    app = await buildApp({
      teacherService: mockTeacherService,
      fileUploadService: mockFileUploadService,
      skipDbInit: true,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. File Upload Presigned URL', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/files/upload-url',
        payload: {
          bizType: 'teacher_video',
          contentType: 'video/mp4',
          contentLength: 10 * 1024 * 1024,
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 200 with presigned upload credentials', async () => {
      mockFileUploadService.getPresignedUploadUrl.mockResolvedValue({
        uploadUrl: 'https://s3.example.com/put-url',
        key: 'dream/teachers/videos/2026/11/04/abc123456789.mp4',
        expiresIn: 300,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/files/upload-url',
        headers: parentHeaders,
        payload: {
          bizType: 'teacher_video',
          contentType: 'video/mp4',
          contentLength: 20 * 1024 * 1024,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.uploadUrl).toBe('https://s3.example.com/put-url');
      expect(json.data.key).toBe('dream/teachers/videos/2026/11/04/abc123456789.mp4');
    });
  });

  describe('2. Public Endpoints', () => {
    it('should return public teachers list with 200', async () => {
      mockTeacherService.listPublicTeachers.mockResolvedValue([sampleTeacherCard]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/public/teachers',
        headers: parentHeaders,
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].displayName).toBe('Teacher Sarah');
      expect(json.meta.total).toBe(1);
    });

    it('should return 200 for teacher details when found', async () => {
      mockTeacherService.getPublicTeacherById.mockResolvedValue(sampleTeacherCard);

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/public/teachers/tea123456789',
        headers: parentHeaders,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe('tea123456789');
    });

    it('should return 404 when teacher not found', async () => {
      mockTeacherService.getPublicTeacherById.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/public/teachers/tea999999999',
        headers: parentHeaders,
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return dictionaries for course types and levels', async () => {
      mockTeacherService.listCourseTypes.mockResolvedValue([
        { id: 'ct1234567890', name: '自然拼读', sortOrder: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ]);
      mockTeacherService.listTeacherLevels.mockResolvedValue([
        { id: 'lvl123456789', name: '资深外教', sortOrder: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const resTypes = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/public/dictionaries/course-types',
        headers: parentHeaders,
      });
      expect(resTypes.statusCode).toBe(200);
      expect(resTypes.json().data).toHaveLength(1);

      const resLevels = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/public/dictionaries/teacher-levels',
        headers: parentHeaders,
      });
      expect(resLevels.statusCode).toBe(200);
      expect(resLevels.json().data).toHaveLength(1);
    });
  });

  describe('3. Monitor Workspace Endpoints (Role Protected)', () => {
    it('should return 403 when non-monitor accesses /monitor/teachers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/monitor/teachers',
        headers: parentHeaders, // roles: ['parent']
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 200 with teachers for valid monitor', async () => {
      mockTeacherService.listTeachersByMonitor.mockResolvedValue([sampleTeacherDetail]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/monitor/teachers',
        headers: monitorHeaders,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(1);
    });

    it('should return 201 on create teacher by monitor', async () => {
      mockTeacherService.createTeacher.mockResolvedValue(sampleTeacherDetail);

      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/monitor/teachers',
        headers: monitorHeaders,
        payload: {
          displayName: 'Teacher Sarah',
          levelId: 'lvl123456789',
          skillCourseTypeIds: ['ct1234567890'],
          introZh: '中文简介测试内容至少十个字',
          introEn: 'English intro for testing teacher profile creation',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().data.displayName).toBe('Teacher Sarah');
    });

    it('should return 400 when create teacher payload is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/monitor/teachers',
        headers: monitorHeaders,
        payload: {
          displayName: '', // empty name
          levelId: 'short',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 200 on update teacher by monitor', async () => {
      mockTeacherService.updateTeacher.mockResolvedValue({
        ...sampleTeacherDetail,
        displayName: 'Updated Sarah',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/dream/v1/monitor/teachers/tea123456789',
        headers: monitorHeaders,
        payload: {
          displayName: 'Updated Sarah',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.displayName).toBe('Updated Sarah');
    });

    it('should return 404 when monitor updates teacher not owned (IDOR)', async () => {
      mockTeacherService.updateTeacher.mockRejectedValue(
        new ApiError('教师档案不存在或无权操作', 404, 'NOT_FOUND')
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/dream/v1/monitor/teachers/tea_other000',
        headers: monitorHeaders,
        payload: {
          displayName: 'Try Hack',
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 200 on soft delete teacher by monitor', async () => {
      mockTeacherService.deleteTeacher.mockResolvedValue(true);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/dream/v1/monitor/teachers/tea123456789',
        headers: monitorHeaders,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.success).toBe(true);
    });
  });

  describe('4. Admin Endpoints (Role Protected)', () => {
    it('should return 403 when non-admin accesses /admin/teachers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/admin/teachers',
        headers: monitorHeaders, // roles: ['monitor']
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 200 with all teachers for admin', async () => {
      mockTeacherService.adminListTeachers.mockResolvedValue([sampleTeacherDetail]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/admin/teachers',
        headers: adminHeaders,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(1);
    });

    it('should return 201 on admin creating teacher with custom monitor binding', async () => {
      mockTeacherService.adminUpsertTeacher.mockResolvedValue(sampleTeacherDetail);

      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/admin/teachers',
        headers: adminHeaders,
        payload: {
          displayName: 'Teacher Sarah',
          levelId: 'lvl123456789',
          monitorProfileId: 'mon123456789',
          skillCourseTypeIds: ['ct1234567890'],
          introZh: '中文简介测试内容至少十个字',
          introEn: 'English intro for testing teacher profile creation',
        },
      });

      expect(res.statusCode).toBe(201);
    });

    it('should return 200 on admin upserting monitor profile', async () => {
      mockTeacherService.adminUpsertMonitor.mockResolvedValue({
        id: 'mon123456789',
        accountId: 'acc_new_mon1',
        displayName: '新班长Bob',
        phone: '13900000000',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/admin/monitors',
        headers: adminHeaders,
        payload: {
          accountId: 'acc_new_mon1',
          displayName: '新班长Bob',
          phone: '13900000000',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.displayName).toBe('新班长Bob');
    });
  });
});
