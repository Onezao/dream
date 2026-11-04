/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { z } from 'zod';
import type { StudentGender } from '../../types/studentProfile.types.js';

export const ShortId = z.string().length(12);

export const AvatarKey = z
  .string()
  .max(255)
  .regex(
    /^dream\/students\/avatars\/\d{4}\/\d{2}\/\d{2}\/[A-Za-z0-9_-]{12}\.(jpg|jpeg|png|webp)$/
  );

export const NICKNAME_REGEX = /^[A-Za-z]{1,24}[A-Z]\d{1,2}[a-z0-9]{0,3}$/;

export const CreateStudentProfileSchema = z.object({
  realName: z.string().trim().min(1).max(32),
  englishName: z.string().trim().regex(/^[A-Za-z]{1,24}$/, '英文名必须为1-24位英文字母'),
  surnameInitial: z
    .string()
    .trim()
    .length(1)
    .regex(/^[A-Za-z]$/, '姓首字母必须为单个字母')
    .transform((v) => v.toUpperCase()),
  age: z.number().int().min(1).max(99),
  nicknameSuffix: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{1,3}$/, '后缀限1-3位小写字母/数字')
    .optional(),
  gender: z.enum(['male', 'female', 'undisclosed']).default('undisclosed'),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  avatarKey: AvatarKey.optional(),
  preferredCourseTypeIds: z.array(ShortId).max(20).default([]),
});

export const UpdateStudentProfileSchema = z.object({
  realName: z.string().trim().min(1).max(32).optional(),
  age: z.number().int().min(1).max(99).optional(),
  nicknameSuffix: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{1,3}$/)
    .optional(),
  gender: z.enum(['male', 'female', 'undisclosed']).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  avatarKey: AvatarKey.optional(),
  preferredCourseTypeIds: z.array(ShortId).max(20).optional(),
});

export type CreateStudentProfileInput = z.input<typeof CreateStudentProfileSchema>;
export type CreateStudentProfileData = z.output<typeof CreateStudentProfileSchema>;

export type UpdateStudentProfileInput = z.input<typeof UpdateStudentProfileSchema>;
export type UpdateStudentProfileData = z.output<typeof UpdateStudentProfileSchema>;

export interface StudentProfileDto {
  id: string;
  accountId: string;
  realName: string;
  englishName: string;
  surnameInitial: string;
  age: number;
  nickname: string;
  gender: StudentGender;
  birthDate: string | null;
  avatarKey: string | null;
  avatarUrl: string | null;
  preferredCourseTypeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentLookupDto {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface StudentProfileListResponse {
  data: StudentProfileDto[];
  meta: {
    total: number;
    limit: number;
  };
}

export type { StudentGender };
