<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <header
    :class="[
      'sticky top-0 z-30 flex items-center justify-between px-4 py-3 shadow transition-colors duration-200',
      headerThemeClasses
    ]"
  >
    <div class="flex items-center space-x-3">
      <div class="font-bold text-lg tracking-wide">
        Dream
      </div>
      <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="badgeThemeClasses">
        {{ currentWorkspaceName }}
      </span>
    </div>

    <div class="flex items-center space-x-3">
      <!-- Child Profile Switcher (When profiles exist in store) -->
      <div v-if="workspaceStore.currentWorkspace === 'parent' && profileStore.profiles.length > 0" class="flex items-center text-sm">
        <label for="child-switcher" class="mr-1 text-xs text-gray-500 font-medium">学生档案:</label>
        <select
          id="child-switcher"
          :value="profileStore.currentProfileId"
          @change="onProfileChange"
          class="bg-white border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option v-for="profile in profileStore.profiles" :key="profile.id" :value="profile.id">
            {{ profile.nickname }}
          </option>
        </select>
      </div>

      <!-- Workspace Switcher Selector -->
      <select
        :value="workspaceStore.currentWorkspace"
        @change="onWorkspaceChange"
        class="bg-white/90 text-gray-800 border border-gray-300 rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="parent">家长工作台 (浅色)</option>
        <option value="monitor">班长工作台 (深靛蓝)</option>
        <option value="admin">管理员后台 (黑金)</option>
        <option value="teacher">教师课表 (中性)</option>
      </select>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useWorkspaceStore } from '../stores/workspace';
import { useProfileStore } from '../stores/profile';
import type { WorkspaceMode } from '../types';

const workspaceStore = useWorkspaceStore();
const profileStore = useProfileStore();

const currentWorkspaceName = computed(() => {
  switch (workspaceStore.currentWorkspace) {
    case 'admin':
      return '管理员后台';
    case 'monitor':
      return '班长工作台';
    case 'parent':
      return '家长工作台';
    case 'teacher':
      return '教师课表';
    default:
      return '工作台';
  }
});

const headerThemeClasses = computed(() => {
  switch (workspaceStore.currentWorkspace) {
    case 'admin':
      return 'bg-slate-900 text-amber-400 border-b border-amber-500/30';
    case 'monitor':
      return 'bg-indigo-950 text-indigo-100 border-b border-indigo-800';
    case 'parent':
      return 'bg-white text-gray-800 border-b border-gray-200';
    case 'teacher':
      return 'bg-slate-100 text-slate-800 border-b border-slate-300';
    default:
      return 'bg-white text-gray-800';
  }
});

const badgeThemeClasses = computed(() => {
  switch (workspaceStore.currentWorkspace) {
    case 'admin':
      return 'bg-amber-400/20 text-amber-300 border border-amber-400/30';
    case 'monitor':
      return 'bg-indigo-800 text-indigo-200';
    case 'parent':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'teacher':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
});

function onWorkspaceChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  workspaceStore.switchWorkspace(target.value as WorkspaceMode);
}

function onProfileChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  profileStore.selectProfile(target.value);
}
</script>
