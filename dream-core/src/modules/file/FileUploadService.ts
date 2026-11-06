/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ApiError, generateShortUuid } from '@topeetop/shared-core';
import {
  UploadUrlInput,
  UploadUrlSchema,
  PresignedUploadResponse,
} from '../profile/teacher.types.js';

export interface FileUploadConfig {
  bucket: string;
  cdnDomain: string;
  endpoint?: string;
  expiresInSeconds?: number;
}

export class FileUploadService {
  private readonly s3Client?: S3Client;
  private readonly config: FileUploadConfig;

  constructor(s3Client?: S3Client, config?: Partial<FileUploadConfig>) {
    this.s3Client = s3Client;
    this.config = {
      bucket: config?.bucket || process.env.S3_BUCKET || 'dream-storage',
      cdnDomain: (
        config?.cdnDomain ||
        process.env.S3_PUBLIC_DOMAIN ||
        'https://static.topee.top'
      ).replace(/\/+$/, ''),
      endpoint: config?.endpoint || process.env.S3_ENDPOINT,
      expiresInSeconds: config?.expiresInSeconds ?? 300,
    };
  }

  /**
   * 生成规范对象存储相对 Key
   * 格式: dream/{biz_type}/{yyyy}/{mm}/{dd}/{uuid12}.{ext}
   */
  generateKey(bizType: UploadUrlInput['bizType'], extension: string, date: Date = new Date()): string {
    const yyyy = date.getFullYear().toString();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const uuid12 = generateShortUuid();

    const normalizedExt = extension.replace(/^\./, '').toLowerCase();

    let subPath: string;
    switch (bizType) {
      case 'student_avatar':
        subPath = 'students/avatars';
        break;
      case 'teacher_photo':
        subPath = 'teachers/photos';
        break;
      case 'teacher_video':
        subPath = 'teachers/videos';
        break;
      case 'teacher_classin_qr':
        subPath = 'teachers/classin_qr';
        break;
      case 'transfer_proof':
        subPath = 'transfers/proofs';
        break;
      default:
        subPath = 'misc';
    }

    return `dream/${subPath}/${yyyy}/${mm}/${dd}/${uuid12}.${normalizedExt}`;
  }

  /**
   * 根据 ContentType 推断扩展名
   */
  getExtensionFromContentType(contentType: string): string {
    switch (contentType.toLowerCase()) {
      case 'image/webp':
        return 'webp';
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'video/mp4':
        return 'mp4';
      default:
        return 'bin';
    }
  }

  /**
   * 生成预签名上传凭证
   */
  async getPresignedUploadUrl(input: UploadUrlInput): Promise<PresignedUploadResponse> {
    const parseResult = UploadUrlSchema.safeParse(input);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map((e) => e.message).join('; ');
      throw new ApiError(errorMsg || 'File upload validation failed', 400, 'VALIDATION_ERROR');
    }

    const { bizType, contentType } = parseResult.data;
    const extension = this.getExtensionFromContentType(contentType);
    const key = this.generateKey(bizType, extension);
    const expiresIn = this.config.expiresInSeconds ?? 300;

    let uploadUrl: string;

    if (this.s3Client) {
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: contentType,
      });
      uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
    } else {
      // 本地无真实 S3 凭据时的模拟实现
      const host = this.config.endpoint || `https://${this.config.bucket}.s3.amazonaws.com`;
      uploadUrl = `${host.replace(/\/+$/, '')}/${key}?X-Amz-Expires=${expiresIn}&mock=true`;
    }

    return {
      uploadUrl,
      key,
      expiresIn,
    };
  }

  /**
   * 拼接绝对 CDN 访问地址
   */
  getPublicUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key;
    }
    const cleanKey = key.replace(/^\/+/, '');
    return `${this.config.cdnDomain}/${cleanKey}`;
  }
}
