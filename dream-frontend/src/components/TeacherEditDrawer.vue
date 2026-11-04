<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex justify-end bg-black/50 transition-opacity"
    @click.self="close"
  >
    <div
      class="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl transition-transform"
      role="dialog"
      aria-modal="true"
    >
      <!-- 抽屉头部 -->
      <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 class="text-lg font-bold text-gray-900">
          {{ isEdit ? '编辑教师档案' : '录入新教师档案' }}
        </h2>
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

      <!-- 表单内容区 (支持滚动) -->
      <form class="flex-1 overflow-y-auto px-6 py-5 space-y-6" @submit.prevent="handleSubmit">
        <!-- 错误提示 Banner -->
        <div v-if="errorText" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {{ errorText }}
        </div>

        <!-- 教师名称 -->
        <div>
          <label class="block text-sm font-medium text-gray-700">
            教师显示姓名 <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.displayName"
            type="text"
            required
            maxlength="64"
            placeholder="例如: Teacher Sarah"
            class="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <!-- 教师级别 -->
        <div>
          <label class="block text-sm font-medium text-gray-700">
            教师定级 <span class="text-red-500">*</span>
          </label>
          <select
            v-model="form.levelId"
            required
            class="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="" disabled>请选择定级</option>
            <option v-for="level in levels" :key="level.id" :value="level.id">
              {{ level.name }}
            </option>
          </select>
        </div>

        <!-- 擅长课程类型 (多选) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            擅长课程类型 <span class="text-red-500">*</span> (至少选择一项)
          </label>
          <div class="grid grid-cols-2 gap-2">
            <label
              v-for="type in courseTypes"
              :key="type.id"
              class="flex items-center gap-2 rounded-xl border p-3 cursor-pointer text-sm"
              :class="form.skillCourseTypeIds.includes(type.id) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700'"
            >
              <input
                type="checkbox"
                :value="type.id"
                v-model="form.skillCourseTypeIds"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span class="truncate">{{ type.name }}</span>
            </label>
          </div>
        </div>

        <!-- 照片上传 (本地 Canvas 裁剪 1:1 WebP 直传) -->
        <div>
          <label class="block text-sm font-medium text-gray-700">教师个人照片 (WebP 直传)</label>
          <div class="mt-2 flex items-center gap-4">
            <div class="h-16 w-16 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              <img v-if="photoPreviewUrl" :src="photoPreviewUrl" class="h-full w-full object-cover" />
              <div v-else class="flex h-full w-full items-center justify-center text-xs text-gray-400">无照片</div>
            </div>
            <label class="min-h-[44px] cursor-pointer inline-flex items-center justify-center rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
              <span>{{ isUploadingPhoto ? '上传中...' : '选择并裁剪照片' }}</span>
              <input type="file" accept="image/*" class="sr-only" :disabled="isUploadingPhoto" @change="handlePhotoSelect" />
            </label>
          </div>
        </div>

        <!-- 介绍视频上传 (MP4 <= 50MB 客户端直传带进度) -->
        <div>
          <label class="block text-sm font-medium text-gray-700">介绍视频 (MP4, 最大 50MB)</label>
          <div class="mt-2">
            <label class="min-h-[44px] cursor-pointer inline-flex items-center justify-center rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
              <span>{{ isUploadingVideo ? `上传中 (${videoProgress}%)` : (form.videoKey ? '更换介绍视频' : '选择视频文件') }}</span>
              <input type="file" accept="video/mp4" class="sr-only" :disabled="isUploadingVideo" @change="handleVideoSelect" />
            </label>
            <!-- 进度条 -->
            <div v-if="isUploadingVideo" class="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div class="h-full bg-blue-600 transition-all duration-200" :style="{ width: `${videoProgress}%` }"></div>
            </div>
            <p v-if="form.videoKey" class="mt-1 text-xs text-green-600 truncate">
              已就绪: {{ form.videoKey }}
            </p>
          </div>
        </div>

        <!-- ClassIn 二维码上传 -->
        <div>
          <label class="block text-sm font-medium text-gray-700">ClassIn 群/好友二维码</label>
          <div class="mt-2 flex items-center gap-4">
            <div class="h-16 w-16 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              <img v-if="qrPreviewUrl" :src="qrPreviewUrl" class="h-full w-full object-contain" />
              <div v-else class="flex h-full w-full items-center justify-center text-xs text-gray-400">无二维码</div>
            </div>
            <label class="min-h-[44px] cursor-pointer inline-flex items-center justify-center rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
              <span>{{ isUploadingQr ? '上传中...' : '上传二维码' }}</span>
              <input type="file" accept="image/*" class="sr-only" :disabled="isUploadingQr" @change="handleQrSelect" />
            </label>
          </div>
        </div>

        <!-- 中文简介 -->
        <div>
          <label class="block text-sm font-medium text-gray-700">
            中文简介 <span class="text-red-500">*</span> (至少10字)
          </label>
          <textarea
            v-model="form.introZh"
            rows="3"
            required
            minlength="10"
            maxlength="2000"
            placeholder="请输入教师中文履历与教学风格..."
            class="mt-1 block w-full rounded-xl border border-gray-300 p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          ></textarea>
        </div>

        <!-- 英文简介 -->
        <div>
          <label class="block text-sm font-medium text-gray-700">
            英文简介 <span class="text-red-500">*</span> (至少20字)
          </label>
          <textarea
            v-model="form.introEn"
            rows="3"
            required
            minlength="20"
            maxlength="2000"
            placeholder="Please enter teacher's English introduction..."
            class="mt-1 block w-full rounded-xl border border-gray-300 p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          ></textarea>
        </div>

        <!-- 底部提交按钮 -->
        <div class="pt-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            class="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            @click="close"
          >
            取消
          </button>
          <button
            type="submit"
            :disabled="isSubmitting || isUploadingPhoto || isUploadingVideo || isUploadingQr"
            class="min-h-[44px] flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {{ isSubmitting ? '正在保存...' : '确认保存' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import type {
  TeacherDetailDto,
  CourseTypeDto,
  TeacherLevelDto,
  CreateTeacherProfileInput,
} from '../types';
import { getPresignedUploadUrl, uploadFileToPresignedUrl } from '../api/file';

const props = defineProps<{
  visible: boolean;
  teacher?: TeacherDetailDto | null;
  levels: TeacherLevelDto[];
  courseTypes: CourseTypeDto[];
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'save', data: CreateTeacherProfileInput): void;
}>();

const isEdit = ref(false);
const isSubmitting = ref(false);
const errorText = ref<string | null>(null);

const photoPreviewUrl = ref<string | null>(null);
const qrPreviewUrl = ref<string | null>(null);
const isUploadingPhoto = ref(false);
const isUploadingVideo = ref(false);
const videoProgress = ref(0);
const isUploadingQr = ref(false);

const form = reactive({
  displayName: '',
  levelId: '',
  skillCourseTypeIds: [] as string[],
  introZh: '',
  introEn: '',
  photoKey: undefined as string | undefined,
  videoKey: undefined as string | undefined,
  classinQrKey: undefined as string | undefined,
});

watch(
  () => props.visible,
  (val) => {
    if (val) {
      errorText.value = null;
      if (props.teacher) {
        isEdit.value = true;
        form.displayName = props.teacher.displayName;
        form.levelId = props.teacher.levelId;
        form.skillCourseTypeIds = [...props.teacher.skillCourseTypeIds];
        form.introZh = props.teacher.introZh;
        form.introEn = props.teacher.introEn;
        form.photoKey = props.teacher.photoKey || undefined;
        form.videoKey = props.teacher.videoKey || undefined;
        form.classinQrKey = props.teacher.classinQrKey || undefined;
        photoPreviewUrl.value = props.teacher.photoUrl || null;
        qrPreviewUrl.value = props.teacher.classinQrUrl || null;
      } else {
        isEdit.value = false;
        form.displayName = '';
        form.levelId = props.levels[0]?.id || '';
        form.skillCourseTypeIds = [];
        form.introZh = '';
        form.introEn = '';
        form.photoKey = undefined;
        form.videoKey = undefined;
        form.classinQrKey = undefined;
        photoPreviewUrl.value = null;
        qrPreviewUrl.value = null;
      }
    }
  }
);

function close() {
  emit('update:visible', false);
}

// 图片转 WebP 裁剪
async function cropImageToWebp(file: File, size: number = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      const minEdge = Math.min(img.width, img.height);
      const sx = (img.width - minEdge) / 2;
      const sy = (img.height - minEdge) / 2;

      ctx.drawImage(img, sx, sy, minEdge, minEdge, 0, 0, size, size);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('WebP blob conversion failed'));
        },
        'image/webp',
        0.85
      );
    };
    img.onerror = () => reject(new Error('Failed to load image for crop'));
    img.src = url;
  });
}

// 照片选择处理
async function handlePhotoSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  isUploadingPhoto.value = true;
  errorText.value = null;
  try {
    const croppedBlob = await cropImageToWebp(file, 400);
    const presigned = await getPresignedUploadUrl({
      bizType: 'teacher_photo',
      contentType: 'image/webp',
      contentLength: croppedBlob.size,
    });

    await uploadFileToPresignedUrl(presigned.uploadUrl, croppedBlob, 'image/webp');
    form.photoKey = presigned.key;
    photoPreviewUrl.value = URL.createObjectURL(croppedBlob);
  } catch (err: any) {
    errorText.value = `照片上传失败: ${err.message}`;
  } finally {
    isUploadingPhoto.value = false;
  }
}

// 视频选择处理
async function handleVideoSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  if (file.size > 50 * 1024 * 1024) {
    errorText.value = '视频体积不能超过 50MB';
    return;
  }

  isUploadingVideo.value = true;
  videoProgress.value = 0;
  errorText.value = null;

  try {
    const presigned = await getPresignedUploadUrl({
      bizType: 'teacher_video',
      contentType: 'video/mp4',
      contentLength: file.size,
    });

    await uploadFileToPresignedUrl(presigned.uploadUrl, file, 'video/mp4', (progress) => {
      videoProgress.value = progress;
    });

    form.videoKey = presigned.key;
  } catch (err: any) {
    errorText.value = `视频上传失败: ${err.message}`;
  } finally {
    isUploadingVideo.value = false;
  }
}

// ClassIn 二维码选择处理
async function handleQrSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  isUploadingQr.value = true;
  errorText.value = null;
  try {
    const croppedBlob = await cropImageToWebp(file, 600);
    const presigned = await getPresignedUploadUrl({
      bizType: 'teacher_classin_qr',
      contentType: 'image/webp',
      contentLength: croppedBlob.size,
    });

    await uploadFileToPresignedUrl(presigned.uploadUrl, croppedBlob, 'image/webp');
    form.classinQrKey = presigned.key;
    qrPreviewUrl.value = URL.createObjectURL(croppedBlob);
  } catch (err: any) {
    errorText.value = `二维码上传失败: ${err.message}`;
  } finally {
    isUploadingQr.value = false;
  }
}

function handleSubmit() {
  if (form.skillCourseTypeIds.length === 0) {
    errorText.value = '请至少勾选一项擅长课程类型';
    return;
  }
  emit('save', {
    displayName: form.displayName,
    levelId: form.levelId,
    skillCourseTypeIds: form.skillCourseTypeIds,
    introZh: form.introZh,
    introEn: form.introEn,
    photoKey: form.photoKey,
    videoKey: form.videoKey,
    classinQrKey: form.classinQrKey,
  });
}
</script>
