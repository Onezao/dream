/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiError, JwtAuthHook } from '@topeetop/shared-core';
import {
  IdentityContextService,
  RoleResolutionSnapshot,
  MeContextDto,
  BusinessRole,
} from '@topeetop/dream-core';
import { getConfig } from '../config/env.config.js';

export interface AuthUser {
  id: string; // 12-char account_id
  userId?: string;
  email: string;
  roles: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    identity?: RoleResolutionSnapshot | MeContextDto;
    currentProfileId?: string; // 12-char student_profile_id
  }
}

const LEGACY_TEST_MOCK_TOKENS = new Set([
  'mock-access-token',
  'mock-monitor-token',
  'mock-admin-token',
  'mock-parent-token',
]);

let identityContextService: IdentityContextService | null = null;
let isIdentityServiceOverridden = false;

/**
 * 注入全局共享的 IdentityContextService 实例（共享 0-60s 整点分钟角色目录缓存）
 */
export function setIdentityContextService(service: IdentityContextService): void {
  identityContextService = service;
  isIdentityServiceOverridden = true;
}

/**
 * 获取全局共享的 IdentityContextService 单例
 */
export function getIdentityContextService(): IdentityContextService {
  if (!identityContextService) {
    identityContextService = new IdentityContextService();
  }
  return identityContextService;
}

/**
 * 重置 IdentityContextService 单例（仅用于测试隔离）
 */
export function resetIdentityContextService(): void {
  identityContextService = null;
  isIdentityServiceOverridden = false;
}

function buildLegacySnapshot(accountId: string, roles: string[]): RoleResolutionSnapshot {
  const effectiveRoles = (roles.length > 0 ? roles : ['parent']) as BusinessRole[];
  return {
    accountId,
    primaryRole: effectiveRoles[0],
    effectiveRoles,
    adminAccount: effectiveRoles.includes('admin')
      ? { id: 'mock_admin', displayName: 'Mock Admin', isPermanentPrimary: false }
      : null,
    monitorProfile: effectiveRoles.includes('monitor')
      ? { id: 'mock_monitor', displayName: 'Mock Monitor', status: 'ACTIVE' }
      : null,
    teacherProfile: effectiveRoles.includes('teacher')
      ? { id: 'mock_teacher', displayName: 'Mock Teacher', status: 'ACTIVE' }
      : null,
  };
}

/**
 * 校验 JWT 并注入当前请求的账号身份、业务四角色上下文及 X-Profile-Id 归属权
 */
export async function authenticateAndResolveProfile(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new ApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  if (!/^Bearer\s+/i.test(authHeader)) {
    throw new ApiError('Invalid authorization token format', 401, 'INVALID_TOKEN');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new ApiError('Invalid authorization token format', 401, 'INVALID_TOKEN');
  }

  const isLegacyMockToken =
    process.env.NODE_ENV === 'test' && LEGACY_TEST_MOCK_TOKENS.has(token);

  let accountId: string;
  let email: string;
  let explicitTestRoles: string[] | undefined;

  if (isLegacyMockToken) {
    accountId = (request.headers['x-account-id'] as string) || 'test_account';
    email = (request.headers['x-email'] as string) || 'user@topee.top';
    const rolesHeader = request.headers['x-roles'] as string | undefined;
    explicitTestRoles = rolesHeader
      ? rolesHeader
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean)
      : undefined;

    request.user = {
      id: accountId,
      userId: accountId,
      email,
      roles: explicitTestRoles ?? ['parent'],
    };
  } else {
    await JwtAuthHook(request, reply);
    const decoded = (request.user ?? {}) as Record<string, unknown>;
    const resolvedId = decoded.id ?? decoded.userId ?? decoded.sub;
    if (typeof resolvedId !== 'string' || !resolvedId) {
      throw new ApiError('Invalid authorization token payload', 401, 'UNAUTHORIZED');
    }
    accountId = resolvedId;
    email = typeof decoded.email === 'string' ? decoded.email : '';
    request.user = {
      ...decoded,
      id: accountId,
      userId: typeof decoded.userId === 'string' ? decoded.userId : accountId,
      email,
      roles: Array.isArray(decoded.roles) ? decoded.roles : [],
    };
  }

  const profileId = request.headers['x-profile-id'] as string | undefined;
  const service = getIdentityContextService();

  if (profileId) {
    const context = await service.resolveContext(accountId, email, profileId);
    request.identity = context;
    request.currentProfileId = profileId;
    request.user.roles = context.effectiveRoles;
    return;
  }

  if (isLegacyMockToken && !isIdentityServiceOverridden) {
    const roles = explicitTestRoles ?? ['parent'];
    const snapshot = buildLegacySnapshot(accountId, roles);
    request.identity = snapshot;
    request.user.roles = snapshot.effectiveRoles;
    return;
  }

  const snapshot = await service.resolveRolesFromCache(accountId);
  request.identity = snapshot;
  request.user.roles = snapshot.effectiveRoles;
}

/**
 * 校验当前登录用户是否具备指定角色权限
 */
export function requireRole(allowedRoles: string | string[]) {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new ApiError('Authentication token is required', 401, 'UNAUTHORIZED');
    }
    const roles =
      request.identity?.effectiveRoles ?? ((request.user as AuthUser)?.roles || []);
    const hasRole = roles.some((role: string) => allowed.includes(role));
    if (!hasRole) {
      throw new ApiError('Forbidden: Insufficient permissions', 403, 'FORBIDDEN');
    }
  };
}

/**
 * 永久主管理员高敏硬守卫 (V1.1 新增 · 跨模块复用):
 * 强制绕过 0-60s 内存缓存直查 dream.admin_accounts 核验 isPermanentPrimary === true && status === 'ACTIVE'
 */
export async function requirePermanentMasterAdmin(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const user = request.user as AuthUser | undefined;
  if (!user?.id) {
    throw new ApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  const service = getIdentityContextService();
  await service.verifyPermanentMasterAdminFromDb(user.id);
}

/**
 * 高危操作实时验活守卫 (Strategy B)：调用 auth-core /api/auth/v1/user 实时核验账号未封禁
 */
export async function verifyActiveAccount(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    throw new ApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  const authBaseUrl = getConfig().AUTH_BASE_URL.replace(/\/+$/, '');
  let response: Response;
  try {
    response = await fetch(`${authBaseUrl}/api/auth/v1/user`, {
      method: 'GET',
      headers: {
        authorization: authHeader,
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new ApiError('Authentication service unavailable', 503, 'AUTH_SERVICE_UNAVAILABLE');
  }

  if (response.status === 403) {
    throw new ApiError('Account is banned', 403, 'ACCOUNT_BANNED');
  }

  if (response.status === 401 || response.status === 404) {
    throw new ApiError('Authentication token is invalid or expired', 401, 'UNAUTHORIZED');
  }

  if (!response.ok) {
    throw new ApiError('Unable to verify account status', 503, 'AUTH_SERVICE_UNAVAILABLE');
  }

  const payload = (await response.json()) as {
    user?: {
      id?: string;
      banned_until?: string | Date | null;
      deleted_at?: string | Date | null;
    };
  };

  const user = payload?.user;
  if (!user) {
    throw new ApiError('Authentication token is invalid or expired', 401, 'UNAUTHORIZED');
  }

  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) {
    throw new ApiError('Account is banned', 403, 'ACCOUNT_BANNED');
  }

  if (user.deleted_at) {
    throw new ApiError('Account is banned', 403, 'ACCOUNT_BANNED');
  }
}
