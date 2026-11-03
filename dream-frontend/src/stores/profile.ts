/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { StudentProfile } from '../types';

export const useProfileStore = defineStore('profile', () => {
  const profiles = ref<StudentProfile[]>([]);
  const currentProfileId = ref<string>('');

  const activeProfile = computed(() =>
    profiles.value.find((p) => p.id === currentProfileId.value)
  );

  function setProfiles(list: StudentProfile[]) {
    profiles.value = list;
    if (list.length > 0 && !currentProfileId.value) {
      currentProfileId.value = list[0].id;
    }
  }

  function selectProfile(profileId: string) {
    currentProfileId.value = profileId;
  }

  return {
    profiles,
    currentProfileId,
    activeProfile,
    setProfiles,
    selectProfile,
  };
});
