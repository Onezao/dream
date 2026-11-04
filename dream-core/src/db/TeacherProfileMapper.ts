/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { generateShortUuid, DatabaseService } from '@topeetop/shared-core';
import { BaseMapper } from './BaseMapper.js';
import {
  TeacherProfileRow,
  TeacherProfileRecord,
  TeacherProfileWithDetailsRow,
  TeacherProfileWithDetailsRecord,
  CreateTeacherProfileDbInput,
  UpdateTeacherProfileDbInput,
  mapRowToTeacherProfileRecord,
  mapRowToTeacherProfileWithDetailsRecord,
} from '../types/teacherProfile.types.js';

export interface PublicTeacherFilters {
  courseTypeId?: string;
  levelId?: string;
}

export class TeacherProfileMapper extends BaseMapper<TeacherProfileRow> {
  protected readonly tableName = 'teacher_profiles';

  constructor(db?: DatabaseService) {
    super(db);
  }

  /**
   * 创建教师档案
   */
  async create(
    data: CreateTeacherProfileDbInput,
    client?: PoolClient
  ): Promise<TeacherProfileRecord> {
    const id = data.id || generateShortUuid();
    const accountId = data.accountId ?? null;
    const photoKey = data.photoKey ?? null;
    const videoKey = data.videoKey ?? null;
    const classinQrKey = data.classinQrKey ?? null;
    const skillCourseTypeIdsJson = JSON.stringify(data.skillCourseTypeIds ?? []);

    const sql = `
      INSERT INTO ${this.fullTableName} (
        id,
        account_id,
        display_name,
        level_id,
        monitor_profile_id,
        skill_course_type_ids,
        intro_zh,
        intro_en,
        photo_key,
        video_key,
        classin_qr_key,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, NOW(), NOW()
      )
      RETURNING *;
    `;

    const params: unknown[] = [
      id,
      accountId,
      data.displayName,
      data.levelId,
      data.monitorProfileId,
      skillCourseTypeIdsJson,
      data.introZh,
      data.introEn,
      photoKey,
      videoKey,
      classinQrKey,
    ];

    const row = await this.executeQuerySingle<TeacherProfileRow>(sql, params, client);
    if (!row) {
      throw new Error('Failed to create teacher profile record: no row returned');
    }

    return mapRowToTeacherProfileRecord(row);
  }

  /**
   * 按 ID 查询教师档案 (未软删除)
   */
  async findById(id: string, client?: PoolClient): Promise<TeacherProfileRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<TeacherProfileRow>(sql, [id], client);
    return row ? mapRowToTeacherProfileRecord(row) : null;
  }

  /**
   * 按账号 ID (account_id) 查询教师档案 (未软删除)
   */
  async findByAccountId(
    accountId: string,
    client?: PoolClient
  ): Promise<TeacherProfileRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE account_id = $1 AND deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<TeacherProfileRow>(sql, [accountId], client);
    return row ? mapRowToTeacherProfileRecord(row) : null;
  }

  /**
   * 按负责班长 ID 查询教师团队列表 (未软删除)
   */
  async findByMonitorProfileId(
    monitorProfileId: string,
    client?: PoolClient
  ): Promise<TeacherProfileRecord[]> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE monitor_profile_id = $1 AND deleted_at IS NULL
      ORDER BY created_at ASC;
    `;

    const rows = await this.executeQuery<TeacherProfileRow>(sql, [monitorProfileId], client);
    return rows.map(mapRowToTeacherProfileRecord);
  }

  /**
   * 管理员/通用更新教师档案
   */
  async update(
    id: string,
    data: UpdateTeacherProfileDbInput,
    client?: PoolClient
  ): Promise<TeacherProfileRecord | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [id];
    let paramIndex = 2;

    if (data.accountId !== undefined) {
      setClauses.push(`account_id = $${paramIndex++}`);
      params.push(data.accountId);
    }
    if (data.displayName !== undefined) {
      setClauses.push(`display_name = $${paramIndex++}`);
      params.push(data.displayName);
    }
    if (data.levelId !== undefined) {
      setClauses.push(`level_id = $${paramIndex++}`);
      params.push(data.levelId);
    }
    if (data.monitorProfileId !== undefined) {
      setClauses.push(`monitor_profile_id = $${paramIndex++}`);
      params.push(data.monitorProfileId);
    }
    if (data.skillCourseTypeIds !== undefined) {
      setClauses.push(`skill_course_type_ids = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(data.skillCourseTypeIds));
    }
    if (data.introZh !== undefined) {
      setClauses.push(`intro_zh = $${paramIndex++}`);
      params.push(data.introZh);
    }
    if (data.introEn !== undefined) {
      setClauses.push(`intro_en = $${paramIndex++}`);
      params.push(data.introEn);
    }
    if (data.photoKey !== undefined) {
      setClauses.push(`photo_key = $${paramIndex++}`);
      params.push(data.photoKey);
    }
    if (data.videoKey !== undefined) {
      setClauses.push(`video_key = $${paramIndex++}`);
      params.push(data.videoKey);
    }
    if (data.classinQrKey !== undefined) {
      setClauses.push(`classin_qr_key = $${paramIndex++}`);
      params.push(data.classinQrKey);
    }
    if (data.resignedAt !== undefined) {
      setClauses.push(`resigned_at = $${paramIndex++}`);
      params.push(data.resignedAt);
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

    const row = await this.executeQuerySingle<TeacherProfileRow>(sql, params, client);
    return row ? mapRowToTeacherProfileRecord(row) : null;
  }

  /**
   * 班长端权限隔离更新 (IDOR 强隔离: 必须同时匹配 id 与 monitorProfileId)
   */
  async updateByMonitor(
    id: string,
    monitorProfileId: string,
    data: UpdateTeacherProfileDbInput,
    client?: PoolClient
  ): Promise<TeacherProfileRecord | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [id, monitorProfileId];
    let paramIndex = 3;

    if (data.accountId !== undefined) {
      setClauses.push(`account_id = $${paramIndex++}`);
      params.push(data.accountId);
    }
    if (data.displayName !== undefined) {
      setClauses.push(`display_name = $${paramIndex++}`);
      params.push(data.displayName);
    }
    if (data.levelId !== undefined) {
      setClauses.push(`level_id = $${paramIndex++}`);
      params.push(data.levelId);
    }
    if (data.skillCourseTypeIds !== undefined) {
      setClauses.push(`skill_course_type_ids = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(data.skillCourseTypeIds));
    }
    if (data.introZh !== undefined) {
      setClauses.push(`intro_zh = $${paramIndex++}`);
      params.push(data.introZh);
    }
    if (data.introEn !== undefined) {
      setClauses.push(`intro_en = $${paramIndex++}`);
      params.push(data.introEn);
    }
    if (data.photoKey !== undefined) {
      setClauses.push(`photo_key = $${paramIndex++}`);
      params.push(data.photoKey);
    }
    if (data.videoKey !== undefined) {
      setClauses.push(`video_key = $${paramIndex++}`);
      params.push(data.videoKey);
    }
    if (data.classinQrKey !== undefined) {
      setClauses.push(`classin_qr_key = $${paramIndex++}`);
      params.push(data.classinQrKey);
    }
    if (data.resignedAt !== undefined) {
      setClauses.push(`resigned_at = $${paramIndex++}`);
      params.push(data.resignedAt);
    }

    if (setClauses.length === 0) {
      const sqlNoop = `
        SELECT *
        FROM ${this.fullTableName}
        WHERE id = $1 AND monitor_profile_id = $2 AND deleted_at IS NULL
        LIMIT 1;
      `;
      const row = await this.executeQuerySingle<TeacherProfileRow>(
        sqlNoop,
        [id, monitorProfileId],
        client
      );
      return row ? mapRowToTeacherProfileRecord(row) : null;
    }

    setClauses.push('updated_at = NOW()');

    const sql = `
      UPDATE ${this.fullTableName}
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND monitor_profile_id = $2 AND deleted_at IS NULL
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<TeacherProfileRow>(sql, params, client);
    return row ? mapRowToTeacherProfileRecord(row) : null;
  }

  /**
   * 班长端权限隔离软删除 (IDOR 强隔离: 必须同时匹配 id 与 monitorProfileId)
   */
  async softDeleteByMonitor(
    id: string,
    monitorProfileId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const sql = `
      UPDATE ${this.fullTableName}
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND monitor_profile_id = $2 AND deleted_at IS NULL
      RETURNING id;
    `;

    const rows = await this.executeQuery(sql, [id, monitorProfileId], client);
    return rows.length > 0;
  }

  /**
   * 查询家长端/公开只读教师卡片列表 (JOIN 等级与班长，物理脱敏排除已离职与已删除)
   */
  async findPublicList(
    filters?: PublicTeacherFilters,
    client?: PoolClient
  ): Promise<TeacherProfileWithDetailsRecord[]> {
    const conditions: string[] = [
      'tp.resigned_at IS NULL',
      'tp.deleted_at IS NULL',
      'mp.deleted_at IS NULL',
    ];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.levelId) {
      conditions.push(`tp.level_id = $${paramIndex++}`);
      params.push(filters.levelId);
    }

    if (filters?.courseTypeId) {
      conditions.push(`tp.skill_course_type_ids @> $${paramIndex++}::jsonb`);
      params.push(JSON.stringify([filters.courseTypeId]));
    }

    const sql = `
      SELECT
        tp.id,
        tp.account_id,
        tp.display_name,
        tp.level_id,
        tl.name AS level_name,
        tp.monitor_profile_id,
        mp.display_name AS monitor_display_name,
        tp.skill_course_type_ids,
        tp.intro_zh,
        tp.intro_en,
        tp.photo_key,
        tp.video_key,
        tp.classin_qr_key,
        tp.resigned_at,
        tp.created_at,
        tp.updated_at,
        tp.deleted_at
      FROM ${this.fullTableName} tp
      JOIN dream.teacher_levels tl ON tp.level_id = tl.id
      JOIN dream.monitor_profiles mp ON tp.monitor_profile_id = mp.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY tl.sort_order ASC, tp.created_at ASC;
    `;

    const rows = await this.executeQuery<TeacherProfileWithDetailsRow>(sql, params, client);
    return rows.map(mapRowToTeacherProfileWithDetailsRecord);
  }

  /**
   * 查询家长端/公开单个教师详情 (JOIN 等级与班长，已离职或已删除返回 null)
   */
  async findPublicById(
    id: string,
    client?: PoolClient
  ): Promise<TeacherProfileWithDetailsRecord | null> {
    const sql = `
      SELECT
        tp.id,
        tp.account_id,
        tp.display_name,
        tp.level_id,
        tl.name AS level_name,
        tp.monitor_profile_id,
        mp.display_name AS monitor_display_name,
        tp.skill_course_type_ids,
        tp.intro_zh,
        tp.intro_en,
        tp.photo_key,
        tp.video_key,
        tp.classin_qr_key,
        tp.resigned_at,
        tp.created_at,
        tp.updated_at,
        tp.deleted_at
      FROM ${this.fullTableName} tp
      JOIN dream.teacher_levels tl ON tp.level_id = tl.id
      JOIN dream.monitor_profiles mp ON tp.monitor_profile_id = mp.id
      WHERE tp.id = $1
        AND tp.resigned_at IS NULL
        AND tp.deleted_at IS NULL
        AND mp.deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<TeacherProfileWithDetailsRow>(sql, [id], client);
    return row ? mapRowToTeacherProfileWithDetailsRecord(row) : null;
  }

  /**
   * 管理员查询全量教师列表 (JOIN 等级与班长，含已离职教师)
   */
  async findAllWithDetails(client?: PoolClient): Promise<TeacherProfileWithDetailsRecord[]> {
    const sql = `
      SELECT
        tp.id,
        tp.account_id,
        tp.display_name,
        tp.level_id,
        COALESCE(tl.name, '') AS level_name,
        tp.monitor_profile_id,
        COALESCE(mp.display_name, '') AS monitor_display_name,
        tp.skill_course_type_ids,
        tp.intro_zh,
        tp.intro_en,
        tp.photo_key,
        tp.video_key,
        tp.classin_qr_key,
        tp.resigned_at,
        tp.created_at,
        tp.updated_at,
        tp.deleted_at
      FROM ${this.fullTableName} tp
      LEFT JOIN dream.teacher_levels tl ON tp.level_id = tl.id
      LEFT JOIN dream.monitor_profiles mp ON tp.monitor_profile_id = mp.id
      WHERE tp.deleted_at IS NULL
      ORDER BY tp.created_at DESC;
    `;

    const rows = await this.executeQuery<TeacherProfileWithDetailsRow>(sql, [], client);
    return rows.map(mapRowToTeacherProfileWithDetailsRecord);
  }
}
