/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  login as apiLogin,
  signup as apiSignup,
  resetPassword as apiResetPassword,
  getAuthUser as apiGetAuthUser,
  getConfig as apiGetConfig,
  updateUser as apiUpdateUser,
  logout as apiLogout,
  getMeContext as apiGetMeContext,
  clearAuthStorage,
  type BusinessRole,
  type DreamContext,
} from '../api/auth';
import { setLocale } from '../i18n';

export type { BusinessRole, DreamContext };

export interface UserInfo {
  id: string;
  email?: string;
  phone?: string;
  username?: string;
  nickname?: string;
  avatar?: string;
  avatar_url?: string;
}

function readStoredJson<T>(key: string): T | null {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return null;
    }
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function readStoredString(key: string): string {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return '';
    }
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(readStoredString('access_token'));
  const userInfo = ref<UserInfo | null>(readStoredJson<UserInfo>('user_info'));
  const dreamContext = ref<DreamContext | null>(readStoredJson<DreamContext>('dream_context'));

  const sysConfig = ref<{ allowRegister: boolean }>({
    allowRegister: false,
  });

  const isLoggedIn = computed(() => !!token.value);
  const effectiveRoles = computed<BusinessRole[]>(
    () => dreamContext.value?.effectiveRoles ?? ['parent']
  );
  const primaryRole = computed<BusinessRole>(
    () => dreamContext.value?.primaryRole ?? 'parent'
  );

  function hasAnyRole(roles: BusinessRole[]): boolean {
    return roles.some((role) => effectiveRoles.value.includes(role));
  }

  function setToken(accessToken: string, refreshToken?: string) {
    token.value = accessToken;
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem('access_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
    }
  }

  function setUserInfo(info: UserInfo) {
    userInfo.value = {
      ...info,
      avatar_url: info.avatar_url || info.avatar,
      nickname: info.nickname || info.username,
    };
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem('user_info', JSON.stringify(userInfo.value));
    }
  }

  function setDreamContext(context: DreamContext | null) {
    dreamContext.value = context;
    if (typeof localStorage !== 'undefined') {
      if (context && typeof localStorage.setItem === 'function') {
        localStorage.setItem('dream_context', JSON.stringify(context));
      } else if (!context && typeof localStorage.removeItem === 'function') {
        localStorage.removeItem('dream_context');
      }
    }
  }

  async function fetchSystemConfig() {
    try {
      const res = await apiGetConfig();
      const data = res.data || res;
      sysConfig.value.allowRegister = String(data['global.allow_register']) === 'true';
    } catch (e) {
      console.warn('[AuthStore] fetchSystemConfig failed:', e);
    }
  }

  async function fetchDreamContext(): Promise<DreamContext | null> {
    if (!token.value) return null;
    try {
      const res = await apiGetMeContext();
      const ctx = ((res as { data?: DreamContext })?.data ?? res) as DreamContext | null;
      if (ctx && Array.isArray(ctx.effectiveRoles)) {
        setDreamContext(ctx);
        if (ctx.preferences?.locale === 'zh-CN' || ctx.preferences?.locale === 'en-US') {
          setLocale(ctx.preferences.locale);
        }
        return ctx;
      }
      return null;
    } catch (e) {
      console.warn('[AuthStore] fetchDreamContext failed:', e);
      return null;
    }
  }

  async function login(credentials: {
    account: string;
    password: string;
    captchaId?: string;
    captchaText?: string;
    rememberMe?: boolean;
  }) {
    const payload: Record<string, unknown> = {
      password: credentials.password,
      rememberMe: credentials.rememberMe ?? true,
    };
    if (credentials.account.includes('@')) {
      payload.email = credentials.account;
    } else {
      payload.phone = credentials.account;
    }
    if (credentials.captchaId) {
      payload.captchaId = credentials.captchaId;
      payload.captchaText = credentials.captchaText;
    }

    try {
      const res = await apiLogin(payload as Parameters<typeof apiLogin>[0]);
      const accessToken = res.access_token || res.accessToken || res.data?.access_token;
      const refreshTokenVal = res.refresh_token || res.refreshToken || res.data?.refresh_token;

      if (accessToken) {
        setToken(accessToken, refreshTokenVal);
        if (res.user) {
          setUserInfo(res.user);
        } else {
          await fetchAuthUser();
        }
        await fetchDreamContext();
        return true;
      }
      return false;
    } catch (error: unknown) {
      const errObj = error as {
        response?: { data?: { code?: string; error?: string } };
        message?: string;
      };
      const errCode = errObj.response?.data?.code || errObj.response?.data?.error || errObj.message;
      if (errCode === 'CAPTCHA_REQUIRED') {
        throw new Error('CAPTCHA_REQUIRED');
      }
      throw error;
    }
  }

  async function register(payload: {
    email?: string;
    phone?: string;
    password: string;
    verificationCode: string;
    agreements?: Array<{ key: string; version: number }>;
  }) {
    await apiSignup(payload);
    return true;
  }

  async function resetPass(payload: {
    email?: string;
    phone?: string;
    code: string;
    newPassword: string;
  }) {
    await apiResetPassword(payload);
    return true;
  }

  async function fetchAuthUser() {
    if (!token.value) return;
    try {
      const res = await apiGetAuthUser();
      const user = res.user || res.data?.user || res;
      if (user) {
        setUserInfo(user);
      }
    } catch (e) {
      console.warn('[AuthStore] fetchAuthUser failed:', e);
    }
  }

  async function updateProfile(data: { nickname?: string; avatar?: string; gender?: string }) {
    await apiUpdateUser({
      nickname: data.nickname,
      username: data.nickname,
      avatar: data.avatar,
      gender: data.gender,
    });
    if (userInfo.value) {
      setUserInfo({
        ...userInfo.value,
        nickname: data.nickname || userInfo.value.nickname,
        avatar: data.avatar || userInfo.value.avatar,
        avatar_url: data.avatar || userInfo.value.avatar_url,
      });
    }
  }

  async function logout() {
    try {
      await apiLogout().catch(() => {});
    } finally {
      token.value = '';
      userInfo.value = null;
      dreamContext.value = null;
      clearAuthStorage();
    }
  }

  return {
    token,
    userInfo,
    dreamContext,
    sysConfig,
    isLoggedIn,
    effectiveRoles,
    primaryRole,
    hasAnyRole,
    login,
    register,
    resetPass,
    fetchSystemConfig,
    fetchAuthUser,
    fetchDreamContext,
    updateProfile,
    logout,
  };
});
