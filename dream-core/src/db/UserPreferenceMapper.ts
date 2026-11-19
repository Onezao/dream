/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient, QueryResultRow } from 'pg';
import { generateShortUuid, DatabaseService } from '@topeetop/shared-core';
import { BaseMapper } from './BaseMapper.js';

export interface UserPreferenceRow extends QueryResultRow {
  id: string;
  account_id: string;
  locale: 'zh-CN' | 'en-US';
  timezone: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserPreferenceRecord {
  id: string;
  accountId: string;
  locale: 'zh-CN' | 'en-US';
  timezone: string;
}

export class UserPreferenceMapper extends BaseMapper<UserPreferenceRow> {
  protected readonly tableName = 'user_preferences';

  constructor(db?: DatabaseService) {
    super(db);
  }

  /**
   * 按账号 ID 查询用户语言与时区偏好
   */
  async findByAccountId(
    accountId: string,
    client?: PoolClient
  ): Promise<UserPreferenceRecord | null> {
    const sql = `
      SELECT id, account_id, locale, timezone, created_at, updated_at
      FROM ${this.fullTableName}
      WHERE account_id = $1
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<UserPreferenceRow>(sql, [accountId], client);
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      accountId: row.account_id,
      locale: row.locale,
      timezone: row.timezone,
    };
  }

  /**
   * 创建或更新用户语言与时区偏好
   */
  async upsertPreference(
    accountId: string,
    input: { locale?: 'zh-CN' | 'en-US'; timezone?: string },
    client?: PoolClient
  ): Promise<UserPreferenceRecord> {
    const id = generateShortUuid();
    const locale = input.locale ?? null;
    const timezone = input.timezone ?? null;

    const sql = `
      INSERT INTO ${this.fullTableName} (
        id,
        account_id,
        locale,
        timezone,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, COALESCE($3, 'zh-CN'), COALESCE($4, 'Asia/Shanghai'), NOW(), NOW()
      )
      ON CONFLICT (account_id) DO UPDATE SET
        locale = COALESCE($3, dream.user_preferences.locale),
        timezone = COALESCE($4, dream.user_preferences.timezone),
        updated_at = NOW()
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<UserPreferenceRow>(
      sql,
      [id, accountId, locale, timezone],
      client
    );
    if (!row) {
      throw new Error('Failed to upsert user preference record: no row returned');
    }

    return {
      id: row.id,
      accountId: row.account_id,
      locale: row.locale,
      timezone: row.timezone,
    };
  }
}
