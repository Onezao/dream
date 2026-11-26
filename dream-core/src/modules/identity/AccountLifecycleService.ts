/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import {
  ApiError,
  DatabaseService,
  executeTx as defaultExecuteTx,
} from '@topeetop/shared-core';
import { AdminAccountMapper } from '../../db/AdminAccountMapper.js';
import { AuditLogMapper } from '../../db/AuditLogMapper.js';
import { MonitorProfileMapper } from '../../db/MonitorProfileMapper.js';
import { StudentProfileMapper } from '../../db/StudentProfileMapper.js';
import { TeacherProfileMapper } from '../../db/TeacherProfileMapper.js';
import { IdentityContextService } from './IdentityContextService.js';
import { AuthAccountPort, DeactivateAccountSchema } from './identity.types.js';

export interface AccountLifecycleServiceDeps {
  db?: DatabaseService;
  adminAccountMapper?: AdminAccountMapper;
  monitorProfileMapper?: MonitorProfileMapper;
  teacherProfileMapper?: TeacherProfileMapper;
  studentProfileMapper?: StudentProfileMapper;
  auditLogMapper?: AuditLogMapper;
  identityContextService: IdentityContextService;
  authAccountPort: AuthAccountPort;
}

export class AccountLifecycleService {
  private readonly db?: DatabaseService;
  private readonly adminAccountMapper: AdminAccountMapper;
  private readonly monitorProfileMapper: MonitorProfileMapper;
  private readonly teacherProfileMapper: TeacherProfileMapper;
  private readonly studentProfileMapper: StudentProfileMapper;
  private readonly auditLogMapper: AuditLogMapper;
  private readonly identityContextService: IdentityContextService;
  private readonly authAccountPort: AuthAccountPort;

  constructor(deps: AccountLifecycleServiceDeps) {
    this.db = deps.db;
    this.adminAccountMapper = deps.adminAccountMapper ?? new AdminAccountMapper(deps.db);
    this.monitorProfileMapper = deps.monitorProfileMapper ?? new MonitorProfileMapper(deps.db);
    this.teacherProfileMapper = deps.teacherProfileMapper ?? new TeacherProfileMapper(deps.db);
    this.studentProfileMapper = deps.studentProfileMapper ?? new StudentProfileMapper(deps.db);
    this.auditLogMapper = deps.auditLogMapper ?? new AuditLogMapper(deps.db);
    this.identityContextService = deps.identityContextService;
    this.authAccountPort = deps.authAccountPort;
  }

  private async runTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    if (this.db) {
      return this.db.executeTx(fn);
    }
    return defaultExecuteTx(fn);
  }

  /**
   * Executes cross-module clearance checks (M0A/M1A/M1B) atomically inside one transaction,
   * deactivates the underlying auth account while retaining all historical Dream records,
   * revokes all refresh tokens, and appends a silent compliance audit log entry.
   */
  async deactivateSelf(
    accountId: string,
    currentEmail: string,
    rawInput: unknown,
    traceId?: string
  ): Promise<{ deactivated: true }> {
    const parsed = DeactivateAccountSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ApiError('Validation failed', 400, 'VALIDATION_FAILED', parsed.error.flatten());
    }

    if (parsed.data.confirmEmail !== currentEmail.trim().toLowerCase()) {
      throw new ApiError(
        'Confirmation email does not match current account email',
        400,
        'CONFIRMATION_MISMATCH'
      );
    }

    await this.runTx(async (client) => {
      await this.studentProfileMapper.lockAccountScope(accountId, client);

      const activeAdmin = await this.adminAccountMapper.findActiveByAccountId(accountId, client);
      if (activeAdmin?.isPermanentPrimary) {
        throw new ApiError(
          'Forbidden: Permanent primary master admin cannot self-deactivate',
          403,
          'PERMANENT_MASTER_ADMIN_PROTECTED'
        );
      }
      if (activeAdmin) {
        throw new ApiError(
          'Cannot deactivate account while holding an active admin role',
          409,
          'DEACTIVATE_BLOCKED_ACTIVE_ADMIN'
        );
      }

      const activeStudentCount = await this.studentProfileMapper.countOfficialActiveByAccountId(
        accountId,
        client
      );
      if (activeStudentCount > 0) {
        throw new ApiError(
          'Cannot deactivate account with active student profiles',
          409,
          'DEACTIVATE_BLOCKED_ACTIVE_STUDENTS'
        );
      }

      const hasBlockingMonitor = await this.monitorProfileMapper.hasBlockingByAccountId(
        accountId,
        client
      );
      if (hasBlockingMonitor) {
        throw new ApiError(
          'Cannot deactivate account with an active or handover-frozen monitor profile',
          409,
          'DEACTIVATE_BLOCKED_ACTIVE_MONITOR'
        );
      }

      const hasBlockingTeacher = await this.teacherProfileMapper.hasBlockingByAccountId(
        accountId,
        client
      );
      if (hasBlockingTeacher) {
        throw new ApiError(
          'Cannot deactivate account with an active, on-leave, or resigning teacher profile',
          409,
          'DEACTIVATE_BLOCKED_ACTIVE_TEACHER'
        );
      }

      await this.authAccountPort.deactivateAccountAndRevokeSessions(accountId, client);

      await this.auditLogMapper.append(
        {
          actorAccountId: accountId,
          module: 'M0A',
          action: 'ACCOUNT_DEACTIVATED',
          targetType: 'auth_account',
          targetId: accountId,
          beforeState: { status: 'ACTIVE' },
          afterState: { status: 'DEACTIVATED' },
          traceId: traceId ?? null,
        },
        client
      );
    });

    this.identityContextService.invalidateRoleDirectoryCache();
    return { deactivated: true };
  }
}
