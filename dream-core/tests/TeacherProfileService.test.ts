/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { ApiError } from '@topeetop/shared-core';
import { TeacherProfileService } from '../src/modules/profile/TeacherProfileService.js';
import { FileUploadService } from '../src/modules/file/FileUploadService.js';
import {
  TeacherProfileMapper,
  MonitorProfileMapper,
  TeacherLevelMapper,
  CourseTypeMapper,
} from '../src/db/index.js';
import {
  CourseTypeRecord,
  TeacherLevelRecord,
  MonitorProfileRecord,
  TeacherProfileRecord,
  TeacherProfileWithDetailsRecord,
} from '../src/types/teacherProfile.types.js';

describe('TeacherProfileService', () => {
  let service: TeacherProfileService;
  let mockTeacherMapper: jest.Mocked<TeacherProfileMapper>;
  let mockMonitorMapper: jest.Mocked<MonitorProfileMapper>;
  let mockLevelMapper: jest.Mocked<TeacherLevelMapper>;
  let mockCourseMapper: jest.Mocked<CourseTypeMapper>;
  let fileUploadService: FileUploadService;

  const mockDate = new Date('2026-11-04T00:00:00.000Z');

  const sampleMonitor: MonitorProfileRecord = {
    id: 'mon123456789',
    accountId: 'acc123456789',
    displayName: '班长Alice',
    phone: '13800000000',
    createdAt: mockDate,
    updatedAt: mockDate,
    deletedAt: null,
  };

  const sampleLevel: TeacherLevelRecord = {
    id: 'lvl123456789',
    name: '高级外教',
    sortOrder: 1,
    isActive: true,
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  const sampleCourseTypes: CourseTypeRecord[] = [
    {
      id: 'ct1123456789',
      name: '自然拼读',
      sortOrder: 1,
      isActive: true,
      createdAt: mockDate,
      updatedAt: mockDate,
    },
    {
      id: 'ct2123456789',
      name: '分级阅读',
      sortOrder: 2,
      isActive: true,
      createdAt: mockDate,
      updatedAt: mockDate,
    },
  ];

  const sampleTeacher: TeacherProfileRecord = {
    id: 'tea123456789',
    accountId: null,
    displayName: 'Teacher John',
    levelId: 'lvl123456789',
    monitorProfileId: 'mon123456789',
    skillCourseTypeIds: ['ct1123456789', 'ct2123456789'],
    introZh: '拥有10年少儿英语教学经验',
    introEn: 'Over 10 years of experience teaching young learners English',
    photoKey: 'dream/teachers/photos/2026/11/04/photo1234567.webp',
    videoKey: 'dream/teachers/videos/2026/11/04/video1234567.mp4',
    classinQrKey: 'dream/teachers/classin_qr/2026/11/04/qr1234567890.webp',
    resignedAt: null,
    createdAt: mockDate,
    updatedAt: mockDate,
    deletedAt: null,
  };

  const sampleTeacherWithDetails: TeacherProfileWithDetailsRecord = {
    ...sampleTeacher,
    levelName: '高级外教',
    monitorDisplayName: '班长Alice',
  };

  beforeEach(() => {
    mockTeacherMapper = {
      findPublicList: jest.fn(),
      findPublicById: jest.fn(),
      findByMonitorProfileId: jest.fn(),
      create: jest.fn(),
      updateByMonitor: jest.fn(),
      softDeleteByMonitor: jest.fn(),
      findAllWithDetails: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<TeacherProfileMapper>;

    mockMonitorMapper = {
      findByAccountId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      listAll: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<MonitorProfileMapper>;

    mockLevelMapper = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      listAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<TeacherLevelMapper>;

    mockCourseMapper = {
      findByIds: jest.fn(),
      listAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<CourseTypeMapper>;

    fileUploadService = new FileUploadService(undefined, {
      cdnDomain: 'https://cdn.topee.top',
    });

    service = new TeacherProfileService(
      mockTeacherMapper,
      mockMonitorMapper,
      mockLevelMapper,
      mockCourseMapper,
      fileUploadService
    );
  });

  describe('listPublicTeachers', () => {
    it('should return empty list when no public teachers match', async () => {
      mockTeacherMapper.findPublicList.mockResolvedValue([]);

      const result = await service.listPublicTeachers();
      expect(result).toEqual([]);
      expect(mockTeacherMapper.findPublicList).toHaveBeenCalledTimes(1);
    });

    it('should return desensitized teacher cards with CDN URLs and skill course types', async () => {
      mockTeacherMapper.findPublicList.mockResolvedValue([sampleTeacherWithDetails]);
      mockCourseMapper.findByIds.mockResolvedValue(sampleCourseTypes);

      const result = await service.listPublicTeachers({ levelId: 'lvl123456789' });

      expect(result).toHaveLength(1);
      const card = result[0];
      expect(card.id).toBe('tea123456789');
      expect(card.displayName).toBe('Teacher John');
      expect(card.levelName).toBe('高级外教');
      expect(card.monitorDisplayName).toBe('班长Alice');
      expect(card.skillCourseTypes).toEqual([
        { id: 'ct1123456789', name: '自然拼读' },
        { id: 'ct2123456789', name: '分级阅读' },
      ]);
      expect(card.photoUrl).toBe(
        'https://cdn.topee.top/dream/teachers/photos/2026/11/04/photo1234567.webp'
      );
      expect(card.videoUrl).toBe(
        'https://cdn.topee.top/dream/teachers/videos/2026/11/04/video1234567.mp4'
      );
      expect(card.classinQrUrl).toBe(
        'https://cdn.topee.top/dream/teachers/classin_qr/2026/11/04/qr1234567890.webp'
      );
    });
  });

  describe('getPublicTeacherById', () => {
    it('should return null when teacher not found', async () => {
      mockTeacherMapper.findPublicById.mockResolvedValue(null);

      const result = await service.getPublicTeacherById('tea999999999');
      expect(result).toBeNull();
    });

    it('should return teacher card when found', async () => {
      mockTeacherMapper.findPublicById.mockResolvedValue(sampleTeacherWithDetails);
      mockCourseMapper.findByIds.mockResolvedValue(sampleCourseTypes);

      const result = await service.getPublicTeacherById('tea123456789');
      expect(result).not.toBeNull();
      expect(result?.displayName).toBe('Teacher John');
    });
  });

  describe('listTeachersByMonitor', () => {
    it('should throw forbidden 403 when current account is not a monitor', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(null);

      await expect(service.listTeachersByMonitor('acc_not_monitor')).rejects.toThrow(
        'Monitor profile not found for account'
      );
    });

    it('should return monitor teachers when account is valid monitor', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockTeacherMapper.findByMonitorProfileId.mockResolvedValue([sampleTeacher]);
      mockLevelMapper.findByIds.mockResolvedValue([sampleLevel]);
      mockCourseMapper.findByIds.mockResolvedValue(sampleCourseTypes);

      const result = await service.listTeachersByMonitor('acc123456789');

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Teacher John');
      expect(result[0].levelName).toBe('高级外教');
      expect(result[0].monitorDisplayName).toBe('班长Alice');
    });
  });

  describe('createTeacher', () => {
    const createInput = {
      displayName: 'Teacher Bob',
      levelId: 'lvl123456789',
      skillCourseTypeIds: ['ct1123456789'],
      introZh: '中文简介测试内容至少十个字',
      introEn: 'English intro for testing teacher profile creation',
    };

    it('should throw forbidden 403 when creator is not a monitor', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(null);

      await expect(service.createTeacher('acc_fake', createInput)).rejects.toThrow(
        'Monitor profile not found for account'
      );
    });

    it('should throw bad request 400 when level does not exist or inactive', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockLevelMapper.findById.mockResolvedValue(null);

      await expect(service.createTeacher('acc123456789', createInput)).rejects.toThrow(
        'Teacher level does not exist or is inactive'
      );
    });

    it('should throw bad request 400 when skill course type is invalid', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockLevelMapper.findById.mockResolvedValue(sampleLevel);
      mockCourseMapper.findByIds.mockResolvedValue([]); // not found

      await expect(service.createTeacher('acc123456789', createInput)).rejects.toThrow(
        'Invalid or inactive course type provided'
      );
    });

    it('should create teacher successfully locked to current monitor', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockLevelMapper.findById.mockResolvedValue(sampleLevel);
      mockCourseMapper.findByIds.mockResolvedValue([sampleCourseTypes[0]]);
      mockTeacherMapper.create.mockResolvedValue({
        ...sampleTeacher,
        displayName: 'Teacher Bob',
      });

      const result = await service.createTeacher('acc123456789', createInput);

      expect(result.displayName).toBe('Teacher Bob');
      expect(mockTeacherMapper.create).toHaveBeenCalledWith(
        expect.objectContaining({
          monitorProfileId: 'mon123456789',
          levelId: 'lvl123456789',
        })
      );
    });
  });

  describe('updateTeacher (IDOR Protection)', () => {
    it('should throw 404 when teacher does not belong to current monitor (IDOR)', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockTeacherMapper.updateByMonitor.mockResolvedValue(null); // IDOR mismatch or not found

      await expect(
        service.updateTeacher('acc123456789', 'tea_other', {
          displayName: 'Updated Name',
        })
      ).rejects.toThrow('Teacher profile not found or permission denied');
    });

    it('should update teacher successfully when owned by monitor', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockTeacherMapper.updateByMonitor.mockResolvedValue({
        ...sampleTeacher,
        displayName: 'Updated John',
      });
      mockLevelMapper.findById.mockResolvedValue(sampleLevel);
      mockCourseMapper.findByIds.mockResolvedValue(sampleCourseTypes);

      const result = await service.updateTeacher('acc123456789', 'tea123456789', {
        displayName: 'Updated John',
      });

      expect(result.displayName).toBe('Updated John');
      expect(mockTeacherMapper.updateByMonitor).toHaveBeenCalledWith(
        'tea123456789',
        'mon123456789',
        { displayName: 'Updated John' }
      );
    });
  });

  describe('deleteTeacher (IDOR Protection)', () => {
    it('should throw 404 when deleting teacher not belonging to monitor', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockTeacherMapper.softDeleteByMonitor.mockResolvedValue(false);

      await expect(
        service.deleteTeacher('acc123456789', 'tea_other')
      ).rejects.toThrow('Teacher profile not found or permission denied');
    });

    it('should soft delete teacher successfully when owned', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockTeacherMapper.softDeleteByMonitor.mockResolvedValue(true);

      const result = await service.deleteTeacher('acc123456789', 'tea123456789');
      expect(result).toBe(true);
    });
  });

  describe('admin operations', () => {
    it('should allow admin to list all teachers with details', async () => {
      mockTeacherMapper.findAllWithDetails.mockResolvedValue([sampleTeacherWithDetails]);
      mockCourseMapper.findByIds.mockResolvedValue(sampleCourseTypes);

      const result = await service.adminListTeachers();
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Teacher John');
    });

    it('should allow admin to upsert teacher with any monitor assignment', async () => {
      mockMonitorMapper.findById.mockResolvedValue(sampleMonitor);
      mockLevelMapper.findById.mockResolvedValue(sampleLevel);
      mockCourseMapper.findByIds.mockResolvedValue(sampleCourseTypes);
      mockTeacherMapper.update.mockResolvedValue(sampleTeacher);

      const result = await service.adminUpsertTeacher('tea123456789', {
        displayName: 'Teacher John',
        levelId: 'lvl123456789',
        monitorProfileId: 'mon123456789',
        skillCourseTypeIds: ['ct1123456789'],
        introZh: '中文简介测试内容至少十个字',
        introEn: 'English intro for testing teacher profile creation',
      });

      expect(result.displayName).toBe('Teacher John');
    });

    it('should allow admin to upsert monitor profile', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(null);
      mockMonitorMapper.create.mockResolvedValue(sampleMonitor);

      const result = await service.adminUpsertMonitor({
        accountId: 'acc123456789',
        displayName: '班长Alice',
      });

      expect(result.displayName).toBe('班长Alice');
    });
  });

  describe('dictionaries', () => {
    it('should list course types and teacher levels', async () => {
      mockCourseMapper.listAll.mockResolvedValue(sampleCourseTypes);
      mockLevelMapper.listAll.mockResolvedValue([sampleLevel]);

      const types = await service.listCourseTypes();
      const levels = await service.listTeacherLevels();

      expect(types).toHaveLength(2);
      expect(levels).toHaveLength(1);
    });
  });
});
