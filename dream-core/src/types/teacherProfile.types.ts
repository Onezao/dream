/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { QueryResultRow } from 'pg';
import { parseCourseTypeIds } from './studentProfile.types.js';

// =============================================================================
// 1. 课程类型字典 (Course Types)
// =============================================================================

export interface CourseTypeRow extends QueryResultRow {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CourseTypeRecord {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCourseTypeDbInput {
  id?: string;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCourseTypeDbInput {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export function mapRowToCourseTypeRecord(row: CourseTypeRow): CourseTypeRecord {
  return {
    id: row.id,
    name: row.name,
    sortOrder: Number(row.sort_order),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  };
}

// =============================================================================
// 2. 教师定级字典 (Teacher Levels)
// =============================================================================

export interface TeacherLevelRow extends QueryResultRow {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TeacherLevelRecord {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTeacherLevelDbInput {
  id?: string;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateTeacherLevelDbInput {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export function mapRowToTeacherLevelRecord(row: TeacherLevelRow): TeacherLevelRecord {
  return {
    id: row.id,
    name: row.name,
    sortOrder: Number(row.sort_order),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  };
}

// =============================================================================
// 3. 班长档案 (Monitor Profiles)
// =============================================================================

export interface MonitorProfileRow extends QueryResultRow {
  id: string;
  account_id: string;
  display_name: string;
  phone: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface MonitorProfileRecord {
  id: string;
  accountId: string;
  displayName: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateMonitorProfileDbInput {
  id?: string;
  accountId: string;
  displayName: string;
  phone?: string | null;
}

export interface UpdateMonitorProfileDbInput {
  displayName?: string;
  phone?: string | null;
}

export function mapRowToMonitorProfileRecord(row: MonitorProfileRow): MonitorProfileRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    displayName: row.display_name,
    phone: row.phone ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    deletedAt: row.deleted_at
      ? row.deleted_at instanceof Date
        ? row.deleted_at
        : new Date(row.deleted_at)
      : null,
  };
}

// =============================================================================
// 4. 教师档案 (Teacher Profiles)
// =============================================================================

export interface TeacherProfileRow extends QueryResultRow {
  id: string;
  account_id: string | null;
  display_name: string;
  level_id: string;
  monitor_profile_id: string;
  skill_course_type_ids: string[] | string;
  intro_zh: string;
  intro_en: string;
  photo_key: string | null;
  video_key: string | null;
  classin_qr_key: string | null;
  resigned_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface TeacherProfileRecord {
  id: string;
  accountId: string | null;
  displayName: string;
  levelId: string;
  monitorProfileId: string;
  skillCourseTypeIds: string[];
  introZh: string;
  introEn: string;
  photoKey: string | null;
  videoKey: string | null;
  classinQrKey: string | null;
  resignedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateTeacherProfileDbInput {
  id?: string;
  accountId?: string | null;
  displayName: string;
  levelId: string;
  monitorProfileId: string;
  skillCourseTypeIds: string[];
  introZh: string;
  introEn: string;
  photoKey?: string | null;
  videoKey?: string | null;
  classinQrKey?: string | null;
}

export interface UpdateTeacherProfileDbInput {
  accountId?: string | null;
  displayName?: string;
  levelId?: string;
  monitorProfileId?: string;
  skillCourseTypeIds?: string[];
  introZh?: string;
  introEn?: string;
  photoKey?: string | null;
  videoKey?: string | null;
  classinQrKey?: string | null;
  resignedAt?: string | Date | null;
}

export function mapRowToTeacherProfileRecord(row: TeacherProfileRow): TeacherProfileRecord {
  return {
    id: row.id,
    accountId: row.account_id ?? null,
    displayName: row.display_name,
    levelId: row.level_id,
    monitorProfileId: row.monitor_profile_id,
    skillCourseTypeIds: parseCourseTypeIds(row.skill_course_type_ids),
    introZh: row.intro_zh,
    introEn: row.intro_en,
    photoKey: row.photo_key ?? null,
    videoKey: row.video_key ?? null,
    classinQrKey: row.classin_qr_key ?? null,
    resignedAt: row.resigned_at
      ? row.resigned_at instanceof Date
        ? row.resigned_at
        : new Date(row.resigned_at)
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

// =============================================================================
// 5. 教师档案详情 (含关联等级与班长信息)
// =============================================================================

export interface TeacherProfileWithDetailsRow extends TeacherProfileRow {
  level_name: string;
  monitor_display_name: string;
}

export interface TeacherProfileWithDetailsRecord extends TeacherProfileRecord {
  levelName: string;
  monitorDisplayName: string;
}

export function mapRowToTeacherProfileWithDetailsRecord(
  row: TeacherProfileWithDetailsRow
): TeacherProfileWithDetailsRecord {
  const base = mapRowToTeacherProfileRecord(row);
  return {
    ...base,
    levelName: row.level_name,
    monitorDisplayName: row.monitor_display_name,
  };
}
