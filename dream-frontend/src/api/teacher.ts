/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type {
  TeacherCardDto,
  TeacherDetailDto,
  CreateTeacherProfileInput,
  UpdateTeacherProfileInput,
  CourseTypeDto,
  TeacherLevelDto,
} from '../types';

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
  };
}

const API_PREFIX = '/api/dream/v1';

async function authFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;

  if (!res.ok) {
    throw new Error(json.error || json.message || `Request failed with ${res.status}`);
  }

  return json as T;
}

/**
 * 1. 家长/公共端：获取公开脱敏教师列表
 */
export async function getPublicTeachers(filter?: {
  levelId?: string;
  courseTypeId?: string;
}): Promise<ApiResponse<TeacherCardDto[]>> {
  const params = new URLSearchParams();
  if (filter?.levelId) params.append('levelId', filter.levelId);
  if (filter?.courseTypeId) params.append('courseTypeId', filter.courseTypeId);

  const query = params.toString() ? `?${params.toString()}` : '';
  return authFetch<ApiResponse<TeacherCardDto[]>>(`${API_PREFIX}/public/teachers${query}`);
}

/**
 * 2. 家长/公共端：获取教师详情
 */
export async function getPublicTeacher(id: string): Promise<ApiResponse<TeacherCardDto>> {
  return authFetch<ApiResponse<TeacherCardDto>>(
    `${API_PREFIX}/public/teachers/${encodeURIComponent(id)}`
  );
}

/**
 * 3. 公共字典：课程类型列表
 */
export async function getCourseTypes(): Promise<ApiResponse<CourseTypeDto[]>> {
  return authFetch<ApiResponse<CourseTypeDto[]>>(`${API_PREFIX}/public/dictionaries/course-types`);
}

/**
 * 4. 公共字典：教师定级列表
 */
export async function getTeacherLevels(): Promise<ApiResponse<TeacherLevelDto[]>> {
  return authFetch<ApiResponse<TeacherLevelDto[]>>(`${API_PREFIX}/public/dictionaries/teacher-levels`);
}

/**
 * 5. 班长端：获取名下教师列表
 */
export async function getMonitorTeachers(): Promise<ApiResponse<TeacherDetailDto[]>> {
  return authFetch<ApiResponse<TeacherDetailDto[]>>(`${API_PREFIX}/monitor/teachers`);
}

/**
 * 6. 班长端：创建新教师档案
 */
export async function createMonitorTeacher(
  data: CreateTeacherProfileInput
): Promise<ApiResponse<TeacherDetailDto>> {
  return authFetch<ApiResponse<TeacherDetailDto>>(`${API_PREFIX}/monitor/teachers`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 7. 班长端：更新所辖教师档案
 */
export async function updateMonitorTeacher(
  id: string,
  data: UpdateTeacherProfileInput
): Promise<ApiResponse<TeacherDetailDto>> {
  return authFetch<ApiResponse<TeacherDetailDto>>(
    `${API_PREFIX}/monitor/teachers/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  );
}

/**
 * 8. 班长端：软删除教师档案
 */
export async function deleteMonitorTeacher(id: string): Promise<ApiResponse<{ success: boolean }>> {
  return authFetch<ApiResponse<{ success: boolean }>>(
    `${API_PREFIX}/monitor/teachers/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
}
