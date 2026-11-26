/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

process.env.NODE_ENV = 'test';

import { generateKeyPairSync } from 'node:crypto';
import { EnvSecureConf } from '@topeetop/env-secure-conf';
import {
  getConfig,
  loadConfig,
  loadConfigAsync,
  maskDbUrl,
  normalizePemKey,
  resetConfigCache,
} from '../src/config/env.config.js';

describe('env.config hardening (reference parity with topee-read user-backend)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test', CONFIG_PATH: '/dev/null' };
    delete process.env.DB_URL_CIPHER;
    delete process.env.TASK_RELAY_TOKEN_CIPHER;
    delete process.env.S3_ACCESS_KEY_ID_CIPHER;
    delete process.env.S3_SECRET_ACCESS_KEY_CIPHER;
    delete process.env.EMAIL_API_KEY_CIPHER;
    delete process.env.SMS_ACCESS_KEY_SECRET_CIPHER;
    delete process.env.JWT_CURRENT_PRIVATE_KEY_CIPHER;
    delete process.env.PREVIEW_MODE;
    resetConfigCache();
  });

  afterAll(() => {
    process.env = originalEnv;
    resetConfigCache();
  });

  it('normalizePemKey handles single-line escaped newlines, headerless base64, and PKCS#1 -> SPKI', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const singleLinePub = publicKey.replace(/\n/g, '\\n');
    expect(normalizePemKey(singleLinePub, 'public')).toContain('-----BEGIN PUBLIC KEY-----');

    const headerlessPriv = privateKey
      .replace(/-----BEGIN[^-]+-----/g, '')
      .replace(/-----END[^-]+-----/g, '')
      .replace(/\n/g, '');
    expect(normalizePemKey(headerlessPriv, 'private')).toContain('-----BEGIN PRIVATE KEY-----');
  });

  it('maskDbUrl hides credentials cleanly', () => {
    expect(maskDbUrl('postgresql://dream_user:super_secret_pw@db.internal:5432/dream_prod')).toBe(
      'postgresql://***:***@db.internal:5432/dream_prod'
    );
  });

  it('loadConfigAsync decrypts cipher secrets, normalizes R2 aliases, and strips email quotes', async () => {
    const masterKey = 'unit-test-master-key-32-chars!!';
    process.env.SECRET_MASTER_KEY = masterKey;
    process.env.DB_URL_CIPHER = EnvSecureConf.encrypt(
      'postgresql://u:p@localhost:5432/dream_unit',
      masterKey
    );
    process.env.TASK_RELAY_TOKEN_CIPHER = EnvSecureConf.encrypt('psk-decrypted-123', masterKey);
    process.env.R2_BUCKET = 'r2-dream-bucket';
    process.env.R2_FORCE_PATH_STYLE = 'true';
    process.env.EMAIL_SENDER_EMAIL = '"noreply@topee.top"';
    delete process.env.S3_BUCKET;
    delete process.env.DB_URL;
    delete process.env.TASK_RELAY_TOKEN;

    const cfg = await loadConfigAsync();
    expect(cfg.DB_URL).toBe('postgresql://u:p@localhost:5432/dream_unit');
    expect(cfg.TASK_RELAY_TOKEN).toBe('psk-decrypted-123');
    expect(cfg.S3_BUCKET).toBe('r2-dream-bucket');
    expect(cfg.S3_FORCE_PATH_STYLE).toBe(true);
    expect(cfg.EMAIL_SENDER_EMAIL).toBe('noreply@topee.top');
    expect(getConfig()).toBe(cfg);
  });

  it('rejects plaintext critical secrets in strict production mode', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_URL = 'postgresql://u:p@prod-db:5432/dream';
    delete process.env.DB_URL_CIPHER;

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => {
        throw new Error('PROCESS_EXIT_1');
      }) as never);

    expect(() => loadConfig()).toThrow('PROCESS_EXIT_1');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Plaintext DB_URL is prohibited in production')
    );

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
