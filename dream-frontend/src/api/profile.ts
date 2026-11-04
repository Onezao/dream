/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type {
  StudentProfileDto,
  CreateStudentProfileInput,
  UpdateStudentProfileInput,
  NicknameAvailabilityResult,
  StudentLookupResult,
} from '../types';

export interface ProfileApiError extends Error {
  code?: string;
  statusCode?: number;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    limit: number;
  };
  code?: string;
  message?: string;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      (typeof body.message === 'string' && body.message) ||
      (typeof body.error === 'string' && body.error) ||
      `HTTP ${response.status}`;
    const error: ProfileApiError = new Error(message);
    error.statusCode = response.status;
    error.code = typeof body.code === 'string' ? body.code : undefined;
    error.details = body.details;
    throw error;
  }

  return body as T;
}

const API_PREFIX = '/api/dream/v1';

/**
 * 1. 获取当前家长名下所有学员档案
 */
export async function getStudentProfiles(): Promise<ApiResponse<StudentProfileDto[]>> {
  return request<ApiResponse<StudentProfileDto[]>>(`${API_PREFIX}/parent/student-profiles`, {
    method: 'GET',
  });
}

/**
 * 2. 创建学员档案
 */
export async function createStudentProfile(
  data: CreateStudentProfileInput
): Promise<ApiResponse<StudentProfileDto>> {
  return request<ApiResponse<StudentProfileDto>>(`${API_PREFIX}/parent/student-profiles`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 3. 获取指定学员档案 (带 IDOR 校验)
 */
export async function getStudentProfile(id: string): Promise<ApiResponse<StudentProfileDto>> {
  return request<ApiResponse<StudentProfileDto>>(
    `${API_PREFIX}/parent/student-profiles/${encodeURIComponent(id)}`,
    {
      method: 'GET',
    }
  );
}

/**
 * 4. 更新指定学员档案
 */
export async function updateStudentProfile(
  id: string,
  data: UpdateStudentProfileInput
): Promise<ApiResponse<StudentProfileDto>> {
  return request<ApiResponse<StudentProfileDto>>(
    `${API_PREFIX}/parent/student-profiles/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  );
}

/**
 * 5. 软删除学员档案
 */
export async function deleteStudentProfile(id: string): Promise<ApiResponse<{ success: boolean }>> {
  return request<ApiResponse<{ success: boolean }>>(
    `${API_PREFIX}/parent/student-profiles/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
}

/**
 * 6. 规范昵称实时可用性查重
 */
export async function checkNicknameAvailability(
  nickname: string
): Promise<ApiResponse<NicknameAvailabilityResult>> {
  return request<ApiResponse<NicknameAvailabilityResult>>(
    `${API_PREFIX}/parent/nicknames/availability?nickname=${encodeURIComponent(nickname)}`,
    {
      method: 'GET',
    }
  );
}

/**
 * 7. 跨家长课程转让脱敏检索学员档案
 */
export async function lookupProfileForTransfer(
  nickname: string
): Promise<ApiResponse<StudentLookupResult>> {
  return request<ApiResponse<StudentLookupResult>>(
    `${API_PREFIX}/parent/student-profiles/lookup?nickname=${encodeURIComponent(nickname)}`,
    {
      method: 'GET',
    }
  );
}
