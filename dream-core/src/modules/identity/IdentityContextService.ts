/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { ApiError } from '@topeetop/shared-core';
import { AdminAccountMapper, AdminAccountMinimal } from '../../db/AdminAccountMapper.js';
import { MonitorProfileMapper } from '../../db/MonitorProfileMapper.js';
import { TeacherProfileMapper } from '../../db/TeacherProfileMapper.js';
import { StudentProfileMapper } from '../../db/StudentProfileMapper.js';
import { UserPreferenceMapper, UserPreferenceRecord } from '../../db/UserPreferenceMapper.js';
import {
  BusinessRole,
  CachedRoleDirectory,
  MeContextDto,
  RoleResolutionSnapshot,
  UpdatePreferencesSchema,
  maskEmailAddress,
} from './identity.types.js';

export interface IdentityContextServiceDeps {
  adminAccountMapper?: AdminAccountMapper;
  monitorProfileMapper?: MonitorProfileMapper;
  teacherProfileMapper?: TeacherProfileMapper;
  studentProfileMapper?: StudentProfileMapper;
  userPreferenceMapper?: UserPreferenceMapper;
  now?: () => number;
}

export class IdentityContextService {
  private readonly adminAccountMapper: AdminAccountMapper;
  private readonly monitorProfileMapper: MonitorProfileMapper;
  private readonly teacherProfileMapper: TeacherProfileMapper;
  private readonly studentProfileMapper: StudentProfileMapper;
  private readonly userPreferenceMapper: UserPreferenceMapper;
  private readonly now: () => number;

  private cachedDirectory: CachedRoleDirectory | null = null;
  private refreshPromise: Promise<CachedRoleDirectory> | null = null;
  private cacheEpoch = 0;

  constructor(deps: IdentityContextServiceDeps = {}) {
    this.adminAccountMapper = deps.adminAccountMapper ?? new AdminAccountMapper();
    this.monitorProfileMapper = deps.monitorProfileMapper ?? new MonitorProfileMapper();
    this.teacherProfileMapper = deps.teacherProfileMapper ?? new TeacherProfileMapper();
    this.studentProfileMapper = deps.studentProfileMapper ?? new StudentProfileMapper();
    this.userPreferenceMapper = deps.userPreferenceMapper ?? new UserPreferenceMapper();
    this.now = deps.now ?? (() => Date.now());
  }

  /**
   * Invalidates the in-memory minute-boundary role directory cache after admin/monitor/teacher changes.
   */
  invalidateRoleDirectoryCache(): void {
    this.cacheEpoch += 1;
    this.cachedDirectory = null;
    this.refreshPromise = null;
  }

  /**
   * Gets or refreshes the 0-60s minute-boundary role directory cache (serverless-safe single-flight).
   */
  private async getOrRefreshDirectory(): Promise<CachedRoleDirectory> {
    const currentMinute = Math.floor(this.now() / 60_000);
    if (this.cachedDirectory && this.cachedDirectory.minuteBucket === currentMinute) {
      return this.cachedDirectory;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const epochAtStart = this.cacheEpoch;
    const targetMinute = currentMinute;

    const currentPromise = (async (): Promise<CachedRoleDirectory> => {
      try {
        const [admins, monitors, teachers] = await Promise.all([
          this.adminAccountMapper.findAllActiveMinimal(),
          this.monitorProfileMapper.findAllActiveMinimal(),
          this.teacherProfileMapper.findAllActiveMinimal(),
        ]);

        const adminByAccountId = new Map<
          string,
          {
            id: string;
            accountId: string;
            displayName: string;
            status: 'ACTIVE' | 'REVOKED';
            isPermanentPrimary: boolean;
          }
        >();
        for (const admin of admins) {
          adminByAccountId.set(admin.accountId, {
            id: admin.id,
            accountId: admin.accountId,
            displayName: admin.displayName,
            status: admin.status,
            isPermanentPrimary: admin.isPermanentPrimary,
          });
        }

        const monitorByAccountId = new Map<
          string,
          { id: string; accountId: string; displayName: string; status: string }
        >();
        for (const monitor of monitors) {
          monitorByAccountId.set(monitor.accountId, {
            id: monitor.id,
            accountId: monitor.accountId,
            displayName: monitor.displayName,
            status: monitor.status,
          });
        }

        const teacherByAccountId = new Map<
          string,
          { id: string; accountId: string; displayName: string; status: string }
        >();
        for (const teacher of teachers) {
          teacherByAccountId.set(teacher.accountId, {
            id: teacher.id,
            accountId: teacher.accountId,
            displayName: teacher.displayName,
            status: teacher.status,
          });
        }

        const directory: CachedRoleDirectory = {
          minuteBucket: targetMinute,
          adminByAccountId,
          monitorByAccountId,
          teacherByAccountId,
        };

        if (this.cacheEpoch === epochAtStart) {
          this.cachedDirectory = directory;
        }

        return directory;
      } finally {
        if (this.cacheEpoch === epochAtStart) {
          this.refreshPromise = null;
        }
      }
    })();

    this.refreshPromise = currentPromise;
    return currentPromise;
  }

  /**
   * Resolves effective business roles from the minute-boundary cache with priority:
   * admin > monitor > teacher > parent.
   */
  async resolveRolesFromCache(accountId: string): Promise<RoleResolutionSnapshot> {
    const directory = await this.getOrRefreshDirectory();

    const admin = directory.adminByAccountId.get(accountId) ?? null;
    const monitor = directory.monitorByAccountId.get(accountId) ?? null;
    const teacher = directory.teacherByAccountId.get(accountId) ?? null;

    const effectiveRoles: BusinessRole[] = [];
    if (admin) {
      effectiveRoles.push('admin');
    }
    if (monitor) {
      effectiveRoles.push('monitor');
    }
    if (teacher) {
      effectiveRoles.push('teacher');
    }
    effectiveRoles.push('parent');

    const primaryRole: BusinessRole = effectiveRoles[0];

    return {
      accountId,
      primaryRole,
      effectiveRoles,
      adminAccount: admin
        ? {
            id: admin.id,
            displayName: admin.displayName,
            isPermanentPrimary: admin.isPermanentPrimary,
          }
        : null,
      monitorProfile: monitor
        ? { id: monitor.id, displayName: monitor.displayName, status: monitor.status }
        : null,
      teacherProfile: teacher
        ? { id: teacher.id, displayName: teacher.displayName, status: teacher.status }
        : null,
    };
  }

  /**
   * High-risk guard helper: bypasses in-memory cache and queries DB directly to confirm
   * the caller is currently the active permanent primary master admin.
   */
  async verifyPermanentMasterAdminFromDb(accountId: string): Promise<AdminAccountMinimal> {
    const admin = await this.adminAccountMapper.findActiveByAccountId(accountId);
    if (!admin || !admin.isPermanentPrimary || admin.status !== 'ACTIVE') {
      throw new ApiError(
        'Forbidden: Permanent primary master admin required',
        403,
        'PERMANENT_MASTER_ADMIN_REQUIRED'
      );
    }
    return admin;
  }

  /**
   * Resolves complete identity context for `/me/context` (roles + masked email + owned student profiles + preferences).
   */
  async resolveContext(
    accountId: string,
    email: string,
    requestedProfileId?: string
  ): Promise<MeContextDto> {
    const [roleSnapshot, studentProfiles, userPreference] = await Promise.all([
      this.resolveRolesFromCache(accountId),
      this.studentProfileMapper.findActiveByAccountId(accountId),
      this.userPreferenceMapper.findByAccountId(accountId),
    ]);

    if (requestedProfileId !== undefined) {
      const isOwned = studentProfiles.some((profile) => profile.id === requestedProfileId);
      if (!isOwned) {
        throw new ApiError(
          'Forbidden: Student profile does not belong to your account',
          403,
          'PROFILE_ACCESS_DENIED'
        );
      }
    }

    const defaultLocale: 'zh-CN' | 'en-US' =
      roleSnapshot.primaryRole === 'teacher' ? 'en-US' : 'zh-CN';

    const preferences = {
      locale: userPreference?.locale ?? defaultLocale,
      timezone: userPreference?.timezone ?? 'Asia/Shanghai',
    };

    return {
      ...roleSnapshot,
      emailMasked: maskEmailAddress(email),
      studentProfiles: studentProfiles.map((profile) => ({
        id: profile.id,
        nickname: profile.nickname,
        avatarKey: profile.avatarKey,
      })),
      preferences,
      ...(requestedProfileId !== undefined ? { currentStudentProfileId: requestedProfileId } : {}),
    };
  }

  /**
   * Validates and persists locale / timezone preferences.
   */
  async updatePreferences(accountId: string, rawInput: unknown): Promise<UserPreferenceRecord> {
    const parsed = UpdatePreferencesSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ApiError('Validation failed', 400, 'VALIDATION_FAILED', parsed.error.flatten());
    }

    return this.userPreferenceMapper.upsertPreference(accountId, parsed.data);
  }
}
