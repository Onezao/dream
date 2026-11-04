<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
  >
    <div
      class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
      role="dialog"
      aria-modal="true"
    >
      <!-- 头部 -->
      <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h3 class="text-base font-bold text-gray-900">
          {{ $t('classes.createClass') }}
        </h3>
        <button
          type="button"
          class="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600"
          @click="onClose"
        >
          ✕
        </button>
      </div>

      <!-- 表单主体 -->
      <form class="space-y-4 px-6 py-4" @submit.prevent="handleSubmit">
        <!-- 班级名称 -->
        <div>
          <label class="block text-xs font-semibold text-gray-700">
            {{ $t('classes.nameLabel') }} <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.name"
            type="text"
            required
            :placeholder="$t('classes.namePlaceholder')"
            class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <!-- 课程类型选择 -->
        <div>
          <label class="block text-xs font-semibold text-gray-700">
            {{ $t('classes.courseType') }} <span class="text-red-500">*</span>
          </label>
          <select
            v-model="form.courseTypeId"
            required
            class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="" disabled>{{ $t('classes.selectCourseType') }}</option>
            <option
              v-for="item in courseTypes"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option>
          </select>
        </div>

        <!-- 授课外教选择 -->
        <div>
          <label class="block text-xs font-semibold text-gray-700">
            {{ $t('classes.teacher') }} <span class="text-red-500">*</span>
          </label>
          <select
            v-model="form.teacherProfileId"
            required
            class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="" disabled>{{ $t('classes.selectTeacher') }}</option>
            <option
              v-for="t in teachers"
              :key="t.id"
              :value="t.id"
            >
              {{ t.displayName }}
            </option>
          </select>
        </div>

        <!-- 人数容量 (两栏网格) -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-700">
              {{ $t('classes.minStudentsLabel') }}
            </label>
            <input
              v-model.number="form.minStudents"
              type="number"
              min="1"
              :max="form.maxStudents"
              class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-700">
              {{ $t('classes.maxStudentsLabel') }}
            </label>
            <input
              v-model.number="form.maxStudents"
              type="number"
              min="1"
              max="20"
              class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <!-- 课酬与抽佣 (两栏网格) -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-700">
              {{ $t('classes.salaryPointsLabel') }}
            </label>
            <input
              v-model.number="form.teacherSalaryPoints"
              type="number"
              min="0"
              class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-700">
              {{ $t('classes.commissionRateLabel') }}
            </label>
            <input
              v-model.number="form.platformCommissionRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <!-- 计划开课日期 -->
        <div>
          <label class="block text-xs font-semibold text-gray-700">
            {{ $t('classes.plannedStartDateLabel') }} <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.plannedStartDate"
            type="date"
            required
            class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <!-- 错误提示 -->
        <div v-if="error" class="rounded-xl bg-red-50 p-3 text-xs text-red-600">
          {{ error }}
        </div>

        <!-- 底部提交按钮 -->
        <div class="flex items-center justify-end gap-3 pt-3">
          <button
            type="button"
            class="min-h-[44px] min-w-[80px] rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            @click="onClose"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="min-h-[44px] min-w-[100px] rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <span v-if="isSubmitting">{{ $t('common.loading') }}</span>
            <span v-else>{{ $t('common.save') }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import type {
  CreateSmallGroupClassInput,
  CourseTypeDto,
  TeacherDetailDto,
} from '../types';

defineProps<{
  visible: boolean;
  courseTypes: CourseTypeDto[];
  teachers: TeacherDetailDto[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', form: CreateSmallGroupClassInput): void;
}>();

const form = reactive<CreateSmallGroupClassInput>({
  name: '',
  courseTypeId: '',
  teacherProfileId: '',
  minStudents: 2,
  maxStudents: 4,
  teacherSalaryPoints: 0,
  platformCommissionRate: 0.0,
  plannedStartDate: '',
});

const isSubmitting = ref(false);
const error = ref<string | null>(null);

function onClose(): void {
  error.value = null;
  emit('close');
}

function handleSubmit(): void {
  if (form.minStudents! > form.maxStudents!) {
    error.value = '最少开班人数不能大于最大容纳人数';
    return;
  }
  error.value = null;
  emit('submit', { ...form });
}
</script>
