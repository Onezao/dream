/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import pg, { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DatabaseConfig } from '../types/index.js';

let pool: Pool | null = null;

/**
 * 初始化 PostgreSQL 连接池
 */
export function initDb(config: DatabaseConfig): Pool {
  if (pool) {
    return pool;
  }

  const poolConfig: pg.PoolConfig = {
    connectionString: config.connectionString,
    max: config.max ?? 10,
    idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5000,
  };

  if (config.ssl) {
    poolConfig.ssl = typeof config.ssl === 'boolean' ? { rejectUnauthorized: false } : config.ssl;
  }

  pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle PostgreSQL client:', err);
  });

  return pool;
}

/**
 * 获取连接池单例
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initDb() first.');
  }
  return pool;
}

/**
 * 关闭连接池 (常用于测试拆卸或服务优雅退出)
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * 执行单条查询 (在连接池中借用客户端)
 */
export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> {
  const p = getPool();
  return p.query<R>(text, params);
}

/**
 * 在事务中执行操作 (自动管理 BEGIN / COMMIT / ROLLBACK)
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
