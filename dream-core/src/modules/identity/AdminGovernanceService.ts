/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import {
  ApiError,
  DatabaseService,
  executeTx as defaultExecuteTx,
} from '@topeetop/shared-core';
import { AdminAccountMapper, AdminAccountRecord } from '../../db/AdminAccountMapper.js';
import { AuditLogMapper } from '../../db/AuditLogMapper.js';
import { IdentityContextService } from './IdentityContextService.js';
import {
  AdminAccountDto,
  AdminListDto,
  AdminLookupDto,
  AuthAccountPort,
  AuthAccountSummary,
  GrantAdminSchema,
  LookupAccountByEmailSchema,
  RevokeAdminSchema,
  RoleInvalidationNotifier,
  UpdateAdminDisplayNameSchema,
  maskEmailAddress,
} from './identity.types.js';

export interface AdminGovernanceServiceDeps {
  db?: DatabaseService;
  adminAccountMapper?: AdminAccountMapper;
  auditLogMapper?: AuditLogMapper;
  identityContextService: IdentityContextService;
  authAccountPort: AuthAccountPort;
  roleInvalidationNotifier?: RoleInvalidationNotifier;
}

export class AdminGovernanceService {
  private readonly db?: DatabaseService;
  private readonly adminAccountMapper: AdminAccountMapper;
  private readonly auditLogMapper: AuditLogMapper;
  private readonly identityContextService: IdentityContextService;
  private readonly authAccountPort: AuthAccountPort;
  private readonly roleInvalidationNotifier?: RoleInvalidationNotifier;

  constructor(deps: AdminGovernanceServiceDeps) {
    this.db = deps.db;
    this.adminAccountMapper = deps.adminAccountMapper ?? new AdminAccountMapper(deps.db);
    this.auditLogMapper = deps.auditLogMapper ?? new AuditLogMapper(deps.db);
    this.identityContextService = deps.identityContextService;
    this.authAccountPort = deps.authAccountPort;
    this.roleInvalidationNotifier = deps.roleInvalidationNotifier;
  }

  private async runTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    if (this.db) {
      return this.db.executeTx(fn);
    }
    return defaultExecuteTx(fn);
  }

  private async resolveCoRoles(
    accountId: string
  ): Promise<Array<'monitor' | 'teacher' | 'parent'>> {
    const snapshot = await this.identityContextService.resolveRolesFromCache(accountId);
    return snapshot.effectiveRoles.filter(
      (role): role is 'monitor' | 'teacher' | 'parent' => role !== 'admin'
    );
  }

  private toAdminDto(
    record: AdminAccountRecord,
    authById: Map<string, AuthAccountSummary>,
    nameByAccountId: Map<string, string>,
    coRoles: Array<'monitor' | 'teacher' | 'parent'>
  ): AdminAccountDto {
    const authSummary = authById.get(record.accountId);
    return {
      id: record.id,
      accountId: record.accountId,
      displayName: record.displayName,
      emailMasked: authSummary ? maskEmailAddress(authSummary.email) : '***',
      isPermanentPrimary: record.isPermanentPrimary,
      status: record.status,
      coRoles,
      grantedByName: record.grantedBy ? nameByAccountId.get(record.grantedBy) ?? null : null,
      grantedAt: record.grantedAt.toISOString(),
      revokedByName: record.revokedBy ? nameByAccountId.get(record.revokedBy) ?? null : null,
      revokedAt: record.revokedAt ? record.revokedAt.toISOString() : null,
    };
  }

  private async buildSingleDto(record: AdminAccountRecord): Promise<AdminAccountDto> {
    const lookupIds = [record.accountId];
    if (record.grantedBy) {
      lookupIds.push(record.grantedBy);
    }
    if (record.revokedBy && record.revokedBy !== record.grantedBy) {
      lookupIds.push(record.revokedBy);
    }

    const [authById, coRoles, allAdmins] = await Promise.all([
      this.authAccountPort.findByIds(lookupIds),
      this.resolveCoRoles(record.accountId),
      this.adminAccountMapper.listAll(),
    ]);

    const nameByAccountId = new Map<string, string>();
    for (const item of allAdmins) {
      if (item.displayName) {
        nameByAccountId.set(item.accountId, item.displayName);
      }
    }

    return this.toAdminDto(record, authById, nameByAccountId, coRoles);
  }

  /**
   * Lists all admin accounts in Mode A baseline order (permanent primary -> active -> revoked).
   * Readable by any active admin; `canManage` is true strictly for the active permanent primary admin.
   */
  async listAdmins(actorAccountId: string): Promise<AdminListDto> {
    const records = await this.adminAccountMapper.listAll();
    const canManage = records.some(
      (item) =>
        item.accountId === actorAccountId &&
        item.status === 'ACTIVE' &&
        item.isPermanentPrimary === true
    );

    if (records.length === 0) {
      return { canManage, items: [] };
    }

    const uniqueAccountIds = Array.from(new Set(records.map((item) => item.accountId)));
    const nameByAccountId = new Map<string, string>();
    for (const item of records) {
      if (item.displayName) {
        nameByAccountId.set(item.accountId, item.displayName);
      }
    }

    const [authById, coRolesList] = await Promise.all([
      this.authAccountPort.findByIds(uniqueAccountIds),
      Promise.all(records.map((item) => this.resolveCoRoles(item.accountId))),
    ]);

    const items = records.map((record, index) =>
      this.toAdminDto(record, authById, nameByAccountId, coRolesList[index] ?? ['parent'])
    );

    return { canManage, items };
  }

  /**
   * Looks up a registered natural-person account by exact email prior to granting admin access.
   */
  async lookupAccountByEmail(rawInput: unknown): Promise<AdminLookupDto> {
    const parsed = LookupAccountByEmailSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ApiError('Validation failed', 400, 'VALIDATION_FAILED', parsed.error.flatten());
    }

    const account = await this.authAccountPort.findByEmail(parsed.data.email);
    if (!account) {
      throw new ApiError(
        'Account not found for the specified email',
        404,
        'ACCOUNT_NOT_FOUND'
      );
    }

    const [existingAdmin, coRoles] = await Promise.all([
      this.adminAccountMapper.findByAccountId(account.id),
      this.resolveCoRoles(account.id),
    ]);

    const currentAdminStatus = existingAdmin ? existingAdmin.status : 'NONE';
    const isEligibleToGrant =
      account.accountStatus === 'ACTIVE' && currentAdminStatus !== 'ACTIVE';

    return {
      accountId: account.id,
      emailMasked: maskEmailAddress(account.email),
      accountStatus: account.accountStatus,
      isEligibleToGrant,
      currentAdminStatus,
      currentAdminId: existingAdmin?.id ?? null,
      currentDisplayName: existingAdmin?.displayName ?? null,
      coRoles,
    };
  }

  /**
   * Grants ordinary admin privileges to an existing active natural-person account
   * (or reactivates a previously REVOKED admin record for that account).
   */
  async grantAdmin(
    actorAccountId: string,
    rawInput: unknown,
    traceId?: string
  ): Promise<AdminAccountDto> {
    const parsed = GrantAdminSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ApiError('Validation failed', 400, 'VALIDATION_FAILED', parsed.error.flatten());
    }

    const { email, displayName, confirmText } = parsed.data;
    const normalizedConfirm = confirmText.trim().toLowerCase();
    if (normalizedConfirm !== email && confirmText.trim() !== displayName) {
      throw new ApiError(
        'Confirmation text does not match target email or display name',
        400,
        'CONFIRMATION_MISMATCH'
      );
    }

    const targetAccount = await this.authAccountPort.findByEmail(email);
    if (!targetAccount) {
      throw new ApiError(
        'Account not found for the specified email',
        404,
        'ACCOUNT_NOT_FOUND'
      );
    }
    if (targetAccount.accountStatus === 'BANNED') {
      throw new ApiError('Target account is banned', 403, 'ACCOUNT_BANNED');
    }
    if (targetAccount.accountStatus !== 'ACTIVE') {
      throw new ApiError('Target account is not active', 403, 'ACCOUNT_NOT_ACTIVE');
    }

    const saved = await this.runTx(async (client) => {
      await this.adminAccountMapper.lockGovernanceScope(client);

      const actor = await this.adminAccountMapper.findActiveByAccountId(actorAccountId, client);
      if (!actor || !actor.isPermanentPrimary || actor.status !== 'ACTIVE') {
        throw new ApiError(
          'Forbidden: Permanent primary master admin required',
          403,
          'PERMANENT_MASTER_ADMIN_REQUIRED'
        );
      }

      const existing = await this.adminAccountMapper.findByAccountId(targetAccount.id, client);
      if (existing) {
        if (existing.status === 'ACTIVE') {
          throw new ApiError(
            'Target account already holds an active admin role',
            409,
            'ADMIN_ALREADY_ACTIVE'
          );
        }

        const reactivated = await this.adminAccountMapper.reactivate(
          existing.id,
          { displayName, grantedBy: actorAccountId },
          client
        );
        if (!reactivated) {
          throw new ApiError(
            'Failed to reactivate admin account',
            409,
            'ADMIN_REACTIVATE_FAILED'
          );
        }

        await this.auditLogMapper.append(
          {
            actorAccountId,
            module: 'M0A',
            action: 'ADMIN_REACTIVATED',
            targetType: 'admin_account',
            targetId: reactivated.id,
            beforeState: { status: existing.status, displayName: existing.displayName },
            afterState: { status: reactivated.status, displayName: reactivated.displayName },
            traceId: traceId ?? null,
          },
          client
        );

        return reactivated;
      }

      const created = await this.adminAccountMapper.create(
        {
          accountId: targetAccount.id,
          displayName,
          isPermanentPrimary: false,
          grantedBy: actorAccountId,
        },
        client
      );

      await this.auditLogMapper.append(
        {
          actorAccountId,
          module: 'M0A',
          action: 'ADMIN_GRANTED',
          targetType: 'admin_account',
          targetId: created.id,
          beforeState: null,
          afterState: {
            accountId: created.accountId,
            status: created.status,
            displayName: created.displayName,
            isPermanentPrimary: false,
          },
          traceId: traceId ?? null,
        },
        client
      );

      return created;
    });

    this.identityContextService.invalidateRoleDirectoryCache();
    return this.buildSingleDto(saved);
  }

  /**
   * Updates displayName of an active admin account (permanently protected or ordinary).
   */
  async updateAdminDisplayName(
    actorAccountId: string,
    targetAdminId: string,
    rawInput: unknown,
    traceId?: string
  ): Promise<AdminAccountDto> {
    const parsed = UpdateAdminDisplayNameSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ApiError('Validation failed', 400, 'VALIDATION_FAILED', parsed.error.flatten());
    }

    const updated = await this.runTx(async (client) => {
      await this.adminAccountMapper.lockGovernanceScope(client);

      const actor = await this.adminAccountMapper.findActiveByAccountId(actorAccountId, client);
      if (!actor || !actor.isPermanentPrimary || actor.status !== 'ACTIVE') {
        throw new ApiError(
          'Forbidden: Permanent primary master admin required',
          403,
          'PERMANENT_MASTER_ADMIN_REQUIRED'
        );
      }

      const target = await this.adminAccountMapper.findById(targetAdminId, client);
      if (!target || target.status !== 'ACTIVE') {
        throw new ApiError('Active admin account not found', 404, 'ADMIN_NOT_FOUND');
      }

      const nextRecord = await this.adminAccountMapper.updateDisplayName(
        target.id,
        parsed.data.displayName,
        client
      );
      if (!nextRecord) {
        throw new ApiError('Active admin account not found', 404, 'ADMIN_NOT_FOUND');
      }

      await this.auditLogMapper.append(
        {
          actorAccountId,
          module: 'M0A',
          action: 'ADMIN_RENAMED',
          targetType: 'admin_account',
          targetId: nextRecord.id,
          beforeState: { displayName: target.displayName },
          afterState: { displayName: nextRecord.displayName },
          traceId: traceId ?? null,
        },
        client
      );

      return nextRecord;
    });

    this.identityContextService.invalidateRoleDirectoryCache();
    return this.buildSingleDto(updated);
  }

  /**
   * Revokes an ordinary ACTIVE admin role inside an advisory-locked transaction while ensuring
   * at least one active healthy admin remains and preserving all co-roles (monitor/teacher/parent).
   */
  async revokeOrdinaryAdmin(
    actorAccountId: string,
    targetAdminId: string,
    rawInput: unknown,
    traceId?: string
  ): Promise<AdminAccountDto> {
    const parsed = RevokeAdminSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ApiError('Validation failed', 400, 'VALIDATION_FAILED', parsed.error.flatten());
    }

    const revoked = await this.runTx(async (client) => {
      await this.adminAccountMapper.lockGovernanceScope(client);

      const actor = await this.adminAccountMapper.findActiveByAccountId(actorAccountId, client);
      if (!actor || !actor.isPermanentPrimary || actor.status !== 'ACTIVE') {
        throw new ApiError(
          'Forbidden: Permanent primary master admin required',
          403,
          'PERMANENT_MASTER_ADMIN_REQUIRED'
        );
      }

      const target = await this.adminAccountMapper.findById(targetAdminId, client);
      if (!target || target.status !== 'ACTIVE') {
        throw new ApiError('Active admin account not found', 404, 'ADMIN_NOT_FOUND');
      }

      if (target.isPermanentPrimary) {
        throw new ApiError(
          'Forbidden: Permanent primary master admin cannot be revoked',
          403,
          'PERMANENT_MASTER_ADMIN_PROTECTED'
        );
      }

      if (target.accountId === actorAccountId) {
        throw new ApiError('Cannot revoke your own admin role', 400, 'CANNOT_REVOKE_SELF');
      }

      const authMap = await this.authAccountPort.findByIds([target.accountId]);
      const targetEmail = authMap.get(target.accountId)?.email;
      const confirmTrimmed = parsed.data.confirmText.trim();
      const matchesDisplayName = confirmTrimmed === target.displayName;
      const matchesEmail = Boolean(
        targetEmail && confirmTrimmed.toLowerCase() === targetEmail.trim().toLowerCase()
      );
      if (!matchesDisplayName && !matchesEmail) {
        throw new ApiError(
          'Confirmation text does not match target admin display name or email',
          400,
          'CONFIRMATION_MISMATCH'
        );
      }

      const activeAdmins = await this.adminAccountMapper.findAllActiveMinimal(client);
      const remainingAdmins = activeAdmins.filter((item) => item.id !== target.id);
      if (remainingAdmins.length === 0) {
        throw new ApiError(
          'At least one active admin must remain on the platform',
          409,
          'LAST_ACTIVE_ADMIN_REQUIRED'
        );
      }

      const remainingAuthById = await this.authAccountPort.findByIds(
        remainingAdmins.map((item) => item.accountId)
      );
      const hasHealthyRemainingAdmin = remainingAdmins.some(
        (item) => remainingAuthById.get(item.accountId)?.accountStatus === 'ACTIVE'
      );
      if (!hasHealthyRemainingAdmin) {
        throw new ApiError(
          'At least one active healthy admin must remain on the platform',
          409,
          'LAST_ACTIVE_ADMIN_REQUIRED'
        );
      }

      const updated = await this.adminAccountMapper.revoke(target.id, actorAccountId, client);
      if (!updated) {
        throw new ApiError('Active admin account not found', 404, 'ADMIN_NOT_FOUND');
      }

      await this.auditLogMapper.append(
        {
          actorAccountId,
          module: 'M0A',
          action: 'ADMIN_REVOKED',
          targetType: 'admin_account',
          targetId: updated.id,
          beforeState: { status: target.status, displayName: target.displayName },
          afterState: { status: updated.status, revokedBy: actorAccountId },
          traceId: traceId ?? null,
        },
        client
      );

      return updated;
    });

    this.identityContextService.invalidateRoleDirectoryCache();

    if (this.roleInvalidationNotifier) {
      try {
        await this.roleInvalidationNotifier.notifyRoleContextInvalidated(revoked.accountId, {
          reason: 'ADMIN_REVOKED',
          adminId: revoked.id,
        });
      } catch {
        // Best-effort SSE push: revocation has already committed and local cache is cleared.
      }
    }

    return this.buildSingleDto(revoked);
  }
}
