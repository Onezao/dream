/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

export interface ApiResponse<T = any> {
  code?: string;
  message?: string;
  data?: T;
  [key: string]: any;
}

const API_BASE = '';

async function request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: any = new Error(data.message || data.error || `HTTP ${response.status}`);
    error.response = { data, status: response.status };
    throw error;
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
  scenario:
    | 'signup'
    | 'forgot_password'
    | 'change_email_verify_old'
    | 'change_email_verify_new';
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

// 10. Update User Info (nickname, avatar, etc.)
export function updateUser(data: {
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

// 11. Change Email (Two-step flow supported in auth-core)
export function changeEmail(data: {
  step: 1 | 2;
  code: string;
  securityToken?: string;
  newEmail?: string;
}) {
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
