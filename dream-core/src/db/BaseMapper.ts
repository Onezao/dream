/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { PoolClient, QueryResultRow } from 'pg';
import { query as defaultQuery } from './connection.js';

export abstract class BaseMapper<T extends QueryResultRow> {
  protected abstract readonly tableName: string;

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
    params: any[] = [],
    client?: PoolClient
  ): Promise<R[]> {
    if (client) {
      const result = await client.query<R>(sql, params);
      return result.rows;
    }
    const result = await defaultQuery<R>(sql, params);
    return result.rows;
  }

  /**
   * 执行单行查询，返回第一条或 null
   */
  protected async executeQuerySingle<R extends QueryResultRow = T>(
    sql: string,
    params: any[] = [],
    client?: PoolClient
  ): Promise<R | null> {
    const rows = await this.executeQuery<R>(sql, params, client);
    return rows.length > 0 ? rows[0] : null;
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
