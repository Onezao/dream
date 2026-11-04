/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  StudentProfileDto,
  CreateStudentProfileInput,
  UpdateStudentProfileInput,
  NicknameAvailabilityResult,
} from '../types';
import {
  getStudentProfiles,
  createStudentProfile,
  updateStudentProfile,
  deleteStudentProfile,
  checkNicknameAvailability,
} from '../api/profile';

const STORAGE_ACTIVE_PROFILE_KEY = 'dream_active_profile_id';

function getStoredActiveProfileId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_ACTIVE_PROFILE_KEY) || '';
    }
  } catch {
    // Ignore localStorage access failures in restricted environments
  }
  return '';
}

function persistActiveProfileId(id: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (id) {
        localStorage.setItem(STORAGE_ACTIVE_PROFILE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_PROFILE_KEY);
      }
    }
  } catch {
    // Ignore localStorage access failures
  }
}

export const useProfileStore = defineStore('profile', () => {
  const profiles = ref<StudentProfileDto[]>([]);
  const activeProfileId = ref<string>(getStoredActiveProfileId());
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  // Backward compatibility alias for currentProfileId
  const currentProfileId = computed({
    get: () => activeProfileId.value,
    set: (val: string) => selectProfile(val),
  });

  const activeProfile = computed<StudentProfileDto | null>(() => {
    if (profiles.value.length === 0) return null;
    const found = profiles.value.find((p) => p.id === activeProfileId.value);
    return found || profiles.value[0] || null;
  });

  const profileCount = computed(() => profiles.value.length);
  const isMaxProfiles = computed(() => profileCount.value >= 10);

  function setProfiles(list: StudentProfileDto[]) {
    profiles.value = list;
    if (list.length > 0) {
      const exists = list.some((p) => p.id === activeProfileId.value);
      if (!exists) {
        selectProfile(list[0].id);
      }
    } else {
      activeProfileId.value = '';
      persistActiveProfileId('');
    }
  }

  function selectProfile(profileId: string) {
    activeProfileId.value = profileId;
    persistActiveProfileId(profileId);
  }

  async function fetchProfiles(): Promise<StudentProfileDto[]> {
    loading.value = true;
    error.value = null;
    try {
      const response = await getStudentProfiles();
      const list = response.data || [];
      setProfiles(list);
      return list;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '获取学员档案失败';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createProfile(data: CreateStudentProfileInput): Promise<StudentProfileDto> {
    loading.value = true;
    error.value = null;
    try {
      const response = await createStudentProfile(data);
      const created = response.data;
      profiles.value = [...profiles.value, created];
      selectProfile(created.id);
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '创建学员档案失败';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateProfile(
    id: string,
    data: UpdateStudentProfileInput
  ): Promise<StudentProfileDto> {
    loading.value = true;
    error.value = null;
    try {
      const response = await updateStudentProfile(id, data);
      const updated = response.data;
      const index = profiles.value.findIndex((p) => p.id === id);
      if (index !== -1) {
        profiles.value[index] = updated;
      }
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '更新学员档案失败';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteProfile(id: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await deleteStudentProfile(id);
      profiles.value = profiles.value.filter((p) => p.id !== id);
      if (activeProfileId.value === id) {
        if (profiles.value.length > 0) {
          selectProfile(profiles.value[0].id);
        } else {
          activeProfileId.value = '';
          persistActiveProfileId('');
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除学员档案失败';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function checkNickname(nickname: string): Promise<NicknameAvailabilityResult> {
    const response = await checkNicknameAvailability(nickname);
    return response.data;
  }

  return {
    profiles,
    activeProfileId,
    currentProfileId,
    loading,
    error,
    activeProfile,
    profileCount,
    isMaxProfiles,
    setProfiles,
    selectProfile,
    fetchProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    checkNickname,
  };
});
