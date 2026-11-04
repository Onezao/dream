/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { DatabaseService } from '@topeetop/shared-core';
import { ClassMapper, ClassStudentMapper } from '../src/db/index.js';
import {
  ClassRow,
  ClassStudentRow,
  PublicSmallGroupClassRow,
  ClassEnrolledStudentRow,
  CreateClassDbInput,
  UpdateClassDbInput,
  CreateClassStudentDbInput,
} from '../src/types/index.js';

jest.mock('@topeetop/shared-core', () => {
  const actual = jest.requireActual('@topeetop/shared-core');
  return {
    ...actual,
    executeQuery: jest.fn(),
    getOne: jest.fn(),
  };
});

function createMockClient(): { client: PoolClient; queryMock: jest.Mock } {
  const queryMock = jest.fn();
  const client = {
    query: queryMock,
    release: jest.fn(),
  } as unknown as PoolClient;
  return { client, queryMock };
}

describe('Class & ClassStudent Mappers Test Suite', () => {
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      executeQuery: jest.fn(),
      getOne: jest.fn(),
      executeTx: jest.fn(),
      getPool: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<DatabaseService>;
  });

  // ===========================================================================
  // 1. ClassMapper Tests
  // ===========================================================================
  describe('ClassMapper', () => {
    let mapper: ClassMapper;

    const mockClassRow: ClassRow = {
      id: 'cls123456789',
      name: '少儿英语启蒙小班',
      class_type: 'small_group',
      course_type_id: 'ct1234567890',
      teacher_profile_id: 'tp1234567890',
      owner_monitor_profile_id: 'mp1234567890',
      min_students: 2,
      max_students: 4,
      teacher_salary_points: 120,
      platform_commission_rate: '15.00',
      status: 'recruiting',
      planned_start_date: '2026-12-01',
      force_started_at: null,
      created_at: new Date('2026-11-04T10:00:00Z'),
      updated_at: new Date('2026-11-04T10:00:00Z'),
      deleted_at: null,
    };

    beforeEach(() => {
      mapper = new ClassMapper(mockDb);
    });

    describe('create', () => {
      it('should create a class with default values and provided parameters', async () => {
        mockDb.getOne.mockResolvedValueOnce(mockClassRow);

        const input: CreateClassDbInput = {
          name: '少儿英语启蒙小班',
          classType: 'small_group',
          courseTypeId: 'ct1234567890',
          teacherProfileId: 'tp1234567890',
          ownerMonitorProfileId: 'mp1234567890',
          minStudents: 2,
          maxStudents: 4,
          teacherSalaryPoints: 120,
          platformCommissionRate: 15.0,
          plannedStartDate: '2026-12-01',
        };

        const result = await mapper.create(input);

        expect(mockDb.getOne).toHaveBeenCalledTimes(1);
        const [sql, params] = mockDb.getOne.mock.calls[0];
        expect(sql).toContain('INSERT INTO dream.classes');
        expect(sql).toContain('RETURNING *');
        expect((params as unknown[])[1]).toBe('少儿英语启蒙小班');
        expect((params as unknown[])[2]).toBe('small_group');
        expect((params as unknown[])[6]).toBe(2); // min_students
        expect((params as unknown[])[7]).toBe(4); // max_students
        expect(result.id).toBe('cls123456789');
        expect(result.name).toBe('少儿英语启蒙小班');
        expect(result.platformCommissionRate).toBe(15.0);
        expect(result.status).toBe('recruiting');
        expect(result.plannedStartDate).toBe('2026-12-01');
      });

      it('should pass through client when provided', async () => {
        const { client, queryMock } = createMockClient();
        queryMock.mockResolvedValueOnce({ rows: [mockClassRow] });

        const input: CreateClassDbInput = {
          id: 'custom_id_12',
          name: '1v1 定制课',
          classType: '1v1',
          courseTypeId: 'ct1234567890',
          teacherProfileId: 'tp1234567890',
          ownerMonitorProfileId: 'mp1234567890',
        };

        const result = await mapper.create(input, client);

        expect(queryMock).toHaveBeenCalledTimes(1);
        expect(mockDb.getOne).not.toHaveBeenCalled();
        expect(result.id).toBe('cls123456789');
      });

      it('should throw when no row returned from database', async () => {
        mockDb.getOne.mockResolvedValueOnce(null);

        await expect(
          mapper.create({
            name: '无效班级',
            classType: '1v1',
            courseTypeId: 'ct1234567890',
            teacherProfileId: 'tp1234567890',
            ownerMonitorProfileId: 'mp1234567890',
          })
        ).rejects.toThrow('Failed to create class record: no row returned');
      });
    });

    describe('findById & findByIdForUpdate', () => {
      it('should find class by id', async () => {
        mockDb.getOne.mockResolvedValueOnce(mockClassRow);

        const result = await mapper.findById('cls123456789');
        expect(result?.id).toBe('cls123456789');
        expect(result?.name).toBe('少儿英语启蒙小班');
        expect(mockDb.getOne).toHaveBeenCalledWith(
          expect.stringContaining('WHERE id = $1 AND deleted_at IS NULL'),
          ['cls123456789']
        );
      });

      it('should return null when not found', async () => {
        mockDb.getOne.mockResolvedValueOnce(null);

        const result = await mapper.findById('non_existent_');
        expect(result).toBeNull();
      });

      it('should execute SELECT ... FOR UPDATE on findByIdForUpdate (native row-level lock)', async () => {
        const { client, queryMock } = createMockClient();
        queryMock.mockResolvedValueOnce({ rows: [mockClassRow] });

        const result = await mapper.findByIdForUpdate('cls123456789', client);

        expect(queryMock).toHaveBeenCalledTimes(1);
        const [sql, params] = queryMock.mock.calls[0];
        expect(sql).toContain('FOR UPDATE');
        expect(sql).toContain('WHERE id = $1 AND deleted_at IS NULL');
        expect(params).toEqual(['cls123456789']);
        expect(result?.id).toBe('cls123456789');
      });
    });

    describe('update', () => {
      it('should dynamically update all fields including dates and set updated_at', async () => {
        const updatedRow: ClassRow = {
          ...mockClassRow,
          name: '少儿英语进阶小班',
          teacher_profile_id: 'tp_new_123456',
          min_students: 3,
          max_students: 6,
          teacher_salary_points: 150,
          platform_commission_rate: '20.00',
          status: 'active',
          planned_start_date: '2026-12-15',
          force_started_at: new Date('2026-11-04T12:00:00Z'),
        };
        mockDb.getOne.mockResolvedValueOnce(updatedRow);

        const updateInput: UpdateClassDbInput = {
          name: '少儿英语进阶小班',
          teacherProfileId: 'tp_new_123456',
          minStudents: 3,
          maxStudents: 6,
          teacherSalaryPoints: 150,
          platformCommissionRate: 20.0,
          status: 'active',
          plannedStartDate: '2026-12-15',
          forceStartedAt: '2026-11-04T12:00:00Z',
        };

        const result = await mapper.update('cls123456789', updateInput);

        expect(mockDb.getOne).toHaveBeenCalledTimes(1);
        const [sql, params] = mockDb.getOne.mock.calls[0];
        expect(sql).toContain('UPDATE dream.classes');
        expect(sql).toContain('name = $2');
        expect(sql).toContain('teacher_profile_id = $3');
        expect(sql).toContain('min_students = $4');
        expect(sql).toContain('max_students = $5');
        expect(sql).toContain('teacher_salary_points = $6');
        expect(sql).toContain('platform_commission_rate = $7');
        expect(sql).toContain('status = $8');
        expect(sql).toContain('planned_start_date = $9');
        expect(sql).toContain('force_started_at = $10');
        expect(sql).toContain('updated_at = NOW()');
        expect(result?.name).toBe('少儿英语进阶小班');
        expect(result?.minStudents).toBe(3);
        expect(result?.maxStudents).toBe(6);
        expect(result?.teacherSalaryPoints).toBe(150);
        expect(result?.platformCommissionRate).toBe(20.0);
        expect(result?.status).toBe('active');
      });

      it('should return findById when update payload is empty', async () => {
        mockDb.getOne.mockResolvedValueOnce(mockClassRow);

        const result = await mapper.update('cls123456789', {});

        expect(mockDb.getOne).toHaveBeenCalledWith(
          expect.stringContaining('SELECT *'),
          ['cls123456789']
        );
        expect(result?.id).toBe('cls123456789');
      });
    });

    describe('updateStatus & updateForceStarted', () => {
      it('should update class status', async () => {
        const activeRow: ClassRow = { ...mockClassRow, status: 'active' };
        mockDb.getOne.mockResolvedValueOnce(activeRow);

        const result = await mapper.updateStatus('cls123456789', 'active');

        expect(mockDb.getOne).toHaveBeenCalledWith(
          expect.stringContaining('SET status = $2, updated_at = NOW()'),
          ['cls123456789', 'active']
        );
        expect(result?.status).toBe('active');
      });

      it('should force start class and set force_started_at timestamp', async () => {
        const now = new Date('2026-11-04T12:00:00Z');
        const forceStartedRow: ClassRow = {
          ...mockClassRow,
          status: 'active',
          force_started_at: now,
        };
        mockDb.getOne.mockResolvedValueOnce(forceStartedRow);

        const result = await mapper.updateForceStarted('cls123456789', now);

        expect(mockDb.getOne).toHaveBeenCalledWith(
          expect.stringContaining("SET status = 'active', force_started_at = $2"),
          ['cls123456789', now]
        );
        expect(result?.status).toBe('active');
        expect(result?.forceStartedAt).toEqual(now);
      });
    });

    describe('findOneToOne', () => {
      it('should find 1v1 class by teacher, course type, and monitor', async () => {
        const oneToOneRow: ClassRow = {
          ...mockClassRow,
          class_type: '1v1',
          min_students: 1,
          max_students: 1,
        };
        mockDb.getOne.mockResolvedValueOnce(oneToOneRow);

        const result = await mapper.findOneToOne('tp1234567890', 'ct1234567890', 'mp1234567890');

        expect(mockDb.getOne).toHaveBeenCalledWith(
          expect.stringContaining("WHERE class_type = '1v1'"),
          ['tp1234567890', 'ct1234567890', 'mp1234567890']
        );
        expect(result?.classType).toBe('1v1');
      });

      it('should find 1v1 class for specific student', async () => {
        const oneToOneRow: ClassRow = {
          ...mockClassRow,
          class_type: '1v1',
          min_students: 1,
          max_students: 1,
        };
        mockDb.getOne.mockResolvedValueOnce(oneToOneRow);

        const result = await mapper.findOneToOneForStudent('sp1234567890', 'tp1234567890', 'ct1234567890');

        expect(mockDb.getOne).toHaveBeenCalledWith(
          expect.stringContaining("INNER JOIN dream.class_students cs ON c.id = cs.class_id"),
          ['tp1234567890', 'ct1234567890', 'sp1234567890']
        );
        expect(result?.classType).toBe('1v1');
      });
    });

    describe('findByMonitor & countByMonitor', () => {
      it('should find classes by monitor with pagination and status filters', async () => {
        mockDb.executeQuery.mockResolvedValueOnce([mockClassRow]);

        const result = await mapper.findByMonitor('mp1234567890', {
          status: ['recruiting', 'active'],
          classType: 'small_group',
          limit: 10,
          offset: 0,
        });

        expect(mockDb.executeQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = mockDb.executeQuery.mock.calls[0];
        expect(sql).toContain('owner_monitor_profile_id = $1');
        expect(sql).toContain('class_type = $2');
        expect(sql).toContain('status = ANY($3::varchar[])');
        expect(sql).toContain('LIMIT $4 OFFSET $5');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('cls123456789');
      });

      it('should count classes by monitor with single status filter', async () => {
        mockDb.getOne.mockResolvedValueOnce({ count: 5 });

        const count = await mapper.countByMonitor('mp1234567890', {
          status: 'recruiting',
        });

        expect(count).toBe(5);
        const [sql, params] = mockDb.getOne.mock.calls[0];
        expect(sql).toContain('SELECT COUNT(*)::int');
        expect(params).toEqual(['mp1234567890', 'recruiting']);
      });

      it('should count classes by monitor with array status and classType filter', async () => {
        mockDb.getOne.mockResolvedValueOnce({ count: 2 });

        const count = await mapper.countByMonitor('mp1234567890', {
          status: ['recruiting', 'active'],
          classType: 'small_group',
        });

        expect(count).toBe(2);
        const [sql, params] = mockDb.getOne.mock.calls[0];
        expect(sql).toContain('class_type = $2');
        expect(sql).toContain('status = ANY($3::varchar[])');
        expect(params).toEqual(['mp1234567890', 'small_group', ['recruiting', 'active']]);
      });

      it('should find classes by monitor with single status and offset only', async () => {
        mockDb.executeQuery.mockResolvedValueOnce([mockClassRow]);

        const result = await mapper.findByMonitor('mp1234567890', {
          status: 'recruiting',
          offset: 5,
        });

        expect(result).toHaveLength(1);
        const [sql, params] = mockDb.executeQuery.mock.calls[0];
        expect(sql).toContain('status = $2');
        expect(sql).toContain('OFFSET $3');
        expect(params).toEqual(['mp1234567890', 'recruiting', 5]);
      });
    });

    describe('findPublicSmallGroupClasses', () => {
      const mockPublicRow: PublicSmallGroupClassRow = {
        id: 'cls123456789',
        name: '少儿英语启蒙小班',
        course_type_name: '自然拼读',
        teacher_display_name: 'Sarah Teacher',
        teacher_photo_key: 'teachers/sarah.jpg',
        min_students: 2,
        max_students: 4,
        enrolled_count: '4',
        planned_start_date: '2026-12-01',
        status: 'recruiting',
        created_at: new Date('2026-11-04T10:00:00Z'),
      };

      it('should query joined small group classes with enrolled count and isFull computed', async () => {
        mockDb.executeQuery.mockResolvedValueOnce([mockPublicRow]);

        const result = await mapper.findPublicSmallGroupClasses({
          courseTypeId: 'ct1234567890',
          status: 'recruiting',
          limit: 20,
        });

        expect(mockDb.executeQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = mockDb.executeQuery.mock.calls[0];
        expect(sql).toContain("c.class_type = 'small_group'");
        expect(sql).toContain('INNER JOIN dream.course_types ct');
        expect(sql).toContain('INNER JOIN dream.teacher_profiles tp');
        expect(sql).toContain('LEFT JOIN (');
        expect(sql).toContain('GROUP BY class_id');
        expect(result).toHaveLength(1);
        expect(result[0].courseTypeName).toBe('自然拼读');
        expect(result[0].teacherDisplayName).toBe('Sarah Teacher');
        expect(result[0].enrolledCount).toBe(4);
        expect(result[0].maxStudents).toBe(4);
        expect(result[0].isFull).toBe(true);
      });

      it('should use default status array and support offset when status is omitted', async () => {
        mockDb.executeQuery.mockResolvedValueOnce([mockPublicRow]);

        const result = await mapper.findPublicSmallGroupClasses({
          offset: 10,
        });

        expect(result).toHaveLength(1);
        const [sql, params] = mockDb.executeQuery.mock.calls[0];
        expect(sql).toContain('c.status = ANY($1::varchar[])');
        expect(sql).toContain('OFFSET $2');
        expect(params).toEqual([['recruiting', 'active'], 10]);
      });
    });

    describe('softDelete & softDeleteByMonitor', () => {
      it('should soft delete class by id', async () => {
        mockDb.executeQuery.mockResolvedValueOnce([{ id: 'cls123456789' }]);

        const success = await mapper.softDelete('cls123456789');

        expect(success).toBe(true);
        const [sql, params] = mockDb.executeQuery.mock.calls[0];
        expect(sql).toContain('UPDATE dream.classes');
        expect(sql).toContain('deleted_at = NOW()');
        expect(params).toEqual(['cls123456789']);
      });

      it('should soft delete with monitor IDOR isolation', async () => {
        mockDb.executeQuery.mockResolvedValueOnce([{ id: 'cls123456789' }]);

        const success = await mapper.softDeleteByMonitor('cls123456789', 'mp1234567890');

        expect(success).toBe(true);
        const [sql, params] = mockDb.executeQuery.mock.calls[0];
        expect(sql).toContain('UPDATE dream.classes');
        expect(sql).toContain('owner_monitor_profile_id = $2');
        expect(sql).toContain('deleted_at = NOW()');
        expect(params).toEqual(['cls123456789', 'mp1234567890']);
      });

      it('should return false if monitor does not own class or class not found', async () => {
        mockDb.executeQuery.mockResolvedValueOnce([]);

        const success = await mapper.softDeleteByMonitor('cls123456789', 'other_monitor');
        expect(success).toBe(false);
      });
    });
  });

  // ===========================================================================
  // 2. ClassStudentMapper Tests
  // ===========================================================================
  describe('ClassStudentMapper', () => {
    let mapper: ClassStudentMapper;

    const mockStudentRow: ClassStudentRow = {
      id: 'cs1234567890',
      class_id: 'cls123456789',
      student_profile_id: 'sp1234567890',
      status: 'enrolled',
      enrolled_at: new Date('2026-11-04T10:05:00Z'),
      removed_at: null,
      created_at: new Date('2026-11-04T10:05:00Z'),
      updated_at: new Date('2026-11-04T10:05:00Z'),
    };

    beforeEach(() => {
      mapper = new ClassStudentMapper(mockDb);
    });

    describe('create (enrollment)', () => {
      it('should create enrollment record with default values', async () => {
        mockDb.getOne.mockResolvedValueOnce(mockStudentRow);

        const input: CreateClassStudentDbInput = {
          classId: 'cls123456789',
          studentProfileId: 'sp1234567890',
        };

        const result = await mapper.create(input);

        expect(mockDb.getOne).toHaveBeenCalledTimes(1);
        const [sql, params] = mockDb.getOne.mock.calls[0];
        expect(sql).toContain('INSERT INTO dream.class_students');
        expect((params as unknown[])[1]).toBe('cls123456789');
        expect((params as unknown[])[2]).toBe('sp1234567890');
        expect((params as unknown[])[3]).toBe('enrolled');
        expect(result.id).toBe('cs1234567890');
        expect(result.status).toBe('enrolled');
      });

      it('should throw if insert returns no row', async () => {
        mockDb.getOne.mockResolvedValueOnce(null);

        await expect(
          mapper.create({
            classId: 'cls123456789',
            studentProfileId: 'sp1234567890',
          })
        ).rejects.toThrow('Failed to create class student record: no row returned');
      });
    });

    describe('findById & findActiveEnrollment', () => {
      it('should find student enrollment by id', async () => {
        mockDb.getOne.mockResolvedValueOnce(mockStudentRow);

        const result = await mapper.findById('cs1234567890');
        expect(result?.id).toBe('cs1234567890');
        expect(mockDb.getOne).toHaveBeenCalledWith(
          expect.stringContaining('WHERE id = $1'),
          ['cs1234567890']
        );
      });

      it('should find active enrollment in class', async () => {
        mockDb.getOne.mockResolvedValueOnce(mockStudentRow);

        const result = await mapper.findActiveEnrollment('cls123456789', 'sp1234567890');
        expect(result?.status).toBe('enrolled');
        const [sql, params] = mockDb.getOne.mock.calls[0];
        expect(sql).toContain('class_id = $1');
        expect(sql).toContain('student_profile_id = $2');
        expect(sql).toContain("status = 'enrolled'");
        expect(params).toEqual(['cls123456789', 'sp1234567890']);
      });
    });

    describe('countEnrolled', () => {
      it('should count enrolled students in class', async () => {
        mockDb.getOne.mockResolvedValueOnce({ count: 3 });

        const count = await mapper.countEnrolled('cls123456789');
        expect(count).toBe(3);
        expect(mockDb.getOne).toHaveBeenCalledWith(
          expect.stringContaining("WHERE class_id = $1 AND status = 'enrolled'"),
          ['cls123456789']
        );
      });

      it('should support PoolClient transaction passthrough', async () => {
        const { client, queryMock } = createMockClient();
        queryMock.mockResolvedValueOnce({ rows: [{ count: 2 }] });

        const count = await mapper.countEnrolled('cls123456789', client);
        expect(count).toBe(2);
        expect(queryMock).toHaveBeenCalledTimes(1);
        expect(mockDb.getOne).not.toHaveBeenCalled();
      });
    });

    describe('withdraw', () => {
      it('should withdraw student from class and record removed_at', async () => {
        const withdrawnRow: ClassStudentRow = {
          ...mockStudentRow,
          status: 'withdrawn',
          removed_at: new Date('2026-11-04T12:00:00Z'),
        };
        mockDb.getOne.mockResolvedValueOnce(withdrawnRow);

        const result = await mapper.withdraw('cls123456789', 'sp1234567890');

        expect(mockDb.getOne).toHaveBeenCalledWith(
          expect.stringContaining("SET status = 'withdrawn', removed_at = NOW()"),
          ['cls123456789', 'sp1234567890']
        );
        expect(result?.status).toBe('withdrawn');
        expect(result?.removedAt).toBeInstanceOf(Date);
      });
    });

    describe('findEnrolledByClassId & findEnrolledStudentsWithDetails', () => {
      it('should find enrolled students in class ordered by enrolled_at', async () => {
        mockDb.executeQuery.mockResolvedValueOnce([mockStudentRow]);

        const result = await mapper.findEnrolledByClassId('cls123456789');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('cs1234567890');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(
          expect.stringContaining("WHERE class_id = $1 AND status = 'enrolled'"),
          ['cls123456789']
        );
      });

      it('should find enrolled students with student profile details (nickname and avatar)', async () => {
        const detailRow: ClassEnrolledStudentRow = {
          id: 'cs1234567890',
          class_id: 'cls123456789',
          student_profile_id: 'sp1234567890',
          nickname: 'AliceZ12',
          avatar_key: 'avatars/alice.png',
          enrolled_at: new Date('2026-11-04T10:05:00Z'),
          status: 'enrolled',
        };
        mockDb.executeQuery.mockResolvedValueOnce([detailRow]);

        const result = await mapper.findEnrolledStudentsWithDetails('cls123456789');
        expect(result).toHaveLength(1);
        expect(result[0].nickname).toBe('AliceZ12');
        expect(result[0].avatarKey).toBe('avatars/alice.png');
        expect(mockDb.executeQuery).toHaveBeenCalledWith(
          expect.stringContaining('INNER JOIN dream.student_profiles sp'),
          ['cls123456789']
        );
      });
    });

    describe('findByStudentProfileId', () => {
      it('should find all class enrollments for student profile', async () => {
        mockDb.executeQuery.mockResolvedValueOnce([mockStudentRow]);

        const result = await mapper.findByStudentProfileId('sp1234567890', 'enrolled');
        expect(result).toHaveLength(1);
        const [sql, params] = mockDb.executeQuery.mock.calls[0];
        expect(sql).toContain('student_profile_id = $1');
        expect(sql).toContain('status = $2');
        expect(params).toEqual(['sp1234567890', 'enrolled']);
      });
    });

    describe('withdrawAllInClass', () => {
      it('should batch withdraw all enrolled students in class', async () => {
        mockDb.executeQuery.mockResolvedValueOnce([{ id: 'cs1' }, { id: 'cs2' }]);

        const count = await mapper.withdrawAllInClass('cls123456789');
        expect(count).toBe(2);
        const [sql, params] = mockDb.executeQuery.mock.calls[0];
        expect(sql).toContain("SET status = 'withdrawn', removed_at = NOW()");
        expect(sql).toContain("WHERE class_id = $1 AND status = 'enrolled'");
        expect(params).toEqual(['cls123456789']);
      });
    });
  });
});
