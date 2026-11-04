/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

export type WorkspaceMode = 'admin' | 'monitor' | 'parent' | 'teacher';

export type UserRole = 'ADMIN' | 'MONITOR' | 'PARENT' | 'TEACHER';

export type StudentGender = 'male' | 'female' | 'undisclosed';

export interface StudentProfileDto {
  id: string;
  accountId: string;
  realName: string;
  englishName: string;
  surnameInitial: string;
  age: number;
  nickname: string;
  gender: StudentGender;
  birthDate: string | null;
  avatarKey: string | null;
  avatarUrl: string | null;
  preferredCourseTypeIds: string[];
  createdAt: string;
  updatedAt: string;
}

// Backward compatibility alias
export type StudentProfile = StudentProfileDto;

export interface CreateStudentProfileInput {
  realName: string;
  englishName: string;
  surnameInitial: string;
  age: number;
  nicknameSuffix?: string;
  gender?: StudentGender;
  birthDate?: string;
  avatarKey?: string;
  avatarDataUrl?: string;
  preferredCourseTypeIds?: string[];
}

export interface UpdateStudentProfileInput {
  realName?: string;
  age?: number;
  nicknameSuffix?: string;
  gender?: StudentGender;
  birthDate?: string;
  avatarKey?: string;
  avatarDataUrl?: string;
  preferredCourseTypeIds?: string[];
}

export interface NicknameAvailabilityResult {
  available: boolean;
  nickname: string;
  reason?: string;
}

export interface StudentLookupResult {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface UserSession {
  userId: string;
  email: string;
  roles: UserRole[];
  currentWorkspace: WorkspaceMode;
  currentProfileId?: string;
}
