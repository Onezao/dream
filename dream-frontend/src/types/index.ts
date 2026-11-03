/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

export type WorkspaceMode = 'admin' | 'monitor' | 'parent' | 'teacher';

export type UserRole = 'ADMIN' | 'MONITOR' | 'PARENT' | 'TEACHER';

export interface StudentProfile {
  id: string;
  accountId: string;
  nickname: string; // e.g. AliceZ12
  realName?: string;
  birthYearMonth?: string;
  notes?: string;
}

export interface UserSession {
  userId: string;
  email: string;
  roles: UserRole[];
  currentWorkspace: WorkspaceMode;
  currentProfileId?: string;
}
