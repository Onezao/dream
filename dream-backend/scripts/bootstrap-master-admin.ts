/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { DatabaseService } from '@topeetop/shared-core';
import { AdminAccountMapper, AuditLogMapper } from '@topeetop/dream-core';
import { loadConfig } from '../src/config/env.config.js';
import { AuthAccountAdapter } from '../src/adapters/authAccount.adapter.js';

function parseCliArgs(argv: string[]): { email?: string; name?: string } {
  const result: { email?: string; name?: string } = {};
  for (const arg of argv) {
    if (arg.startsWith('--email=')) {
      result.email = arg.slice('--email='.length).trim();
    } else if (arg.startsWith('--name=')) {
      result.name = arg.slice('--name='.length).trim();
    }
  }
  return result;
}

/**
 * Controlled CLI script to bootstrap the sole platform Permanent Primary Master Admin.
 * Usage: npx tsx scripts/bootstrap-master-admin.ts --email=owner@topee.top --name="Platform Owner"
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { email, name } = parseCliArgs(argv);
  if (!email || !name) {
    throw new Error('Usage: bootstrap-master-admin --email=<email> --name=<displayName>');
  }

  const config = loadConfig();
  const db = new DatabaseService({
    connectionString: config.DB_URL,
    max: config.DB_POOL_MAX,
    ssl: config.DB_USE_SSL,
  });

  try {
    const adminMapper = new AdminAccountMapper(db);
    const auditMapper = new AuditLogMapper(db);
    const authPort = new AuthAccountAdapter(db);

    const targetAccount = await authPort.findByEmail(email);
    if (!targetAccount) {
      throw new Error(`No registered account found for email: ${email}`);
    }
    if (targetAccount.accountStatus !== 'ACTIVE') {
      throw new Error(`Target account is not ACTIVE (status=${targetAccount.accountStatus})`);
    }

    await db.executeTx(async (client) => {
      await adminMapper.lockGovernanceScope(client);

      const existingPrimary = await adminMapper.findPermanentPrimary(client);
      if (existingPrimary) {
        throw new Error(
          `Permanent primary master admin already exists (id=${existingPrimary.id}). Use recover-master-admin.ts for emergency handover.`
        );
      }

      const existingTarget = await adminMapper.findByAccountId(targetAccount.id, client);
      const promoted = existingTarget
        ? await adminMapper.promotePermanentPrimary(existingTarget.id, name, targetAccount.id, client)
        : await adminMapper.create(
            {
              accountId: targetAccount.id,
              displayName: name,
              isPermanentPrimary: true,
              note: 'Bootstrapped via CLI',
              grantedBy: targetAccount.id,
            },
            client
          );

      if (!promoted) {
        throw new Error('Failed to bootstrap permanent primary master admin');
      }

      await auditMapper.append(
        {
          actorAccountId: targetAccount.id,
          module: 'M0A',
          action: 'MASTER_ADMIN_BOOTSTRAPPED',
          targetType: 'admin_account',
          targetId: promoted.id,
          beforeState: null,
          afterState: { accountId: promoted.accountId, displayName: promoted.displayName },
          traceId: 'CLI_BOOTSTRAP',
        },
        client
      );

      console.log(`Bootstrapped permanent primary master admin: ${promoted.id} (${promoted.displayName})`);
    });
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[bootstrap-master-admin] Error:', (err as Error).message);
    process.exit(1);
  });
}
