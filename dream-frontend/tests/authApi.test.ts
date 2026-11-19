/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import {
  getAuthUser,
  getConfig,
  getMeContext,
  updateMePreferences,
  verifyCurrentEmail,
  changeEmail,
  updateUser,
  sendCode,
  clearAuthStorage,
} from '../src/api/auth';

describe('Auth API Client (401 Refresh Queue & M0A Contracts)', () => {
  let mockStorage: Record<string, string>;
  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;
  const originalWindow = (global as unknown as { window?: unknown }).window;

  beforeEach(() => {
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
      },
      writable: true,
    });

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    Object.defineProperty(global, 'window', {
      value: {
        location: {
          pathname: '/profile',
          search: '?tab=security',
          href: '/profile?tab=security',
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalWindow === undefined) {
      delete (global as unknown as { window?: unknown }).window;
    } else {
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        writable: true,
        configurable: true,
      });
    }
  });

  it('1. should deduplicate concurrent 401 refreshes into 1 refresh_token call and replay all 3 requests', async () => {
    mockStorage['access_token'] = 'expired-access-token';
    mockStorage['refresh_token'] = 'old-refresh-token';
    mockStorage['dream_locale'] = 'en-US';

    let refreshCount = 0;

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      if (url.includes('/api/auth/v1/token?grant_type=refresh_token')) {
        refreshCount += 1;
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ refresh_token: 'old-refresh-token' });
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'fresh-access-token',
            refresh_token: 'rotated-refresh-token',
          }),
        });
      }

      if (headers['Authorization'] === 'Bearer expired-access-token') {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ code: 'UNAUTHORIZED', error: 'Token expired' }),
        });
      }

      if (headers['Authorization'] === 'Bearer fresh-access-token') {
        if (url === '/api/auth/v1/user') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ user: { id: 'acc_1' } }),
          });
        }
        if (url === '/api/dream/v1/me/context') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { primaryRole: 'parent', effectiveRoles: ['parent'] } }),
          });
        }
        if (url === '/api/auth/v1/config') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: { 'global.allow_register': 'true' } }),
          });
        }
      }

      return Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Unexpected fetch call' }),
      });
    });

    const [userRes, ctxRes, cfgRes] = await Promise.all([
      getAuthUser(),
      getMeContext(),
      getConfig(),
    ]);

    expect(refreshCount).toBe(1);
    expect(mockStorage['access_token']).toBe('fresh-access-token');
    expect(mockStorage['refresh_token']).toBe('rotated-refresh-token');
    expect(mockStorage['dream_locale']).toBe('en-US');
    expect(userRes).toEqual({ user: { id: 'acc_1' } });
    expect(ctxRes).toEqual({ data: { primaryRole: 'parent', effectiveRoles: ['parent'] } });
    expect(cfgRes).toEqual({ data: { 'global.allow_register': 'true' } });
    // 3 initial 401s + 1 refresh + 3 replayed 200s = 7 fetch calls total
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it('2. should reject all queued requests, clear auth storage preserving dream_locale, and redirect when refresh fails', async () => {
    mockStorage['access_token'] = 'expired-access-token';
    mockStorage['refresh_token'] = 'revoked-refresh-token';
    mockStorage['user_info'] = '{"id":"u1"}';
    mockStorage['dream_context'] = '{"primaryRole":"parent"}';
    mockStorage['dream_locale'] = 'zh-CN';

    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/auth/v1/token?grant_type=refresh_token')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ code: 'INVALID_REFRESH_TOKEN', error: 'Refresh token invalid' }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({ code: 'UNAUTHORIZED', error: 'Expired' }),
      });
    });

    const results = await Promise.allSettled([getAuthUser(), getMeContext(), getConfig()]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(mockStorage['access_token']).toBeUndefined();
    expect(mockStorage['refresh_token']).toBeUndefined();
    expect(mockStorage['user_info']).toBeUndefined();
    expect(mockStorage['dream_context']).toBeUndefined();
    expect(mockStorage['dream_locale']).toBe('zh-CN');
    expect((global.window as { location: { href: string } }).location.href).toBe(
      '/login?redirect=%2Fprofile%3Ftab%3Dsecurity'
    );
  });

  it('3. should call verifyCurrentEmail and changeEmail with exact two-step endpoints and payloads', async () => {
    mockStorage['access_token'] = 'valid-token';
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ securityToken: 'sec_tok_123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

    const step1 = await verifyCurrentEmail({ code: '112233' });
    expect(step1).toEqual({ securityToken: 'sec_tok_123' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/auth/v1/user/verify-current-email',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: '112233' }),
      })
    );

    const step2 = await changeEmail({
      newEmail: 'new@topee.top',
      code: '445566',
      securityToken: 'sec_tok_123',
    });
    expect(step2).toEqual({ success: true });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/v1/user/change-email',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          newEmail: 'new@topee.top',
          code: '445566',
          securityToken: 'sec_tok_123',
        }),
      })
    );
  });

  it('4. should support updateUser extended fields, sendCode new scenarios, and updateMePreferences', async () => {
    mockStorage['access_token'] = 'valid-token';
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { locale: 'en-US', timezone: 'UTC' } }),
    });

    await updateUser({
      oldPassword: 'OldPassword1!',
      newPassword: 'NewPassword1!',
      firstName: 'Alice',
      lastName: 'Zhang',
      data: { bio: 'Parent' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/auth/v1/user',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          oldPassword: 'OldPassword1!',
          newPassword: 'NewPassword1!',
          firstName: 'Alice',
          lastName: 'Zhang',
          data: { bio: 'Parent' },
        }),
      })
    );

    await sendCode({
      receiver: 'user@topee.top',
      channel: 'email',
      scenario: 'change_password',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/v1/send-code',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          receiver: 'user@topee.top',
          channel: 'email',
          scenario: 'change_password',
        }),
      })
    );

    await updateMePreferences({ locale: 'en-US', timezone: 'UTC' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/dream/v1/me/preferences',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ locale: 'en-US', timezone: 'UTC' }),
      })
    );
  });

  it('5. clearAuthStorage should remove auth keys while preserving dream_locale', () => {
    mockStorage['access_token'] = 'a';
    mockStorage['refresh_token'] = 'b';
    mockStorage['user_info'] = 'c';
    mockStorage['dream_context'] = 'd';
    mockStorage['dream_locale'] = 'en-US';

    clearAuthStorage();

    expect(mockStorage['access_token']).toBeUndefined();
    expect(mockStorage['refresh_token']).toBeUndefined();
    expect(mockStorage['user_info']).toBeUndefined();
    expect(mockStorage['dream_context']).toBeUndefined();
    expect(mockStorage['dream_locale']).toBe('en-US');
  });

  it('6. should throw business error without clearing tokens or redirecting when refresh succeeds and replayed request returns 400/403', async () => {
    mockStorage['access_token'] = 'expired-access-token';
    mockStorage['refresh_token'] = 'valid-refresh-token';
    mockStorage['user_info'] = '{"id":"u1"}';

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      if (url.includes('/api/auth/v1/token?grant_type=refresh_token')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'fresh-access-token',
            refresh_token: 'rotated-refresh-token',
          }),
        });
      }
      if (headers['Authorization'] === 'Bearer expired-access-token') {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ code: 'UNAUTHORIZED', error: 'Expired' }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 403,
        json: async () => ({ code: 'FORBIDDEN', error: 'Permission denied' }),
      });
    });

    await expect(getMeContext()).rejects.toMatchObject({
      response: {
        status: 403,
        data: { code: 'FORBIDDEN', error: 'Permission denied' },
      },
    });

    expect(mockStorage['access_token']).toBe('fresh-access-token');
    expect(mockStorage['refresh_token']).toBe('rotated-refresh-token');
    expect(mockStorage['user_info']).toBe('{"id":"u1"}');
    expect((global.window as { location: { href: string } }).location.href).toBe(
      '/profile?tab=security'
    );
  });
});
