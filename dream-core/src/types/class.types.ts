/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { QueryResultRow } from 'pg';

// =============================================================================
// 1. 枚举与联合类型 (Enums & Union Types)
// =============================================================================

export type ClassType = '1v1' | 'small_group';
export type ClassStatus = 'recruiting' | 'active' | 'completed' | 'cancelled';
export type ClassStudentStatus = 'enrolled' | 'withdrawn';

// =============================================================================
// 2. 班级实体 (Class Row, Record & DbInputs)
// =============================================================================

/**
 * PostgreSQL 表 dream.classes 原始行结构 (snake_case)
 */
export interface ClassRow extends QueryResultRow {
  id: string;
  name: string;
  class_type: ClassType;
  course_type_id: string;
  teacher_profile_id: string;
  owner_monitor_profile_id: string;
  min_students: number;
  max_students: number;
  teacher_salary_points: number;
  platform_commission_rate: string | number;
  status: ClassStatus;
  planned_start_date: string | Date | null;
  force_started_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

/**
 * 班级实体领域结构 (camelCase)
 */
export interface ClassRecord {
  id: string;
  name: string;
  classType: ClassType;
  courseTypeId: string;
  teacherProfileId: string;
  ownerMonitorProfileId: string;
  minStudents: number;
  maxStudents: number;
  teacherSalaryPoints: number;
  platformCommissionRate: number;
  status: ClassStatus;
  plannedStartDate: string | null;
  forceStartedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Mapper 创建班级输入参数
 */
export interface CreateClassDbInput {
  id?: string;
  name: string;
  classType: ClassType;
  courseTypeId: string;
  teacherProfileId: string;
  ownerMonitorProfileId: string;
  minStudents?: number;
  maxStudents?: number;
  teacherSalaryPoints?: number;
  platformCommissionRate?: number;
  status?: ClassStatus;
  plannedStartDate?: string | Date | null;
  forceStartedAt?: string | Date | null;
}

/**
 * Mapper 更新班级输入参数
 */
export interface UpdateClassDbInput {
  name?: string;
  teacherProfileId?: string;
  minStudents?: number;
  maxStudents?: number;
  teacherSalaryPoints?: number;
  platformCommissionRate?: number;
  status?: ClassStatus;
  plannedStartDate?: string | Date | null;
  forceStartedAt?: string | Date | null;
}

// =============================================================================
// 3. 班级学员报名关系 (Class Student Row, Record & DbInputs)
// =============================================================================

/**
 * PostgreSQL 表 dream.class_students 原始行结构 (snake_case)
 */
export interface ClassStudentRow extends QueryResultRow {
  id: string;
  class_id: string;
  student_profile_id: string;
  status: ClassStudentStatus;
  enrolled_at: Date | string;
  removed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * 班级学员报名领域结构 (camelCase)
 */
export interface ClassStudentRecord {
  id: string;
  classId: string;
  studentProfileId: string;
  status: ClassStudentStatus;
  enrolledAt: Date;
  removedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mapper 新增班级学员输入参数
 */
export interface CreateClassStudentDbInput {
  id?: string;
  classId: string;
  studentProfileId: string;
  status?: ClassStudentStatus;
  enrolledAt?: string | Date;
}

// =============================================================================
// 4. 复合查询结构 (Joined Rows & Records)
// =============================================================================

/**
 * 公开小班课列表原始行结构 (含课程名称、教师信息与聚合报名数)
 */
export interface PublicSmallGroupClassRow extends QueryResultRow {
  id: string;
  name: string;
  course_type_name: string;
  teacher_display_name: string;
  teacher_photo_key: string | null;
  min_students: number;
  max_students: number;
  enrolled_count: string | number;
  planned_start_date: string | Date | null;
  status: ClassStatus;
  created_at: Date | string;
}

/**
 * 公开小班课列表领域结构
 */
export interface PublicSmallGroupClassRecord {
  id: string;
  name: string;
  courseTypeName: string;
  teacherDisplayName: string;
  teacherPhotoKey: string | null;
  minStudents: number;
  maxStudents: number;
  enrolledCount: number;
  isFull: boolean;
  plannedStartDate: string | null;
  status: ClassStatus;
  createdAt: Date;
}

/**
 * 班级在读学员原始行结构 (含学员昵称与头像)
 */
export interface ClassEnrolledStudentRow extends QueryResultRow {
  id: string;
  class_id: string;
  student_profile_id: string;
  nickname: string;
  avatar_key: string | null;
  enrolled_at: Date | string;
  status: ClassStudentStatus;
}

/**
 * 班级在读学员领域结构
 */
export interface ClassEnrolledStudentRecord {
  id: string;
  classId: string;
  studentProfileId: string;
  nickname: string;
  avatarKey: string | null;
  enrolledAt: Date;
  status: ClassStudentStatus;
}

// =============================================================================
// 5. 查询过滤条件 (Filter Criteria)
// =============================================================================

export interface FindClassesFilter {
  ownerMonitorProfileId?: string;
  teacherProfileId?: string;
  courseTypeId?: string;
  classType?: ClassType;
  status?: ClassStatus | ClassStatus[];
  limit?: number;
  offset?: number;
}

export interface FindPublicSmallGroupClassesFilter {
  courseTypeId?: string;
  status?: 'recruiting' | 'active';
  limit?: number;
  offset?: number;
}

// =============================================================================
// 6. 映射与格式化工具函数 (Mapping Helpers)
// =============================================================================

/**
 * 规范化日期字符串 (YYYY-MM-DD)
 */
export function formatDateOnly(val: string | Date | null | undefined): string | null {
  if (!val) {
    return null;
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'string') {
    return val.slice(0, 10);
  }
  return null;
}

/**
 * 映射 ClassRow 到 ClassRecord
 */
export function mapRowToClassRecord(row: ClassRow): ClassRecord {
  return {
    id: row.id,
    name: row.name,
    classType: row.class_type,
    courseTypeId: row.course_type_id,
    teacherProfileId: row.teacher_profile_id,
    ownerMonitorProfileId: row.owner_monitor_profile_id,
    minStudents: Number(row.min_students),
    maxStudents: Number(row.max_students),
    teacherSalaryPoints: Number(row.teacher_salary_points),
    platformCommissionRate: Number(row.platform_commission_rate),
    status: row.status,
    plannedStartDate: formatDateOnly(row.planned_start_date),
    forceStartedAt: row.force_started_at
      ? row.force_started_at instanceof Date
        ? row.force_started_at
        : new Date(row.force_started_at)
      : null,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    deletedAt: row.deleted_at
      ? row.deleted_at instanceof Date
        ? row.deleted_at
        : new Date(row.deleted_at)
      : null,
  };
}

/**
 * 映射 ClassStudentRow 到 ClassStudentRecord
 */
export function mapRowToClassStudentRecord(row: ClassStudentRow): ClassStudentRecord {
  return {
    id: row.id,
    classId: row.class_id,
    studentProfileId: row.student_profile_id,
    status: row.status,
    enrolledAt: row.enrolled_at instanceof Date ? row.enrolled_at : new Date(row.enrolled_at),
    removedAt: row.removed_at
      ? row.removed_at instanceof Date
        ? row.removed_at
        : new Date(row.removed_at)
      : null,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  };
}

/**
 * 映射 PublicSmallGroupClassRow 到 PublicSmallGroupClassRecord
 */
export function mapRowToPublicSmallGroupClassRecord(
  row: PublicSmallGroupClassRow
): PublicSmallGroupClassRecord {
  const minStudents = Number(row.min_students);
  const maxStudents = Number(row.max_students);
  const enrolledCount = Number(row.enrolled_count || 0);

  return {
    id: row.id,
    name: row.name,
    courseTypeName: row.course_type_name,
    teacherDisplayName: row.teacher_display_name,
    teacherPhotoKey: row.teacher_photo_key ?? null,
    minStudents,
    maxStudents,
    enrolledCount,
    isFull: enrolledCount >= maxStudents,
    plannedStartDate: formatDateOnly(row.planned_start_date),
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

/**
 * 映射 ClassEnrolledStudentRow 到 ClassEnrolledStudentRecord
 */
export function mapRowToClassEnrolledStudentRecord(
  row: ClassEnrolledStudentRow
): ClassEnrolledStudentRecord {
  return {
    id: row.id,
    classId: row.class_id,
    studentProfileId: row.student_profile_id,
    nickname: row.nickname,
    avatarKey: row.avatar_key ?? null,
    enrolledAt: row.enrolled_at instanceof Date ? row.enrolled_at : new Date(row.enrolled_at),
    status: row.status,
  };
}
