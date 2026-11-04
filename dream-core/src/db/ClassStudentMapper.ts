/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { generateShortUuid, DatabaseService } from '@topeetop/shared-core';
import { BaseMapper } from './BaseMapper.js';
import {
  ClassStudentRow,
  ClassStudentRecord,
  CreateClassStudentDbInput,
  ClassStudentStatus,
  ClassEnrolledStudentRow,
  ClassEnrolledStudentRecord,
  mapRowToClassStudentRecord,
  mapRowToClassEnrolledStudentRecord,
} from '../types/class.types.js';

export class ClassStudentMapper extends BaseMapper<ClassStudentRow> {
  protected readonly tableName = 'class_students';

  constructor(db?: DatabaseService) {
    super(db);
  }

  /**
   * 记录学员选入班级（报名）
   */
  async create(
    data: CreateClassStudentDbInput,
    client?: PoolClient
  ): Promise<ClassStudentRecord> {
    const id = data.id || generateShortUuid();
    const status = data.status || 'enrolled';
    const enrolledAt = data.enrolledAt
      ? data.enrolledAt instanceof Date
        ? data.enrolledAt
        : new Date(data.enrolledAt)
      : new Date();

    const sql = `
      INSERT INTO ${this.fullTableName} (
        id,
        class_id,
        student_profile_id,
        status,
        enrolled_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW(), NOW()
      )
      RETURNING *;
    `;

    const params: unknown[] = [
      id,
      data.classId,
      data.studentProfileId,
      status,
      enrolledAt,
    ];

    const row = await this.executeQuerySingle<ClassStudentRow>(sql, params, client);
    if (!row) {
      throw new Error('Failed to create class student record: no row returned');
    }

    return mapRowToClassStudentRecord(row);
  }

  /**
   * 根据 ID 查询班级学员关系记录
   */
  async findById(id: string, client?: PoolClient): Promise<ClassStudentRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE id = $1
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<ClassStudentRow>(sql, [id], client);
    return row ? mapRowToClassStudentRecord(row) : null;
  }

  /**
   * 查询学员在指定班级中的当前有效在读状态记录
   */
  async findActiveEnrollment(
    classId: string,
    studentProfileId: string,
    client?: PoolClient
  ): Promise<ClassStudentRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE class_id = $1
        AND student_profile_id = $2
        AND status = 'enrolled'
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<ClassStudentRow>(
      sql,
      [classId, studentProfileId],
      client
    );
    return row ? mapRowToClassStudentRecord(row) : null;
  }

  /**
   * 统计指定班级当前的有效在读学员总数 (status = 'enrolled')
   */
  async countEnrolled(classId: string, client?: PoolClient): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int AS count
      FROM ${this.fullTableName}
      WHERE class_id = $1 AND status = 'enrolled';
    `;

    const row = await this.executeQuerySingle<{ count: string | number }>(
      sql,
      [classId],
      client
    );
    return row ? Number(row.count) : 0;
  }

  /**
   * 学员退班 (将 status 变更为 withdrawn 并记录 removed_at)
   */
  async withdraw(
    classId: string,
    studentProfileId: string,
    client?: PoolClient
  ): Promise<ClassStudentRecord | null> {
    const sql = `
      UPDATE ${this.fullTableName}
      SET status = 'withdrawn', removed_at = NOW(), updated_at = NOW()
      WHERE class_id = $1
        AND student_profile_id = $2
        AND status = 'enrolled'
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<ClassStudentRow>(
      sql,
      [classId, studentProfileId],
      client
    );
    return row ? mapRowToClassStudentRecord(row) : null;
  }

  /**
   * 查询指定班级所有在读学员记录
   */
  async findEnrolledByClassId(
    classId: string,
    client?: PoolClient
  ): Promise<ClassStudentRecord[]> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE class_id = $1 AND status = 'enrolled'
      ORDER BY enrolled_at ASC;
    `;

    const rows = await this.executeQuery<ClassStudentRow>(sql, [classId], client);
    return rows.map(mapRowToClassStudentRecord);
  }

  /**
   * 查询指定班级所有在读学员详情 (JOIN 学员档案获取昵称与头像)
   */
  async findEnrolledStudentsWithDetails(
    classId: string,
    client?: PoolClient
  ): Promise<ClassEnrolledStudentRecord[]> {
    const sql = `
      SELECT
        cs.id,
        cs.class_id,
        cs.student_profile_id,
        sp.nickname,
        sp.avatar_key,
        cs.enrolled_at,
        cs.status
      FROM ${this.fullTableName} cs
      INNER JOIN dream.student_profiles sp ON cs.student_profile_id = sp.id
      WHERE cs.class_id = $1
        AND cs.status = 'enrolled'
        AND sp.deleted_at IS NULL
      ORDER BY cs.enrolled_at ASC;
    `;

    const rows = await this.executeQuery<ClassEnrolledStudentRow>(sql, [classId], client);
    return rows.map(mapRowToClassEnrolledStudentRecord);
  }

  /**
   * 查询学员名下参与的所有班级记录 (支持按状态过滤)
   */
  async findByStudentProfileId(
    studentProfileId: string,
    status?: ClassStudentStatus,
    client?: PoolClient
  ): Promise<ClassStudentRecord[]> {
    const conditions: string[] = ['student_profile_id = $1'];
    const params: unknown[] = [studentProfileId];

    if (status) {
      conditions.push('status = $2');
      params.push(status);
    }

    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE ${conditions.join(' AND ')}
      ORDER BY enrolled_at DESC;
    `;

    const rows = await this.executeQuery<ClassStudentRow>(sql, params, client);
    return rows.map(mapRowToClassStudentRecord);
  }

  /**
   * 批量将某班级的所有在读学员退班 (用于班级取消场景)
   */
  async withdrawAllInClass(classId: string, client?: PoolClient): Promise<number> {
    const sql = `
      UPDATE ${this.fullTableName}
      SET status = 'withdrawn', removed_at = NOW(), updated_at = NOW()
      WHERE class_id = $1 AND status = 'enrolled'
      RETURNING id;
    `;

    const rows = await this.executeQuery<{ id: string }>(sql, [classId], client);
    return rows.length;
  }
}
