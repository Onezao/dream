/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiError, executeQuery } from '@topeetop/shared-core';

export interface AuthUser {
  id: string; // 12-char account_id
  email: string;
  roles: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    currentProfileId?: string; // 12-char student_profile_id
  }
}

/**
 * 校验并注入当前请求的用户身份及 X-Profile-Id 归属权
 */
export async function authenticateAndResolveProfile(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  // 开发调试或预设简易测试 Header
  if (!authHeader) {
    throw new ApiError('Authentication token is required', 401, 'UNAUTHORIZED');
  }

  // 基础 Token 解析 (生产环境接入 @topeetop/auth-core JwtTokenProvider)
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new ApiError('Invalid authorization token format', 401, 'INVALID_TOKEN');
  }

  // 模拟/轻量提取（实际对接 JWT 解密）
  request.user = {
    id: request.headers['x-account-id'] as string || 'test_account',
    email: 'user@topee.top',
    roles: ['parent'],
  };

  // 检查 Header 穿透的 X-Profile-Id
  const profileId = request.headers['x-profile-id'] as string | undefined;

  if (profileId) {
    // 物理防御 IDOR：校验 profileId 是否确实属于当前 account_id
    const checkSql = `
      SELECT 1 
      FROM dream.student_profiles 
      WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL 
      LIMIT 1;
    `;
    const rows = await executeQuery(checkSql, [profileId, request.user.id]);

    if (rows.length === 0) {
      throw new ApiError(
        'Forbidden: Student profile does not belong to your account',
        403,
        'PROFILE_ACCESS_DENIED'
      );
    }

    request.currentProfileId = profileId;
  }
}
