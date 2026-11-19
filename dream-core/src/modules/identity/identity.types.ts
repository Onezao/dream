/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { z } from 'zod';

export const BusinessRoleSchema = z.enum(['admin', 'monitor', 'teacher', 'parent']);
export type BusinessRole = z.infer<typeof BusinessRoleSchema>;

export const UpdatePreferencesSchema = z.object({
  locale: z.enum(['zh-CN', 'en-US']).optional(),
  timezone: z.string().min(1).max(64).optional(),
});
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;

export interface CachedRoleDirectory {
  minuteBucket: number;
  adminByAccountId: Map<string, { id: string; accountId: string; status: string }>;
  monitorByAccountId: Map<
    string,
    { id: string; accountId: string; displayName: string; status: string }
  >;
  teacherByAccountId: Map<
    string,
    { id: string; accountId: string; displayName: string; status: string }
  >;
}

export interface RoleResolutionSnapshot {
  accountId: string;
  primaryRole: BusinessRole;
  effectiveRoles: BusinessRole[];
  adminAccount: { id: string } | null;
  monitorProfile: { id: string; displayName: string } | null;
  teacherProfile: { id: string; displayName: string } | null;
}

export interface MeContextDto extends RoleResolutionSnapshot {
  email: string;
  studentProfiles: Array<{ id: string; nickname: string; avatarKey: string | null }>;
  preferences: { locale: 'zh-CN' | 'en-US'; timezone: string };
  currentStudentProfileId?: string;
}
