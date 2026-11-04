<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity"
    @click.self="close"
  >
    <div
      class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl transition-all"
      role="dialog"
      aria-modal="true"
    >
      <div class="flex items-center justify-between pb-3 border-b border-gray-100">
        <h3 class="text-base font-semibold text-gray-900">
          {{ teacherName }} 的 ClassIn 二维码
        </h3>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none"
          @click="close"
        >
          <span class="sr-only">关闭</span>
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="my-6 flex flex-col items-center justify-center">
        <div v-if="qrUrl" class="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-2 shadow-inner">
          <img
            :src="qrUrl"
            :alt="`${teacherName} ClassIn 二维码`"
            class="h-64 w-64 object-contain"
          />
        </div>
        <div v-else class="flex h-64 w-64 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-400">
          暂无 ClassIn 二维码
        </div>
        <p class="mt-4 text-xs text-gray-500">
          长按或截屏识别二维码，添加教师入群交流
        </p>
      </div>

      <button
        type="button"
        class="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 active:bg-blue-800"
        @click="close"
      >
        我知道了
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  qrUrl: string | null;
  teacherName: string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
}>();

function close() {
  emit('update:visible', false);
}
</script>
