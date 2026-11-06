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
    name: z.string().trim().min(2, 'Class name must be at least 2 characters').max(64, 'Class name cannot exceed 64 characters'),
    courseTypeId: ShortId,
    teacherProfileId: ShortId,
    minStudents: z.number().int().min(1, 'Minimum students cannot be less than 1').default(2),
    maxStudents: z.number().int().min(1).max(20, 'Maximum students cannot exceed 20').default(4),
    teacherSalaryPoints: z.number().int().nonnegative('Teacher salary points must be non-negative').default(0),
    platformCommissionRate: z
      .number()
      .min(0.0)
      .max(100.0)
      .multipleOf(0.01, 'Commission rate supports at most 2 decimal places')
      .default(0.0),
    plannedStartDate: z.string().date('Invalid planned start date format (YYYY-MM-DD)'),
  })
  .refine((data) => data.minStudents <= data.maxStudents, {
    message: 'Minimum students cannot exceed maximum students',
    path: ['minStudents'],
  });

export const ConfirmActionSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Action must be explicitly confirmed' }),
  }),
});

export const CancelClassSchema = ConfirmActionSchema.extend({
  reason: z.string().trim().min(2, 'Cancellation reason must be at least 2 characters').max(200, 'Cancellation reason cannot exceed 200 characters'),
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
    name: z.string().trim().min(2, 'Class name must be at least 2 characters').max(64, 'Class name cannot exceed 64 characters').optional(),
    teacherProfileId: ShortId.optional(),
    minStudents: z.number().int().min(1, 'Minimum students cannot be less than 1').optional(),
    maxStudents: z.number().int().min(1).max(20, 'Maximum students cannot exceed 20').optional(),
    teacherSalaryPoints: z.number().int().nonnegative('Teacher salary points must be non-negative').optional(),
    platformCommissionRate: z
      .number()
      .min(0.0)
      .max(100.0)
      .multipleOf(0.01, 'Commission rate supports at most 2 decimal places')
      .optional(),
    status: z.enum(['recruiting', 'active', 'completed', 'cancelled']).optional(),
    plannedStartDate: z.string().date('Invalid planned start date format (YYYY-MM-DD)').nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.minStudents !== undefined && data.maxStudents !== undefined) {
        return data.minStudents <= data.maxStudents;
      }
      return true;
    },
    {
      message: 'Minimum students cannot exceed maximum students',
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
