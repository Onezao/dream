<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <div class="relative select-none text-left">
    <!-- Empty State: Weak prompt with add child button -->
    <div
      v-if="profileStore.profileCount === 0"
      class="flex items-center justify-between gap-3 px-3 py-1.5 bg-amber-50/90 border border-amber-200/80 rounded-xl"
    >
      <div class="flex items-center gap-1.5 text-xs text-amber-900 font-medium">
        <svg class="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ t('profile.switcher.noChild') }}</span>
      </div>
      <button
        type="button"
        @click="openCreateModal"
        class="h-9 px-3 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 active:bg-teal-800 transition shadow-sm flex items-center gap-1 min-h-[44px]"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span>{{ t('profile.switcher.addPrompt') }}</span>
      </button>
    </div>

    <!-- Active Profile Trigger (Touch friendly >= 44px) -->
    <div v-else class="flex items-center gap-2">
      <button
        type="button"
        @click="toggleDropdown"
        class="flex items-center gap-2.5 text-left py-1 px-2.5 rounded-xl border border-slate-200 hover:border-teal-500/50 hover:bg-slate-50 active:bg-slate-100 transition min-h-[44px]"
        :aria-expanded="dropdownOpen"
      >
        <!-- Child Avatar -->
        <div class="relative w-8 h-8 rounded-full overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0 flex items-center justify-center">
          <img
            v-if="profileStore.activeProfile?.avatarUrl"
            :src="profileStore.activeProfile.avatarUrl"
            class="w-full h-full object-cover"
            :alt="profileStore.activeProfile.nickname"
          />
          <span v-else class="text-xs font-bold text-teal-700">
            {{ profileStore.activeProfile?.surnameInitial || 'D' }}
          </span>
        </div>

        <!-- Nickname & Summary -->
        <div class="flex flex-col min-w-0 pr-1">
          <div class="flex items-center gap-1.5 leading-tight">
            <span class="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {{ profileStore.activeProfile?.nickname || 'Select Child' }}
            </span>
            <span class="text-[11px] text-slate-500 font-normal shrink-0">
              ({{ profileStore.activeProfile?.age }}{{ t('profile.switcher.ageSuffix') }})
            </span>
            <svg
              class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0"
              :class="dropdownOpen ? 'rotate-180 text-teal-600' : ''"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <span class="text-[10px] text-slate-400 truncate mt-0.5">
            {{ profileStore.activeProfile?.realName || '' }} · {{ profileStore.profileCount }}/10
          </span>
        </div>
      </button>

      <!-- Quick Add Child Button (Desktop & Tablet) -->
      <button
        type="button"
        v-if="!profileStore.isMaxProfiles"
        @click="openCreateModal"
        class="w-9 h-9 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-teal-600 hover:border-teal-500 grid place-items-center transition min-w-[44px] min-h-[44px]"
        :title="t('profile.switcher.addStudent')"
        :aria-label="t('profile.switcher.addStudent')"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Dropdown Menu / Bottom Sheet overlay on mobile -->
    <div
      v-if="dropdownOpen"
      class="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-xs sm:hidden"
      @click="closeDropdown"
    ></div>

    <div
      v-if="dropdownOpen"
      class="absolute right-0 sm:left-0 sm:right-auto top-full mt-2 w-72 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-slate-200 py-2 px-2 z-50 animate-in fade-in zoom-in-95 duration-150"
    >
      <div class="px-2.5 py-1.5 flex items-center justify-between text-xs text-slate-400 border-b border-slate-100 mb-1">
        <span class="font-semibold text-slate-600">{{ t('profile.switcher.title') }}</span>
        <span class="font-mono text-[11px]">{{ t('profile.switcher.countSummary', { current: profileStore.profileCount }) }}</span>
      </div>

      <!-- Profile Items List -->
      <div class="max-h-60 overflow-y-auto space-y-1 py-1">
        <button
          type="button"
          v-for="p in profileStore.profiles"
          :key="p.id"
          @click="selectChild(p.id)"
          class="w-full flex items-center justify-between p-2 rounded-xl text-left transition min-h-[44px]"
          :class="p.id === profileStore.activeProfileId ? 'bg-teal-50 text-teal-900' : 'hover:bg-slate-50 text-slate-700'"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-full overflow-hidden bg-slate-100 ring-1 ring-slate-200 shrink-0 flex items-center justify-center">
              <img
                v-if="p.avatarUrl"
                :src="p.avatarUrl"
                class="w-full h-full object-cover"
                :alt="p.nickname"
              />
              <span v-else class="text-xs font-bold text-teal-700">
                {{ p.surnameInitial || 'D' }}
              </span>
            </div>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-1.5 truncate">
                <span class="text-xs font-bold truncate">{{ p.nickname }}</span>
                <span class="text-[11px] text-slate-400 shrink-0">({{ p.age }}{{ t('profile.switcher.ageSuffix') }})</span>
              </div>
              <span class="text-[10px] text-slate-400 truncate">{{ p.realName }}</span>
            </div>
          </div>

          <svg
            v-if="p.id === profileStore.activeProfileId"
            class="w-4 h-4 text-teal-600 shrink-0 ml-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>

      <!-- Add Child Action in Dropdown -->
      <div class="pt-2 mt-1 border-t border-slate-100">
        <button
          type="button"
          :disabled="profileStore.isMaxProfiles"
          @click="openCreateModal"
          class="w-full h-11 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition min-h-[44px]"
          :class="profileStore.isMaxProfiles ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 text-teal-700 hover:bg-teal-50 active:bg-teal-100'"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>
            {{ profileStore.isMaxProfiles ? t('profile.switcher.maxReached') : `${t('profile.switcher.addStudent')} (${profileStore.profileCount}/10)` }}
          </span>
        </button>
      </div>
    </div>

    <!-- Student Create/Edit Modal Mount -->
    <StudentCreateModal
      v-model="createModalVisible"
      @success="handleProfileCreated"
      @close="createModalVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useProfileStore } from '../stores/profile';
import StudentCreateModal from './StudentCreateModal.vue';
import type { StudentProfileDto } from '../types';

const { t } = useI18n();
const profileStore = useProfileStore();

const dropdownOpen = ref<boolean>(false);
const createModalVisible = ref<boolean>(false);

onMounted(async () => {
  if (profileStore.profiles.length === 0) {
    try {
      await profileStore.fetchProfiles();
    } catch {
      // Ignore network errors on init
    }
  }
});

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value;
}

function closeDropdown() {
  dropdownOpen.value = false;
}

function selectChild(id: string) {
  profileStore.selectProfile(id);
  closeDropdown();
}

function openCreateModal() {
  if (profileStore.isMaxProfiles) return;
  closeDropdown();
  createModalVisible.value = true;
}

function handleProfileCreated(_created: StudentProfileDto) {
  createModalVisible.value = false;
}
</script>
