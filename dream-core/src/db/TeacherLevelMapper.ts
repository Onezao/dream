/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { generateShortUuid, DatabaseService } from '@topeetop/shared-core';
import { BaseMapper } from './BaseMapper.js';
import {
  TeacherLevelRow,
  TeacherLevelRecord,
  CreateTeacherLevelDbInput,
  UpdateTeacherLevelDbInput,
  mapRowToTeacherLevelRecord,
} from '../types/teacherProfile.types.js';

export class TeacherLevelMapper extends BaseMapper<TeacherLevelRow> {
  protected readonly tableName = 'teacher_levels';

  constructor(db?: DatabaseService) {
    super(db);
  }

  /**
   * 创建教师定级记录
   */
  async create(data: CreateTeacherLevelDbInput, client?: PoolClient): Promise<TeacherLevelRecord> {
    const id = data.id || generateShortUuid();
    const sortOrder = data.sortOrder ?? 0;
    const isActive = data.isActive ?? true;

    const sql = `
      INSERT INTO ${this.fullTableName} (
        id,
        name,
        sort_order,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, NOW(), NOW()
      )
      RETURNING *;
    `;

    const params: unknown[] = [id, data.name, sortOrder, isActive];
    const row = await this.executeQuerySingle<TeacherLevelRow>(sql, params, client);
    if (!row) {
      throw new Error('Failed to create teacher level record: no row returned');
    }

    return mapRowToTeacherLevelRecord(row);
  }

  /**
   * 按 ID 查询教师定级
   */
  async findById(id: string, client?: PoolClient): Promise<TeacherLevelRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE id = $1
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<TeacherLevelRow>(sql, [id], client);
    return row ? mapRowToTeacherLevelRecord(row) : null;
  }

  /**
   * 按名称查询教师定级
   */
  async findByName(name: string, client?: PoolClient): Promise<TeacherLevelRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE name = $1
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<TeacherLevelRow>(sql, [name], client);
    return row ? mapRowToTeacherLevelRecord(row) : null;
  }

  /**
   * 按 ID 集合批量查询教师定级
   */
  async findByIds(ids: string[], client?: PoolClient): Promise<TeacherLevelRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE id = ANY($1::text[])
      ORDER BY sort_order ASC, name ASC;
    `;

    const rows = await this.executeQuery<TeacherLevelRow>(sql, [ids], client);
    return rows.map(mapRowToTeacherLevelRecord);
  }

  /**
   * 获取所有教师定级列表
   */
  async listAll(
    options?: { activeOnly?: boolean },
    client?: PoolClient
  ): Promise<TeacherLevelRecord[]> {
    const activeOnly = options?.activeOnly ?? false;
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      ${activeOnly ? 'WHERE is_active = true' : ''}
      ORDER BY sort_order ASC, name ASC;
    `;

    const rows = await this.executeQuery<TeacherLevelRow>(sql, [], client);
    return rows.map(mapRowToTeacherLevelRecord);
  }

  /**
   * 更新教师定级
   */
  async update(
    id: string,
    data: UpdateTeacherLevelDbInput,
    client?: PoolClient
  ): Promise<TeacherLevelRecord | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [id];
    let paramIndex = 2;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.sortOrder !== undefined) {
      setClauses.push(`sort_order = $${paramIndex++}`);
      params.push(data.sortOrder);
    }
    if (data.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(data.isActive);
    }

    if (setClauses.length === 0) {
      return this.findById(id, client);
    }

    setClauses.push('updated_at = NOW()');

    const sql = `
      UPDATE ${this.fullTableName}
      SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<TeacherLevelRow>(sql, params, client);
    return row ? mapRowToTeacherLevelRecord(row) : null;
  }

  /**
   * 物理删除教师定级（字典表无软删除字段）
   */
  async delete(id: string, client?: PoolClient): Promise<boolean> {
    const sql = `
      DELETE FROM ${this.fullTableName}
      WHERE id = $1
      RETURNING id;
    `;

    const rows = await this.executeQuery(sql, [id], client);
    return rows.length > 0;
  }
}
