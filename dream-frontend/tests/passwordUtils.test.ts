/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import {
  isSafeInternalRedirect,
  isValidEmail,
  maskEmail,
  validatePasswordStrength,
} from '../src/utils/password';
import { clearL3Snapshots } from '../src/utils/l3Cache';

describe('Auth UI Helpers & Cache Isolation', () => {
  it('validatePasswordStrength enforces min 8 chars + upper + lower + digit + special', () => {
    expect(validatePasswordStrength('Ab1!').valid).toBe(false);
    expect(validatePasswordStrength('abcdefgh1!').valid).toBe(false);
    expect(validatePasswordStrength('ABCDEFGH1!').valid).toBe(false);
    expect(validatePasswordStrength('Abcdefgh!').valid).toBe(false);
    expect(validatePasswordStrength('Abcdefgh1').valid).toBe(false);
    expect(validatePasswordStrength('Abcdef1!').valid).toBe(true);
  });

  it('isValidEmail validates email format', () => {
    expect(isValidEmail('parent@topee.top')).toBe(true);
    expect(isValidEmail(' 13800138000 ')).toBe(false);
    expect(isValidEmail('invalid@')).toBe(false);
  });

  it('isSafeInternalRedirect blocks open redirects', () => {
    expect(isSafeInternalRedirect('/profile?tab=security')).toBe(true);
    expect(isSafeInternalRedirect('//evil.com')).toBe(false);
    expect(isSafeInternalRedirect('https://evil.com')).toBe(false);
    expect(isSafeInternalRedirect('')).toBe(false);
  });

  it('maskEmail masks local part safely', () => {
    expect(maskEmail('alice@topee.top')).toBe('al***@topee.top');
    expect(maskEmail('a@topee.top')).toBe('a***@topee.top');
  });

  it('clearL3Snapshots removes dream_l3_* keys while preserving auth tokens & locale', async () => {
    const store: Record<string, string> = {
      access_token: 'keep-access',
      refresh_token: 'keep-refresh',
      user_info: '{"id":"u1"}',
      dream_context: '{"primaryRole":"parent"}',
      dream_locale: 'en-US',
      dream_l3_teachers: '{"data":[]}',
      dream_l3_classes: '{"data":[]}',
    };

    Object.defineProperty(global, 'localStorage', {
      value: {
        get length() {
          return Object.keys(store).length;
        },
        key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
        getItem: jest.fn((key: string) => store[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete store[key];
        }),
      },
      writable: true,
    });

    await clearL3Snapshots();

    expect(store['access_token']).toBe('keep-access');
    expect(store['refresh_token']).toBe('keep-refresh');
    expect(store['user_info']).toBe('{"id":"u1"}');
    expect(store['dream_context']).toBe('{"primaryRole":"parent"}');
    expect(store['dream_locale']).toBe('en-US');
    expect(store['dream_l3_teachers']).toBeUndefined();
    expect(store['dream_l3_classes']).toBeUndefined();
  });
});
