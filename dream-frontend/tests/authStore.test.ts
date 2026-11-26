/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../src/stores/auth';
import * as authApi from '../src/api/auth';

jest.mock('../src/api/auth', () => {
  const actual = jest.requireActual('../src/api/auth');
  return {
    login: jest.fn(),
    refreshToken: jest.fn(),
    getAuthUser: jest.fn(),
    getConfig: jest.fn(),
    sendCode: jest.fn(),
    signup: jest.fn(),
    resetPassword: jest.fn(),
    getCaptcha: jest.fn(),
    updateUser: jest.fn(),
    logout: jest.fn(),
    getMeContext: jest.fn(),
    updateMePreferences: jest.fn(),
    verifyCurrentEmail: jest.fn(),
    changeEmail: jest.fn(),
    deactivateAccount: jest.fn(),
    issueSseTicket: jest.fn(),
    clearAuthStorage: actual.clearAuthStorage,
    clearAuthAndRedirect: actual.clearAuthAndRedirect,
  };
});

describe('Auth Store Controls & Lifecycle (M0A Context & Role Aggregation)', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();

    mockStorage = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => mockStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockStorage[key] = value.toString();
        }),
        removeItem: jest.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: jest.fn(() => {
          for (const key of Object.keys(mockStorage)) {
            delete mockStorage[key];
          }
        }),
      },
      writable: true,
    });
  });

  it('1. should fetch system config and cache allowRegister status', async () => {
    (authApi.getConfig as jest.Mock).mockResolvedValue({
      data: { 'global.allow_register': 'true' },
    });
    const store = useAuthStore();

    expect(store.sysConfig.allowRegister).toBe(false);
    await store.fetchSystemConfig();
    expect(authApi.getConfig).toHaveBeenCalledTimes(1);
    expect(store.sysConfig.allowRegister).toBe(true);
  });

  it('2. should properly handle login throwing CAPTCHA_REQUIRED', async () => {
    const error: Error & { response?: { data: { code: string; message: string } } } = new Error(
      'CAPTCHA_REQUIRED'
    );
    error.response = { data: { code: 'CAPTCHA_REQUIRED', message: 'CAPTCHA_REQUIRED' } };
    (authApi.login as jest.Mock).mockRejectedValue(error);

    const store = useAuthStore();
    await expect(
      store.login({ account: 'test@topee.top', password: 'Password123' })
    ).rejects.toThrow('CAPTCHA_REQUIRED');
  });

  it('3. should support register action proxy to API', async () => {
    (authApi.signup as jest.Mock).mockResolvedValue({ user: { id: 'u123' } });
    const store = useAuthStore();

    const payload = {
      email: 'test@topee.top',
      password: 'Password123',
      verificationCode: '123456',
    };
    const result = await store.register(payload);
    expect(authApi.signup).toHaveBeenCalledWith(payload);
    expect(result).toBe(true);
  });

  it('4. should support resetPass action proxy to API', async () => {
    (authApi.resetPassword as jest.Mock).mockResolvedValue({ success: true });
    const store = useAuthStore();

    const payload = {
      email: 'test@topee.top',
      code: '123456',
      newPassword: 'NewPassword123',
    };
    const result = await store.resetPass(payload);
    expect(authApi.resetPassword).toHaveBeenCalledWith(payload);
    expect(result).toBe(true);
  });

  it('5. should support updateProfile for nickname and avatar', async () => {
    (authApi.updateUser as jest.Mock).mockResolvedValue({ success: true });
    const store = useAuthStore();
    store.userInfo = { id: 'u123', nickname: 'OldNick' };

    await store.updateProfile({ nickname: 'NewNick', avatar: 'https://img.topee.top/avatar.png' });
    expect(authApi.updateUser).toHaveBeenCalledWith({
      nickname: 'NewNick',
      username: 'NewNick',
      avatar: 'https://img.topee.top/avatar.png',
      gender: undefined,
    });
    expect(store.userInfo?.nickname).toBe('NewNick');
    expect(store.userInfo?.avatar).toBe('https://img.topee.top/avatar.png');
  });

  it('6. should clear token, user state, dreamContext & auth storage while preserving dream_locale on logout', async () => {
    (authApi.logout as jest.Mock).mockResolvedValue({ success: true });
    mockStorage['access_token'] = 'active-token';
    mockStorage['refresh_token'] = 'active-refresh';
    mockStorage['user_info'] = JSON.stringify({ id: 'u123', nickname: 'Alice' });
    mockStorage['dream_context'] = JSON.stringify({
      primaryRole: 'monitor',
      effectiveRoles: ['monitor', 'parent'],
      adminAccount: null,
      monitorProfile: { id: 'mon1', displayName: 'Alice Monitor' },
      teacherProfile: null,
      studentProfiles: [],
      preferences: { locale: 'en-US', timezone: 'Asia/Shanghai' },
    });
    mockStorage['dream_locale'] = 'en-US';

    const store = useAuthStore();
    await store.logout();

    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(store.token).toBe('');
    expect(store.userInfo).toBeNull();
    expect(store.dreamContext).toBeNull();
    expect(mockStorage['access_token']).toBeUndefined();
    expect(mockStorage['refresh_token']).toBeUndefined();
    expect(mockStorage['user_info']).toBeUndefined();
    expect(mockStorage['dream_context']).toBeUndefined();
    expect(mockStorage['dream_locale']).toBe('en-US');
  });

  it('7. should default effectiveRoles & primaryRole to parent when dreamContext is null', () => {
    const store = useAuthStore();
    expect(store.dreamContext).toBeNull();
    expect(store.effectiveRoles).toEqual(['parent']);
    expect(store.primaryRole).toBe('parent');
    expect(store.hasAnyRole(['parent'])).toBe(true);
    expect(store.hasAnyRole(['admin', 'monitor'])).toBe(false);
  });

  it('8. should fetchDreamContext, persist dream_context, compute roles, and sync dream_locale', async () => {
    const mockContext: authApi.DreamContext = {
      accountId: 'acc_001',
      email: 'monitor@topee.top',
      primaryRole: 'monitor',
      effectiveRoles: ['monitor', 'teacher', 'parent'],
      adminAccount: null,
      monitorProfile: { id: 'mon_001', displayName: 'Ms. Wang' },
      teacherProfile: { id: 'tch_001', displayName: 'Teacher Wang' },
      studentProfiles: [{ id: 'stu_001', nickname: 'AliceZ10', avatarKey: null }],
      preferences: { locale: 'en-US', timezone: 'Asia/Shanghai' },
    };
    (authApi.getMeContext as jest.Mock).mockResolvedValue({ data: mockContext });

    const store = useAuthStore();
    store.token = 'valid-token';

    const result = await store.fetchDreamContext();
    expect(authApi.getMeContext).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockContext);
    expect(store.dreamContext).toEqual(mockContext);
    expect(store.primaryRole).toBe('monitor');
    expect(store.effectiveRoles).toEqual(['monitor', 'teacher', 'parent']);
    expect(store.hasAnyRole(['admin', 'monitor'])).toBe(true);
    expect(store.hasAnyRole(['admin'])).toBe(false);
    expect(JSON.parse(mockStorage['dream_context'])).toEqual(mockContext);
    expect(mockStorage['dream_locale']).toBe('en-US');
  });

  it('9. should fetchDreamContext automatically after login succeeds', async () => {
    const mockContext: authApi.DreamContext = {
      primaryRole: 'admin',
      effectiveRoles: ['admin', 'parent'],
      adminAccount: { id: 'adm_001' },
      monitorProfile: null,
      teacherProfile: null,
      studentProfiles: [],
      preferences: { locale: 'zh-CN', timezone: 'Asia/Shanghai' },
    };
    (authApi.login as jest.Mock).mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      user: { id: 'acc_admin', email: 'admin@topee.top' },
    });
    (authApi.getMeContext as jest.Mock).mockResolvedValue({ data: mockContext });

    const store = useAuthStore();
    const ok = await store.login({ account: 'admin@topee.top', password: 'Password123!' });

    expect(ok).toBe(true);
    expect(store.token).toBe('new-access');
    expect(mockStorage['refresh_token']).toBe('new-refresh');
    expect(authApi.getMeContext).toHaveBeenCalledTimes(1);
    expect(store.primaryRole).toBe('admin');
    expect(store.hasAnyRole(['admin'])).toBe(true);
  });

  it('10. should still clear local auth state even if apiLogout rejects', async () => {
    (authApi.logout as jest.Mock).mockRejectedValue(new Error('Network down'));
    mockStorage['access_token'] = 't1';
    mockStorage['dream_locale'] = 'zh-CN';

    const store = useAuthStore();
    await store.logout();

    expect(store.token).toBe('');
    expect(store.dreamContext).toBeNull();
    expect(mockStorage['access_token']).toBeUndefined();
    expect(mockStorage['dream_locale']).toBe('zh-CN');
  });

  it('11. should expose isPermanentPrimary, emailMasked, and deactivateAccount cleanly', async () => {
    (authApi.deactivateAccount as jest.Mock).mockResolvedValue({ data: { deactivated: true } });
    mockStorage['access_token'] = 'active-token';
    mockStorage['dream_locale'] = 'zh-CN';

    const store = useAuthStore();
    store.token = 'active-token';
    store.dreamContext = {
      accountId: 'acc_master',
      emailMasked: 'ow***@topee.top',
      primaryRole: 'admin',
      effectiveRoles: ['admin', 'parent'],
      adminAccount: { id: 'adm_001', displayName: 'Master', isPermanentPrimary: true },
      monitorProfile: null,
      teacherProfile: null,
      studentProfiles: [],
      preferences: { locale: 'zh-CN', timezone: 'Asia/Shanghai' },
    };

    expect(store.isPermanentPrimary).toBe(true);
    expect(store.emailMasked).toBe('ow***@topee.top');

    await store.deactivateAccount('owner@topee.top');
    expect(authApi.deactivateAccount).toHaveBeenCalledWith({ confirmEmail: 'owner@topee.top' });
    expect(store.isLoggedIn).toBe(false);
    expect(store.dreamContext).toBeNull();
    expect(mockStorage['dream_locale']).toBe('zh-CN');
  });
});
