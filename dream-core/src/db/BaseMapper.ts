/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient, QueryResultRow } from 'pg';
import {
  DatabaseService,
  executeQuery as defaultExecuteQuery,
  getOne as defaultGetOne,
} from '@topeetop/shared-core';

export abstract class BaseMapper<T extends QueryResultRow> {
  protected abstract readonly tableName: string;
  protected readonly db?: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db;
  }

  /**
   * 规范表名：强制 dream. 单 Schema 前缀
   */
  protected get fullTableName(): string {
    return `dream.${this.tableName}`;
  }

  /**
   * 执行 SQL 查询，支持传入事务客户端 (PoolClient) 确保事务一致性
   */
  protected async executeQuery<R extends QueryResultRow = T>(
    sql: string,
    params: unknown[] = [],
    client?: PoolClient
  ): Promise<R[]> {
    if (client) {
      const result = await client.query<R>(sql, params as unknown as any[]);
      return result.rows;
    }
    if (this.db) {
      return this.db.executeQuery<R>(sql, params as unknown as any[]);
    }
    return defaultExecuteQuery<R>(sql, params as unknown as any[]);
  }

  /**
   * 执行单行查询，返回第一条或 null
   */
  protected async executeQuerySingle<R extends QueryResultRow = T>(
    sql: string,
    params: unknown[] = [],
    client?: PoolClient
  ): Promise<R | null> {
    if (client) {
      const rows = await this.executeQuery<R>(sql, params, client);
      return rows.length > 0 ? rows[0] : null;
    }
    if (this.db) {
      return this.db.getOne<R>(sql, params as unknown as any[]);
    }
    return defaultGetOne<R>(sql, params as unknown as any[]);
  }

  /**
   * 软删除标准实现
   */
  async softDelete(id: string, client?: PoolClient): Promise<boolean> {
    const sql = `
      UPDATE ${this.fullTableName}
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id;
    `;
    const rows = await this.executeQuery(sql, [id], client);
    return rows.length > 0;
  }
}
