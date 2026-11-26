/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService, generateShortUuid } from '@topeetop/shared-core';
import { BaseMapper } from './BaseMapper.js';

export interface AuditLogRow extends QueryResultRow {
  id: string;
  actor_account_id: string;
  module: string;
  action: string;
  target_type: string;
  target_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  trace_id: string | null;
  created_at: Date | string;
}

export interface AuditLogRecord {
  id: string;
  actorAccountId: string;
  module: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  traceId: string | null;
  createdAt: Date;
}

export interface CreateAuditLogInput {
  id?: string;
  actorAccountId: string;
  module: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  traceId?: string | null;
}

function mapRowToAuditLogRecord(row: AuditLogRow): AuditLogRecord {
  return {
    id: row.id,
    actorAccountId: row.actor_account_id,
    module: row.module,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    beforeState: row.before_state ?? null,
    afterState: row.after_state ?? null,
    traceId: row.trace_id ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

/**
 * Append-only silent compliance audit log mapper (`dream.audit_logs`).
 */
export class AuditLogMapper extends BaseMapper<AuditLogRow> {
  protected readonly tableName = 'audit_logs';

  constructor(db?: DatabaseService) {
    super(db);
  }

  /**
   * Appends a single immutable audit record inside or outside a transaction.
   */
  async append(input: CreateAuditLogInput, client?: PoolClient): Promise<AuditLogRecord> {
    const id = input.id || generateShortUuid();
    const beforeStateJson = input.beforeState !== undefined ? JSON.stringify(input.beforeState) : null;
    const afterStateJson = input.afterState !== undefined ? JSON.stringify(input.afterState) : null;

    const sql = `
      INSERT INTO ${this.fullTableName} (
        id,
        actor_account_id,
        module,
        action,
        target_type,
        target_id,
        before_state,
        after_state,
        trace_id,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, NOW()
      )
      RETURNING *;
    `;

    const params: unknown[] = [
      id,
      input.actorAccountId,
      input.module,
      input.action,
      input.targetType,
      input.targetId,
      beforeStateJson,
      afterStateJson,
      input.traceId ?? null,
    ];

    const row = await this.executeQuerySingle<AuditLogRow>(sql, params, client);
    if (!row) {
      throw new Error('Failed to append audit log record: no row returned');
    }

    return mapRowToAuditLogRecord(row);
  }
}
