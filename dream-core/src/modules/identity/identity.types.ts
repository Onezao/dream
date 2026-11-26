/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { AdminAccountStatus } from '../../db/AdminAccountMapper.js';

export const BusinessRoleSchema = z.enum(['admin', 'monitor', 'teacher', 'parent']);
export type BusinessRole = z.infer<typeof BusinessRoleSchema>;

export const UpdatePreferencesSchema = z.object({
  locale: z.enum(['zh-CN', 'en-US']).optional(),
  timezone: z.string().min(1).max(64).optional(),
});
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;

export const RequestAvatarUploadUrlSchema = z.object({
  contentType: z.literal('image/webp').default('image/webp'),
  fileSizeBytes: z.number().int().positive().max(2 * 1024 * 1024),
});
export type RequestAvatarUploadUrlInput = z.infer<typeof RequestAvatarUploadUrlSchema>;

export const DeactivateAccountSchema = z.object({
  confirmEmail: z.string().trim().email('Invalid email format').transform((v) => v.toLowerCase()),
});
export type DeactivateAccountInput = z.infer<typeof DeactivateAccountSchema>;

export const LookupAccountByEmailSchema = z.object({
  email: z.string().trim().email('Invalid email format').transform((v) => v.toLowerCase()),
});
export type LookupAccountByEmailInput = z.infer<typeof LookupAccountByEmailSchema>;

export const GrantAdminSchema = z.object({
  email: z.string().trim().email('Invalid email format').transform((v) => v.toLowerCase()),
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters'),
  confirmText: z.string().trim().min(1, 'Confirmation text is required').max(120),
});
export type GrantAdminInput = z.infer<typeof GrantAdminSchema>;

export const UpdateAdminDisplayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters'),
});
export type UpdateAdminDisplayNameInput = z.infer<typeof UpdateAdminDisplayNameSchema>;

export const RevokeAdminSchema = z.object({
  confirmText: z.string().trim().min(1, 'Confirmation text is required').max(120),
});
export type RevokeAdminInput = z.infer<typeof RevokeAdminSchema>;

/**
 * Masks an email address for safe API response display (e.g. al***@example.com).
 */
export function maskEmailAddress(email: string): string {
  const normalized = email.trim();
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return '***';
  }
  const localPart = normalized.slice(0, atIndex);
  const domainPart = normalized.slice(atIndex + 1);
  const visibleCount = localPart.length <= 1 ? 1 : 2;
  return `${localPart.slice(0, visibleCount)}***@${domainPart}`;
}

export interface CachedRoleDirectory {
  minuteBucket: number;
  adminByAccountId: Map<
    string,
    {
      id: string;
      accountId: string;
      displayName: string;
      status: AdminAccountStatus;
      isPermanentPrimary: boolean;
    }
  >;
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
  adminAccount: { id: string; displayName: string; isPermanentPrimary: boolean } | null;
  monitorProfile: { id: string; displayName: string; status: string } | null;
  teacherProfile: { id: string; displayName: string; status: string } | null;
}

export interface MeContextDto extends RoleResolutionSnapshot {
  emailMasked: string;
  studentProfiles: Array<{ id: string; nickname: string; avatarKey: string | null }>;
  preferences: { locale: 'zh-CN' | 'en-US'; timezone: string };
  currentStudentProfileId?: string;
}

export interface AdminAccountDto {
  id: string;
  accountId: string;
  displayName: string;
  emailMasked: string;
  isPermanentPrimary: boolean;
  status: AdminAccountStatus;
  coRoles: Array<'monitor' | 'teacher' | 'parent'>;
  grantedByName: string | null;
  grantedAt: string;
  revokedByName: string | null;
  revokedAt: string | null;
}

export interface AdminListDto {
  canManage: boolean;
  items: AdminAccountDto[];
}

export type ExternalAccountStatus = 'ACTIVE' | 'UNVERIFIED' | 'LOCKED' | 'BANNED' | 'DEACTIVATED';

export interface AdminLookupDto {
  accountId: string;
  emailMasked: string;
  accountStatus: ExternalAccountStatus;
  isEligibleToGrant: boolean;
  currentAdminStatus: 'NONE' | AdminAccountStatus;
  currentAdminId: string | null;
  currentDisplayName: string | null;
  coRoles: Array<'monitor' | 'teacher' | 'parent'>;
}

export interface AvatarUploadUrlDto {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export interface AuthAccountSummary {
  id: string;
  email: string;
  emailConfirmedAt: Date | null;
  bannedUntil: Date | null;
  lockedUntil: Date | null;
  deletedAt: Date | null;
  accountStatus: ExternalAccountStatus;
}

/**
 * Port implemented in dream-backend to decouple dream-core domain services from auth-core/tauth internals.
 */
export interface AuthAccountPort {
  findByEmail(email: string): Promise<AuthAccountSummary | null>;
  findByIds(accountIds: string[]): Promise<Map<string, AuthAccountSummary>>;
  deactivateAccountAndRevokeSessions(accountId: string, client?: PoolClient): Promise<void>;
}

/**
 * Optional notification publisher used to trigger real-time role downgrade over SSE.
 */
export interface RoleInvalidationNotifier {
  notifyRoleContextInvalidated(
    targetAccountId: string,
    payload: { reason: string; adminId: string }
  ): Promise<void>;
}
