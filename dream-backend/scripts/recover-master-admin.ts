/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { DatabaseService } from '@topeetop/shared-core';
import { AdminAccountMapper, AuditLogMapper } from '@topeetop/dream-core';
import { loadConfig } from '../src/config/env.config.js';
import { AuthAccountAdapter } from '../src/adapters/authAccount.adapter.js';

function parseCliArgs(argv: string[]): { email?: string; name?: string; approver?: string } {
  const result: { email?: string; name?: string; approver?: string } = {};
  for (const arg of argv) {
    if (arg.startsWith('--email=')) {
      result.email = arg.slice('--email='.length).trim();
    } else if (arg.startsWith('--name=')) {
      result.name = arg.slice('--name='.length).trim();
    } else if (arg.startsWith('--approver=')) {
      result.approver = arg.slice('--approver='.length).trim();
    }
  }
  return result;
}

/**
 * Controlled dual-approved emergency CLI script to transfer Permanent Primary Master Admin
 * in case of irreversible account loss or ban of the sole permanent master admin.
 * Usage: npx tsx scripts/recover-master-admin.ts --email=new@topee.top --name="New Owner" --approver=ops-ticket-123
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { email, name, approver } = parseCliArgs(argv);
  if (!email || !name || !approver) {
    throw new Error(
      'Usage: recover-master-admin --email=<email> --name=<displayName> --approver=<ticketOrOperator>'
    );
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

    const nextAccount = await authPort.findByEmail(email);
    if (!nextAccount) {
      throw new Error(`No registered account found for email: ${email}`);
    }
    if (nextAccount.accountStatus !== 'ACTIVE') {
      throw new Error(`Target account is not ACTIVE (status=${nextAccount.accountStatus})`);
    }

    await db.executeTx(async (client) => {
      await adminMapper.lockGovernanceScope(client);

      const currentPrimary = await adminMapper.findPermanentPrimary(client);
      if (currentPrimary) {
        if (currentPrimary.accountId === nextAccount.id) {
          throw new Error('Target account is already the active permanent primary master admin');
        }
        await adminMapper.revokePermanentPrimaryForRecovery(currentPrimary.id, 'CLI_RECOVERY', client);
      }

      const existingTarget = await adminMapper.findByAccountId(nextAccount.id, client);
      const promoted = existingTarget
        ? await adminMapper.promotePermanentPrimary(
            existingTarget.id,
            name,
            nextAccount.id,
            client
          )
        : await adminMapper.create(
            {
              accountId: nextAccount.id,
              displayName: name,
              isPermanentPrimary: true,
              note: `Recovered via CLI (${approver})`,
              grantedBy: nextAccount.id,
            },
            client
          );

      if (!promoted) {
        throw new Error('Failed to promote target account during emergency recovery');
      }

      await auditMapper.append(
        {
          actorAccountId: nextAccount.id,
          module: 'M0A',
          action: 'MASTER_ADMIN_RECOVERY',
          targetType: 'admin_account',
          targetId: promoted.id,
          beforeState: currentPrimary
            ? { previousPrimaryAdminId: currentPrimary.id, previousAccountId: currentPrimary.accountId }
            : null,
          afterState: {
            newPrimaryAdminId: promoted.id,
            newAccountId: promoted.accountId,
            approver,
          },
          traceId: `CLI_RECOVERY:${approver}`,
        },
        client
      );

      console.log(
        `Emergency master admin recovery complete: ${promoted.id} (${promoted.displayName}), trace=${approver}`
      );
    });
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[recover-master-admin] Error:', (err as Error).message);
    process.exit(1);
  });
}
