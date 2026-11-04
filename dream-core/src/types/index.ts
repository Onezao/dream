/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

export type UserRole = 'admin' | 'monitor' | 'teacher' | 'parent';

export interface ContextUser {
  id: string; // 12-char account_id
  email: string;
  roles: UserRole[];
}

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export * from './studentProfile.types.js';
export * from './teacherProfile.types.js';
