/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/app.ts'],
  format: ['cjs'],
  target: 'node20',
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: true,
  bundle: true,
  external: [
    'pg',
    '@fastify/cors',
    'fastify',
    'fastify-type-provider-zod',
    '@topeetop/dream-core',
    '@topeetop/shared-core',
    '@topeetop/security-core',
    '@topeetop/auth-core',
    '@topeetop/notification-client',
    '@topeetop/env-secure-conf'
  ]
});
