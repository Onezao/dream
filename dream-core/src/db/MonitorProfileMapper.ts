/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { generateShortUuid, DatabaseService } from '@topeetop/shared-core';
import { BaseMapper } from './BaseMapper.js';
import {
  MonitorProfileRow,
  MonitorProfileRecord,
  CreateMonitorProfileDbInput,
  UpdateMonitorProfileDbInput,
  mapRowToMonitorProfileRecord,
} from '../types/teacherProfile.types.js';

export class MonitorProfileMapper extends BaseMapper<MonitorProfileRow> {
  protected readonly tableName = 'monitor_profiles';

  constructor(db?: DatabaseService) {
    super(db);
  }

  /**
   * 创建班长档案记录
   */
  async create(
    data: CreateMonitorProfileDbInput,
    client?: PoolClient
  ): Promise<MonitorProfileRecord> {
    const id = data.id || generateShortUuid();
    const phone = data.phone ?? null;

    const sql = `
      INSERT INTO ${this.fullTableName} (
        id,
        account_id,
        display_name,
        phone,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, NOW(), NOW()
      )
      RETURNING *;
    `;

    const params: unknown[] = [id, data.accountId, data.displayName, phone];
    const row = await this.executeQuerySingle<MonitorProfileRow>(sql, params, client);
    if (!row) {
      throw new Error('Failed to create monitor profile record: no row returned');
    }

    return mapRowToMonitorProfileRecord(row);
  }

  /**
   * 按 ID 查询有效班长档案
   */
  async findById(id: string, client?: PoolClient): Promise<MonitorProfileRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<MonitorProfileRow>(sql, [id], client);
    return row ? mapRowToMonitorProfileRecord(row) : null;
  }

  /**
   * 按账号 ID (account_id) 查询有效班长档案
   */
  async findByAccountId(accountId: string, client?: PoolClient): Promise<MonitorProfileRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE account_id = $1 AND deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<MonitorProfileRow>(sql, [accountId], client);
    return row ? mapRowToMonitorProfileRecord(row) : null;
  }

  /**
   * 查询所有有效班长档案列表
   */
  async listAll(client?: PoolClient): Promise<MonitorProfileRecord[]> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC;
    `;

    const rows = await this.executeQuery<MonitorProfileRow>(sql, [], client);
    return rows.map(mapRowToMonitorProfileRecord);
  }

  /**
   * 更新班长档案
   */
  async update(
    id: string,
    data: UpdateMonitorProfileDbInput,
    client?: PoolClient
  ): Promise<MonitorProfileRecord | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [id];
    let paramIndex = 2;

    if (data.displayName !== undefined) {
      setClauses.push(`display_name = $${paramIndex++}`);
      params.push(data.displayName);
    }
    if (data.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      params.push(data.phone);
    }

    if (setClauses.length === 0) {
      return this.findById(id, client);
    }

    setClauses.push('updated_at = NOW()');

    const sql = `
      UPDATE ${this.fullTableName}
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<MonitorProfileRow>(sql, params, client);
    return row ? mapRowToMonitorProfileRecord(row) : null;
  }
}
