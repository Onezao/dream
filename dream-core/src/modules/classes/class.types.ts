/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { z } from 'zod';
import { ShortId } from '../profile/index.js';
import type {
  ClassStatus,
  ClassType,
  ClassRecord,
  ClassStudentRecord,
  PublicSmallGroupClassRecord,
} from '../../types/class.types.js';

// =============================================================================
// 1. Zod 入参校验契约 (Zod Validation Schemas)
// =============================================================================

export const CreateSmallGroupClassSchema = z
  .object({
    name: z.string().trim().min(2, '班级名称至少2字').max(64, '班级名称最多64字'),
    courseTypeId: ShortId,
    teacherProfileId: ShortId,
    minStudents: z.number().int().min(1, '最少开班人数不能小于1').default(2),
    maxStudents: z.number().int().min(1).max(20, '最大容纳人数不能超过20人').default(4),
    teacherSalaryPoints: z.number().int().nonnegative('教师单节课酬必须非负').default(0),
    platformCommissionRate: z
      .number()
      .min(0.0)
      .max(100.0)
      .multipleOf(0.01, '抽佣比例最多支持2位小数')
      .default(0.0),
    plannedStartDate: z.string().date('计划开课日期格式不正确 (YYYY-MM-DD)'),
  })
  .refine((data) => data.minStudents <= data.maxStudents, {
    message: '最少开班人数不能大于最大容纳人数',
    path: ['minStudents'],
  });

export const ConfirmActionSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: '必须显式确认操作' }),
  }),
});

export const CancelClassSchema = ConfirmActionSchema.extend({
  reason: z.string().trim().min(2, '取消原因至少2字').max(200, '取消原因最多200字'),
});

export const AdminClassQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['recruiting', 'active', 'completed', 'cancelled']).optional(),
  classType: z.enum(['1v1', 'small_group']).optional(),
  ownerMonitorProfileId: ShortId.optional(),
  teacherProfileId: ShortId.optional(),
  courseTypeId: ShortId.optional(),
});

export const AdminUpdateClassSchema = z
  .object({
    name: z.string().trim().min(2, '班级名称至少2字').max(64, '班级名称最多64字').optional(),
    teacherProfileId: ShortId.optional(),
    minStudents: z.number().int().min(1, '最少开班人数不能小于1').optional(),
    maxStudents: z.number().int().min(1).max(20, '最大容纳人数不能超过20人').optional(),
    teacherSalaryPoints: z.number().int().nonnegative('教师单节课酬必须非负').optional(),
    platformCommissionRate: z
      .number()
      .min(0.0)
      .max(100.0)
      .multipleOf(0.01, '抽佣比例最多支持2位小数')
      .optional(),
    status: z.enum(['recruiting', 'active', 'completed', 'cancelled']).optional(),
    plannedStartDate: z.string().date('计划开课日期格式不正确 (YYYY-MM-DD)').nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.minStudents !== undefined && data.maxStudents !== undefined) {
        return data.minStudents <= data.maxStudents;
      }
      return true;
    },
    {
      message: '最少开班人数不能大于最大容纳人数',
      path: ['minStudents'],
    }
  );

// =============================================================================
// 2. TypeScript 类型推导 (Inferred Input Types)
// =============================================================================

export type CreateSmallGroupClassInput = z.infer<typeof CreateSmallGroupClassSchema>;
export type ConfirmActionInput = z.infer<typeof ConfirmActionSchema>;
export type CancelClassInput = z.infer<typeof CancelClassSchema>;
export type AdminClassQueryInput = z.infer<typeof AdminClassQuerySchema>;
export type AdminUpdateClassInput = z.infer<typeof AdminUpdateClassSchema>;

// =============================================================================
// 3. 数据传输对象 (Data Transfer Objects - DTOs)
// =============================================================================

export interface PublicSmallGroupClassDto {
  id: string; // 12-char
  name: string;
  courseTypeName: string;
  teacherDisplayName: string;
  teacherPhotoUrl: string | null;
  minStudents: number;
  maxStudents: number;
  enrolledCount: number;
  isFull: boolean;
  plannedStartDate: string | null;
  status: ClassStatus;
}

export interface EnrolledStudentSummaryDto {
  studentProfileId: string;
  nickname: string;
  avatarUrl: string | null;
  enrolledAt: string;
}

export interface MonitorClassDto extends PublicSmallGroupClassDto {
  ownerMonitorProfileId: string;
  teacherSalaryPoints: number;
  platformCommissionRate: number;
  forceStartedAt: string | null;
  createdAt: string;
  enrolledStudents: EnrolledStudentSummaryDto[];
}

export interface AdminClassDto extends MonitorClassDto {
  classType: ClassType;
  updatedAt: string;
}

export interface EnsureOneToOneClassParams {
  studentProfileId: string;
  teacherProfileId: string;
  courseTypeId: string;
  ownerMonitorProfileId?: string;
}

export interface ClassServiceOptions {
  cdnBaseUrl?: string;
}
