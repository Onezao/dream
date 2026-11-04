<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <main class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
    <!-- Parent Workspace Active Child Card & Schedule -->
    <section v-if="workspaceStore.currentWorkspace === 'parent'" class="space-y-4">
      <!-- Empty Child Weak Guide -->
      <div
        v-if="profileStore.profileCount === 0"
        class="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-5 text-amber-900 space-y-3"
      >
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="text-xs leading-relaxed">
            <span class="font-bold block text-sm mb-1 text-amber-950">欢迎来到 Dream 少儿教务系统</span>
            当前账号暂未绑定学员档案。您可以随时浏览公开名师与排期，预约排课前系统将引导您添加宝贝档案。
          </div>
        </div>
        <div class="pt-1 flex items-center gap-3">
          <router-link
            to="/profile"
            class="h-10 px-4 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition inline-flex items-center gap-1.5 shadow-sm min-h-[44px]"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>添加第一个孩子档案</span>
          </router-link>
        </div>
      </div>

      <!-- Active Child Card -->
      <div v-else class="space-y-4">
        <div class="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3.5">
              <div class="relative w-12 h-12 rounded-full overflow-hidden bg-slate-100 ring-2 ring-teal-500/30 shrink-0 flex items-center justify-center">
                <img
                  v-if="profileStore.activeProfile?.avatarUrl"
                  :src="profileStore.activeProfile.avatarUrl"
                  class="w-full h-full object-cover"
                  :alt="profileStore.activeProfile.nickname"
                />
                <span v-else class="text-base font-bold text-teal-700">
                  {{ profileStore.activeProfile?.surnameInitial || 'D' }}
                </span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-900 text-base sm:text-lg">
                    {{ profileStore.activeProfile?.nickname }}
                  </span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 font-medium">
                    {{ profileStore.activeProfile?.gender === 'female' ? '女孩' : profileStore.activeProfile?.gender === 'male' ? '男孩' : '宝贝' }} · {{ profileStore.activeProfile?.age }}岁
                  </span>
                </div>
                <div class="text-xs text-slate-500 mt-0.5">
                  真实姓名: {{ profileStore.activeProfile?.realName }} · 档案ID: <span class="font-mono text-slate-400">{{ profileStore.activeProfile?.id }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <router-link
                to="/profile"
                class="h-9 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 transition flex items-center gap-1 min-h-[44px]"
              >
                <span>管理多孩 ({{ profileStore.profileCount }}/10)</span>
              </router-link>
            </div>
          </div>
        </div>

        <!-- Weekly Schedule Preview (7-color calendar preview) -->
        <div class="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold text-slate-900">
              {{ profileStore.activeProfile?.nickname }} 的当周课表
            </span>
            <span class="text-xs text-teal-600 font-semibold cursor-pointer hover:underline">
              完整日历 &rarr;
            </span>
          </div>
          <div class="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
            本周暂无已排课次，快去约课吧
          </div>
        </div>
      </div>
    </section>

    <!-- General System Status Card -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-gray-900">Dream 教务排班与分账系统</h1>
        <span class="text-xs font-medium px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">
          Phase 4 多孩中心就绪
        </span>
      </div>

      <p class="text-sm text-gray-600 leading-relaxed">
        系统已完成 Monorepo 骨架、多角色工作台物理隔离以及多孩全局档案切换器（Profile Switcher）、规范昵称实时防抖查重与学员建档/编辑能力。
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
        <div class="p-3 bg-gray-50 rounded-lg space-y-1">
          <span class="text-gray-500 font-medium">当前工作台模式</span>
          <p class="text-sm font-semibold text-gray-800">{{ workspaceStore.currentWorkspace }}</p>
        </div>
        <div class="p-3 bg-gray-50 rounded-lg space-y-1">
          <span class="text-gray-500 font-medium">单 Schema 约束</span>
          <p class="text-sm font-semibold text-gray-800">PostgreSQL (dream.*)</p>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useWorkspaceStore } from '../stores/workspace';
import { useProfileStore } from '../stores/profile';

const workspaceStore = useWorkspaceStore();
const profileStore = useProfileStore();

onMounted(async () => {
  if (profileStore.profiles.length === 0) {
    try {
      await profileStore.fetchProfiles();
    } catch {
      // Ignore initial load error
    }
  }
});
</script>
