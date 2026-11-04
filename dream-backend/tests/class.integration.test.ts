/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

process.env.NODE_ENV = 'test';
process.env.DB_URL = process.env.DB_URL || 'postgresql://localhost:5432/dream_test';

import type { FastifyInstance } from 'fastify';
import { ApiError } from '@topeetop/shared-core';
import {
  ClassService,
  PublicSmallGroupClassDto,
  MonitorClassDto,
  AdminClassDto,
} from '@topeetop/dream-core';
import { buildApp } from '../src/app.js';

describe('Class Integration Tests', () => {
  let app: FastifyInstance;
  let mockClassService: jest.Mocked<ClassService>;

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

  const samplePublicClass: PublicSmallGroupClassDto = {
    id: 'cls123456789',
    name: '周三晚自然拼读精读班',
    courseTypeName: '自然拼读',
    teacherDisplayName: 'Teacher Sarah',
    teacherPhotoUrl: 'https://cdn.topee.top/photo.webp',
    minStudents: 2,
    maxStudents: 4,
    enrolledCount: 2,
    isFull: false,
    plannedStartDate: '2026-11-20',
    status: 'recruiting',
  };

  const sampleMonitorClass: MonitorClassDto = {
    ...samplePublicClass,
    ownerMonitorProfileId: 'mon123456789',
    teacherSalaryPoints: 100,
    platformCommissionRate: 15.0,
    forceStartedAt: null,
    createdAt: '2026-11-04T12:00:00.000Z',
    enrolledStudents: [
      {
        studentProfileId: 'stu123456789',
        nickname: 'AliceZ12',
        avatarUrl: 'https://cdn.topee.top/avatar.webp',
        enrolledAt: '2026-11-04T12:30:00.000Z',
      },
    ],
  };

  const sampleAdminClass: AdminClassDto = {
    ...sampleMonitorClass,
    classType: 'small_group',
    updatedAt: '2026-11-04T12:00:00.000Z',
  };

  beforeAll(async () => {
    mockClassService = {
      listPublicSmallGroupClasses: jest.fn(),
      listMonitorClasses: jest.fn(),
      createSmallGroupClass: jest.fn(),
      forceStartClass: jest.fn(),
      cancelClass: jest.fn(),
      adminListClasses: jest.fn(),
      adminUpdateClass: jest.fn(),
    } as unknown as jest.Mocked<ClassService>;

    app = await buildApp({
      classService: mockClassService,
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

  describe('1. Public Small-Group Classes (/public/classes/small-group)', () => {
    it('should return 401 UNAUTHORIZED when no authorization header is sent', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/public/classes/small-group',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return public classes successfully for authenticated users', async () => {
      mockClassService.listPublicSmallGroupClasses.mockResolvedValue([samplePublicClass]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/public/classes/small-group',
        headers: parentHeaders,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].id).toBe('cls123456789');
      expect(json.meta.total).toBe(1);
    });

    it('should pass courseTypeId filter to service when provided', async () => {
      mockClassService.listPublicSmallGroupClasses.mockResolvedValue([samplePublicClass]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/public/classes/small-group?courseTypeId=ct1234567890',
        headers: parentHeaders,
      });

      expect(response.statusCode).toBe(200);
      expect(mockClassService.listPublicSmallGroupClasses).toHaveBeenCalledWith({
        courseTypeId: 'ct1234567890',
      });
    });
  });

  describe('2. Monitor Classes Endpoints (/monitor/classes)', () => {
    it('should forbid non-monitor access with 403', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/monitor/classes',
        headers: parentHeaders,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should list monitor classes successfully for monitor user', async () => {
      mockClassService.listMonitorClasses.mockResolvedValue([sampleMonitorClass]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/monitor/classes?status=recruiting',
        headers: monitorHeaders,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe('周三晚自然拼读精读班');
      expect(mockClassService.listMonitorClasses).toHaveBeenCalledWith(
        'acc_monitor_01',
        'recruiting'
      );
    });

    it('should create small-group class successfully with 201', async () => {
      mockClassService.createSmallGroupClass.mockResolvedValue(sampleMonitorClass);

      const payload = {
        name: '周三晚自然拼读精读班',
        courseTypeId: 'ct1234567890',
        teacherProfileId: 'tea123456789',
        minStudents: 2,
        maxStudents: 4,
        teacherSalaryPoints: 100,
        platformCommissionRate: 15.0,
        plannedStartDate: '2026-11-20',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/monitor/classes',
        headers: monitorHeaders,
        payload,
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.data.id).toBe('cls123456789');
      expect(mockClassService.createSmallGroupClass).toHaveBeenCalledWith(
        'acc_monitor_01',
        expect.objectContaining({ name: '周三晚自然拼读精读班' })
      );
    });

    it('should return 400 validation error if minStudents > maxStudents', async () => {
      const payload = {
        name: '非法班级配置',
        courseTypeId: 'ct1234567890',
        teacherProfileId: 'tea123456789',
        minStudents: 5,
        maxStudents: 3,
        teacherSalaryPoints: 100,
        platformCommissionRate: 15.0,
        plannedStartDate: '2026-11-20',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/monitor/classes',
        headers: monitorHeaders,
        payload,
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('should force start class successfully when confirm is true', async () => {
      mockClassService.forceStartClass.mockResolvedValue({
        ...sampleMonitorClass,
        status: 'active',
        forceStartedAt: '2026-11-04T13:00:00.000Z',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/monitor/classes/cls123456789/force-start',
        headers: monitorHeaders,
        payload: { confirm: true },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.status).toBe('active');
      expect(mockClassService.forceStartClass).toHaveBeenCalledWith(
        'cls123456789',
        'acc_monitor_01'
      );
    });

    it('should reject force start if confirm is not true', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/monitor/classes/cls123456789/force-start',
        headers: monitorHeaders,
        payload: { confirm: false },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should cancel class successfully with reason', async () => {
      mockClassService.cancelClass.mockResolvedValue({ success: true });

      const response = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/monitor/classes/cls123456789/cancel',
        headers: monitorHeaders,
        payload: { confirm: true, reason: '招募人数不足取消开班' },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.success).toBe(true);
      expect(mockClassService.cancelClass).toHaveBeenCalledWith(
        'cls123456789',
        'acc_monitor_01',
        '招募人数不足取消开班'
      );
    });

    it('should return 400 on cancel if reason is too short', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/dream/v1/monitor/classes/cls123456789/cancel',
        headers: monitorHeaders,
        payload: { confirm: true, reason: 'a' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('3. Admin Endpoints (/admin/classes)', () => {
    it('should forbid monitor from accessing admin classes endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/admin/classes',
        headers: monitorHeaders,
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return paginated classes for admin user', async () => {
      mockClassService.adminListClasses.mockResolvedValue({
        data: [sampleAdminClass],
        meta: { total: 1, page: 1, pageSize: 20 },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/dream/v1/admin/classes?page=1&pageSize=20',
        headers: adminHeaders,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data).toHaveLength(1);
      expect(json.meta.total).toBe(1);
      expect(mockClassService.adminListClasses).toHaveBeenCalled();
    });

    it('should allow admin to update class attributes', async () => {
      mockClassService.adminUpdateClass.mockResolvedValue({
        ...sampleAdminClass,
        name: '管理员调整后的班级名称',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/dream/v1/admin/classes/cls123456789',
        headers: adminHeaders,
        payload: {
          name: '管理员调整后的班级名称',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.name).toBe('管理员调整后的班级名称');
      expect(mockClassService.adminUpdateClass).toHaveBeenCalledWith(
        'cls123456789',
        expect.objectContaining({ name: '管理员调整后的班级名称' })
      );
    });

    it('should propagate 404 ApiError from service when class is not found', async () => {
      mockClassService.adminUpdateClass.mockRejectedValue(
        new ApiError('班级不存在', 404, 'CLASS_NOT_FOUND')
      );

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/dream/v1/admin/classes/cls999999999',
        headers: adminHeaders,
        payload: {
          name: '测试更新未找到',
        },
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.code).toBe('CLASS_NOT_FOUND');
    });
  });
});
