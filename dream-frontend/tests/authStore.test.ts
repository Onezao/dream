/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../src/stores/auth';
import * as authApi from '../src/api/auth';

jest.mock('../src/api/auth', () => ({
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
}));

describe('Auth Store Controls & Lifecycle (Ported from topee-read)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();

    const mockStorage: Record<string, string> = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn((key) => mockStorage[key] || null),
        setItem: jest.fn((key, value) => {
          mockStorage[key] = value.toString();
        }),
        removeItem: jest.fn((key) => {
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
    const error: any = new Error('CAPTCHA_REQUIRED');
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

  it('6. should clear token and user state on logout', async () => {
    (authApi.logout as jest.Mock).mockResolvedValue({ success: true });
    const store = useAuthStore();
    store.token = 'active-token';
    store.userInfo = { id: 'u123', nickname: 'Alice' };

    await store.logout();
    expect(store.token).toBe('');
    expect(store.userInfo).toBeNull();
  });
});
