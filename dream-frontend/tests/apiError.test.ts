/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { resolveApiErrorMessage } from '../src/utils/apiError';
import { setLocale } from '../src/i18n';

describe('resolveApiErrorMessage Unit Tests', () => {
  beforeEach(() => {
    setLocale('zh-CN');
  });

  it('should translate known errorCode in Chinese locale', () => {
    setLocale('zh-CN');
    const msg = resolveApiErrorMessage({
      code: 'CLASS_FULL',
      error: 'Class is already full',
    });
    expect(msg).toBe('班级名额已满，无法加塞');
  });

  it('should translate known errorCode in English locale', () => {
    setLocale('en-US');
    const msg = resolveApiErrorMessage({
      code: 'CLASS_FULL',
      error: 'Class is already full',
    });
    expect(msg).toBe('Class is already full');
  });

  it('should fallback to error message if code is unknown', () => {
    const msg = resolveApiErrorMessage({
      code: 'UNKNOWN_NEW_ERROR',
      error: 'Some specific server error',
    });
    expect(msg).toBe('Some specific server error');
  });

  it('should fallback to status code if no error string is present', () => {
    const msg = resolveApiErrorMessage({}, 502);
    expect(msg).toBe('Request failed with 502');
  });
});
