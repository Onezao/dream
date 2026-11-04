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

export type ClassStatus = 'recruiting' | 'active' | 'completed' | 'cancelled';
export type ClassType = '1v1' | 'small_group';

export interface PublicSmallGroupClassDto {
  id: string;
  name: string;
  courseTypeName: string;
  teacherDisplayName: string;
  teacherPhotoUrl: string | null;
  minStudents: number;
  maxStudents: number;
  enrolledCount: number;
  isFull: boolean;
  plannedStartDate: string | null;
  status: ClassStatus;
}

export interface EnrolledStudentSummaryDto {
  studentProfileId: string;
  nickname: string;
  avatarUrl: string | null;
  enrolledAt: string;
}

export interface MonitorClassDto extends PublicSmallGroupClassDto {
  ownerMonitorProfileId: string;
  teacherSalaryPoints: number;
  platformCommissionRate: number;
  forceStartedAt: string | null;
  createdAt: string;
  enrolledStudents: EnrolledStudentSummaryDto[];
}

export interface AdminClassDto extends MonitorClassDto {
  classType: ClassType;
  updatedAt: string;
}

export interface CreateSmallGroupClassInput {
  name: string;
  courseTypeId: string;
  teacherProfileId: string;
  minStudents?: number;
  maxStudents?: number;
  teacherSalaryPoints?: number;
  platformCommissionRate?: number;
  plannedStartDate: string;
}

export interface CancelClassInput {
  confirm: true;
  reason: string;
}

export interface AdminClassQueryInput {
  page?: number;
  pageSize?: number;
  status?: ClassStatus;
  classType?: ClassType;
  ownerMonitorProfileId?: string;
  teacherProfileId?: string;
  courseTypeId?: string;
}

export interface AdminUpdateClassInput {
  name?: string;
  teacherProfileId?: string;
  minStudents?: number;
  maxStudents?: number;
  teacherSalaryPoints?: number;
  platformCommissionRate?: number;
  status?: ClassStatus;
  plannedStartDate?: string | null;
}
