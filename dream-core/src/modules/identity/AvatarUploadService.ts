/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ApiError, generateShortUuid } from '@topeetop/shared-core';
import { AvatarUploadUrlDto, RequestAvatarUploadUrlSchema } from './identity.types.js';

export interface AvatarStorageConfig {
  bucket: string;
  region: string;
  endpoint: string;
  publicDomain: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface AvatarUploadServiceDeps {
  storageConfig: AvatarStorageConfig;
  presignPutUrl?: (key: string, contentType: string, expiresInSeconds: number) => Promise<string>;
  now?: () => Date;
}

const AVATAR_UPLOAD_TTL_SECONDS = 300;

export class AvatarUploadService {
  private readonly storageConfig: AvatarStorageConfig;
  private readonly presignPutUrl?: (
    key: string,
    contentType: string,
    expiresInSeconds: number
  ) => Promise<string>;
  private readonly now: () => Date;
  private s3Client: S3Client | null = null;

  constructor(deps: AvatarUploadServiceDeps) {
    this.storageConfig = deps.storageConfig;
    this.presignPutUrl = deps.presignPutUrl;
    this.now = deps.now ?? (() => new Date());
  }

  private getS3Client(): S3Client {
    if (this.s3Client) {
      return this.s3Client;
    }

    const { accessKeyId, secretAccessKey, region, endpoint } = this.storageConfig;
    if (!accessKeyId || !secretAccessKey) {
      throw new ApiError(
        'Object storage credentials are not configured',
        503,
        'STORAGE_NOT_CONFIGURED'
      );
    }

    this.s3Client = new S3Client({
      region: region || 'auto',
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    return this.s3Client;
  }

  private buildAvatarKey(): string {
    const dt = this.now();
    const yyyy = String(dt.getUTCFullYear());
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `dream/accounts/avatars/${yyyy}/${mm}/${dd}/${generateShortUuid()}.webp`;
  }

  /**
   * Generates a 300s S3 presigned PUT URL locked to `image/webp` for cropped browser avatar uploads.
   */
  async createAvatarUploadUrl(_accountId: string, rawInput: unknown): Promise<AvatarUploadUrlDto> {
    const parsed = RequestAvatarUploadUrlSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ApiError('Validation failed', 400, 'VALIDATION_FAILED', parsed.error.flatten());
    }

    const key = this.buildAvatarKey();
    const contentType = parsed.data.contentType;

    let uploadUrl: string;
    if (this.presignPutUrl) {
      uploadUrl = await this.presignPutUrl(key, contentType, AVATAR_UPLOAD_TTL_SECONDS);
    } else {
      const client = this.getS3Client();
      const command = new PutObjectCommand({
        Bucket: this.storageConfig.bucket,
        Key: key,
        ContentType: contentType,
      });
      uploadUrl = await getSignedUrl(client, command, {
        expiresIn: AVATAR_UPLOAD_TTL_SECONDS,
      });
    }

    const domainBase = this.storageConfig.publicDomain.replace(/\/+$/, '');
    return {
      uploadUrl,
      key,
      publicUrl: `${domainBase}/${key}`,
      expiresInSeconds: AVATAR_UPLOAD_TTL_SECONDS,
    };
  }
}
