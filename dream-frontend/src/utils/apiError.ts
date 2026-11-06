/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { i18n } from '../i18n';

/**
 * 解析 API 响应错误并依托 vue-i18n 自动翻译为当前语言
 * 对齐 @topeetop/auth-core 标准错误码规范
 */
export function resolveApiErrorMessage(
  data: any,
  fallbackStatus?: number,
  defaultMessage = 'Request failed'
): string {
  const code = data?.code || data?.errorCode;
  if (code) {
    const key = `errors.${code}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((i18n.global as any).te(key)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (i18n.global as any).t(key);
    }
  }

  return (
    data?.error ||
    data?.message ||
    (fallbackStatus ? `Request failed with ${fallbackStatus}` : defaultMessage)
  );
}
