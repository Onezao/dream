/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { setActivePinia, createPinia } from 'pinia';
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { authBeforeEach } from '../src/router/guard';
import { useAuthStore } from '../src/stores/auth';
import * as authApi from '../src/api/auth';

jest.mock('../src/api/auth', () => {
  const actual = jest.requireActual('../src/api/auth');
  return {
    ...actual,
    getMeContext: jest.fn(),
  };
});

function createMockRoute(
  overrides: Partial<RouteLocationNormalized> = {}
): RouteLocationNormalized {
  return {
    path: '/',
    name: 'home',
    fullPath: '/',
    params: {},
    query: {},
    hash: '',
    matched: [],
    meta: {},
    redirectedFrom: undefined,
    ...overrides,
  } as RouteLocationNormalized;
}

describe('Router Guard (authBeforeEach)', () => {
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
      },
      writable: true,
    });
  });

  it('1. redirects unauthenticated user on protected route to login with redirect query', async () => {
    const next = jest.fn() as unknown as NavigationGuardNext;
    const to = createMockRoute({
      path: '/profile',
      name: 'profile',
      fullPath: '/profile?tab=security',
      meta: { requiresAuth: true },
    });

    await authBeforeEach(to, createMockRoute(), next);

    expect(next).toHaveBeenCalledWith({
      name: 'login',
      query: { redirect: '/profile?tab=security' },
    });
  });

  it('2. allows unauthenticated user on public auth routes', async () => {
    const next = jest.fn() as unknown as NavigationGuardNext;
    const to = createMockRoute({
      path: '/login',
      name: 'login',
      fullPath: '/login',
      meta: { public: true },
    });

    await authBeforeEach(to, createMockRoute(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('3. redirects authenticated user away from login and register to home', async () => {
    mockStorage['access_token'] = 'valid-token';
    mockStorage['dream_context'] = JSON.stringify({
      primaryRole: 'parent',
      effectiveRoles: ['parent'],
      adminAccount: null,
      monitorProfile: null,
      teacherProfile: null,
      studentProfiles: [],
      preferences: { locale: 'zh-CN', timezone: 'Asia/Shanghai' },
    });

    for (const routeName of ['login', 'register', 'signup'] as const) {
      const next = jest.fn() as unknown as NavigationGuardNext;
      const to = createMockRoute({
        path: `/${routeName}`,
        name: routeName,
        fullPath: `/${routeName}`,
        meta: { public: true },
      });

      await authBeforeEach(to, createMockRoute(), next);

      expect(next).toHaveBeenCalledWith({ name: 'home' });
    }
  });

  it('4. fetches dreamContext before entering when authenticated and dreamContext is null', async () => {
    mockStorage['access_token'] = 'valid-token';
    (authApi.getMeContext as jest.Mock).mockResolvedValue({
      data: {
        primaryRole: 'monitor',
        effectiveRoles: ['monitor', 'parent'],
        adminAccount: null,
        monitorProfile: { id: 'mon_1', displayName: 'Ms. Wang' },
        teacherProfile: null,
        studentProfiles: [],
        preferences: { locale: 'zh-CN', timezone: 'Asia/Shanghai' },
      },
    });

    const authStore = useAuthStore();
    expect(authStore.dreamContext).toBeNull();

    const next = jest.fn() as unknown as NavigationGuardNext;
    const to = createMockRoute({
      path: '/profile',
      name: 'profile',
      fullPath: '/profile',
      meta: { requiresAuth: true },
    });

    await authBeforeEach(to, createMockRoute(), next);

    expect(authApi.getMeContext).toHaveBeenCalledTimes(1);
    expect(authStore.dreamContext?.primaryRole).toBe('monitor');
    expect(next).toHaveBeenCalledWith();
  });

  it('5. continues navigation even if fetchDreamContext fails on non-role route', async () => {
    mockStorage['access_token'] = 'valid-token';
    (authApi.getMeContext as jest.Mock).mockRejectedValue(new Error('Network error'));

    const next = jest.fn() as unknown as NavigationGuardNext;
    const to = createMockRoute({
      path: '/profile',
      name: 'profile',
      fullPath: '/profile',
      meta: { requiresAuth: true },
    });

    await authBeforeEach(to, createMockRoute(), next);

    expect(authApi.getMeContext).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('6. redirects to home when allowedRoles is set and user lacks required role', async () => {
    mockStorage['access_token'] = 'valid-token';
    mockStorage['dream_context'] = JSON.stringify({
      primaryRole: 'parent',
      effectiveRoles: ['parent'],
      adminAccount: null,
      monitorProfile: null,
      teacherProfile: null,
      studentProfiles: [],
      preferences: { locale: 'zh-CN', timezone: 'Asia/Shanghai' },
    });

    const next = jest.fn() as unknown as NavigationGuardNext;
    const to = createMockRoute({
      path: '/admin',
      name: 'admin',
      fullPath: '/admin',
      meta: { requiresAuth: true, allowedRoles: ['admin', 'monitor'] },
    });

    await authBeforeEach(to, createMockRoute(), next);

    expect(next).toHaveBeenCalledWith({ name: 'home' });
  });

  it('7. allows access when allowedRoles matches user effectiveRoles', async () => {
    mockStorage['access_token'] = 'valid-token';
    mockStorage['dream_context'] = JSON.stringify({
      primaryRole: 'monitor',
      effectiveRoles: ['monitor', 'parent'],
      adminAccount: null,
      monitorProfile: { id: 'mon_1', displayName: 'Ms. Wang' },
      teacherProfile: null,
      studentProfiles: [],
      preferences: { locale: 'zh-CN', timezone: 'Asia/Shanghai' },
    });

    const next = jest.fn() as unknown as NavigationGuardNext;
    const to = createMockRoute({
      path: '/monitor-board',
      name: 'monitor-board',
      fullPath: '/monitor-board',
      meta: { requiresAuth: true, allowedRoles: ['admin', 'monitor'] },
    });

    await authBeforeEach(to, createMockRoute(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('8. blocks non-admin from /admin/admins and allows active admin', async () => {
    mockStorage['access_token'] = 'valid-token';
    mockStorage['dream_context'] = JSON.stringify({
      primaryRole: 'monitor',
      effectiveRoles: ['monitor', 'parent'],
      adminAccount: null,
      monitorProfile: { id: 'mon_1', displayName: 'Ms. Wang' },
      teacherProfile: null,
      studentProfiles: [],
      preferences: { locale: 'zh-CN', timezone: 'Asia/Shanghai' },
    });

    const nextBlocked = jest.fn() as unknown as NavigationGuardNext;
    await authBeforeEach(
      createMockRoute({
        path: '/admin/admins',
        name: 'admin-admins',
        fullPath: '/admin/admins',
        meta: { requiresAuth: true, allowedRoles: ['admin'], activeTab: 'profile' },
      }),
      createMockRoute(),
      nextBlocked
    );
    expect(nextBlocked).toHaveBeenCalledWith({ name: 'home' });
  });
});
