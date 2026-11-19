/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { ApiError } from '@topeetop/shared-core';
import { AdminAccountMapper } from '../../db/AdminAccountMapper.js';
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
   * 主动清空内存中的角色目录缓存（用于管理员/班长/教师绑定关系变更后强制刷新）
   */
  invalidateRoleDirectoryCache(): void {
    this.cacheEpoch += 1;
    this.cachedDirectory = null;
    this.refreshPromise = null;
  }

  /**
   * 获取或按整点分钟边界刷新 0-60s 角色目录缓存 (Serverless-safe, 无定时器, 单飞并发锁)
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
          { id: string; accountId: string; status: string }
        >();
        for (const admin of admins) {
          adminByAccountId.set(admin.accountId, {
            id: admin.id,
            accountId: admin.accountId,
            status: admin.status,
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
   * 从 0-60s 整点分钟目录缓存中解析账号的四大业务角色与主角色优先级 (admin > monitor > teacher > parent)
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
      adminAccount: admin ? { id: admin.id } : null,
      monitorProfile: monitor ? { id: monitor.id, displayName: monitor.displayName } : null,
      teacherProfile: teacher ? { id: teacher.id, displayName: teacher.displayName } : null,
    };
  }

  /**
   * 聚合当前登录账号完整上下文（四角色解析 + 学员档案列表 + X-Profile-Id 归属校验 + 用户偏好兜底）
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
      email,
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
   * 校验并更新用户语言与时区偏好
   */
  async updatePreferences(accountId: string, rawInput: unknown): Promise<UserPreferenceRecord> {
    const parsed = UpdatePreferencesSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ApiError('Validation failed', 400, 'VALIDATION_FAILED', parsed.error.flatten());
    }

    return this.userPreferenceMapper.upsertPreference(accountId, parsed.data);
  }
}
