/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { DatabaseService, executeTx as defaultExecuteTx, ApiError } from '@topeetop/shared-core';
import { ClassMapper } from '../../db/ClassMapper.js';
import { ClassStudentMapper } from '../../db/ClassStudentMapper.js';
import { MonitorProfileMapper } from '../../db/MonitorProfileMapper.js';
import { TeacherProfileMapper } from '../../db/TeacherProfileMapper.js';
import { CourseTypeMapper } from '../../db/CourseTypeMapper.js';
import { StudentProfileMapper } from '../../db/StudentProfileMapper.js';
import type {
  ClassRecord,
  ClassStudentRecord,
  ClassStatus,
  FindPublicSmallGroupClassesFilter,
} from '../../types/class.types.js';
import {
  CreateSmallGroupClassSchema,
  CreateSmallGroupClassInput,
  PublicSmallGroupClassDto,
  MonitorClassDto,
  AdminClassDto,
  AdminClassQueryInput,
  AdminUpdateClassInput,
  EnsureOneToOneClassParams,
  ClassServiceOptions,
} from './class.types.js';

export interface ClassServiceDependencies {
  classMapper?: ClassMapper;
  classStudentMapper?: ClassStudentMapper;
  monitorProfileMapper?: MonitorProfileMapper;
  teacherProfileMapper?: TeacherProfileMapper;
  courseTypeMapper?: CourseTypeMapper;
  studentProfileMapper?: StudentProfileMapper;
  db?: DatabaseService;
  cdnBaseUrl?: string;
}

export class ClassService {
  private readonly classMapper: ClassMapper;
  private readonly classStudentMapper: ClassStudentMapper;
  private readonly monitorProfileMapper: MonitorProfileMapper;
  private readonly teacherProfileMapper: TeacherProfileMapper;
  private readonly courseTypeMapper: CourseTypeMapper;
  private readonly studentProfileMapper: StudentProfileMapper;
  private readonly db?: DatabaseService;
  private readonly cdnBaseUrl: string;

  constructor(
    classMapper?: ClassMapper | ClassServiceDependencies,
    classStudentMapper?: ClassStudentMapper,
    monitorProfileMapper?: MonitorProfileMapper,
    teacherProfileMapper?: TeacherProfileMapper,
    courseTypeMapper?: CourseTypeMapper,
    studentProfileMapper?: StudentProfileMapper,
    db?: DatabaseService,
    options?: ClassServiceOptions
  ) {
    if (classMapper && typeof classMapper === 'object' && !(classMapper instanceof ClassMapper)) {
      const deps = classMapper as ClassServiceDependencies;
      this.db = deps.db;
      this.classMapper = deps.classMapper ?? new ClassMapper(this.db);
      this.classStudentMapper = deps.classStudentMapper ?? new ClassStudentMapper(this.db);
      this.monitorProfileMapper = deps.monitorProfileMapper ?? new MonitorProfileMapper(this.db);
      this.teacherProfileMapper = deps.teacherProfileMapper ?? new TeacherProfileMapper(this.db);
      this.courseTypeMapper = deps.courseTypeMapper ?? new CourseTypeMapper(this.db);
      this.studentProfileMapper = deps.studentProfileMapper ?? new StudentProfileMapper(this.db);
      this.cdnBaseUrl = deps.cdnBaseUrl ?? '';
    } else {
      this.db = db;
      this.classMapper = (classMapper as ClassMapper | undefined) ?? new ClassMapper(db);
      this.classStudentMapper = classStudentMapper ?? new ClassStudentMapper(db);
      this.monitorProfileMapper = monitorProfileMapper ?? new MonitorProfileMapper(db);
      this.teacherProfileMapper = teacherProfileMapper ?? new TeacherProfileMapper(db);
      this.courseTypeMapper = courseTypeMapper ?? new CourseTypeMapper(db);
      this.studentProfileMapper = studentProfileMapper ?? new StudentProfileMapper(db);
      this.cdnBaseUrl = options?.cdnBaseUrl ?? '';
    }
  }

  // ===========================================================================
  // 事务编排辅助方法
  // ===========================================================================

  private async executeTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (this.db) {
      return this.db.executeTx(callback);
    }
    return defaultExecuteTx(callback);
  }

  // ===========================================================================
  // CDN 链接规范化
  // ===========================================================================

  private resolveCdnUrl(key: string | null | undefined): string | null {
    if (!key) {
      return null;
    }
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key;
    }
    if (!this.cdnBaseUrl) {
      return key;
    }
    const baseUrl = this.cdnBaseUrl.replace(/\/+$/, '');
    const cleanKey = key.replace(/^\/+/, '');
    return `${baseUrl}/${cleanKey}`;
  }

  // ===========================================================================
  // 1. 1v1 课程静默建班 (Silent 1v1 Provisioning & Retrieval)
  // ===========================================================================

  /**
   * 1v1 静默建班 / 幂等获取现有班级
   *
   * 业务规则：
   * 1. 检查学员是否已在与目标教师、课程类型的 1v1 班级中；若存在直接幂等返回；
   * 2. 若不存在，严格校验学员、教师与课程类型存在性；
   * 3. 继承教师名下负责班长（若未显式指定）；
   * 4. 静默创建 class_type = '1v1', min_students = 1, max_students = 1, status = 'active' 的班级实体；
   * 5. 立即将学员选入班级并在同一事务内提交。
   */
  async ensureOneToOneClass(
    params: EnsureOneToOneClassParams,
    client?: PoolClient
  ): Promise<ClassRecord> {
    if (!params.studentProfileId || !params.teacherProfileId || !params.courseTypeId) {
      throw new ApiError('缺少必要的 1v1 关联参数', 400, 'BAD_REQUEST');
    }

    if (client) {
      return this.ensureOneToOneClassInternal(params, client);
    }

    return this.executeTransaction((txClient) =>
      this.ensureOneToOneClassInternal(params, txClient)
    );
  }

  private async ensureOneToOneClassInternal(
    params: EnsureOneToOneClassParams,
    client: PoolClient
  ): Promise<ClassRecord> {
    // 1. 幂等查重：检查学员是否已在该组合的 1v1 班级中
    const existingClass = await this.classMapper.findOneToOneForStudent(
      params.studentProfileId,
      params.teacherProfileId,
      params.courseTypeId,
      client
    );
    if (existingClass) {
      return existingClass;
    }

    // 2. 校验学员实体
    const student = await this.studentProfileMapper.findById(params.studentProfileId, client);
    if (!student) {
      throw new ApiError('学员档案不存在', 404, 'STUDENT_NOT_FOUND');
    }

    // 3. 校验教师实体
    const teacher = await this.teacherProfileMapper.findById(params.teacherProfileId, client);
    if (!teacher) {
      throw new ApiError('授课教师档案不存在', 404, 'TEACHER_NOT_FOUND');
    }

    // 4. 校验课程类型
    const courseType = await this.courseTypeMapper.findById(params.courseTypeId, client);
    if (!courseType) {
      throw new ApiError('课程类型不存在', 404, 'COURSE_TYPE_NOT_FOUND');
    }

    // 5. 确定负责班长（优先入参，缺省继承教师所绑定的责任班长）
    const ownerMonitorProfileId = params.ownerMonitorProfileId || teacher.monitorProfileId;
    if (!ownerMonitorProfileId) {
      throw new ApiError('教师未分配所属班长，无法建班', 400, 'TEACHER_MONITOR_MISSING');
    }

    // 6. 自动生成班级名称（格式：1v1 - {学员昵称} - {课程类型名称}，最多64字）
    const rawName = `1v1 - ${student.nickname} - ${courseType.name}`;
    const name = rawName.slice(0, 64);

    // 7. 写入班级实体
    const newClass = await this.classMapper.create(
      {
        name,
        classType: '1v1',
        courseTypeId: params.courseTypeId,
        teacherProfileId: params.teacherProfileId,
        ownerMonitorProfileId,
        minStudents: 1,
        maxStudents: 1,
        teacherSalaryPoints: 0,
        platformCommissionRate: 0.0,
        status: 'active',
      },
      client
    );

    // 8. 写入学员报名关系
    await this.classStudentMapper.create(
      {
        classId: newClass.id,
        studentProfileId: params.studentProfileId,
        status: 'enrolled',
      },
      client
    );

    return newClass;
  }

  // ===========================================================================
  // 2. 小班课显式录入 (Small Group Class Creation)
  // ===========================================================================

  /**
   * 班长端录入小班课 (自负盈亏)
   */
  async createSmallGroupClass(
    monitorAccountId: string,
    dto: CreateSmallGroupClassInput,
    client?: PoolClient
  ): Promise<MonitorClassDto> {
    const validated = CreateSmallGroupClassSchema.parse(dto);

    // 1. 班长身份物理校验 (IDOR 强隔离)
    const monitor = await this.monitorProfileMapper.findByAccountId(monitorAccountId, client);
    if (!monitor) {
      throw new ApiError('当前账号未关联班长档案', 403, 'FORBIDDEN');
    }

    // 2. 授课教师存在性校验
    const teacher = await this.teacherProfileMapper.findById(validated.teacherProfileId, client);
    if (!teacher) {
      throw new ApiError('授课教师档案不存在', 404, 'TEACHER_NOT_FOUND');
    }

    // 3. 课程类型存在性校验
    const courseType = await this.courseTypeMapper.findById(validated.courseTypeId, client);
    if (!courseType) {
      throw new ApiError('课程类型不存在', 404, 'COURSE_TYPE_NOT_FOUND');
    }

    // 4. 写入班级实体 (初始状态强制为 recruiting)
    const record = await this.classMapper.create(
      {
        name: validated.name,
        classType: 'small_group',
        courseTypeId: validated.courseTypeId,
        teacherProfileId: validated.teacherProfileId,
        ownerMonitorProfileId: monitor.id,
        minStudents: validated.minStudents,
        maxStudents: validated.maxStudents,
        teacherSalaryPoints: validated.teacherSalaryPoints,
        platformCommissionRate: validated.platformCommissionRate,
        status: 'recruiting',
        plannedStartDate: validated.plannedStartDate,
      },
      client
    );

    return {
      id: record.id,
      name: record.name,
      courseTypeName: courseType.name,
      teacherDisplayName: teacher.displayName,
      teacherPhotoUrl: this.resolveCdnUrl(teacher.photoKey),
      minStudents: record.minStudents,
      maxStudents: record.maxStudents,
      enrolledCount: 0,
      isFull: false,
      plannedStartDate: record.plannedStartDate,
      status: record.status,
      ownerMonitorProfileId: record.ownerMonitorProfileId,
      teacherSalaryPoints: record.teacherSalaryPoints,
      platformCommissionRate: record.platformCommissionRate,
      forceStartedAt: null,
      createdAt: record.createdAt.toISOString(),
      enrolledStudents: [],
    };
  }

  // ===========================================================================
  // 3. 并发排他锁防超卖选课 (Concurrency Lock Enrollment)
  // ===========================================================================

  /**
   * 学员报名选入班级 (带 SELECT ... FOR UPDATE 原生行级锁)
   */
  async enrollStudent(
    classId: string,
    studentProfileId: string,
    client?: PoolClient
  ): Promise<ClassStudentRecord> {
    if (!classId || !studentProfileId) {
      throw new ApiError('班级编号或学员编号不能为空', 400, 'BAD_REQUEST');
    }

    if (client) {
      return this.enrollStudentInternal(classId, studentProfileId, client);
    }

    return this.executeTransaction((txClient) =>
      this.enrollStudentInternal(classId, studentProfileId, txClient)
    );
  }

  private async enrollStudentInternal(
    classId: string,
    studentProfileId: string,
    client: PoolClient
  ): Promise<ClassStudentRecord> {
    // 1. 原生行级排他锁锁定班级行 (SELECT ... FOR UPDATE)
    const targetClass = await this.classMapper.findByIdForUpdate(classId, client);
    if (!targetClass) {
      throw new ApiError('班级不存在', 404, 'CLASS_NOT_FOUND');
    }

    // 2. 状态机前置守卫：必须处于 recruiting 招募中
    if (targetClass.status !== 'recruiting') {
      throw new ApiError('班级未处于招募状态', 409, 'CLASS_STATE_INVALID');
    }

    // 3. 学员档案有效性校验
    const student = await this.studentProfileMapper.findById(studentProfileId, client);
    if (!student) {
      throw new ApiError('学员档案不存在', 404, 'STUDENT_NOT_FOUND');
    }

    // 4. 重复报名幂等拦截
    const activeEnrollment = await this.classStudentMapper.findActiveEnrollment(
      classId,
      studentProfileId,
      client
    );
    if (activeEnrollment) {
      throw new ApiError('学员已在班级中，请勿重复报名', 409, 'ALREADY_ENROLLED');
    }

    // 5. 容量上限刚性截流 (并发防超卖核心)
    const enrolledCount = await this.classStudentMapper.countEnrolled(classId, client);
    if (enrolledCount >= targetClass.maxStudents) {
      throw new ApiError('班级名额已满，无法加塞', 409, 'CLASS_FULL');
    }

    // 6. 落盘学员在读关系
    return this.classStudentMapper.create(
      {
        classId,
        studentProfileId,
        status: 'enrolled',
      },
      client
    );
  }

  // ===========================================================================
  // 4. 班长强制开班 (Force Start Class)
  // ===========================================================================

  /**
   * 班长二次确认强制开班 (未达 Min 时人工决策流转为 active)
   */
  async forceStartClass(classId: string, monitorAccountId: string): Promise<MonitorClassDto> {
    const monitor = await this.monitorProfileMapper.findByAccountId(monitorAccountId);
    if (!monitor) {
      throw new ApiError('当前账号未关联班长档案', 403, 'FORBIDDEN');
    }

    const targetClass = await this.classMapper.findById(classId);
    if (!targetClass) {
      throw new ApiError('班级不存在', 404, 'CLASS_NOT_FOUND');
    }

    // IDOR 校验：必须为责任班长本人
    if (targetClass.ownerMonitorProfileId !== monitor.id) {
      throw new ApiError('无权操作此班级', 403, 'FORBIDDEN');
    }

    if (targetClass.status !== 'recruiting') {
      throw new ApiError('班级未处于招募状态，无法强制开班', 409, 'CLASS_STATE_INVALID');
    }

    const updated = await this.classMapper.updateForceStarted(classId, new Date());
    if (!updated) {
      throw new ApiError('更新班级状态失败', 500, 'INTERNAL_SERVER_ERROR');
    }

    return this.buildMonitorClassDto(updated);
  }

  // ===========================================================================
  // 5. 班长取消班级 (Cancel Class)
  // ===========================================================================

  /**
   * 班长取消班级 (流转为 cancelled 并撤销班内所有在读学员)
   */
  async cancelClass(
    classId: string,
    monitorAccountId: string,
    reason?: string
  ): Promise<{ success: boolean }> {
    const monitor = await this.monitorProfileMapper.findByAccountId(monitorAccountId);
    if (!monitor) {
      throw new ApiError('当前账号未关联班长档案', 403, 'FORBIDDEN');
    }

    const targetClass = await this.classMapper.findById(classId);
    if (!targetClass) {
      throw new ApiError('班级不存在', 404, 'CLASS_NOT_FOUND');
    }

    // IDOR 校验
    if (targetClass.ownerMonitorProfileId !== monitor.id) {
      throw new ApiError('无权操作此班级', 403, 'FORBIDDEN');
    }

    // 终态不可流转守卫
    if (targetClass.status === 'completed' || targetClass.status === 'cancelled') {
      throw new ApiError('班级已处于完结或取消状态', 409, 'CLASS_STATE_INVALID');
    }

    await this.executeTransaction(async (txClient) => {
      await this.classMapper.updateStatus(classId, 'cancelled', txClient);
      await this.classStudentMapper.withdrawAllInClass(classId, txClient);
    });

    return { success: true };
  }

  // ===========================================================================
  // 6. 班级查询列表 (Public & Monitor Listings)
  // ===========================================================================

  /**
   * 招募中小班课公开选班大厅列表
   */
  async listPublicSmallGroupClasses(
    filter?: FindPublicSmallGroupClassesFilter
  ): Promise<PublicSmallGroupClassDto[]> {
    const records = await this.classMapper.findPublicSmallGroupClasses(filter);
    return records.map((record) => ({
      id: record.id,
      name: record.name,
      courseTypeName: record.courseTypeName,
      teacherDisplayName: record.teacherDisplayName,
      teacherPhotoUrl: this.resolveCdnUrl(record.teacherPhotoKey),
      minStudents: record.minStudents,
      maxStudents: record.maxStudents,
      enrolledCount: record.enrolledCount,
      isFull: record.isFull,
      plannedStartDate: record.plannedStartDate,
      status: record.status,
    }));
  }

  /**
   * 班长端看板列表 (所辖小班课及学员报名详情)
   */
  async listMonitorClasses(
    monitorAccountId: string,
    status?: ClassStatus | ClassStatus[]
  ): Promise<MonitorClassDto[]> {
    const monitor = await this.monitorProfileMapper.findByAccountId(monitorAccountId);
    if (!monitor) {
      throw new ApiError('当前账号未关联班长档案', 403, 'FORBIDDEN');
    }

    const classes = await this.classMapper.findByMonitor(monitor.id, {
      status,
      classType: 'small_group',
    });

    return Promise.all(classes.map((cls) => this.buildMonitorClassDto(cls)));
  }

  /**
   * 班长端单个班级详情查询 (带 IDOR 校验)
   */
  async getMonitorClassDetail(
    classId: string,
    monitorAccountId: string
  ): Promise<MonitorClassDto> {
    const monitor = await this.monitorProfileMapper.findByAccountId(monitorAccountId);
    if (!monitor) {
      throw new ApiError('当前账号未关联班长档案', 403, 'FORBIDDEN');
    }

    const targetClass = await this.classMapper.findById(classId);
    if (!targetClass) {
      throw new ApiError('班级不存在', 404, 'CLASS_NOT_FOUND');
    }

    if (targetClass.ownerMonitorProfileId !== monitor.id) {
      throw new ApiError('无权查看此班级', 403, 'FORBIDDEN');
    }

    return this.buildMonitorClassDto(targetClass);
  }

  /**
   * 根据 ID 检索班级原始记录
   */
  async getClassById(classId: string, client?: PoolClient): Promise<ClassRecord | null> {
    return this.classMapper.findById(classId, client);
  }

  // ===========================================================================
  // 内部辅助组装
  // ===========================================================================

  private async buildMonitorClassDto(
    cls: ClassRecord,
    client?: PoolClient
  ): Promise<MonitorClassDto> {
    const [courseType, teacher, enrolledStudents] = await Promise.all([
      this.courseTypeMapper.findById(cls.courseTypeId, client),
      this.teacherProfileMapper.findById(cls.teacherProfileId, client),
      this.classStudentMapper.findEnrolledStudentsWithDetails(cls.id, client),
    ]);

    const enrolledCount = enrolledStudents.length;

    return {
      id: cls.id,
      name: cls.name,
      courseTypeName: courseType?.name ?? '未知课程',
      teacherDisplayName: teacher?.displayName ?? '未知教师',
      teacherPhotoUrl: this.resolveCdnUrl(teacher?.photoKey),
      minStudents: cls.minStudents,
      maxStudents: cls.maxStudents,
      enrolledCount,
      isFull: enrolledCount >= cls.maxStudents,
      plannedStartDate: cls.plannedStartDate,
      status: cls.status,
      ownerMonitorProfileId: cls.ownerMonitorProfileId,
      teacherSalaryPoints: cls.teacherSalaryPoints,
      platformCommissionRate: cls.platformCommissionRate,
      forceStartedAt: cls.forceStartedAt ? cls.forceStartedAt.toISOString() : null,
      createdAt: cls.createdAt.toISOString(),
      enrolledStudents: enrolledStudents.map((s) => ({
        studentProfileId: s.studentProfileId,
        nickname: s.nickname,
        avatarUrl: this.resolveCdnUrl(s.avatarKey),
        enrolledAt: s.enrolledAt.toISOString(),
      })),
    };
  }

  // ===========================================================================
  // 7. 管理员端接口编排 (Admin Endpoints)
  // ===========================================================================

  /**
   * 全平台班级统一管理与分页列表
   */
  async adminListClasses(query: AdminClassQueryInput): Promise<{
    data: AdminClassDto[];
    meta: { total: number; page: number; pageSize: number };
  }> {
    const limit = query.pageSize;
    const offset = (query.page - 1) * query.pageSize;
    const filter = {
      status: query.status,
      classType: query.classType,
      ownerMonitorProfileId: query.ownerMonitorProfileId,
      teacherProfileId: query.teacherProfileId,
      courseTypeId: query.courseTypeId,
      limit,
      offset,
    };

    const [classes, total] = await Promise.all([
      this.classMapper.findAll(filter),
      this.classMapper.countAll(filter),
    ]);

    const data = await Promise.all(
      classes.map(async (cls) => {
        const monitorDto = await this.buildMonitorClassDto(cls);
        return {
          ...monitorDto,
          classType: cls.classType,
          updatedAt: cls.updatedAt.toISOString(),
        };
      })
    );

    return {
      data,
      meta: {
        total,
        page: query.page,
        pageSize: query.pageSize,
      },
    };
  }

  /**
   * 管理员统一调配/更新班级
   */
  async adminUpdateClass(
    classId: string,
    input: AdminUpdateClassInput
  ): Promise<AdminClassDto> {
    const existing = await this.classMapper.findById(classId);
    if (!existing) {
      throw new ApiError('班级不存在', 404, 'CLASS_NOT_FOUND');
    }

    if (input.teacherProfileId) {
      const teacher = await this.teacherProfileMapper.findById(input.teacherProfileId);
      if (!teacher) {
        throw new ApiError('指定的教师档案不存在', 404, 'TEACHER_NOT_FOUND');
      }
    }

    const updated = await this.classMapper.update(classId, {
      name: input.name,
      teacherProfileId: input.teacherProfileId,
      minStudents: input.minStudents,
      maxStudents: input.maxStudents,
      teacherSalaryPoints: input.teacherSalaryPoints,
      platformCommissionRate: input.platformCommissionRate,
      status: input.status,
      plannedStartDate: input.plannedStartDate,
    });

    if (!updated) {
      throw new ApiError('更新班级失败', 500, 'INTERNAL_ERROR');
    }

    const monitorDto = await this.buildMonitorClassDto(updated);
    return {
      ...monitorDto,
      classType: updated.classType,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
