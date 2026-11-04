/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { generateShortUuid, DatabaseService } from '@topeetop/shared-core';
import { BaseMapper } from './BaseMapper.js';
import {
  StudentProfileRow,
  StudentProfileRecord,
  CreateStudentProfileDbInput,
  UpdateStudentProfileDbInput,
  formatBirthDate,
  mapRowToStudentProfileRecord,
} from '../types/studentProfile.types.js';

export class StudentProfileMapper extends BaseMapper<StudentProfileRow> {
  protected readonly tableName = 'student_profiles';

  constructor(db?: DatabaseService) {
    super(db);
  }

  /**
   * 创建学员档案记录
   */
  async create(
    data: CreateStudentProfileDbInput,
    client?: PoolClient
  ): Promise<StudentProfileRecord> {
    const id = data.id || generateShortUuid();
    const gender = data.gender || 'undisclosed';
    const birthDate = formatBirthDate(data.birthDate);
    const avatarKey = data.avatarKey ?? null;
    const preferredCourseTypeIdsJson = JSON.stringify(data.preferredCourseTypeIds ?? []);

    const sql = `
      INSERT INTO ${this.fullTableName} (
        id,
        account_id,
        real_name,
        english_name,
        surname_initial,
        age,
        nickname,
        gender,
        birth_date,
        avatar_key,
        preferred_course_type_ids,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW(), NOW()
      )
      RETURNING *;
    `;

    const params: unknown[] = [
      id,
      data.accountId,
      data.realName,
      data.englishName,
      data.surnameInitial,
      data.age,
      data.nickname,
      gender,
      birthDate,
      avatarKey,
      preferredCourseTypeIdsJson,
    ];

    const row = await this.executeQuerySingle<StudentProfileRow>(sql, params, client);
    if (!row) {
      throw new Error('Failed to create student profile record: no row returned');
    }

    return mapRowToStudentProfileRecord(row);
  }

  /**
   * 根据档案 ID 查询有效学员档案 (WHERE deleted_at IS NULL)
   */
  async findById(id: string, client?: PoolClient): Promise<StudentProfileRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<StudentProfileRow>(sql, [id], client);
    return row ? mapRowToStudentProfileRecord(row) : null;
  }

  /**
   * 根据家长账号 ID 查询名下所有有效学员档案
   */
  async findByAccountId(accountId: string, client?: PoolClient): Promise<StudentProfileRecord[]> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE account_id = $1 AND deleted_at IS NULL
      ORDER BY created_at ASC;
    `;

    const rows = await this.executeQuery<StudentProfileRow>(sql, [accountId], client);
    return rows.map(mapRowToStudentProfileRecord);
  }

  /**
   * 根据规范昵称查询学员档案（大小写不敏感匹配）
   * @param nickname 规范昵称 (如 AliceZ12)
   * @param client 可选事务客户端
   * @param includeDeleted 是否包含软删除档案 (默认 false，仅查有效档案)
   */
  async findByNickname(
    nickname: string,
    client?: PoolClient,
    includeDeleted: boolean = false
  ): Promise<StudentProfileRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE LOWER(nickname) = LOWER($1) ${includeDeleted ? '' : 'AND deleted_at IS NULL'}
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<StudentProfileRow>(sql, [nickname], client);
    return row ? mapRowToStudentProfileRecord(row) : null;
  }

  /**
   * 统计家长名下处于有效状态的档案数量 (用于 10 个数量上限拦截)
   */
  async countActiveByAccountId(accountId: string, client?: PoolClient): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int AS total
      FROM ${this.fullTableName}
      WHERE account_id = $1 AND deleted_at IS NULL;
    `;

    const row = await this.executeQuerySingle<{ total: number }>(sql, [accountId], client);
    return row?.total ? Number(row.total) : 0;
  }

  /**
   * 更新学员档案 (IDOR 强隔离: 必须同时匹配 id 与 accountId 且未删除)
   */
  async update(
    id: string,
    accountId: string,
    data: UpdateStudentProfileDbInput,
    client?: PoolClient
  ): Promise<StudentProfileRecord | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [id, accountId];
    let paramIndex = 3;

    if (data.realName !== undefined) {
      setClauses.push(`real_name = $${paramIndex++}`);
      params.push(data.realName);
    }
    if (data.englishName !== undefined) {
      setClauses.push(`english_name = $${paramIndex++}`);
      params.push(data.englishName);
    }
    if (data.surnameInitial !== undefined) {
      setClauses.push(`surname_initial = $${paramIndex++}`);
      params.push(data.surnameInitial);
    }
    if (data.age !== undefined) {
      setClauses.push(`age = $${paramIndex++}`);
      params.push(data.age);
    }
    if (data.nickname !== undefined) {
      setClauses.push(`nickname = $${paramIndex++}`);
      params.push(data.nickname);
    }
    if (data.gender !== undefined) {
      setClauses.push(`gender = $${paramIndex++}`);
      params.push(data.gender);
    }
    if (data.birthDate !== undefined) {
      setClauses.push(`birth_date = $${paramIndex++}`);
      params.push(formatBirthDate(data.birthDate));
    }
    if (data.avatarKey !== undefined) {
      setClauses.push(`avatar_key = $${paramIndex++}`);
      params.push(data.avatarKey);
    }
    if (data.preferredCourseTypeIds !== undefined) {
      setClauses.push(`preferred_course_type_ids = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(data.preferredCourseTypeIds));
    }

    if (setClauses.length === 0) {
      const sqlNoop = `
        SELECT *
        FROM ${this.fullTableName}
        WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL
        LIMIT 1;
      `;
      const row = await this.executeQuerySingle<StudentProfileRow>(sqlNoop, [id, accountId], client);
      return row ? mapRowToStudentProfileRecord(row) : null;
    }

    setClauses.push('updated_at = NOW()');

    const sql = `
      UPDATE ${this.fullTableName}
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<StudentProfileRow>(
      sql,
      params,
      client
    );
    return row ? mapRowToStudentProfileRecord(row) : null;
  }

  /**
   * 软删除学员档案 (IDOR 强隔离: 必须同时匹配 id 与 accountId 且未删除)
   */
  override async softDelete(id: string, client?: PoolClient): Promise<boolean>;
  override async softDelete(id: string, accountId: string, client?: PoolClient): Promise<boolean>;
  override async softDelete(
    id: string,
    accountIdOrClient?: string | PoolClient,
    maybeClient?: PoolClient
  ): Promise<boolean> {
    let accountId: string | undefined;
    let client: PoolClient | undefined;

    if (typeof accountIdOrClient === 'string') {
      accountId = accountIdOrClient;
      client = maybeClient;
    } else {
      client = accountIdOrClient;
    }

    if (accountId) {
      const sql = `
        UPDATE ${this.fullTableName}
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL
        RETURNING id;
      `;
      const rows = await this.executeQuery(sql, [id, accountId], client);
      return rows.length > 0;
    }

    return super.softDelete(id, client);
  }

  /**
   * 在事务内锁定家长账号作用域 (防止并发创建超额突破 10 个上限)
   * 必须在已开启事务的 PoolClient 上执行
   */
  async lockAccountScope(accountId: string, client: PoolClient): Promise<void> {
    const sql = 'SELECT pg_advisory_xact_lock(hashtext($1));';
    await client.query(sql, [accountId]);
  }
}
