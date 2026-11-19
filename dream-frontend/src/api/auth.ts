/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { resolveApiErrorMessage } from '../utils/apiError';

export type BusinessRole = 'admin' | 'monitor' | 'teacher' | 'parent';

export interface DreamContext {
  accountId?: string;
  email?: string;
  primaryRole: BusinessRole;
  effectiveRoles: BusinessRole[];
  adminAccount: { id: string } | null;
  monitorProfile: { id: string; displayName: string } | null;
  teacherProfile: { id: string; displayName: string } | null;
  studentProfiles: Array<{ id: string; nickname: string; avatarKey: string | null }>;
  preferences: { locale: 'zh-CN' | 'en-US'; timezone: string };
  currentStudentProfileId?: string;
}

export type SendCodeScenario =
  | 'signup'
  | 'forgot_password'
  | 'change_password'
  | 'bind_email'
  | 'change_email_verify_old'
  | 'change_email_verify_new';

export interface ApiResponse<T = unknown> {
  code?: string;
  message?: string;
  data?: T;
  [key: string]: unknown;
}

export interface ApiRequestError extends Error {
  response?: {
    data: unknown;
    status: number;
  };
}

const API_BASE = '';
const AUTH_STORAGE_KEYS = ['access_token', 'refresh_token', 'user_info', 'dream_context'] as const;

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
  return null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
}

export function clearAuthStorage(): void {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      for (const key of AUTH_STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
}

export function clearAuthAndRedirect(): void {
  clearAuthStorage();
  if (typeof window !== 'undefined' && window.location && window.location.pathname !== '/login') {
    const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search || ''}`);
    window.location.href = `/login?redirect=${redirect}`;
  }
}

function createApiError(data: unknown, status: number): ApiRequestError {
  const error: ApiRequestError = new Error(resolveApiErrorMessage(data, status));
  error.response = { data, status };
  return error;
}

function extractRefreshedTokens(payload: Record<string, unknown>): {
  accessToken?: string;
  refreshToken?: string;
} {
  const nested =
    payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : undefined;
  const accessToken =
    (typeof payload.access_token === 'string' && payload.access_token) ||
    (typeof payload.accessToken === 'string' && payload.accessToken) ||
    (typeof nested?.access_token === 'string' && nested.access_token) ||
    (typeof nested?.accessToken === 'string' && nested.accessToken) ||
    undefined;
  const refreshToken =
    (typeof payload.refresh_token === 'string' && payload.refresh_token) ||
    (typeof payload.refreshToken === 'string' && payload.refreshToken) ||
    (typeof nested?.refresh_token === 'string' && nested.refresh_token) ||
    (typeof nested?.refreshToken === 'string' && nested.refreshToken) ||
    undefined;
  return { accessToken, refreshToken };
}

export async function request<T = any>(
  url: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = getStorageItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (token && !isRetry) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && !isRetry && !url.includes('/api/auth/v1/token')) {
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) =>
        request<T>(
          url,
          {
            ...options,
            headers: {
              ...((options.headers as Record<string, string>) || {}),
              Authorization: `Bearer ${newToken}`,
            },
          },
          true
        )
      );
    }

    isRefreshing = true;
    const currentRefreshToken = getStorageItem('refresh_token');
    if (!currentRefreshToken) {
      isRefreshing = false;
      clearAuthAndRedirect();
      throw createApiError(data, response.status);
    }

    let newAccessToken: string;
    try {
      const refreshResponse = await fetch(
        `${API_BASE}/api/auth/v1/token?grant_type=refresh_token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: currentRefreshToken }),
        }
      );
      const refreshData = (await refreshResponse.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (!refreshResponse.ok) {
        throw createApiError(refreshData, refreshResponse.status);
      }

      const { accessToken, refreshToken: newRefreshToken } = extractRefreshedTokens(refreshData);

      if (!accessToken) {
        throw createApiError(refreshData, 401);
      }

      newAccessToken = accessToken;
      setStorageItem('access_token', newAccessToken);
      if (newRefreshToken) {
        setStorageItem('refresh_token', newRefreshToken);
      }

      isRefreshing = false;
      processQueue(null, newAccessToken);
    } catch (refreshError) {
      isRefreshing = false;
      processQueue(refreshError, null);
      clearAuthAndRedirect();
      throw refreshError;
    }

    return await request<T>(
      url,
      {
        ...options,
        headers: {
          ...((options.headers as Record<string, string>) || {}),
          Authorization: `Bearer ${newAccessToken}`,
        },
      },
      true
    );
  }

  if (!response.ok) {
    throw createApiError(data, response.status);
  }

  return data as T;
}

// 1. Login with password (supports Captcha)
export function login(data: {
  account?: string;
  email?: string;
  phone?: string;
  password: string;
  captchaId?: string;
  captchaText?: string;
  rememberMe?: boolean;
}) {
  return request('/api/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 2. Token refresh
export function refreshToken(token: string) {
  return request('/api/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: token }),
  });
}

// 3. Get Auth User
export function getAuthUser() {
  return request('/api/auth/v1/user', {
    method: 'GET',
  });
}

// 4. System public config (e.g. allow_register)
export function getConfig() {
  return request('/api/auth/v1/config', {
    method: 'GET',
  });
}

// 5. Captcha image (id & base64/svg data)
export function getCaptcha(): Promise<{ id: string; data: string }> {
  return request('/api/auth/v1/captcha', {
    method: 'GET',
  });
}

// 6. Send verification code
export function sendCode(data: {
  receiver: string;
  channel: 'email' | 'sms';
  scenario: SendCodeScenario;
  captchaId?: string;
  captchaText?: string;
}) {
  return request('/api/auth/v1/send-code', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 7. Signup / Registration
export function signup(data: {
  email?: string;
  phone?: string;
  password: string;
  verificationCode: string;
  username?: string;
  agreements?: Array<{ key: string; version: number }>;
}) {
  return request('/api/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 8. Reset Password (Forgot password)
export function resetPassword(data: {
  email?: string;
  phone?: string;
  code: string;
  newPassword: string;
}) {
  return request('/api/auth/v1/reset-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 9. Policies (user agreement, privacy policy)
export function getPolicy(key: string) {
  return request(`/api/auth/v1/policies/${key}`, {
    method: 'GET',
  });
}

// 10. Update User Info (password, name, metadata, username, nickname, avatar, gender)
export function updateUser(data: {
  oldPassword?: string;
  newPassword?: string;
  firstName?: string;
  lastName?: string;
  data?: Record<string, unknown>;
  username?: string;
  nickname?: string;
  avatar?: string;
  gender?: string;
}) {
  return request('/api/auth/v1/user', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// 11a. Verify Current Email (Step 1 of two-step email change)
export function verifyCurrentEmail(data: { code: string }): Promise<{ securityToken: string }> {
  return request<{ securityToken: string }>('/api/auth/v1/user/verify-current-email', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 11b. Change Email (Step 2 of two-step email change)
export function changeEmail(data: { newEmail: string; code: string; securityToken: string }) {
  return request('/api/auth/v1/user/change-email', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 12. Logout
export function logout() {
  return request('/api/auth/v1/logout', {
    method: 'POST',
  });
}

// 13. Dream Identity & Preferences Context
export function getMeContext(): Promise<ApiResponse<DreamContext> | DreamContext> {
  return request('/api/dream/v1/me/context', {
    method: 'GET',
  });
}

export function updateMePreferences(data: {
  locale?: 'zh-CN' | 'en-US';
  timezone?: string;
}): Promise<ApiResponse<{ locale: 'zh-CN' | 'en-US'; timezone: string }>> {
  return request('/api/dream/v1/me/preferences', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
