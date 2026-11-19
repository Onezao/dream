/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService } from '@topeetop/shared-core';
import { BaseMapper } from './BaseMapper.js';

export interface AdminAccountRow extends QueryResultRow {
  id: string;
  account_id: string;
  status: 'ACTIVE' | 'DISABLED';
  note: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface AdminAccountMinimal {
  id: string;
  accountId: string;
  status: 'ACTIVE' | 'DISABLED';
}

interface AdminAccountMinimalRow extends QueryResultRow {
  id: string;
  account_id: string;
  status: 'ACTIVE' | 'DISABLED';
}

export class AdminAccountMapper extends BaseMapper<AdminAccountRow> {
  protected readonly tableName = 'admin_accounts';

  constructor(db?: DatabaseService) {
    super(db);
  }

  /**
   * 查询所有处于 ACTIVE 状态且未软删除的平台管理员最小身份列表
   */
  async findAllActiveMinimal(client?: PoolClient): Promise<AdminAccountMinimal[]> {
    const sql = `
      SELECT id, account_id, status
      FROM ${this.fullTableName}
      WHERE status = 'ACTIVE' AND deleted_at IS NULL;
    `;

    const rows = await this.executeQuery<AdminAccountMinimalRow>(sql, [], client);
    return rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      status: row.status,
    }));
  }

  /**
   * 按账号 ID 查询处于 ACTIVE 状态且未软删除的平台管理员记录
   */
  async findActiveByAccountId(
    accountId: string,
    client?: PoolClient
  ): Promise<AdminAccountMinimal | null> {
    const sql = `
      SELECT id, account_id, status
      FROM ${this.fullTableName}
      WHERE account_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<AdminAccountMinimalRow>(sql, [accountId], client);
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      accountId: row.account_id,
      status: row.status,
    };
  }
}
