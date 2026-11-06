/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { resolveApiErrorMessage } from '../utils/apiError';
import type { PresignedUploadResult } from '../types';

export interface GetUploadUrlInput {
  bizType:
    | 'student_avatar'
    | 'teacher_photo'
    | 'teacher_video'
    | 'teacher_classin_qr'
    | 'transfer_proof';
  contentType: 'image/webp' | 'image/jpeg' | 'image/png' | 'video/mp4';
  contentLength: number;
}

const API_PREFIX = '/api/dream/v1';

/**
 * 1. 获取对象存储预签名上传凭证
 */
export async function getPresignedUploadUrl(
  input: GetUploadUrlInput
): Promise<PresignedUploadResult> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_PREFIX}/files/upload-url`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    throw new Error(resolveApiErrorMessage(json, res.status));
  }

  return json.data as PresignedUploadResult;
}

/**
 * 2. 客户端直接 PUT 上传文件至对象存储 (S3/R2)
 */
export async function uploadFileToPresignedUrl(
  uploadUrl: string,
  fileOrBlob: Blob | File,
  contentType: string,
  onProgress?: (progressPercent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', contentType);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Storage PUT failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during storage upload'));
    };

    xhr.send(fileOrBlob);
  });
}
