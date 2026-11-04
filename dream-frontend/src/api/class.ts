/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type {
  PublicSmallGroupClassDto,
  MonitorClassDto,
  AdminClassDto,
  CreateSmallGroupClassInput,
  AdminClassQueryInput,
  AdminUpdateClassInput,
  ClassStatus,
} from '../types';

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page?: number;
    pageSize?: number;
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
 * 1. 家长/公共端：招募中小班课公开选班列表
 */
export async function getPublicSmallGroupClasses(filter?: {
  courseTypeId?: string;
}): Promise<ApiResponse<PublicSmallGroupClassDto[]>> {
  const params = new URLSearchParams();
  if (filter?.courseTypeId) params.append('courseTypeId', filter.courseTypeId);

  const query = params.toString() ? `?${params.toString()}` : '';
  return authFetch<ApiResponse<PublicSmallGroupClassDto[]>>(
    `${API_PREFIX}/public/classes/small-group${query}`
  );
}

/**
 * 2. 班长端：所辖小班课列表
 */
export async function getMonitorClasses(
  status?: ClassStatus
): Promise<ApiResponse<MonitorClassDto[]>> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);

  const query = params.toString() ? `?${params.toString()}` : '';
  return authFetch<ApiResponse<MonitorClassDto[]>>(`${API_PREFIX}/monitor/classes${query}`);
}

/**
 * 3. 班长端：创建招募中小班课
 */
export async function createMonitorClass(
  input: CreateSmallGroupClassInput
): Promise<ApiResponse<MonitorClassDto>> {
  return authFetch<ApiResponse<MonitorClassDto>>(`${API_PREFIX}/monitor/classes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * 4. 班长端：强制开班
 */
export async function forceStartMonitorClass(
  id: string
): Promise<ApiResponse<MonitorClassDto>> {
  return authFetch<ApiResponse<MonitorClassDto>>(`${API_PREFIX}/monitor/classes/${id}/force-start`, {
    method: 'POST',
    body: JSON.stringify({ confirm: true }),
  });
}

/**
 * 5. 班长端：取消小班课
 */
export async function cancelMonitorClass(
  id: string,
  reason: string
): Promise<ApiResponse<{ success: boolean }>> {
  return authFetch<ApiResponse<{ success: boolean }>>(`${API_PREFIX}/monitor/classes/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ confirm: true, reason }),
  });
}

/**
 * 6. 管理员端：全平台班级统一管理与分页列表
 */
export async function getAdminClasses(
  query?: AdminClassQueryInput
): Promise<ApiResponse<AdminClassDto[]>> {
  const params = new URLSearchParams();
  if (query?.page) params.append('page', String(query.page));
  if (query?.pageSize) params.append('pageSize', String(query.pageSize));
  if (query?.status) params.append('status', query.status);
  if (query?.classType) params.append('classType', query.classType);
  if (query?.ownerMonitorProfileId) params.append('ownerMonitorProfileId', query.ownerMonitorProfileId);
  if (query?.teacherProfileId) params.append('teacherProfileId', query.teacherProfileId);
  if (query?.courseTypeId) params.append('courseTypeId', query.courseTypeId);

  const qs = params.toString() ? `?${params.toString()}` : '';
  return authFetch<ApiResponse<AdminClassDto[]>>(`${API_PREFIX}/admin/classes${qs}`);
}

/**
 * 7. 管理员端：更新班级配置
 */
export async function updateAdminClass(
  id: string,
  input: AdminUpdateClassInput
): Promise<ApiResponse<AdminClassDto>> {
  return authFetch<ApiResponse<AdminClassDto>>(`${API_PREFIX}/admin/classes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
