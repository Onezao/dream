/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { QueryResultRow } from 'pg';

export type StudentGender = 'male' | 'female' | 'undisclosed';

/**
 * PostgreSQL 表 dream.student_profiles 原始行结构 (snake_case)
 */
export interface StudentProfileRow extends QueryResultRow {
  id: string;
  account_id: string;
  real_name: string;
  english_name: string;
  surname_initial: string;
  age: number;
  nickname: string;
  gender: StudentGender;
  birth_date: string | Date | null;
  avatar_key: string | null;
  preferred_course_type_ids: string[] | string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

/**
 * 学员档案领域实体结构 (camelCase)
 */
export interface StudentProfileRecord {
  id: string;
  accountId: string;
  realName: string;
  englishName: string;
  surnameInitial: string;
  age: number;
  nickname: string;
  gender: StudentGender;
  birthDate: string | null;
  avatarKey: string | null;
  preferredCourseTypeIds: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Mapper 创建学员档案输入参数
 */
export interface CreateStudentProfileDbInput {
  id?: string;
  accountId: string;
  realName: string;
  englishName: string;
  surnameInitial: string;
  age: number;
  nickname: string;
  gender?: StudentGender;
  birthDate?: string | Date | null;
  avatarKey?: string | null;
  preferredCourseTypeIds?: string[];
}

/**
 * Mapper 更新学员档案输入参数
 */
export interface UpdateStudentProfileDbInput {
  realName?: string;
  englishName?: string;
  surnameInitial?: string;
  age?: number;
  nickname?: string;
  gender?: StudentGender;
  birthDate?: string | Date | null;
  avatarKey?: string | null;
  preferredCourseTypeIds?: string[];
}

/**
 * 转换日期为 YYYY-MM-DD 字符串
 */
export function formatBirthDate(val: string | Date | null | undefined): string | null {
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
 * 安全解析 JSONB 偏好课程类型 ID 数组
 */
export function parseCourseTypeIds(val: unknown): string[] {
  if (!val) {
    return [];
  }
  if (Array.isArray(val)) {
    return val.filter((item): item is string => typeof item === 'string');
  }
  if (typeof val === 'string') {
    try {
      const parsed: unknown = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * 将数据库原始行映射为业务 Record
 */
export function mapRowToStudentProfileRecord(row: StudentProfileRow): StudentProfileRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    realName: row.real_name,
    englishName: row.english_name,
    surnameInitial: row.surname_initial,
    age: Number(row.age),
    nickname: row.nickname,
    gender: row.gender || 'undisclosed',
    birthDate: formatBirthDate(row.birth_date),
    avatarKey: row.avatar_key ?? null,
    preferredCourseTypeIds: parseCourseTypeIds(row.preferred_course_type_ids),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    deletedAt: row.deleted_at
      ? row.deleted_at instanceof Date
        ? row.deleted_at
        : new Date(row.deleted_at)
      : null,
  };
}
