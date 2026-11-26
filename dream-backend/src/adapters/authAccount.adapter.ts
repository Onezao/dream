/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import {
  DatabaseService,
  executeQuery as defaultExecuteQuery,
} from '@topeetop/shared-core';
import { SessionProvider, UserProvider } from '@topeetop/auth-core';
import { RefreshTokenProvider } from '@topeetop/security-core';
import type {
  AuthAccountPort,
  AuthAccountSummary,
  ExternalAccountStatus,
} from '@topeetop/dream-core';

interface AuthCoreUserRow {
  id: string;
  email: string;
  email_confirmed_at: Date | string | null;
  banned_until: Date | string | null;
  deleted_at: Date | string | null;
  failed_login_attempts?: number | null;
  created_at?: Date | string | null;
}

function toOptionalDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

function resolveAccountStatus(row: AuthCoreUserRow, nowMs: number = Date.now()): ExternalAccountStatus {
  const deletedAt = toOptionalDate(row.deleted_at);
  if (deletedAt) {
    return 'DEACTIVATED';
  }
  const bannedUntil = toOptionalDate(row.banned_until);
  if (bannedUntil && bannedUntil.getTime() > nowMs) {
    const failedAttempts = Number(row.failed_login_attempts ?? 0);
    return failedAttempts >= 5 ? 'LOCKED' : 'BANNED';
  }
  const emailConfirmedAt = toOptionalDate(row.email_confirmed_at);
  if (!emailConfirmedAt) {
    return 'UNVERIFIED';
  }
  return 'ACTIVE';
}

function mapUserRow(row: AuthCoreUserRow): AuthAccountSummary {
  const bannedUntil = toOptionalDate(row.banned_until);
  const status = resolveAccountStatus(row);
  return {
    id: row.id,
    email: row.email,
    emailConfirmedAt: toOptionalDate(row.email_confirmed_at),
    bannedUntil: status === 'BANNED' ? bannedUntil : null,
    lockedUntil: status === 'LOCKED' ? bannedUntil : null,
    deletedAt: toOptionalDate(row.deleted_at),
    accountStatus: status,
  };
}

function pickPreferredUserRow(rows: AuthCoreUserRow[]): AuthCoreUserRow | null {
  if (rows.length === 0) {
    return null;
  }
  const sorted = [...rows].sort((a, b) => {
    const aActiveRank = a.deleted_at ? 1 : 0;
    const bActiveRank = b.deleted_at ? 1 : 0;
    if (aActiveRank !== bActiveRank) {
      return aActiveRank - bActiveRank;
    }
    const aTime = toOptionalDate(a.created_at)?.getTime() ?? 0;
    const bTime = toOptionalDate(b.created_at)?.getTime() ?? 0;
    return bTime - aTime;
  });
  return sorted[0];
}

/**
 * Infrastructure adapter bridging dream-core AuthAccountPort strictly via
 * `@topeetop/auth-core` (`UserProvider`, `SessionProvider`) & `@topeetop/security-core` (`RefreshTokenProvider`),
 * keeping zero raw SQL inside `dream-backend`.
 */
export class AuthAccountAdapter implements AuthAccountPort {
  private readonly db?: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db;
  }

  private async runQuery<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
    client?: PoolClient
  ): Promise<T[]> {
    if (client) {
      const result = await client.query(sql, params);
      return result.rows as T[];
    }
    if (this.db) {
      return this.db.executeQuery(sql, params as any[]) as Promise<T[]>;
    }
    return defaultExecuteQuery(sql, params as any[]) as Promise<T[]>;
  }

  private createUserProvider(client?: PoolClient): UserProvider {
    return new UserProvider({
      executeQuery: (query: string, params: unknown[] = []) =>
        this.runQuery(query, params, client),
    });
  }

  async findByEmail(email: string): Promise<AuthAccountSummary | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const userProvider = this.createUserProvider();
    const rows = (await userProvider.findUserByEmailOrPhone({
      email: normalizedEmail,
    })) as AuthCoreUserRow[];

    const preferred = pickPreferredUserRow(rows);
    return preferred ? mapUserRow(preferred) : null;
  }

  async findByIds(accountIds: string[]): Promise<Map<string, AuthAccountSummary>> {
    const map = new Map<string, AuthAccountSummary>();
    const uniqueIds = Array.from(new Set(accountIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return map;
    }

    const userProvider = this.createUserProvider();
    const rowGroups = (await Promise.all(
      uniqueIds.map((id) => userProvider.findUserById(id))
    )) as AuthCoreUserRow[][];

    for (const rows of rowGroups) {
      if (rows && rows.length > 0) {
        const mapped = mapUserRow(rows[0]);
        map.set(mapped.id, mapped);
      }
    }
    return map;
  }

  async deactivateAccountAndRevokeSessions(accountId: string, client?: PoolClient): Promise<void> {
    const executeQuery = (query: string, params: unknown[] = []) =>
      this.runQuery(query, params, client);

    const userProvider = new UserProvider({ executeQuery });
    const sessionProvider = new SessionProvider({ executeQuery });
    const refreshTokenProvider = new RefreshTokenProvider({ executeQuery });

    await userProvider.softDeleteUser(accountId);
    await sessionProvider.deleteSessionsByUserId(accountId);
    await refreshTokenProvider.deleteRefreshTokensByUserId({ userId: accountId });
  }
}
