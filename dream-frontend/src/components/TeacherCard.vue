<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->

<template>
  <div class="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
    <!-- 头部：教师基础信息与照片 -->
    <div class="flex items-start gap-4 p-5">
      <!-- 教师头像/照片 -->
      <div class="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-blue-50">
        <img
          v-if="teacher.photoUrl"
          :src="teacher.photoUrl"
          :alt="teacher.displayName"
          class="h-full w-full object-cover"
          loading="lazy"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center text-xl font-bold text-blue-600"
        >
          {{ teacher.displayName.charAt(0) }}
        </div>
      </div>

      <!-- 姓名、定级与负责班长 -->
      <div class="flex flex-1 flex-col justify-center min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="truncate text-lg font-bold text-gray-900">
            {{ teacher.displayName }}
          </h3>
          <span class="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {{ teacher.levelName }}
          </span>
        </div>

        <div class="mt-1 flex items-center text-xs text-gray-500">
          <span class="truncate">负责班长：{{ teacher.monitorDisplayName }}</span>
        </div>

        <!-- 擅长课程标签 -->
        <div class="mt-2 flex flex-wrap gap-1">
          <span
            v-for="skill in teacher.skillCourseTypes"
            :key="skill.id"
            class="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
          >
            {{ skill.name }}
          </span>
        </div>
      </div>
    </div>

    <!-- 视频试讲原位播放区 (若有) -->
    <div v-if="teacher.videoUrl" class="px-5 pb-3">
      <div class="overflow-hidden rounded-xl bg-black">
        <video
          :src="teacher.videoUrl"
          controls
          playsinline
          preload="metadata"
          class="w-full max-h-56 object-contain"
        >
          您的浏览器不支持视频播放
        </video>
      </div>
    </div>

    <!-- 简介区与双语切换 -->
    <div class="flex-1 px-5 pb-4">
      <div class="flex items-center justify-between border-b border-gray-100 pb-2">
        <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {{ showEnglish ? 'English Bio' : '教师简介' }}
        </span>
        <button
          type="button"
          class="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs font-medium text-blue-600 hover:text-blue-800"
          @click="showEnglish = !showEnglish"
        >
          {{ showEnglish ? '切至中文' : 'Switch to EN' }}
        </button>
      </div>

      <p class="mt-2 text-sm leading-relaxed text-gray-700 whitespace-pre-line">
        {{ showEnglish ? teacher.introEn : teacher.introZh }}
      </p>
    </div>

    <!-- 底部操作栏：ClassIn 二维码联络 -->
    <div class="border-t border-gray-100 bg-gray-50/50 p-4">
      <button
        type="button"
        class="min-h-[44px] w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:bg-gray-100"
        @click="showQrModal = true"
      >
        <svg class="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        <span>查看 ClassIn 二维码</span>
      </button>
    </div>

    <!-- 二维码弹窗 -->
    <ClassInQrModal
      v-model:visible="showQrModal"
      :qr-url="teacher.classinQrUrl"
      :teacher-name="teacher.displayName"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { TeacherCardDto } from '../types';
import ClassInQrModal from './ClassInQrModal.vue';

defineProps<{
  teacher: TeacherCardDto;
}>();

const showEnglish = ref(false);
const showQrModal = ref(false);
</script>
