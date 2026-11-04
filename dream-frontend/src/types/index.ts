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

export interface CourseTypeDto {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TeacherLevelDto {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TeacherCardDto {
  id: string;
  displayName: string;
  levelName: string;
  monitorDisplayName: string;
  skillCourseTypes: Array<{ id: string; name: string }>;
  introZh: string;
  introEn: string;
  photoUrl: string | null;
  videoUrl: string | null;
  classinQrUrl: string | null;
}

export interface TeacherDetailDto {
  id: string;
  accountId: string | null;
  displayName: string;
  levelId: string;
  levelName?: string;
  monitorProfileId: string;
  monitorDisplayName?: string;
  skillCourseTypeIds: string[];
  skillCourseTypes?: Array<{ id: string; name: string }>;
  introZh: string;
  introEn: string;
  photoKey: string | null;
  photoUrl: string | null;
  videoKey: string | null;
  videoUrl: string | null;
  classinQrKey: string | null;
  classinQrUrl: string | null;
  resignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeacherProfileInput {
  displayName: string;
  levelId: string;
  skillCourseTypeIds: string[];
  introZh: string;
  introEn: string;
  photoKey?: string;
  videoKey?: string;
  classinQrKey?: string;
}

export type UpdateTeacherProfileInput = Partial<CreateTeacherProfileInput>;

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}
