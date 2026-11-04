<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->

<template>
  <div class="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
    <!-- 头部：班级基本信息 -->
    <div class="flex items-start justify-between gap-3 p-5 pb-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="truncate text-lg font-bold text-gray-900">
            {{ classItem.name }}
          </h3>
          <!-- 状态徽标 -->
          <span
            v-if="classItem.isFull"
            class="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"
          >
            {{ $t('classes.full') }}
          </span>
          <span
            v-else-if="classItem.status === 'recruiting'"
            class="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
          >
            {{ $t('classes.recruiting') }}
          </span>
          <span
            v-else-if="classItem.status === 'active'"
            class="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
          >
            {{ $t('classes.active') }}
          </span>
        </div>

        <div class="mt-1 flex items-center gap-2 text-xs text-gray-500">
          <span class="inline-block rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
            {{ classItem.courseTypeName }}
          </span>
          <span class="text-gray-400">|</span>
          <span>{{ classItem.plannedStartDate ? $t('classes.plannedStart', { date: classItem.plannedStartDate }) : $t('classes.noPlannedDate') }}</span>
        </div>
      </div>
    </div>

    <!-- 中部：授课外教与当前人数 -->
    <div class="flex items-center justify-between border-t border-b border-gray-50 bg-gray-50/50 px-5 py-3">
      <!-- 教师信息 -->
      <div class="flex items-center gap-3 min-w-0">
        <div class="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
          <img
            v-if="classItem.teacherPhotoUrl"
            :src="classItem.teacherPhotoUrl"
            :alt="classItem.teacherDisplayName"
            class="h-full w-full object-cover"
            loading="lazy"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center text-sm font-bold text-gray-500"
          >
            {{ classItem.teacherDisplayName.charAt(0) }}
          </div>
        </div>
        <div class="min-w-0">
          <div class="text-xs text-gray-400">{{ $t('classes.teacher') }}</div>
          <div class="truncate text-sm font-semibold text-gray-800">
            {{ classItem.teacherDisplayName }}
          </div>
        </div>
      </div>

      <!-- 招募进度 -->
      <div class="text-right">
        <div class="flex items-center justify-end gap-1 text-sm font-bold">
          <span :class="classItem.isFull ? 'text-red-600' : 'text-blue-600'">
            {{ classItem.enrolledCount }}
          </span>
          <span class="text-gray-400">/</span>
          <span class="text-gray-600">{{ classItem.maxStudents }}人</span>
        </div>
        <div class="text-[11px] text-gray-400">
          {{ $t('classes.minStudentsTip', { min: classItem.minStudents }) }}
        </div>
      </div>
    </div>

    <!-- 底部操作区 -->
    <div class="p-5 pt-3">
      <!-- 进度条 -->
      <div class="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="classItem.isFull ? 'bg-red-500' : 'bg-blue-600'"
          :style="{ width: `${Math.min(100, Math.round((classItem.enrolledCount / classItem.maxStudents) * 100))}%` }"
        ></div>
      </div>

      <button
        type="button"
        :disabled="classItem.isFull || isOffline"
        class="flex min-h-[44px] w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed"
        :class="
          classItem.isFull
            ? 'bg-gray-100 text-gray-400'
            : isOffline
            ? 'bg-gray-100 text-gray-400'
            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
        "
        @click="$emit('enroll', classItem.id)"
      >
        <span v-if="isOffline">{{ $t('classes.offlineBlocked') }}</span>
        <span v-else-if="classItem.isFull">{{ $t('classes.fullDisabled') }}</span>
        <span v-else>{{ $t('classes.joinNow') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PublicSmallGroupClassDto } from '../types';

const props = defineProps<{
  classItem: PublicSmallGroupClassDto;
  isOffline?: boolean;
}>();

defineEmits<{
  (e: 'enroll', classId: string): void;
}>();
</script>
