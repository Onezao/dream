/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { ApiError } from '@topeetop/shared-core';
import {
  TeacherProfileMapper,
  MonitorProfileMapper,
  TeacherLevelMapper,
  CourseTypeMapper,
} from '../../db/index.js';
import {
  CourseTypeRecord,
  TeacherLevelRecord,
  MonitorProfileRecord,
  TeacherProfileRecord,
  TeacherProfileWithDetailsRecord,
} from '../../types/teacherProfile.types.js';
import { FileUploadService } from '../file/FileUploadService.js';
import {
  CreateTeacherProfileInput,
  UpdateTeacherProfileInput,
  AdminUpsertTeacherInput,
  AdminUpsertMonitorInput,
  TeacherCardDto,
  TeacherDetailDto,
} from './teacher.types.js';

export class TeacherProfileService {
  constructor(
    private readonly teacherProfileMapper: TeacherProfileMapper = new TeacherProfileMapper(),
    private readonly monitorProfileMapper: MonitorProfileMapper = new MonitorProfileMapper(),
    private readonly teacherLevelMapper: TeacherLevelMapper = new TeacherLevelMapper(),
    private readonly courseTypeMapper: CourseTypeMapper = new CourseTypeMapper(),
    private readonly fileUploadService: FileUploadService = new FileUploadService()
  ) {}

  /**
   * 按 AccountId 获取班长档案
   */
  async getMonitorByAccountId(accountId: string): Promise<MonitorProfileRecord | null> {
    return this.monitorProfileMapper.findByAccountId(accountId);
  }

  /**
   * 按 ID 获取班长档案
   */
  async getMonitorById(id: string): Promise<MonitorProfileRecord | null> {
    return this.monitorProfileMapper.findById(id);
  }

  /**
   * 公开只读：获取教师脱敏卡片列表（物理脱敏，含 CDN 多媒体加速地址）
   */
  async listPublicTeachers(filter?: {
    levelId?: string;
    courseTypeId?: string;
  }): Promise<TeacherCardDto[]> {
    const records = await this.teacherProfileMapper.findPublicList(filter);
    if (records.length === 0) {
      return [];
    }

    // 批量加载所有相关课程类型
    const allCourseTypeIds = Array.from(
      new Set(records.flatMap((r) => r.skillCourseTypeIds))
    );
    const courseTypes = await this.courseTypeMapper.findByIds(allCourseTypeIds);
    const courseTypeMap = new Map(courseTypes.map((c) => [c.id, c.name]));

    return records.map((record) =>
      this.mapToTeacherCardDto(record, courseTypeMap)
    );
  }

  /**
   * 公开只读：获取单个教师脱敏卡片详情
   */
  async getPublicTeacherById(id: string): Promise<TeacherCardDto | null> {
    const record = await this.teacherProfileMapper.findPublicById(id);
    if (!record) {
      return null;
    }

    const courseTypes = await this.courseTypeMapper.findByIds(
      record.skillCourseTypeIds
    );
    const courseTypeMap = new Map(courseTypes.map((c) => [c.id, c.name]));

    return this.mapToTeacherCardDto(record, courseTypeMap);
  }

  /**
   * 班长端：获取当前班长负责的外教列表
   */
  async listTeachersByMonitor(monitorAccountId: string): Promise<TeacherDetailDto[]> {
    const monitor = await this.monitorProfileMapper.findByAccountId(monitorAccountId);
    if (!monitor) {
      throw new ApiError('Monitor profile not found for account', 403, 'FORBIDDEN');
    }

    const teachers = await this.teacherProfileMapper.findByMonitorProfileId(monitor.id);
    if (teachers.length === 0) {
      return [];
    }

    // 批量补充定级与课程类型
    const levelIds = Array.from(new Set(teachers.map((t) => t.levelId)));
    const levels = await this.teacherLevelMapper.findByIds(levelIds);
    const levelMap = new Map(levels.map((l) => [l.id, l.name]));

    const allCourseTypeIds = Array.from(
      new Set(teachers.flatMap((t) => t.skillCourseTypeIds))
    );
    const courseTypes = await this.courseTypeMapper.findByIds(allCourseTypeIds);
    const courseTypeMap = new Map(courseTypes.map((c) => [c.id, c.name]));

    return teachers.map((teacher) =>
      this.mapToTeacherDetailDto(
        teacher,
        levelMap.get(teacher.levelId),
        monitor.displayName,
        courseTypeMap
      )
    );
  }

  /**
   * 班长端：新增所辖教师档案 (强制锁定负责班长为当前班长)
   */
  async createTeacher(
    monitorAccountId: string,
    input: CreateTeacherProfileInput
  ): Promise<TeacherDetailDto> {
    const monitor = await this.monitorProfileMapper.findByAccountId(monitorAccountId);
    if (!monitor) {
      throw new ApiError('Monitor profile not found for account', 403, 'FORBIDDEN');
    }

    // 校验教师级别是否存在
    const level = await this.teacherLevelMapper.findById(input.levelId);
    if (!level || !level.isActive) {
      throw new ApiError('Teacher level does not exist or is inactive', 400, 'TEACHER_LEVEL_INVALID');
    }

    // 校验擅长课程类型
    const courseTypes = await this.courseTypeMapper.findByIds(input.skillCourseTypeIds);
    if (courseTypes.length !== input.skillCourseTypeIds.length) {
      throw new ApiError('Invalid or inactive course type provided', 400, 'COURSE_TYPE_INVALID');
    }
    const courseTypeMap = new Map(courseTypes.map((c) => [c.id, c.name]));

    // 插入数据库
    const record = await this.teacherProfileMapper.create({
      displayName: input.displayName,
      levelId: input.levelId,
      monitorProfileId: monitor.id, // 强制绑定当前班长，严禁篡改
      skillCourseTypeIds: input.skillCourseTypeIds,
      introZh: input.introZh,
      introEn: input.introEn,
      photoKey: input.photoKey ?? null,
      videoKey: input.videoKey ?? null,
      classinQrKey: input.classinQrKey ?? null,
    });

    return this.mapToTeacherDetailDto(
      record,
      level.name,
      monitor.displayName,
      courseTypeMap
    );
  }

  /**
   * 班长端：更新所辖教师档案 (严格防越权 IDOR 校验)
   */
  async updateTeacher(
    monitorAccountId: string,
    teacherId: string,
    input: UpdateTeacherProfileInput
  ): Promise<TeacherDetailDto> {
    const monitor = await this.monitorProfileMapper.findByAccountId(monitorAccountId);
    if (!monitor) {
      throw new ApiError('Monitor profile not found for account', 403, 'FORBIDDEN');
    }

    if (input.levelId) {
      const level = await this.teacherLevelMapper.findById(input.levelId);
      if (!level || !level.isActive) {
        throw new ApiError('Teacher level does not exist or is inactive', 400, 'TEACHER_LEVEL_INVALID');
      }
    }

    if (input.skillCourseTypeIds) {
      const courseTypes = await this.courseTypeMapper.findByIds(input.skillCourseTypeIds);
      if (courseTypes.length !== input.skillCourseTypeIds.length) {
        throw new ApiError('Invalid or inactive course type provided', 400, 'COURSE_TYPE_INVALID');
      }
    }

    const updated = await this.teacherProfileMapper.updateByMonitor(
      teacherId,
      monitor.id,
      input
    );
    if (!updated) {
      throw new ApiError('Teacher profile not found or permission denied', 404, 'NOT_FOUND');
    }

    const level = await this.teacherLevelMapper.findById(updated.levelId);
    const courseTypes = await this.courseTypeMapper.findByIds(updated.skillCourseTypeIds);
    const courseTypeMap = new Map(courseTypes.map((c) => [c.id, c.name]));

    return this.mapToTeacherDetailDto(
      updated,
      level?.name,
      monitor.displayName,
      courseTypeMap
    );
  }

  /**
   * 班长端：软删除所辖教师档案 (防越权 IDOR)
   */
  async deleteTeacher(monitorAccountId: string, teacherId: string): Promise<boolean> {
    const monitor = await this.monitorProfileMapper.findByAccountId(monitorAccountId);
    if (!monitor) {
      throw new ApiError('Monitor profile not found for account', 403, 'FORBIDDEN');
    }

    const success = await this.teacherProfileMapper.softDeleteByMonitor(
      teacherId,
      monitor.id
    );
    if (!success) {
      throw new ApiError('Teacher profile not found or permission denied', 404, 'NOT_FOUND');
    }

    return true;
  }

  /**
   * 管理员端：全量教师列表
   */
  async adminListTeachers(): Promise<TeacherDetailDto[]> {
    const records = await this.teacherProfileMapper.findAllWithDetails();
    if (records.length === 0) {
      return [];
    }

    const allCourseTypeIds = Array.from(
      new Set(records.flatMap((r) => r.skillCourseTypeIds))
    );
    const courseTypes = await this.courseTypeMapper.findByIds(allCourseTypeIds);
    const courseTypeMap = new Map(courseTypes.map((c) => [c.id, c.name]));

    return records.map((record) => ({
      id: record.id,
      accountId: record.accountId,
      displayName: record.displayName,
      levelId: record.levelId,
      levelName: record.levelName,
      monitorProfileId: record.monitorProfileId,
      monitorDisplayName: record.monitorDisplayName,
      skillCourseTypeIds: record.skillCourseTypeIds,
      skillCourseTypes: record.skillCourseTypeIds.map((id) => ({
        id,
        name: courseTypeMap.get(id) || id,
      })),
      introZh: record.introZh,
      introEn: record.introEn,
      photoKey: record.photoKey,
      photoUrl: this.fileUploadService.getPublicUrl(record.photoKey),
      videoKey: record.videoKey,
      videoUrl: this.fileUploadService.getPublicUrl(record.videoKey),
      classinQrKey: record.classinQrKey,
      classinQrUrl: this.fileUploadService.getPublicUrl(record.classinQrKey),
      resignedAt: record.resignedAt ? record.resignedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));
  }

  /**
   * 管理员端：新增/改绑教师档案
   */
  async adminUpsertTeacher(
    teacherId: string | null,
    input: AdminUpsertTeacherInput
  ): Promise<TeacherDetailDto> {
    const monitor = await this.monitorProfileMapper.findById(input.monitorProfileId);
    if (!monitor) {
      throw new ApiError('Assigned monitor profile not found', 400, 'MONITOR_NOT_FOUND');
    }

    const level = await this.teacherLevelMapper.findById(input.levelId);
    if (!level) {
      throw new ApiError('Teacher level does not exist', 400, 'TEACHER_LEVEL_INVALID');
    }

    const courseTypes = await this.courseTypeMapper.findByIds(input.skillCourseTypeIds);
    const courseTypeMap = new Map(courseTypes.map((c) => [c.id, c.name]));

    let record: TeacherProfileRecord;

    if (teacherId) {
      const updated = await this.teacherProfileMapper.update(teacherId, {
        displayName: input.displayName,
        levelId: input.levelId,
        monitorProfileId: input.monitorProfileId,
        accountId: input.accountId ?? undefined,
        skillCourseTypeIds: input.skillCourseTypeIds,
        introZh: input.introZh,
        introEn: input.introEn,
        photoKey: input.photoKey,
        videoKey: input.videoKey,
        classinQrKey: input.classinQrKey,
        resignedAt: input.resigned ? new Date() : null,
      });
      if (!updated) {
        throw new ApiError('Teacher profile not found', 404, 'NOT_FOUND');
      }
      record = updated;
    } else {
      record = await this.teacherProfileMapper.create({
        displayName: input.displayName,
        levelId: input.levelId,
        monitorProfileId: input.monitorProfileId,
        accountId: input.accountId ?? null,
        skillCourseTypeIds: input.skillCourseTypeIds,
        introZh: input.introZh,
        introEn: input.introEn,
        photoKey: input.photoKey ?? null,
        videoKey: input.videoKey ?? null,
        classinQrKey: input.classinQrKey ?? null,
      });
    }

    return this.mapToTeacherDetailDto(
      record,
      level.name,
      monitor.displayName,
      courseTypeMap
    );
  }

  /**
   * 管理员端：新增/更新班长档案
   */
  async adminUpsertMonitor(input: AdminUpsertMonitorInput): Promise<MonitorProfileRecord> {
    const existing = await this.monitorProfileMapper.findByAccountId(input.accountId);
    if (existing) {
      const updated = await this.monitorProfileMapper.update(existing.id, {
        displayName: input.displayName,
        phone: input.phone ?? null,
      });
      if (!updated) {
        throw new ApiError('Failed to update monitor profile', 500, 'UPDATE_FAILED');
      }
      return updated;
    }

    return this.monitorProfileMapper.create({
      accountId: input.accountId,
      displayName: input.displayName,
      phone: input.phone ?? null,
    });
  }

  /**
   * 字典：获取课程类型列表
   */
  async listCourseTypes(activeOnly: boolean = true): Promise<CourseTypeRecord[]> {
    return this.courseTypeMapper.listAll({ activeOnly });
  }

  /**
   * 字典：获取教师定级列表
   */
  async listTeacherLevels(activeOnly: boolean = true): Promise<TeacherLevelRecord[]> {
    return this.teacherLevelMapper.listAll({ activeOnly });
  }

  // ---------------- 私有辅助方法 ----------------

  private mapToTeacherCardDto(
    record: TeacherProfileWithDetailsRecord,
    courseTypeMap: Map<string, string>
  ): TeacherCardDto {
    return {
      id: record.id,
      displayName: record.displayName,
      levelName: record.levelName,
      monitorDisplayName: record.monitorDisplayName,
      skillCourseTypes: record.skillCourseTypeIds.map((id) => ({
        id,
        name: courseTypeMap.get(id) || id,
      })),
      introZh: record.introZh,
      introEn: record.introEn,
      photoUrl: this.fileUploadService.getPublicUrl(record.photoKey),
      videoUrl: this.fileUploadService.getPublicUrl(record.videoKey),
      classinQrUrl: this.fileUploadService.getPublicUrl(record.classinQrKey),
    };
  }

  private mapToTeacherDetailDto(
    record: TeacherProfileRecord,
    levelName?: string,
    monitorDisplayName?: string,
    courseTypeMap?: Map<string, string>
  ): TeacherDetailDto {
    return {
      id: record.id,
      accountId: record.accountId,
      displayName: record.displayName,
      levelId: record.levelId,
      levelName,
      monitorProfileId: record.monitorProfileId,
      monitorDisplayName,
      skillCourseTypeIds: record.skillCourseTypeIds,
      skillCourseTypes: courseTypeMap
        ? record.skillCourseTypeIds.map((id) => ({
            id,
            name: courseTypeMap.get(id) || id,
          }))
        : undefined,
      introZh: record.introZh,
      introEn: record.introEn,
      photoKey: record.photoKey,
      photoUrl: this.fileUploadService.getPublicUrl(record.photoKey),
      videoKey: record.videoKey,
      videoUrl: this.fileUploadService.getPublicUrl(record.videoKey),
      classinQrKey: record.classinQrKey,
      classinQrUrl: this.fileUploadService.getPublicUrl(record.classinQrKey),
      resignedAt: record.resignedAt ? record.resignedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
