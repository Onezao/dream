/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { WorkspaceMode } from '../types';

export const useWorkspaceStore = defineStore('workspace', () => {
  const currentWorkspace = ref<WorkspaceMode>('parent');

  function switchWorkspace(mode: WorkspaceMode) {
    currentWorkspace.value = mode;
  }

  return {
    currentWorkspace,
    switchWorkspace,
  };
});
