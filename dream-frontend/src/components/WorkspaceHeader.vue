<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <header
    :class="[
      'sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 shadow transition-colors duration-200',
      headerThemeClasses
    ]"
  >
    <div class="flex items-center space-x-2 sm:space-x-3">
      <router-link to="/" class="flex items-center space-x-2">
        <div class="w-7 h-7 rounded-lg bg-teal-600 text-white grid place-items-center text-xs font-bold">
          D
        </div>
        <div class="font-bold text-base sm:text-lg tracking-wide">
          Dream
        </div>
      </router-link>
      <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="badgeThemeClasses">
        {{ currentWorkspaceName }}
      </span>
    </div>

    <div class="flex items-center flex-wrap gap-2 sm:gap-3">
      <!-- Child Profile Switcher (When parent workspace) -->
      <div v-if="workspaceStore.currentWorkspace === 'parent'" class="flex items-center">
        <ProfileSwitcher />
      </div>

      <!-- Language Toggle Button (中 / EN) -->
      <button
        type="button"
        @click="toggleLanguage"
        class="h-9 px-2.5 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition min-h-[44px] flex items-center gap-1"
        :title="currentLocale === 'zh-CN' ? 'Switch to English' : '切换为简体中文'"
      >
        <svg class="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        <span>{{ currentLocale === 'zh-CN' ? 'EN' : '中' }}</span>
      </button>

      <!-- Workspace Switcher Selector -->
      <select
        :value="workspaceStore.currentWorkspace"
        @change="onWorkspaceChange"
        class="bg-white/95 text-slate-800 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[44px]"
      >
        <option value="parent">{{ t('workspace.parent') }}</option>
        <option value="monitor">{{ t('workspace.monitor') }}</option>
        <option value="admin">{{ t('workspace.admin') }}</option>
        <option value="teacher">{{ t('workspace.teacher') }}</option>
      </select>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkspaceStore } from '../stores/workspace';
import { setLocale } from '../i18n';
import ProfileSwitcher from './ProfileSwitcher.vue';
import type { WorkspaceMode } from '../types';

const { t, locale } = useI18n();
const workspaceStore = useWorkspaceStore();

const currentLocale = computed(() => locale.value);

function toggleLanguage() {
  const next = currentLocale.value === 'zh-CN' ? 'en-US' : 'zh-CN';
  setLocale(next);
}

const currentWorkspaceName = computed(() => {
  switch (workspaceStore.currentWorkspace) {
    case 'admin':
      return t('workspace.admin');
    case 'monitor':
      return t('workspace.monitor');
    case 'parent':
      return t('workspace.parent');
    case 'teacher':
      return t('workspace.teacher');
    default:
      return t('workspace.title');
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
</script>
