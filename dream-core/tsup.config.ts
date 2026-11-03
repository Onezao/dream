/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    '@topeetop/shared-core',
    '@topeetop/security-core',
    '@topeetop/auth-core',
    '@topeetop/notification-client',
    '@topeetop/env-secure-conf',
    'pg',
    'zod'
  ]
});
