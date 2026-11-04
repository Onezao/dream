/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { z } from 'zod';
import { ShortId } from './types.js';

export const TeacherPhotoKey = z
  .string()
  .regex(
    /^dream\/teachers\/photos\/\d{4}\/\d{2}\/\d{2}\/[A-Za-z0-9_-]{12}\.(jpg|jpeg|png|webp)$/,
    '照片相对Key格式不符合规范'
  );

export const TeacherVideoKey = z
  .string()
  .regex(
    /^dream\/teachers\/videos\/\d{4}\/\d{2}\/\d{2}\/[A-Za-z0-9_-]{12}\.mp4$/,
    '视频相对Key格式不符合规范(必须为MP4)'
  );

export const TeacherQrKey = z
  .string()
  .regex(
    /^dream\/teachers\/classin_qr\/\d{4}\/\d{2}\/\d{2}\/[A-Za-z0-9_-]{12}\.(jpg|jpeg|png|webp)$/,
    'ClassIn二维码相对Key格式不符合规范'
  );

export const UploadUrlSchema = z
  .object({
    bizType: z.enum([
      'student_avatar',
      'teacher_photo',
      'teacher_video',
      'teacher_classin_qr',
      'transfer_proof',
    ]),
    contentType: z.enum(['image/webp', 'image/jpeg', 'image/png', 'video/mp4']),
    contentLength: z.number().int().positive(),
  })
  .refine(
    (data) => {
      // 视频格式铁律：严格锁定为 MP4 (H.264+AAC)，杜绝 WebM 在 iOS 及部分机型上的解码黑屏
      if (data.bizType === 'teacher_video') {
        return data.contentType === 'video/mp4' && data.contentLength <= 50 * 1024 * 1024;
      }
      // 照片与二维码由前端本地裁剪后生成 WebP 或 JPEG/PNG，放宽上限至 1MB
      if (['teacher_photo', 'teacher_classin_qr', 'student_avatar'].includes(data.bizType)) {
        return (
          ['image/webp', 'image/jpeg', 'image/png'].includes(data.contentType) &&
          data.contentLength <= 1 * 1024 * 1024
        );
      }
      return data.contentLength <= 2 * 1024 * 1024;
    },
    { message: '文件类型或体积超出业务限制 (裁剪后图片<=1MB, 视频必须为MP4且<=50MB)' }
  );

export type UploadUrlInput = z.infer<typeof UploadUrlSchema>;

export const CreateTeacherProfileSchema = z.object({
  displayName: z.string().trim().min(1, '显示名称不能为空').max(64),
  levelId: ShortId,
  skillCourseTypeIds: z.array(ShortId).min(1, '至少选择一项擅长课程类型').max(20),
  introZh: z.string().trim().min(10, '中文简介至少10字').max(2000, '中文简介最多2000字'),
  introEn: z.string().trim().min(20, '英文简介至少20字').max(2000, '英文简介最多2000字'),
  photoKey: TeacherPhotoKey.optional(),
  videoKey: TeacherVideoKey.optional(),
  classinQrKey: TeacherQrKey.optional(),
});

export type CreateTeacherProfileInput = z.infer<typeof CreateTeacherProfileSchema>;

export const UpdateTeacherProfileSchema = CreateTeacherProfileSchema.partial();
export type UpdateTeacherProfileInput = z.infer<typeof UpdateTeacherProfileSchema>;

export const AdminUpsertTeacherSchema = CreateTeacherProfileSchema.extend({
  monitorProfileId: ShortId,
  accountId: ShortId.optional(),
  resigned: z.boolean().optional(),
});
export type AdminUpsertTeacherInput = z.infer<typeof AdminUpsertTeacherSchema>;

export const AdminUpsertMonitorSchema = z.object({
  accountId: ShortId,
  displayName: z.string().trim().min(1, '班长显示名称不能为空').max(64),
  phone: z.string().trim().max(32).optional(),
});
export type AdminUpsertMonitorInput = z.infer<typeof AdminUpsertMonitorSchema>;

// 家长端教师公开卡片 DTO (物理脱敏)
export interface TeacherCardDto {
  id: string; // 12-char
  displayName: string;
  levelName: string;
  monitorDisplayName: string;
  skillCourseTypes: Array<{ id: string; name: string }>;
  introZh: string;
  introEn: string;
  photoUrl: string | null;     // CDN 完整加速地址
  videoUrl: string | null;     // CDN 完整加速地址
  classinQrUrl: string | null; // CDN 完整加速地址
}

// 班长/管理端教师详情 DTO
export interface TeacherDetailDto {
  id: string;
  accountId: string | null;
  displayName: string;
  levelId: string;
  levelName?: string;
  monitorProfileId: string;
  monitorDisplayName?: string;
  skillCourseTypeIds: string[];
  skillCourseTypes?: Array<{ id: string; name: string }>;
  introZh: string;
  introEn: string;
  photoKey: string | null;
  photoUrl: string | null;
  videoKey: string | null;
  videoUrl: string | null;
  classinQrKey: string | null;
  classinQrUrl: string | null;
  resignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorProfileDto {
  id: string;
  accountId: string;
  displayName: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}
