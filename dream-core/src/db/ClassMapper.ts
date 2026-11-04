/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { generateShortUuid, DatabaseService } from '@topeetop/shared-core';
import { BaseMapper } from './BaseMapper.js';
import {
  ClassRow,
  ClassRecord,
  CreateClassDbInput,
  UpdateClassDbInput,
  ClassStatus,
  ClassType,
  FindClassesFilter,
  FindPublicSmallGroupClassesFilter,
  PublicSmallGroupClassRow,
  PublicSmallGroupClassRecord,
  formatDateOnly,
  mapRowToClassRecord,
  mapRowToPublicSmallGroupClassRecord,
} from '../types/class.types.js';

export class ClassMapper extends BaseMapper<ClassRow> {
  protected readonly tableName = 'classes';

  constructor(db?: DatabaseService) {
    super(db);
  }

  /**
   * 创建班级记录
   */
  async create(data: CreateClassDbInput, client?: PoolClient): Promise<ClassRecord> {
    const id = data.id || generateShortUuid();
    const minStudents = data.minStudents ?? 1;
    const maxStudents = data.maxStudents ?? 1;
    const teacherSalaryPoints = data.teacherSalaryPoints ?? 0;
    const platformCommissionRate = data.platformCommissionRate ?? 0.0;
    const status = data.status ?? 'recruiting';
    const plannedStartDate = formatDateOnly(data.plannedStartDate);
    const forceStartedAt = data.forceStartedAt
      ? data.forceStartedAt instanceof Date
        ? data.forceStartedAt
        : new Date(data.forceStartedAt)
      : null;

    const sql = `
      INSERT INTO ${this.fullTableName} (
        id,
        name,
        class_type,
        course_type_id,
        teacher_profile_id,
        owner_monitor_profile_id,
        min_students,
        max_students,
        teacher_salary_points,
        platform_commission_rate,
        status,
        planned_start_date,
        force_started_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
      )
      RETURNING *;
    `;

    const params: unknown[] = [
      id,
      data.name,
      data.classType,
      data.courseTypeId,
      data.teacherProfileId,
      data.ownerMonitorProfileId,
      minStudents,
      maxStudents,
      teacherSalaryPoints,
      platformCommissionRate,
      status,
      plannedStartDate,
      forceStartedAt,
    ];

    const row = await this.executeQuerySingle<ClassRow>(sql, params, client);
    if (!row) {
      throw new Error('Failed to create class record: no row returned');
    }

    return mapRowToClassRecord(row);
  }

  /**
   * 根据 ID 查询有效班级 (未软删除)
   */
  async findById(id: string, client?: PoolClient): Promise<ClassRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<ClassRow>(sql, [id], client);
    return row ? mapRowToClassRecord(row) : null;
  }

  /**
   * 行级排他排班并发防超卖锁查询 (SELECT ... FOR UPDATE)
   * 必须在事务中调用，锁住当前班级记录，防止并发报名击穿容量上限
   */
  async findByIdForUpdate(id: string, client?: PoolClient): Promise<ClassRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE id = $1 AND deleted_at IS NULL
      FOR UPDATE;
    `;

    const row = await this.executeQuerySingle<ClassRow>(sql, [id], client);
    return row ? mapRowToClassRecord(row) : null;
  }

  /**
   * 更新班级信息
   */
  async update(
    id: string,
    data: UpdateClassDbInput,
    client?: PoolClient
  ): Promise<ClassRecord | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [id];
    let paramIndex = 2;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.teacherProfileId !== undefined) {
      setClauses.push(`teacher_profile_id = $${paramIndex++}`);
      params.push(data.teacherProfileId);
    }
    if (data.minStudents !== undefined) {
      setClauses.push(`min_students = $${paramIndex++}`);
      params.push(data.minStudents);
    }
    if (data.maxStudents !== undefined) {
      setClauses.push(`max_students = $${paramIndex++}`);
      params.push(data.maxStudents);
    }
    if (data.teacherSalaryPoints !== undefined) {
      setClauses.push(`teacher_salary_points = $${paramIndex++}`);
      params.push(data.teacherSalaryPoints);
    }
    if (data.platformCommissionRate !== undefined) {
      setClauses.push(`platform_commission_rate = $${paramIndex++}`);
      params.push(data.platformCommissionRate);
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }
    if (data.plannedStartDate !== undefined) {
      setClauses.push(`planned_start_date = $${paramIndex++}`);
      params.push(formatDateOnly(data.plannedStartDate));
    }
    if (data.forceStartedAt !== undefined) {
      setClauses.push(`force_started_at = $${paramIndex++}`);
      params.push(
        data.forceStartedAt
          ? data.forceStartedAt instanceof Date
            ? data.forceStartedAt
            : new Date(data.forceStartedAt)
          : null
      );
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

    const row = await this.executeQuerySingle<ClassRow>(sql, params, client);
    return row ? mapRowToClassRecord(row) : null;
  }

  /**
   * 变更班级状态
   */
  async updateStatus(
    id: string,
    status: ClassStatus,
    client?: PoolClient
  ): Promise<ClassRecord | null> {
    const sql = `
      UPDATE ${this.fullTableName}
      SET status = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<ClassRow>(sql, [id, status], client);
    return row ? mapRowToClassRecord(row) : null;
  }

  /**
   * 班长强制开班（将状态变更为 active 并写入 force_started_at）
   */
  async updateForceStarted(
    id: string,
    forceStartedAt: Date = new Date(),
    client?: PoolClient
  ): Promise<ClassRecord | null> {
    const sql = `
      UPDATE ${this.fullTableName}
      SET status = 'active', force_started_at = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;

    const row = await this.executeQuerySingle<ClassRow>(sql, [id, forceStartedAt], client);
    return row ? mapRowToClassRecord(row) : null;
  }

  /**
   * 查找现有的 1v1 班级（按教师、课程类型及负责班长匹配）
   */
  async findOneToOne(
    teacherProfileId: string,
    courseTypeId: string,
    ownerMonitorProfileId: string,
    client?: PoolClient
  ): Promise<ClassRecord | null> {
    const sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE class_type = '1v1'
        AND teacher_profile_id = $1
        AND course_type_id = $2
        AND owner_monitor_profile_id = $3
        AND deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<ClassRow>(
      sql,
      [teacherProfileId, courseTypeId, ownerMonitorProfileId],
      client
    );
    return row ? mapRowToClassRecord(row) : null;
  }

  /**
   * 查找学员已绑定的有效 1v1 班级 (按学员、教师与课程类型匹配)
   */
  async findOneToOneForStudent(
    studentProfileId: string,
    teacherProfileId: string,
    courseTypeId: string,
    client?: PoolClient
  ): Promise<ClassRecord | null> {
    const sql = `
      SELECT c.*
      FROM ${this.fullTableName} c
      INNER JOIN dream.class_students cs ON c.id = cs.class_id
      WHERE c.class_type = '1v1'
        AND c.teacher_profile_id = $1
        AND c.course_type_id = $2
        AND cs.student_profile_id = $3
        AND cs.status = 'enrolled'
        AND c.deleted_at IS NULL
      LIMIT 1;
    `;

    const row = await this.executeQuerySingle<ClassRow>(
      sql,
      [teacherProfileId, courseTypeId, studentProfileId],
      client
    );
    return row ? mapRowToClassRecord(row) : null;
  }

  /**
   * 按负责班长查询班级列表（支持状态与类型过滤及分页）
   */
  async findByMonitor(
    monitorProfileId: string,
    filter?: {
      status?: ClassStatus | ClassStatus[];
      classType?: ClassType;
      limit?: number;
      offset?: number;
    },
    client?: PoolClient
  ): Promise<ClassRecord[]> {
    const conditions: string[] = ['owner_monitor_profile_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [monitorProfileId];
    let paramIndex = 2;

    if (filter?.classType) {
      conditions.push(`class_type = $${paramIndex++}`);
      params.push(filter.classType);
    }

    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        conditions.push(`status = ANY($${paramIndex++}::varchar[])`);
        params.push(filter.status);
      } else {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filter.status);
      }
    }

    let sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
    `;

    if (filter?.limit !== undefined) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(filter.limit);
    }
    if (filter?.offset !== undefined) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(filter.offset);
    }

    const rows = await this.executeQuery<ClassRow>(sql, params, client);
    return rows.map(mapRowToClassRecord);
  }

  /**
   * 统计班长名下班级总数
   */
  async countByMonitor(
    monitorProfileId: string,
    filter?: {
      status?: ClassStatus | ClassStatus[];
      classType?: ClassType;
    },
    client?: PoolClient
  ): Promise<number> {
    const conditions: string[] = ['owner_monitor_profile_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [monitorProfileId];
    let paramIndex = 2;

    if (filter?.classType) {
      conditions.push(`class_type = $${paramIndex++}`);
      params.push(filter.classType);
    }

    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        conditions.push(`status = ANY($${paramIndex++}::varchar[])`);
        params.push(filter.status);
      } else {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filter.status);
      }
    }

    const sql = `
      SELECT COUNT(*)::int AS count
      FROM ${this.fullTableName}
      WHERE ${conditions.join(' AND ')};
    `;

    const row = await this.executeQuerySingle<{ count: string | number }>(sql, params, client);
    return row ? Number(row.count) : 0;
  }

  /**
   * 全平台通用查询班级列表（管理员管理与全量统计）
   */
  async findAll(
    filter?: FindClassesFilter,
    client?: PoolClient
  ): Promise<ClassRecord[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter?.ownerMonitorProfileId) {
      conditions.push(`owner_monitor_profile_id = $${paramIndex++}`);
      params.push(filter.ownerMonitorProfileId);
    }

    if (filter?.teacherProfileId) {
      conditions.push(`teacher_profile_id = $${paramIndex++}`);
      params.push(filter.teacherProfileId);
    }

    if (filter?.courseTypeId) {
      conditions.push(`course_type_id = $${paramIndex++}`);
      params.push(filter.courseTypeId);
    }

    if (filter?.classType) {
      conditions.push(`class_type = $${paramIndex++}`);
      params.push(filter.classType);
    }

    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        conditions.push(`status = ANY($${paramIndex++}::varchar[])`);
        params.push(filter.status);
      } else {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filter.status);
      }
    }

    let sql = `
      SELECT *
      FROM ${this.fullTableName}
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
    `;

    if (filter?.limit !== undefined) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(filter.limit);
    }
    if (filter?.offset !== undefined) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(filter.offset);
    }

    const rows = await this.executeQuery<ClassRow>(sql, params, client);
    return rows.map(mapRowToClassRecord);
  }

  /**
   * 全平台通用统计班级总数
   */
  async countAll(
    filter?: FindClassesFilter,
    client?: PoolClient
  ): Promise<number> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter?.ownerMonitorProfileId) {
      conditions.push(`owner_monitor_profile_id = $${paramIndex++}`);
      params.push(filter.ownerMonitorProfileId);
    }

    if (filter?.teacherProfileId) {
      conditions.push(`teacher_profile_id = $${paramIndex++}`);
      params.push(filter.teacherProfileId);
    }

    if (filter?.courseTypeId) {
      conditions.push(`course_type_id = $${paramIndex++}`);
      params.push(filter.courseTypeId);
    }

    if (filter?.classType) {
      conditions.push(`class_type = $${paramIndex++}`);
      params.push(filter.classType);
    }

    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        conditions.push(`status = ANY($${paramIndex++}::varchar[])`);
        params.push(filter.status);
      } else {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filter.status);
      }
    }

    const sql = `
      SELECT COUNT(*)::int AS count
      FROM ${this.fullTableName}
      WHERE ${conditions.join(' AND ')};
    `;

    const row = await this.executeQuerySingle<{ count: string | number }>(sql, params, client);
    return row ? Number(row.count) : 0;
  }

  /**
   * 公开小班课招募列表查询 (JOIN 课程类型、教师档案及在读人数统计)
   */
  async findPublicSmallGroupClasses(
    filter?: FindPublicSmallGroupClassesFilter,
    client?: PoolClient
  ): Promise<PublicSmallGroupClassRecord[]> {
    const conditions: string[] = [
      `c.class_type = 'small_group'`,
      `c.deleted_at IS NULL`,
    ];
    const params: unknown[] = [];
    let paramIndex = 1;

    // 默认展示 recruiting 与 active 状态的小班
    if (filter?.status) {
      conditions.push(`c.status = $${paramIndex++}`);
      params.push(filter.status);
    } else {
      conditions.push(`c.status = ANY($${paramIndex++}::varchar[])`);
      params.push(['recruiting', 'active']);
    }

    if (filter?.courseTypeId) {
      conditions.push(`c.course_type_id = $${paramIndex++}`);
      params.push(filter.courseTypeId);
    }

    let sql = `
      SELECT
        c.id,
        c.name,
        ct.name AS course_type_name,
        tp.display_name AS teacher_display_name,
        tp.photo_key AS teacher_photo_key,
        c.min_students,
        c.max_students,
        COALESCE(cs_agg.enrolled_count, 0)::int AS enrolled_count,
        c.planned_start_date,
        c.status,
        c.created_at
      FROM ${this.fullTableName} c
      INNER JOIN dream.course_types ct ON c.course_type_id = ct.id
      INNER JOIN dream.teacher_profiles tp ON c.teacher_profile_id = tp.id
      LEFT JOIN (
        SELECT class_id, COUNT(*)::int AS enrolled_count
        FROM dream.class_students
        WHERE status = 'enrolled'
        GROUP BY class_id
      ) cs_agg ON c.id = cs_agg.class_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.planned_start_date ASC NULLS LAST, c.created_at ASC
    `;

    if (filter?.limit !== undefined) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(filter.limit);
    }
    if (filter?.offset !== undefined) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(filter.offset);
    }

    const rows = await this.executeQuery<PublicSmallGroupClassRow>(sql, params, client);
    return rows.map(mapRowToPublicSmallGroupClassRecord);
  }

  /**
   * 班长端权限隔离软删除 (IDOR 强隔离: 必须同时匹配 id 与 owner_monitor_profile_id)
   */
  async softDeleteByMonitor(
    id: string,
    monitorProfileId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const sql = `
      UPDATE ${this.fullTableName}
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND owner_monitor_profile_id = $2 AND deleted_at IS NULL
      RETURNING id;
    `;

    const rows = await this.executeQuery<{ id: string }>(sql, [id, monitorProfileId], client);
    return rows.length > 0;
  }
}
