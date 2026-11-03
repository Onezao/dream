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
} from '../api/auth';

export interface UserInfo {
  id: string;
  email?: string;
  phone?: string;
  username?: string;
  nickname?: string;
  avatar?: string;
  avatar_url?: string;
  roles?: Array<{ name: string } | string>;
  is_admin?: boolean;
}

function getStoredUser(): UserInfo | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('user_info');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(
    typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') || '' : ''
  );
  const userInfo = ref<UserInfo | null>(getStoredUser());

  const sysConfig = ref<{ allowRegister: boolean }>({
    allowRegister: false,
  });

  const isLoggedIn = computed(() => !!token.value);

  function setToken(accessToken: string, refreshToken?: string) {
    token.value = accessToken;
    if (typeof localStorage !== 'undefined') {
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('user_info', JSON.stringify(userInfo.value));
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

  async function login(credentials: {
    account: string;
    password: string;
    captchaId?: string;
    captchaText?: string;
    rememberMe?: boolean;
  }) {
    const payload: Record<string, any> = {
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
      const res = await apiLogin(payload as any);
      const accessToken = res.access_token || res.accessToken || res.data?.access_token;
      const refreshTokenVal = res.refresh_token || res.refreshToken || res.data?.refresh_token;

      if (accessToken) {
        setToken(accessToken, refreshTokenVal);
        if (res.user) {
          setUserInfo(res.user);
        } else {
          await fetchAuthUser();
        }
        return true;
      }
      return false;
    } catch (error: any) {
      const errCode = error.response?.data?.code || error.response?.data?.error || error.message;
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
      await apiLogout();
    } catch {
      // ignore logout network errors
    } finally {
      token.value = '';
      userInfo.value = null;
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_info');
      }
    }
  }

  return {
    token,
    userInfo,
    sysConfig,
    isLoggedIn,
    login,
    register,
    resetPass,
    fetchSystemConfig,
    fetchAuthUser,
    updateProfile,
    logout,
  };
});
