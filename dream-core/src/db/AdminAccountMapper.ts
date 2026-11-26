/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient, QueryResultRow } from 'pg';
import { DatabaseService, generateShortUuid } from '@topeetop/shared-core';
import { BaseMapper } from './BaseMapper.js';

export type AdminAccountStatus = 'ACTIVE' | 'REVOKED';

export interface AdminAccountRow extends QueryResultRow {
  id: string;
  account_id: string;
  display_name: string;
  status: AdminAccountStatus;
  is_permanent_primary: boolean;
  note: string | null;
  granted_by: string | null;
  granted_at: Date | string;
  revoked_by: string | null;
  revoked_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface AdminAccountRecord {
  id: string;
  accountId: string;
  displayName: string;
  status: AdminAccountStatus;
  isPermanentPrimary: boolean;
  note: string | null;
  grantedBy: string | null;
  grantedAt: Date;
  revokedBy: string | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface AdminAccountMinimal {
  id: string;
  accountId: string;
  displayName: string;
  status: AdminAccountStatus;
  isPermanentPrimary: boolean;
}

interface AdminAccountMinimalRow extends QueryResultRow {
  id: string;
  account_id: string;
  display_name: string;
  status: AdminAccountStatus;
  is_permanent_primary: boolean;
}

export interface CreateAdminAccountDbInput {
  id?: string;
  accountId: string;
  displayName: string;
  isPermanentPrimary?: boolean;
  note?: string | null;
  grantedBy?: string | null;
}

export interface ReactivateAdminAccountDbInput {
  displayName: string;
  grantedBy: string;
  note?: string | null;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapRowToAdminAccountRecord(row: AdminAccountRow): AdminAccountRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    displayName: row.display_name,
    status: row.status,
    isPermanentPrimary: Boolean(row.is_permanent_primary),
    note: row.note ?? null,
    grantedBy: row.granted_by ?? null,
    grantedAt: toDate(row.granted_at),
    revokedBy: row.revoked_by ?? null,
    revokedAt: row.revoked_at ? toDate(row.revoked_at) : null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    deletedAt: row.deleted_at ? toDate(row.deleted_at) : null,
  };
}

export class AdminAccountMapper extends BaseMapper<AdminAccountRow> {
  protected readonly tableName = 'admin_accounts';

  constructor(db?: DatabaseService) {
    super(db);
  }

  /**
   * Acquires a transaction-level advisory lock for admin governance mutations.
   */
  async lockGovernanceScope(client: PoolClient): Promise<void> {
    const sql = "SELECT pg_advisory_xact_lock(hashtext('dream:admin_accounts:governance'));";
    await client.query(sql);
  }

  /**
   * Finds all ACTIVE and non-deleted admin accounts with minimal fields for role directory cache.
   */
  async findAllActiveMinimal(client?: PoolClient): Promise<AdminAccountMinimal[]> {
    const sql = `
      SELECT id, account_id, display_name, status, is_permanent_primary
      FROM ${this.fullTableName}
      WHERE status = 'ACTIVE' AND deleted_at IS NULL;
    `;

    const rows = await this.executeQuery<AdminAccountMinimalRow>(sql, [], client);
    return rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      displayName: row.display_name ?? '',
      status: row.status,
      isPermanentPrimary: Boolean(row.is_permanent_primary),
    }));
  }

  /**
   * Finds an ACTIVE admin account by account_id (used by high-risk guards bypassing cache).
   */
  async findActiveByAccountId(
    accountId: string,
    client?: PoolClient
  ): Promise<AdminAccountMinimal | null> {
    const sql = `
      SELECT id, account_id, display_name, status, is_permanent_primary
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
      displayName: row.display_name ?? '',
      status: row.status,
      isPermanentPrimary: Boolean(row.is_permanent_primary),
    };
  }

  /**
   * Finds a non-deleted admin record by primary key ID.
   */
  async findById(id: string, client?: PoolClient): Promise<AdminAccountRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<AdminAccountRow>(sql, [id], client);
    return row ? mapRowToAdminAccountRecord(row) : null;
  }

  /**
   * Finds a non-deleted admin record (ACTIVE or REVOKED) by account ID.
   */
  async findByAccountId(accountId: string, client?: PoolClient): Promise<AdminAccountRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE account_id = $1 AND deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<AdminAccountRow>(sql, [accountId], client);
    return row ? mapRowToAdminAccountRecord(row) : null;
  }

  /**
   * Finds the single active permanent primary master admin record.
   */
  async findPermanentPrimary(client?: PoolClient): Promise<AdminAccountRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE is_permanent_primary = TRUE AND status = 'ACTIVE' AND deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<AdminAccountRow>(sql, [], client);
    return row ? mapRowToAdminAccountRecord(row) : null;
  }

  /**
   * Lists all non-deleted admin accounts sorted by Mode A baseline:
   * permanent primary first -> active ordinary -> revoked, then granted_at ASC.
   */
  async listAll(client?: PoolClient): Promise<AdminAccountRecord[]> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE deleted_at IS NULL
      ORDER BY
        is_permanent_primary DESC,
        CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END ASC,
        granted_at ASC,
        id ASC;
    `;

    const rows = await this.executeQuery<AdminAccountRow>(sql, [], client);
    return rows.map(mapRowToAdminAccountRecord);
  }

  /**
   * Creates a new admin account record.
   */
  async create(
    data: CreateAdminAccountDbInput,
    client?: PoolClient
  ): Promise<AdminAccountRecord> {
    const id = data.id || generateShortUuid();
    const isPermanentPrimary = Boolean(data.isPermanentPrimary);
    const note = data.note ?? null;
    const grantedBy = data.grantedBy ?? null;

    const sql = `
      INSERT INTO ${this.fullTableName} (
        id,
        account_id,
        display_name,
        status,
        is_permanent_primary,
        note,
        granted_by,
        granted_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, 'ACTIVE', $4, $5, $6, NOW(), NOW(), NOW()
      )
      RETURNING *;
    `;

    const params: unknown[] = [
      id,
      data.accountId,
      data.displayName,
      isPermanentPrimary,
      note,
      grantedBy,
    ];
    const row = await this.executeQuerySingle<AdminAccountRow>(sql, params, client);
    if (!row) {
      throw new Error('Failed to create admin account record: no row returned');
    }

    return mapRowToAdminAccountRecord(row);
  }

  /**
   * Re-activates an existing REVOKED admin record for the same account_id.
   */
  async reactivate(
    id: string,
    data: ReactivateAdminAccountDbInput,
    client?: PoolClient
  ): Promise<AdminAccountRecord | null> {
    const sql = `
      UPDATE ${this.fullTableName}
      SET
        status = 'ACTIVE',
        display_name = $2,
        granted_by = $3,
        granted_at = NOW(),
        revoked_by = NULL,
        revoked_at = NULL,
        note = COALESCE($4, note),
        updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL AND is_permanent_primary = FALSE
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<AdminAccountRow>(
      sql,
      [id, data.displayName, data.grantedBy, data.note ?? null],
      client
    );
    return row ? mapRowToAdminAccountRecord(row) : null;
  }

  /**
   * Updates display_name of an ACTIVE admin record.
   */
  async updateDisplayName(
    id: string,
    displayName: string,
    client?: PoolClient
  ): Promise<AdminAccountRecord | null> {
    const sql = `
      UPDATE ${this.fullTableName}
      SET display_name = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<AdminAccountRow>(sql, [id, displayName], client);
    return row ? mapRowToAdminAccountRecord(row) : null;
  }

  /**
   * Revokes an ordinary ACTIVE admin record while enforcing non-primary guard.
   */
  async revoke(
    id: string,
    revokedBy: string,
    client?: PoolClient
  ): Promise<AdminAccountRecord | null> {
    const sql = `
      UPDATE ${this.fullTableName}
      SET
        status = 'REVOKED',
        revoked_by = $2,
        revoked_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND status = 'ACTIVE'
        AND is_permanent_primary = FALSE
        AND deleted_at IS NULL
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<AdminAccountRow>(sql, [id, revokedBy], client);
    return row ? mapRowToAdminAccountRecord(row) : null;
  }

  /**
   * Releases permanent primary protection and revokes old master admin during CLI emergency recovery.
   */
  async revokePermanentPrimaryForRecovery(
    id: string,
    actorAccountId: string,
    client: PoolClient
  ): Promise<AdminAccountRecord | null> {
    const sql = `
      UPDATE ${this.fullTableName}
      SET
        is_permanent_primary = FALSE,
        status = 'REVOKED',
        revoked_by = $2,
        revoked_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND is_permanent_primary = TRUE AND deleted_at IS NULL
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<AdminAccountRow>(sql, [id, actorAccountId], client);
    return row ? mapRowToAdminAccountRecord(row) : null;
  }

  /**
   * Promotes an existing admin record to permanent primary master admin during CLI bootstrap/recovery.
   */
  async promotePermanentPrimary(
    id: string,
    displayName: string,
    grantedBy: string,
    client: PoolClient
  ): Promise<AdminAccountRecord | null> {
    const sql = `
      UPDATE ${this.fullTableName}
      SET
        is_permanent_primary = TRUE,
        status = 'ACTIVE',
        display_name = $2,
        granted_by = $3,
        granted_at = NOW(),
        revoked_by = NULL,
        revoked_at = NULL,
        updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<AdminAccountRow>(
      sql,
      [id, displayName, grantedBy],
      client
    );
    return row ? mapRowToAdminAccountRecord(row) : null;
  }
}
