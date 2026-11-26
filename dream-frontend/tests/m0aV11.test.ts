/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import {
  buildL3PartitionKey,
  clearAccountL3Snapshots,
  clearL3Snapshots,
  getPartitionedL3Snapshot,
  setPartitionedL3Snapshot,
} from '../src/utils/l3Cache';
import { resolveApiErrorMessage } from '../src/utils/apiError';
import { setLocale } from '../src/i18n';
import {
  deactivateAccount,
  grantAdmin,
  listAdmins,
  lookupAdminCandidate,
  requestAvatarUploadUrl,
  revokeAdmin,
  updateAdminDisplayName,
} from '../src/api/auth';

describe('M0A V1.1 Frontend Cache Isolation, Bilingual Errors & Governance API', () => {
  let mockStorage: Record<string, string>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = {};
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => mockStorage[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
          mockStorage[key] = value.toString();
        }),
        removeItem: jest.fn((key: string) => {
          delete mockStorage[key];
        }),
        key: jest.fn((idx: number) => Object.keys(mockStorage)[idx] ?? null),
        get length() {
          return Object.keys(mockStorage).length;
        },
      },
      writable: true,
    });

    Object.defineProperty(global, 'window', {
      value: {
        location: {
          pathname: '/admin/admins',
          search: '',
          href: '/admin/admins',
        },
      },
      writable: true,
    });
  });

  it('1. L3 snapshots partition by [accountId, roleScope, storeKey] and preserve L2/locale on clearCache', async () => {
    expect(buildL3PartitionKey('acc1', 'monitor', 'teachers')).toBe('acc1::monitor::teachers');

    mockStorage['access_token'] = 'jwt-token';
    mockStorage['dream_locale'] = 'zh-CN';

    await setPartitionedL3Snapshot('acc1', 'monitor', 'teachers', [{ id: 't1' }]);
    await setPartitionedL3Snapshot('acc2', 'parent', 'teachers', [{ id: 't2' }]);

    expect(await getPartitionedL3Snapshot('acc1', 'monitor', 'teachers')).toEqual([{ id: 't1' }]);
    expect(await getPartitionedL3Snapshot('acc2', 'parent', 'teachers')).toEqual([{ id: 't2' }]);

    // Logout / clear account partition only deletes acc1 keys
    await clearAccountL3Snapshots('acc1');
    expect(await getPartitionedL3Snapshot('acc1', 'monitor', 'teachers')).toBeNull();
    expect(await getPartitionedL3Snapshot('acc2', 'parent', 'teachers')).toEqual([{ id: 't2' }]);
    expect(mockStorage['access_token']).toBe('jwt-token');
    expect(mockStorage['dream_locale']).toBe('zh-CN');

    // Full clearL3Snapshots clears all L3 keys while preserving L2 tokens & dream_locale
    await clearL3Snapshots();
    expect(await getPartitionedL3Snapshot('acc2', 'parent', 'teachers')).toBeNull();
    expect(mockStorage['access_token']).toBe('jwt-token');
    expect(mockStorage['dream_locale']).toBe('zh-CN');
  });

  it('2. New V1.1 governance & deactivation error codes translate naturally without engineering jargon', () => {
    setLocale('zh-CN');
    const zhMaster = resolveApiErrorMessage({ code: 'PERMANENT_MASTER_ADMIN_PROTECTED' });
    const zhLast = resolveApiErrorMessage({ code: 'LAST_ACTIVE_ADMIN_REQUIRED' });
    const zhStudents = resolveApiErrorMessage({ code: 'DEACTIVATE_BLOCKED_ACTIVE_STUDENTS' });

    expect(zhMaster).toContain('永久主管理员');
    expect(zhLast).toContain('管理员');
    expect(zhStudents).toContain('在读学员');
    for (const text of [zhMaster, zhLast, zhStudents]) {
      expect(text).not.toMatch(/Break-Glass|TTL|枚举|令牌|审计日志|种子/);
    }

    setLocale('en-US');
    expect(resolveApiErrorMessage({ code: 'PERMANENT_MASTER_ADMIN_REQUIRED' })).toContain(
      'permanent primary admin'
    );
  });

  it('3. Receiving 403 ACCOUNT_BANNED wipes L2 tokens + L3 cache (leaving dream_locale) and redirects to /login', async () => {
    mockStorage['access_token'] = 'banned-jwt';
    mockStorage['refresh_token'] = 'banned-refresh';
    mockStorage['dream_context'] = JSON.stringify({ accountId: 'accBanned1' });
    mockStorage['dream_locale'] = 'en-US';
    await setPartitionedL3Snapshot('accBanned1', 'parent', 'classes', [{ id: 'c1' }]);

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ code: 'ACCOUNT_BANNED', error: 'Account banned' }),
    });

    await expect(listAdmins()).rejects.toThrow();

    expect(mockStorage['access_token']).toBeUndefined();
    expect(mockStorage['refresh_token']).toBeUndefined();
    expect(mockStorage['dream_context']).toBeUndefined();
    expect(mockStorage['dream_locale']).toBe('en-US');
    expect(await getPartitionedL3Snapshot('accBanned1', 'parent', 'classes')).toBeNull();
    expect((global.window as { location: { href: string } }).location.href).toBe(
      '/login?redirect=%2Fadmin%2Fadmins'
    );
  });

  it('4. Admin governance, avatar upload URL, and deactivation endpoints hit expected URLs & methods', async () => {
    mockStorage['access_token'] = 'master-jwt';
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    });

    await lookupAdminCandidate('ops@topee.top');
    await grantAdmin({
      email: 'ops@topee.top',
      displayName: 'Ops',
      confirmText: 'ops@topee.top',
    });
    await updateAdminDisplayName('adm1', 'Ops New');
    await revokeAdmin('adm1', 'Ops New');
    await requestAvatarUploadUrl({ contentType: 'image/webp', fileSizeBytes: 50_000 });
    await deactivateAccount({ confirmEmail: 'me@topee.top' });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/dream/v1/admin/admins/lookup');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/dream/v1/admin/admins');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/dream/v1/admin/admins/adm1');
    expect(fetchMock.mock.calls[2][1].method).toBe('PATCH');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/dream/v1/admin/admins/adm1/revoke');
    expect(fetchMock.mock.calls[4][0]).toBe('/api/dream/v1/me/avatar/upload-url');
    expect(fetchMock.mock.calls[5][0]).toBe('/api/dream/v1/me/deactivate');
  });
});
