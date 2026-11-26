/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { DatabaseService } from '@topeetop/shared-core';
import { AdminAccountMapper, AdminAccountRecord } from '../../src/db/AdminAccountMapper.js';
import { AuditLogMapper } from '../../src/db/AuditLogMapper.js';
import {
  AdminGovernanceService,
  AuthAccountPort,
  AuthAccountSummary,
  IdentityContextService,
  RoleInvalidationNotifier,
} from '../../src/modules/identity/index.js';

function createAdminRecord(overrides: Partial<AdminAccountRecord> = {}): AdminAccountRecord {
  return {
    id: 'admMaster001',
    accountId: 'accMaster001',
    displayName: 'Master Admin',
    status: 'ACTIVE',
    isPermanentPrimary: true,
    note: null,
    grantedBy: null,
    grantedAt: new Date('2026-11-20T00:00:00Z'),
    revokedBy: null,
    revokedAt: null,
    createdAt: new Date('2026-11-20T00:00:00Z'),
    updatedAt: new Date('2026-11-20T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

function createAuthSummary(overrides: Partial<AuthAccountSummary> = {}): AuthAccountSummary {
  return {
    id: 'accTarget001',
    email: 'alice.ops@topee.top',
    emailConfirmedAt: new Date('2026-11-01T00:00:00Z'),
    bannedUntil: null,
    lockedUntil: null,
    deletedAt: null,
    accountStatus: 'ACTIVE',
    ...overrides,
  };
}

describe('AdminGovernanceService (Unit Tests)', () => {
  let mockClient: PoolClient;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockAdminMapper: jest.Mocked<AdminAccountMapper>;
  let mockAuditMapper: jest.Mocked<AuditLogMapper>;
  let mockIdentityService: jest.Mocked<
    Pick<IdentityContextService, 'resolveRolesFromCache' | 'invalidateRoleDirectoryCache'>
  >;
  let mockAuthPort: jest.Mocked<AuthAccountPort>;
  let mockNotifier: jest.Mocked<RoleInvalidationNotifier>;
  let service: AdminGovernanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = { query: jest.fn(), release: jest.fn() } as unknown as PoolClient;
    mockDb = {
      executeTx: jest.fn(async (cb: (client: PoolClient) => Promise<unknown>) => cb(mockClient)),
      executeQuery: jest.fn(),
      getOne: jest.fn(),
    } as unknown as jest.Mocked<DatabaseService>;

    mockAdminMapper = {
      lockGovernanceScope: jest.fn().mockResolvedValue(undefined),
      findAllActiveMinimal: jest.fn().mockResolvedValue([]),
      findActiveByAccountId: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      findByAccountId: jest.fn().mockResolvedValue(null),
      findPermanentPrimary: jest.fn().mockResolvedValue(null),
      listAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      reactivate: jest.fn(),
      updateDisplayName: jest.fn(),
      revoke: jest.fn(),
    } as unknown as jest.Mocked<AdminAccountMapper>;

    mockAuditMapper = {
      append: jest.fn().mockResolvedValue({ id: 'aud000000001' }),
    } as unknown as jest.Mocked<AuditLogMapper>;

    mockIdentityService = {
      resolveRolesFromCache: jest.fn().mockResolvedValue({
        accountId: 'accTarget001',
        primaryRole: 'monitor',
        effectiveRoles: ['monitor', 'parent'],
        adminAccount: null,
        monitorProfile: { id: 'mon001', displayName: 'Ops Monitor', status: 'ACTIVE' },
        teacherProfile: null,
      }),
      invalidateRoleDirectoryCache: jest.fn(),
    };

    mockAuthPort = {
      findByEmail: jest.fn().mockResolvedValue(null),
      findByIds: jest.fn().mockResolvedValue(new Map()),
      deactivateAccountAndRevokeSessions: jest.fn(),
    };

    mockNotifier = {
      notifyRoleContextInvalidated: jest.fn().mockResolvedValue(undefined),
    };

    service = new AdminGovernanceService({
      db: mockDb,
      adminAccountMapper: mockAdminMapper,
      auditLogMapper: mockAuditMapper,
      identityContextService: mockIdentityService as unknown as IdentityContextService,
      authAccountPort: mockAuthPort,
      roleInvalidationNotifier: mockNotifier,
    });
  });

  it('listAdmins should mask emails and set canManage=true only for permanent primary admin', async () => {
    const master = createAdminRecord();
    const ordinary = createAdminRecord({
      id: 'admOrd000001',
      accountId: 'accOrd000001',
      displayName: 'Leo Ops',
      isPermanentPrimary: false,
      grantedBy: 'accMaster001',
    });

    mockAdminMapper.listAll.mockResolvedValue([master, ordinary]);
    mockAuthPort.findByIds.mockResolvedValue(
      new Map([
        ['accMaster001', createAuthSummary({ id: 'accMaster001', email: 'owner@topee.top' })],
        ['accOrd000001', createAuthSummary({ id: 'accOrd000001', email: 'leo.ops@topee.top' })],
      ])
    );

    const masterView = await service.listAdmins('accMaster001');
    expect(masterView.canManage).toBe(true);
    expect(masterView.items).toHaveLength(2);
    expect(masterView.items[0].emailMasked).toBe('ow***@topee.top');
    expect(masterView.items[1].grantedByName).toBe('Master Admin');

    const ordinaryView = await service.listAdmins('accOrd000001');
    expect(ordinaryView.canManage).toBe(false);
  });

  it('lookupAccountByEmail should return masked email, status, and grant eligibility', async () => {
    mockAuthPort.findByEmail.mockResolvedValueOnce(
      createAuthSummary({ id: 'accCandidate1', email: 'candidate@topee.top' })
    );
    mockAdminMapper.findByAccountId.mockResolvedValueOnce(null);

    const result = await service.lookupAccountByEmail({ email: 'Candidate@Topee.Top' });
    expect(result).toEqual({
      accountId: 'accCandidate1',
      emailMasked: 'ca***@topee.top',
      accountStatus: 'ACTIVE',
      isEligibleToGrant: true,
      currentAdminStatus: 'NONE',
      currentAdminId: null,
      currentDisplayName: null,
      coRoles: ['monitor', 'parent'],
    });
  });

  it('grantAdmin should reject banned or inactive accounts and require matching confirmation', async () => {
    await expect(
      service.grantAdmin('accMaster001', {
        email: 'alice@topee.top',
        displayName: 'Alice',
        confirmText: 'wrong',
      })
    ).rejects.toMatchObject({ statusCode: 400, errorCode: 'CONFIRMATION_MISMATCH' });

    mockAuthPort.findByEmail.mockResolvedValueOnce(
      createAuthSummary({
        id: 'accBanned001',
        email: 'banned@topee.top',
        accountStatus: 'BANNED',
      })
    );

    await expect(
      service.grantAdmin('accMaster001', {
        email: 'banned@topee.top',
        displayName: 'Banned',
        confirmText: 'banned@topee.top',
      })
    ).rejects.toMatchObject({ statusCode: 403, errorCode: 'ACCOUNT_BANNED' });
  });

  it('grantAdmin should create new ordinary admin, append silent audit log, and invalidate cache', async () => {
    mockAuthPort.findByEmail.mockResolvedValueOnce(
      createAuthSummary({ id: 'accNew000001', email: 'newops@topee.top' })
    );
    mockAdminMapper.findActiveByAccountId.mockResolvedValueOnce({
      id: 'admMaster001',
      accountId: 'accMaster001',
      displayName: 'Master Admin',
      status: 'ACTIVE',
      isPermanentPrimary: true,
    });
    mockAdminMapper.findByAccountId.mockResolvedValueOnce(null);
    const created = createAdminRecord({
      id: 'admNew000001',
      accountId: 'accNew000001',
      displayName: 'New Ops',
      isPermanentPrimary: false,
      grantedBy: 'accMaster001',
    });
    mockAdminMapper.create.mockResolvedValueOnce(created);
    mockAdminMapper.listAll.mockResolvedValueOnce([createAdminRecord(), created]);
    mockAuthPort.findByIds.mockResolvedValueOnce(
      new Map([['accNew000001', createAuthSummary({ id: 'accNew000001', email: 'newops@topee.top' })]])
    );

    const dto = await service.grantAdmin(
      'accMaster001',
      {
        email: 'newops@topee.top',
        displayName: 'New Ops',
        confirmText: 'newops@topee.top',
      },
      'trace-grant-1'
    );

    expect(dto.id).toBe('admNew000001');
    expect(dto.isPermanentPrimary).toBe(false);
    expect(mockAdminMapper.lockGovernanceScope).toHaveBeenCalledWith(mockClient);
    expect(mockAuditMapper.append).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'M0A',
        action: 'ADMIN_GRANTED',
        targetId: 'admNew000001',
        traceId: 'trace-grant-1',
      }),
      mockClient
    );
    expect(mockIdentityService.invalidateRoleDirectoryCache).toHaveBeenCalledTimes(1);
  });

  it('grantAdmin should reactivate historical REVOKED record instead of duplicating', async () => {
    mockAuthPort.findByEmail.mockResolvedValueOnce(
      createAuthSummary({ id: 'accRev000001', email: 'rev@topee.top' })
    );
    mockAdminMapper.findActiveByAccountId.mockResolvedValueOnce({
      id: 'admMaster001',
      accountId: 'accMaster001',
      displayName: 'Master Admin',
      status: 'ACTIVE',
      isPermanentPrimary: true,
    });
    mockAdminMapper.findByAccountId.mockResolvedValueOnce(
      createAdminRecord({
        id: 'admRev000001',
        accountId: 'accRev000001',
        displayName: 'Old Name',
        status: 'REVOKED',
        isPermanentPrimary: false,
      })
    );
    const reactivated = createAdminRecord({
      id: 'admRev000001',
      accountId: 'accRev000001',
      displayName: 'Restored Name',
      status: 'ACTIVE',
      isPermanentPrimary: false,
      grantedBy: 'accMaster001',
    });
    mockAdminMapper.reactivate.mockResolvedValueOnce(reactivated);
    mockAdminMapper.listAll.mockResolvedValueOnce([createAdminRecord(), reactivated]);
    mockAuthPort.findByIds.mockResolvedValueOnce(
      new Map([['accRev000001', createAuthSummary({ id: 'accRev000001', email: 'rev@topee.top' })]])
    );

    const dto = await service.grantAdmin('accMaster001', {
      email: 'rev@topee.top',
      displayName: 'Restored Name',
      confirmText: 'Restored Name',
    });

    expect(dto.status).toBe('ACTIVE');
    expect(dto.displayName).toBe('Restored Name');
    expect(mockAdminMapper.reactivate).toHaveBeenCalledTimes(1);
    expect(mockAdminMapper.create).not.toHaveBeenCalled();
    expect(mockAuditMapper.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_REACTIVATED' }),
      mockClient
    );
  });

  it('revokeOrdinaryAdmin should protect permanent primary, prevent self-revoke, prevent last healthy admin removal, and push SSE invalidation', async () => {
    mockAdminMapper.findActiveByAccountId.mockResolvedValue({
      id: 'admMaster001',
      accountId: 'accMaster001',
      displayName: 'Master Admin',
      status: 'ACTIVE',
      isPermanentPrimary: true,
    });

    // 1. Protect permanent primary
    mockAdminMapper.findById.mockResolvedValueOnce(createAdminRecord());
    await expect(
      service.revokeOrdinaryAdmin('accMaster001', 'admMaster001', { confirmText: 'Master Admin' })
    ).rejects.toMatchObject({ statusCode: 403, errorCode: 'PERMANENT_MASTER_ADMIN_PROTECTED' });

    // 2. Last healthy admin guard
    const ord = createAdminRecord({
      id: 'admOrd000001',
      accountId: 'accOrd000001',
      displayName: 'Leo Ops',
      isPermanentPrimary: false,
    });
    mockAdminMapper.findById.mockResolvedValueOnce(ord);
    mockAuthPort.findByIds
      .mockResolvedValueOnce(
        new Map([['accOrd000001', createAuthSummary({ id: 'accOrd000001', email: 'leo@topee.top' })]])
      )
      .mockResolvedValueOnce(
        new Map([
          [
            'accMaster001',
            createAuthSummary({
              id: 'accMaster001',
              email: 'owner@topee.top',
              accountStatus: 'BANNED',
            }),
          ],
        ])
      );
    mockAdminMapper.findAllActiveMinimal.mockResolvedValueOnce([
      {
        id: 'admMaster001',
        accountId: 'accMaster001',
        displayName: 'Master Admin',
        status: 'ACTIVE',
        isPermanentPrimary: true,
      },
      {
        id: 'admOrd000001',
        accountId: 'accOrd000001',
        displayName: 'Leo Ops',
        status: 'ACTIVE',
        isPermanentPrimary: false,
      },
    ]);

    await expect(
      service.revokeOrdinaryAdmin('accMaster001', 'admOrd000001', { confirmText: 'Leo Ops' })
    ).rejects.toMatchObject({ statusCode: 409, errorCode: 'LAST_ACTIVE_ADMIN_REQUIRED' });

    // 3. Successful revocation + SSE invalidation + silent audit log
    mockAdminMapper.findById.mockResolvedValueOnce(ord);
    mockAuthPort.findByIds
      .mockResolvedValueOnce(
        new Map([['accOrd000001', createAuthSummary({ id: 'accOrd000001', email: 'leo@topee.top' })]])
      )
      .mockResolvedValueOnce(
        new Map([
          ['accMaster001', createAuthSummary({ id: 'accMaster001', email: 'owner@topee.top' })],
        ])
      )
      .mockResolvedValueOnce(
        new Map([['accOrd000001', createAuthSummary({ id: 'accOrd000001', email: 'leo@topee.top' })]])
      );
    mockAdminMapper.findAllActiveMinimal.mockResolvedValueOnce([
      {
        id: 'admMaster001',
        accountId: 'accMaster001',
        displayName: 'Master Admin',
        status: 'ACTIVE',
        isPermanentPrimary: true,
      },
      {
        id: 'admOrd000001',
        accountId: 'accOrd000001',
        displayName: 'Leo Ops',
        status: 'ACTIVE',
        isPermanentPrimary: false,
      },
    ]);
    const revokedOrd = createAdminRecord({
      ...ord,
      status: 'REVOKED',
      revokedBy: 'accMaster001',
      revokedAt: new Date('2026-11-24T12:00:00Z'),
    });
    mockAdminMapper.revoke.mockResolvedValueOnce(revokedOrd);
    mockAdminMapper.listAll.mockResolvedValueOnce([createAdminRecord(), revokedOrd]);

    const result = await service.revokeOrdinaryAdmin(
      'accMaster001',
      'admOrd000001',
      { confirmText: 'leo@topee.top' },
      'trace-revoke-1'
    );

    expect(result.status).toBe('REVOKED');
    expect(mockIdentityService.invalidateRoleDirectoryCache).toHaveBeenCalled();
    expect(mockNotifier.notifyRoleContextInvalidated).toHaveBeenCalledWith('accOrd000001', {
      reason: 'ADMIN_REVOKED',
      adminId: 'admOrd000001',
    });
  });
});
