/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { FileUploadService } from '../src/modules/file/FileUploadService.js';

describe('FileUploadService', () => {
  let service: FileUploadService;

  beforeEach(() => {
    service = new FileUploadService(undefined, {
      bucket: 'test-bucket',
      cdnDomain: 'https://cdn.topee.top',
      endpoint: 'https://test-endpoint.r2.cloudflarestorage.com',
      expiresInSeconds: 300,
    });
  });

  describe('generateKey', () => {
    it('should generate correct relative key structure for teacher_photo', () => {
      const date = new Date(2026, 10, 4); // 2026-11-04
      const key = service.generateKey('teacher_photo', 'webp', date);
      expect(key).toMatch(/^dream\/teachers\/photos\/2026\/11\/04\/[A-Za-z0-9_-]{12}\.webp$/);
    });

    it('should generate correct key for teacher_video', () => {
      const date = new Date(2026, 10, 4);
      const key = service.generateKey('teacher_video', 'mp4', date);
      expect(key).toMatch(/^dream\/teachers\/videos\/2026\/11\/04\/[A-Za-z0-9_-]{12}\.mp4$/);
    });

    it('should generate correct key for teacher_classin_qr', () => {
      const date = new Date(2026, 10, 4);
      const key = service.generateKey('teacher_classin_qr', 'webp', date);
      expect(key).toMatch(/^dream\/teachers\/classin_qr\/2026\/11\/04\/[A-Za-z0-9_-]{12}\.webp$/);
    });

    it('should generate correct key for student_avatar', () => {
      const date = new Date(2026, 10, 4);
      const key = service.generateKey('student_avatar', 'png', date);
      expect(key).toMatch(/^dream\/students\/avatars\/2026\/11\/04\/[A-Za-z0-9_-]{12}\.png$/);
    });

    it('should generate correct key for transfer_proof', () => {
      const date = new Date(2026, 10, 4);
      const key = service.generateKey('transfer_proof', 'jpg', date);
      expect(key).toMatch(/^dream\/transfers\/proofs\/2026\/11\/04\/[A-Za-z0-9_-]{12}\.jpg$/);
    });
  });

  describe('getExtensionFromContentType', () => {
    it('should map standard content types to extensions', () => {
      expect(service.getExtensionFromContentType('image/webp')).toBe('webp');
      expect(service.getExtensionFromContentType('image/jpeg')).toBe('jpg');
      expect(service.getExtensionFromContentType('image/png')).toBe('png');
      expect(service.getExtensionFromContentType('video/mp4')).toBe('mp4');
      expect(service.getExtensionFromContentType('application/octet-stream')).toBe('bin');
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should return simulated presigned URL for valid video upload', async () => {
      const res = await service.getPresignedUploadUrl({
        bizType: 'teacher_video',
        contentType: 'video/mp4',
        contentLength: 20 * 1024 * 1024, // 20MB <= 50MB
      });

      expect(res.expiresIn).toBe(300);
      expect(res.key).toMatch(/^dream\/teachers\/videos\/\d{4}\/\d{2}\/\d{2}\/[A-Za-z0-9_-]{12}\.mp4$/);
      expect(res.uploadUrl).toContain('https://test-endpoint.r2.cloudflarestorage.com');
      expect(res.uploadUrl).toContain(res.key);
    });

    it('should reject video exceeding 50MB limit', async () => {
      await expect(
        service.getPresignedUploadUrl({
          bizType: 'teacher_video',
          contentType: 'video/mp4',
          contentLength: 51 * 1024 * 1024,
        })
      ).rejects.toThrow('文件类型或体积超出业务限制');
    });

    it('should reject teacher photo exceeding 1MB limit', async () => {
      await expect(
        service.getPresignedUploadUrl({
          bizType: 'teacher_photo',
          contentType: 'image/webp',
          contentLength: 1.5 * 1024 * 1024,
        })
      ).rejects.toThrow('文件类型或体积超出业务限制');
    });

    it('should reject non-mp4 video contentType', async () => {
      await expect(
        service.getPresignedUploadUrl({
          bizType: 'teacher_video',
          // @ts-expect-error test invalid type
          contentType: 'video/webm',
          contentLength: 10 * 1024 * 1024,
        })
      ).rejects.toThrow();
    });
  });

  describe('getPublicUrl', () => {
    it('should return null for empty or null key', () => {
      expect(service.getPublicUrl(null)).toBeNull();
      expect(service.getPublicUrl(undefined)).toBeNull();
      expect(service.getPublicUrl('')).toBeNull();
    });

    it('should preserve already absolute URLs', () => {
      expect(service.getPublicUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
      expect(service.getPublicUrl('http://example.com/photo.jpg')).toBe('http://example.com/photo.jpg');
    });

    it('should prepend CDN domain correctly without duplicate slashes', () => {
      expect(service.getPublicUrl('dream/teachers/photos/2026/11/04/abc.webp')).toBe(
        'https://cdn.topee.top/dream/teachers/photos/2026/11/04/abc.webp'
      );
      expect(service.getPublicUrl('/dream/teachers/photos/2026/11/04/abc.webp')).toBe(
        'https://cdn.topee.top/dream/teachers/photos/2026/11/04/abc.webp'
      );
    });
  });
});
