/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

const TARGET_SIZE_PX = 512;
const MAX_WEBP_BYTES = 2 * 1024 * 1024;

/**
 * 浏览器端将任意 JPG/PNG/WebP 图片居中 1:1 裁切并压缩输出为 <= 2MB 的 image/webp Blob
 */
export async function cropImageToSquareWebp(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      el.src = objectUrl;
    });

    const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const sx = Math.max(0, Math.floor(((img.naturalWidth || img.width) - side) / 2));
    const sy = Math.max(0, Math.floor(((img.naturalHeight || img.height) - side) / 2));

    const canvas = document.createElement('canvas');
    canvas.width = TARGET_SIZE_PX;
    canvas.height = TARGET_SIZE_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('CANVAS_UNAVAILABLE');
    }
    ctx.drawImage(img, sx, sy, side, side, 0, 0, TARGET_SIZE_PX, TARGET_SIZE_PX);

    for (const quality of [0.88, 0.72, 0.56]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((res) => resolve(res), 'image/webp', quality)
      );
      if (blob && blob.size <= MAX_WEBP_BYTES) {
        return blob;
      }
    }

    throw new Error('AVATAR_SIZE_EXCEEDED');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
