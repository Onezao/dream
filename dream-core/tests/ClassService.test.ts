/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { ApiError } from '@topeetop/shared-core';
import type { DatabaseService } from '@topeetop/shared-core';
import { ClassService } from '../src/modules/classes/ClassService.js';
import { ClassMapper } from '../src/db/ClassMapper.js';
import { ClassStudentMapper } from '../src/db/ClassStudentMapper.js';
import { MonitorProfileMapper } from '../src/db/MonitorProfileMapper.js';
import { TeacherProfileMapper } from '../src/db/TeacherProfileMapper.js';
import { CourseTypeMapper } from '../src/db/CourseTypeMapper.js';
import { StudentProfileMapper } from '../src/db/StudentProfileMapper.js';
import type {
  ClassRecord,
  ClassStudentRecord,
  PublicSmallGroupClassRecord,
  ClassEnrolledStudentRecord,
} from '../src/types/class.types.js';
import type {
  MonitorProfileRecord,
  TeacherProfileRecord,
  CourseTypeRecord,
} from '../src/types/teacherProfile.types.js';
import type { StudentProfileRecord } from '../src/types/studentProfile.types.js';

describe('ClassService Unit Tests', () => {
  let service: ClassService;
  let mockClassMapper: jest.Mocked<ClassMapper>;
  let mockClassStudentMapper: jest.Mocked<ClassStudentMapper>;
  let mockMonitorMapper: jest.Mocked<MonitorProfileMapper>;
  let mockTeacherMapper: jest.Mocked<TeacherProfileMapper>;
  let mockCourseMapper: jest.Mocked<CourseTypeMapper>;
  let mockStudentMapper: jest.Mocked<StudentProfileMapper>;

  const mockDate = new Date('2026-11-04T12:00:00.000Z');

  const sampleMonitor: MonitorProfileRecord = {
    id: 'mon123456789',
    accountId: 'acc_mon_0001',
    displayName: '班长Alice',
    phone: '13800000000',
    createdAt: mockDate,
    updatedAt: mockDate,
    deletedAt: null,
  };

  const sampleTeacher: TeacherProfileRecord = {
    id: 'tea123456789',
    accountId: null,
    displayName: 'Teacher Sarah',
    levelId: 'lvl123456789',
    monitorProfileId: 'mon123456789',
    skillCourseTypeIds: ['ct1234567890'],
    introZh: '中文简介内容测试十个字',
    introEn: 'English intro for testing',
    photoKey: 'dream/teachers/photos/photo.webp',
    videoKey: 'dream/teachers/videos/video.mp4',
    classinQrKey: 'dream/teachers/classin_qr/qr.webp',
    resignedAt: null,
    createdAt: mockDate,
    updatedAt: mockDate,
    deletedAt: null,
  };

  const sampleCourseType: CourseTypeRecord = {
    id: 'ct1234567890',
    name: '自然拼读',
    sortOrder: 1,
    isActive: true,
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  const sampleStudent: StudentProfileRecord = {
    id: 'stu123456789',
    accountId: 'acc_parent_01',
    realName: '张小丽',
    englishName: 'Alice',
    surnameInitial: 'Z',
    age: 12,
    nickname: 'AliceZ12',
    gender: 'female',
    birthDate: '2014-05-20',
    avatarKey: 'dream/students/avatars/avatar.webp',
    preferredCourseTypeIds: ['ct1234567890'],
    createdAt: mockDate,
    updatedAt: mockDate,
    deletedAt: null,
  };

  const sampleClass1v1: ClassRecord = {
    id: 'cls1v1123456',
    name: '1v1 - AliceZ12 - 自然拼读',
    classType: '1v1',
    courseTypeId: 'ct1234567890',
    teacherProfileId: 'tea123456789',
    ownerMonitorProfileId: 'mon123456789',
    minStudents: 1,
    maxStudents: 1,
    teacherSalaryPoints: 0,
    platformCommissionRate: 0.0,
    status: 'active',
    plannedStartDate: null,
    forceStartedAt: null,
    createdAt: mockDate,
    updatedAt: mockDate,
    deletedAt: null,
  };

  const sampleSmallGroupClass: ClassRecord = {
    id: 'cls_sg_12345',
    name: '周三晚自然拼读精读班',
    classType: 'small_group',
    courseTypeId: 'ct1234567890',
    teacherProfileId: 'tea123456789',
    ownerMonitorProfileId: 'mon123456789',
    minStudents: 2,
    maxStudents: 4,
    teacherSalaryPoints: 100,
    platformCommissionRate: 15.0,
    status: 'recruiting',
    plannedStartDate: '2026-11-20',
    forceStartedAt: null,
    createdAt: mockDate,
    updatedAt: mockDate,
    deletedAt: null,
  };

  const sampleEnrollment: ClassStudentRecord = {
    id: 'cs1234567890',
    classId: 'cls_sg_12345',
    studentProfileId: 'stu123456789',
    status: 'enrolled',
    enrolledAt: mockDate,
    removedAt: null,
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  beforeEach(() => {
    mockClassMapper = {
      findOneToOneForStudent: jest.fn(),
      findByIdForUpdate: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateForceStarted: jest.fn(),
      updateStatus: jest.fn(),
      findPublicSmallGroupClasses: jest.fn(),
      findByMonitor: jest.fn(),
      findAll: jest.fn(),
      countAll: jest.fn(),
    } as unknown as jest.Mocked<ClassMapper>;

    mockClassStudentMapper = {
      create: jest.fn(),
      findActiveEnrollment: jest.fn(),
      countEnrolled: jest.fn(),
      findEnrolledStudentsWithDetails: jest.fn(),
      withdrawAllInClass: jest.fn(),
    } as unknown as jest.Mocked<ClassStudentMapper>;

    mockMonitorMapper = {
      findByAccountId: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<MonitorProfileMapper>;

    mockTeacherMapper = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<TeacherProfileMapper>;

    mockCourseMapper = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<CourseTypeMapper>;

    mockStudentMapper = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<StudentProfileMapper>;

    const mockDb = {
      executeTx: jest.fn(async (callback: any) => callback({} as any)),
      executeQuery: jest.fn(),
      getOne: jest.fn(),
    } as unknown as DatabaseService;

    service = new ClassService({
      classMapper: mockClassMapper,
      classStudentMapper: mockClassStudentMapper,
      monitorProfileMapper: mockMonitorMapper,
      teacherProfileMapper: mockTeacherMapper,
      courseTypeMapper: mockCourseMapper,
      studentProfileMapper: mockStudentMapper,
      db: mockDb,
      cdnBaseUrl: 'https://cdn.topee.top',
    });
  });

  describe('1. ensureOneToOneClass', () => {
    it('should throw BAD_REQUEST when essential parameters are missing', async () => {
      await expect(
        service.ensureOneToOneClass({
          studentProfileId: '',
          teacherProfileId: 'tea1',
          courseTypeId: 'ct1',
        })
      ).rejects.toThrow('缺少必要的 1v1 关联参数');
    });

    it('should return existing class idempotently when already created', async () => {
      mockClassMapper.findOneToOneForStudent.mockResolvedValue(sampleClass1v1);

      const result = await service.ensureOneToOneClass({
        studentProfileId: 'stu123456789',
        teacherProfileId: 'tea123456789',
        courseTypeId: 'ct1234567890',
      });

      expect(result).toBe(sampleClass1v1);
      expect(mockClassMapper.create).not.toHaveBeenCalled();
    });

    it('should throw 404 when student profile does not exist', async () => {
      mockClassMapper.findOneToOneForStudent.mockResolvedValue(null);
      mockStudentMapper.findById.mockResolvedValue(null);

      await expect(
        service.ensureOneToOneClass({
          studentProfileId: 'stu_not_found',
          teacherProfileId: 'tea123456789',
          courseTypeId: 'ct1234567890',
        })
      ).rejects.toThrow('学员档案不存在');
    });

    it('should throw 404 when teacher profile does not exist', async () => {
      mockClassMapper.findOneToOneForStudent.mockResolvedValue(null);
      mockStudentMapper.findById.mockResolvedValue(sampleStudent);
      mockTeacherMapper.findById.mockResolvedValue(null);

      await expect(
        service.ensureOneToOneClass({
          studentProfileId: 'stu123456789',
          teacherProfileId: 'tea_not_found',
          courseTypeId: 'ct1234567890',
        })
      ).rejects.toThrow('授课教师档案不存在');
    });

    it('should create 1v1 class and enroll student on first schedule', async () => {
      mockClassMapper.findOneToOneForStudent.mockResolvedValue(null);
      mockStudentMapper.findById.mockResolvedValue(sampleStudent);
      mockTeacherMapper.findById.mockResolvedValue(sampleTeacher);
      mockCourseMapper.findById.mockResolvedValue(sampleCourseType);
      mockClassMapper.create.mockResolvedValue(sampleClass1v1);
      mockClassStudentMapper.create.mockResolvedValue(sampleEnrollment);

      const result = await service.ensureOneToOneClass({
        studentProfileId: 'stu123456789',
        teacherProfileId: 'tea123456789',
        courseTypeId: 'ct1234567890',
      });

      expect(result).toBe(sampleClass1v1);
      expect(mockClassMapper.create).toHaveBeenCalledWith(
        expect.objectContaining({
          classType: '1v1',
          minStudents: 1,
          maxStudents: 1,
          status: 'active',
          ownerMonitorProfileId: 'mon123456789',
        }),
        expect.anything()
      );
      expect(mockClassStudentMapper.create).toHaveBeenCalledWith(
        expect.objectContaining({
          classId: sampleClass1v1.id,
          studentProfileId: 'stu123456789',
          status: 'enrolled',
        }),
        expect.anything()
      );
    });
  });

  describe('2. createSmallGroupClass', () => {
    const input = {
      name: '自然拼读精读小班A',
      courseTypeId: 'ct1234567890',
      teacherProfileId: 'tea123456789',
      minStudents: 2,
      maxStudents: 4,
      teacherSalaryPoints: 120,
      platformCommissionRate: 10.0,
      plannedStartDate: '2026-11-20',
    };

    it('should throw FORBIDDEN 403 when creator account is not a monitor', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(null);

      await expect(service.createSmallGroupClass('acc_not_mon', input)).rejects.toThrow(
        '当前账号未关联班长档案'
      );
    });

    it('should throw NOT_FOUND 404 when teacher profile does not exist', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockTeacherMapper.findById.mockResolvedValue(null);

      await expect(service.createSmallGroupClass('acc_mon_0001', input)).rejects.toThrow(
        '授课教师档案不存在'
      );
    });

    it('should create small group class successfully locked to current monitor', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockTeacherMapper.findById.mockResolvedValue(sampleTeacher);
      mockCourseMapper.findById.mockResolvedValue(sampleCourseType);
      mockClassMapper.create.mockResolvedValue(sampleSmallGroupClass);

      const result = await service.createSmallGroupClass('acc_mon_0001', input);

      expect(result.id).toBe(sampleSmallGroupClass.id);
      expect(result.status).toBe('recruiting');
      expect(result.ownerMonitorProfileId).toBe(sampleMonitor.id);
      expect(result.teacherDisplayName).toBe('Teacher Sarah');
      expect(result.courseTypeName).toBe('自然拼读');
    });
  });

  describe('3. enrollStudent (Concurrency Lock)', () => {
    it('should throw NOT_FOUND 404 when class does not exist', async () => {
      mockClassMapper.findByIdForUpdate.mockResolvedValue(null);

      await expect(
        service.enrollStudent('cls_not_found', 'stu123456789')
      ).rejects.toThrow('班级不存在');
    });

    it('should throw 409 CLASS_STATE_INVALID when class status is not recruiting', async () => {
      mockClassMapper.findByIdForUpdate.mockResolvedValue({
        ...sampleSmallGroupClass,
        status: 'active',
      });

      await expect(
        service.enrollStudent('cls_sg_12345', 'stu123456789')
      ).rejects.toThrow('班级未处于招募状态');
    });

    it('should throw 404 when student does not exist', async () => {
      mockClassMapper.findByIdForUpdate.mockResolvedValue(sampleSmallGroupClass);
      mockStudentMapper.findById.mockResolvedValue(null);

      await expect(
        service.enrollStudent('cls_sg_12345', 'stu_not_found')
      ).rejects.toThrow('学员档案不存在');
    });

    it('should throw 409 ALREADY_ENROLLED when student is already enrolled in class', async () => {
      mockClassMapper.findByIdForUpdate.mockResolvedValue(sampleSmallGroupClass);
      mockStudentMapper.findById.mockResolvedValue(sampleStudent);
      mockClassStudentMapper.findActiveEnrollment.mockResolvedValue(sampleEnrollment);

      await expect(
        service.enrollStudent('cls_sg_12345', 'stu123456789')
      ).rejects.toThrow('学员已在班级中，请勿重复报名');
    });

    it('should throw 409 CLASS_FULL when enrolled count reaches maxStudents limit (Anti-Overselling)', async () => {
      mockClassMapper.findByIdForUpdate.mockResolvedValue({
        ...sampleSmallGroupClass,
        maxStudents: 4,
      });
      mockStudentMapper.findById.mockResolvedValue(sampleStudent);
      mockClassStudentMapper.findActiveEnrollment.mockResolvedValue(null);
      mockClassStudentMapper.countEnrolled.mockResolvedValue(4); // already 4/4!

      await expect(
        service.enrollStudent('cls_sg_12345', 'stu123456789')
      ).rejects.toThrow('班级名额已满，无法加塞');
    });

    it('should enroll student successfully when capacity permits', async () => {
      mockClassMapper.findByIdForUpdate.mockResolvedValue({
        ...sampleSmallGroupClass,
        maxStudents: 4,
      });
      mockStudentMapper.findById.mockResolvedValue(sampleStudent);
      mockClassStudentMapper.findActiveEnrollment.mockResolvedValue(null);
      mockClassStudentMapper.countEnrolled.mockResolvedValue(3); // 3/4 -> 4/4
      mockClassStudentMapper.create.mockResolvedValue(sampleEnrollment);

      const result = await service.enrollStudent('cls_sg_12345', 'stu123456789');

      expect(result).toBe(sampleEnrollment);
      expect(mockClassStudentMapper.create).toHaveBeenCalledWith(
        {
          classId: 'cls_sg_12345',
          studentProfileId: 'stu123456789',
          status: 'enrolled',
        },
        expect.anything()
      );
    });
  });

  describe('4. forceStartClass', () => {
    it('should throw 403 when monitor does not own the class (IDOR)', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue({
        ...sampleMonitor,
        id: 'mon_other_999',
      });
      mockClassMapper.findById.mockResolvedValue(sampleSmallGroupClass);

      await expect(
        service.forceStartClass('cls_sg_12345', 'acc_mon_other')
      ).rejects.toThrow('无权操作此班级');
    });

    it('should throw 409 when class is not in recruiting status', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockClassMapper.findById.mockResolvedValue({
        ...sampleSmallGroupClass,
        status: 'active',
      });

      await expect(
        service.forceStartClass('cls_sg_12345', 'acc_mon_0001')
      ).rejects.toThrow('班级未处于招募状态，无法强制开班');
    });

    it('should force start class and transition status to active', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockClassMapper.findById.mockResolvedValue(sampleSmallGroupClass);
      mockClassMapper.updateForceStarted.mockResolvedValue({
        ...sampleSmallGroupClass,
        status: 'active',
        forceStartedAt: mockDate,
      });
      mockCourseMapper.findById.mockResolvedValue(sampleCourseType);
      mockTeacherMapper.findById.mockResolvedValue(sampleTeacher);
      mockClassStudentMapper.findEnrolledStudentsWithDetails.mockResolvedValue([]);

      const result = await service.forceStartClass('cls_sg_12345', 'acc_mon_0001');

      expect(result.status).toBe('active');
      expect(result.forceStartedAt).toBe(mockDate.toISOString());
    });
  });

  describe('5. cancelClass', () => {
    it('should throw 403 when monitor does not own the class (IDOR)', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue({
        ...sampleMonitor,
        id: 'mon_other_999',
      });
      mockClassMapper.findById.mockResolvedValue(sampleSmallGroupClass);

      await expect(
        service.cancelClass('cls_sg_12345', 'acc_mon_other', '招生不足')
      ).rejects.toThrow('无权操作此班级');
    });

    it('should throw 409 when class is already cancelled or completed', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockClassMapper.findById.mockResolvedValue({
        ...sampleSmallGroupClass,
        status: 'cancelled',
      });

      await expect(
        service.cancelClass('cls_sg_12345', 'acc_mon_0001', '招生不足')
      ).rejects.toThrow('班级已处于完结或取消状态');
    });

    it('should cancel class and withdraw all enrolled students', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockClassMapper.findById.mockResolvedValue(sampleSmallGroupClass);

      const result = await service.cancelClass('cls_sg_12345', 'acc_mon_0001', '招生不足');

      expect(result.success).toBe(true);
      expect(mockClassMapper.updateStatus).toHaveBeenCalledWith('cls_sg_12345', 'cancelled', expect.anything());
      expect(mockClassStudentMapper.withdrawAllInClass).toHaveBeenCalledWith('cls_sg_12345', expect.anything());
    });
  });

  describe('6. listPublicSmallGroupClasses & monitor queries', () => {
    it('should return mapped public small group classes', async () => {
      const publicRecord: PublicSmallGroupClassRecord = {
        id: 'cls_sg_12345',
        name: '自然拼读精读班',
        courseTypeName: '自然拼读',
        teacherDisplayName: 'Teacher Sarah',
        teacherPhotoKey: 'dream/teachers/photos/photo.webp',
        minStudents: 2,
        maxStudents: 4,
        enrolledCount: 2,
        isFull: false,
        plannedStartDate: '2026-11-20',
        status: 'recruiting',
        createdAt: mockDate,
      };

      mockClassMapper.findPublicSmallGroupClasses.mockResolvedValue([publicRecord]);

      const list = await service.listPublicSmallGroupClasses();

      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('自然拼读精读班');
      expect(list[0].enrolledCount).toBe(2);
      expect(list[0].isFull).toBe(false);
      expect(list[0].teacherPhotoUrl).toBe('https://cdn.topee.top/dream/teachers/photos/photo.webp');
    });

    it('should list monitor classes with student details', async () => {
      mockMonitorMapper.findByAccountId.mockResolvedValue(sampleMonitor);
      mockClassMapper.findByMonitor.mockResolvedValue([sampleSmallGroupClass]);
      mockCourseMapper.findById.mockResolvedValue(sampleCourseType);
      mockTeacherMapper.findById.mockResolvedValue(sampleTeacher);

      const studentDetail: ClassEnrolledStudentRecord = {
        id: 'cs_detail_1',
        classId: 'cls_sg_12345',
        studentProfileId: 'stu123456789',
        nickname: 'AliceZ12',
        avatarKey: 'dream/students/avatars/avatar.webp',
        enrolledAt: mockDate,
        status: 'enrolled',
      };
      mockClassStudentMapper.findEnrolledStudentsWithDetails.mockResolvedValue([studentDetail]);

      const result = await service.listMonitorClasses('acc_mon_0001');

      expect(result).toHaveLength(1);
      expect(result[0].enrolledStudents).toHaveLength(1);
      expect(result[0].enrolledStudents[0].nickname).toBe('AliceZ12');
      expect(result[0].enrolledStudents[0].avatarUrl).toBe('https://cdn.topee.top/dream/students/avatars/avatar.webp');
    });
  });

  describe('7. Admin Operations', () => {
    it('should list admin classes with pagination metadata', async () => {
      mockClassMapper.findAll.mockResolvedValue([sampleSmallGroupClass]);
      mockClassMapper.countAll.mockResolvedValue(1);
      mockCourseMapper.findById.mockResolvedValue(sampleCourseType);
      mockTeacherMapper.findById.mockResolvedValue(sampleTeacher);
      mockClassStudentMapper.findEnrolledStudentsWithDetails.mockResolvedValue([]);

      const result = await service.adminListClasses({
        page: 1,
        pageSize: 10,
        status: 'recruiting',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, pageSize: 10 });
      expect(result.data[0].classType).toBe('small_group');
    });

    it('should update class details by admin successfully', async () => {
      mockClassMapper.findById.mockResolvedValue(sampleSmallGroupClass);
      mockTeacherMapper.findById.mockResolvedValue(sampleTeacher);
      mockClassMapper.update.mockResolvedValue({
        ...sampleSmallGroupClass,
        name: '更新后的小班课名称',
        minStudents: 3,
      });
      mockCourseMapper.findById.mockResolvedValue(sampleCourseType);
      mockClassStudentMapper.findEnrolledStudentsWithDetails.mockResolvedValue([]);

      const updated = await service.adminUpdateClass(sampleSmallGroupClass.id, {
        name: '更新后的小班课名称',
        teacherProfileId: sampleTeacher.id,
        minStudents: 3,
      });

      expect(updated.name).toBe('更新后的小班课名称');
      expect(updated.minStudents).toBe(3);
    });

    it('should throw NOT_FOUND if class does not exist for admin update', async () => {
      mockClassMapper.findById.mockResolvedValue(null);

      await expect(
        service.adminUpdateClass('non_exist_cls', { name: '新班名' })
      ).rejects.toThrow('班级不存在');
    });
  });
});
