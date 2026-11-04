<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
  >
    <div
      class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl transition-all"
      role="dialog"
      aria-modal="true"
    >
      <!-- 弹窗标题 -->
      <div class="border-b border-gray-100 px-6 py-4">
        <h3 class="text-base font-bold text-gray-900">
          {{ isCancelMode ? $t('classes.cancelConfirmTitle') : $t('classes.forceStartConfirmTitle') }}
        </h3>
      </div>

      <!-- 弹窗主体内容 -->
      <div class="px-6 py-4">
        <!-- 提示说明 -->
        <p class="text-sm text-gray-600 leading-relaxed">
          <template v-if="isCancelMode">
            {{ $t('classes.cancelConfirmDesc') }}
          </template>
          <template v-else>
            {{
              $t('classes.forceStartConfirmDesc', {
                count: classItem?.enrolledCount ?? 0,
                min: classItem?.minStudents ?? 2,
              })
            }}
          </template>
        </p>

        <!-- 取消原因输入框 (仅取消模式) -->
        <div v-if="isCancelMode" class="mt-4">
          <textarea
            v-model="cancelReason"
            rows="3"
            :placeholder="$t('classes.cancelReasonPlaceholder')"
            class="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          ></textarea>
          <div v-if="reasonError" class="mt-1 text-xs text-red-500">
            {{ reasonError }}
          </div>
        </div>

        <!-- 离线提示 -->
        <div v-if="isOffline" class="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
          {{ $t('classes.offlineBlocked') }}
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
        <button
          type="button"
          class="min-h-[44px] min-w-[80px] rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          @click="onClose"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          type="button"
          :disabled="isOffline || isSubmitting"
          class="min-h-[44px] min-w-[100px] rounded-xl px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-300"
          :class="isCancelMode ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'"
          @click="onConfirm"
        >
          <span v-if="isSubmitting">{{ $t('common.loading') }}</span>
          <span v-else>{{ $t('common.confirm') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MonitorClassDto } from '../types';

const props = defineProps<{
  visible: boolean;
  mode: 'force-start' | 'cancel';
  classItem: MonitorClassDto | null;
  isOffline?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', payload: { reason?: string }): void;
}>();

const { t } = useI18n();
const cancelReason = ref('');
const reasonError = ref<string | null>(null);
const isSubmitting = ref(false);

const isCancelMode = computed(() => props.mode === 'cancel');

function onClose(): void {
  cancelReason.value = '';
  reasonError.value = null;
  emit('close');
}

function onConfirm(): void {
  if (isCancelMode.value) {
    const trimmed = cancelReason.value.trim();
    if (trimmed.length < 2) {
      reasonError.value = t('classes.cancelReasonRequired');
      return;
    }
    reasonError.value = null;
    emit('confirm', { reason: trimmed });
  } else {
    emit('confirm', {});
  }
}
</script>
