<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4"
    @click.self="handleClose"
  >
    <div
      class="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100"
    >
      <!-- Modal Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div>
          <h2 class="text-base sm:text-lg font-bold text-slate-900">
            {{ isEditMode ? t('profile.modal.editTitle') : t('profile.modal.createTitle') }}
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">
            {{ t('profile.modal.previewSubtitle') }}
          </p>
        </div>
        <button
          type="button"
          @click="handleClose"
          class="w-11 h-11 -mr-2 rounded-xl grid place-items-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition min-w-[44px] min-h-[44px]"
          :aria-label="t('common.close')"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-left">
        <!-- Avatar Uploader & Canvas Cropper -->
        <div class="flex items-center gap-4">
          <label
            for="avatar-upload-input"
            class="relative w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-slate-100 ring-2 ring-slate-200 grid place-items-center overflow-hidden cursor-pointer shrink-0 hover:ring-teal-500 transition"
          >
            <img
              v-if="avatarDataUrl"
              :src="avatarDataUrl"
              class="w-full h-full object-cover"
              alt="Avatar"
            />
            <div v-else class="flex flex-col items-center justify-center text-slate-400">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <circle cx="12" cy="13" r="3" stroke-width="1.8" />
              </svg>
            </div>
            <input
              id="avatar-upload-input"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleAvatarFileSelect"
            />
          </label>
          <div class="text-xs flex-1">
            <label
              for="avatar-upload-input"
              class="inline-flex items-center justify-center h-11 px-4 rounded-xl ring-1 ring-slate-200 text-slate-700 font-medium cursor-pointer hover:bg-slate-50 transition min-h-[44px]"
            >
              {{ t('profile.modal.choosePhoto') }}
            </label>
            <p class="text-slate-500 mt-1.5 leading-relaxed">
              {{ avatarCroppedInfo || t('profile.modal.avatarHint') }}
            </p>
          </div>
        </div>

        <!-- Real Name -->
        <div>
          <label for="student-real-name" class="block text-xs font-semibold text-slate-700 mb-1.5">
            {{ t('profile.modal.realName') }} <span class="text-rose-500">*</span>
          </label>
          <input
            id="student-real-name"
            v-model.trim="form.realName"
            type="text"
            maxlength="32"
            :placeholder="t('profile.modal.realNamePlaceholder')"
            class="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm bg-white transition"
          />
        </div>

        <!-- English Name, Initial, Age Grid -->
        <div class="grid grid-cols-[1fr_80px_80px] gap-2.5">
          <div>
            <label for="student-en-name" class="block text-xs font-semibold text-slate-700 mb-1.5">
              {{ t('profile.modal.englishName') }} <span class="text-rose-500">*</span>
            </label>
            <input
              id="student-en-name"
              v-model.trim="form.englishName"
              type="text"
              maxlength="24"
              :disabled="isEditMode"
              :placeholder="t('profile.modal.englishNamePlaceholder')"
              class="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400 transition"
              @input="onNicknameInput"
            />
          </div>
          <div>
            <label for="student-surname-initial" class="block text-xs font-semibold text-slate-700 mb-1.5 text-center">
              {{ t('profile.modal.surnameInitial') }} <span class="text-rose-500">*</span>
            </label>
            <input
              id="student-surname-initial"
              v-model.trim="form.surnameInitial"
              type="text"
              maxlength="1"
              :disabled="isEditMode"
              :placeholder="t('profile.modal.surnameInitialPlaceholder')"
              class="w-full h-11 px-2 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm text-center uppercase font-bold bg-white disabled:bg-slate-100 disabled:text-slate-400 transition"
              @input="onInitialInput"
            />
          </div>
          <div>
            <label for="student-age" class="block text-xs font-semibold text-slate-700 mb-1.5 text-center">
              {{ t('profile.modal.age') }} <span class="text-rose-500">*</span>
            </label>
            <input
              id="student-age"
              v-model.number="form.age"
              type="number"
              min="1"
              max="99"
              :placeholder="t('profile.modal.agePlaceholder')"
              class="w-full h-11 px-2 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm text-center bg-white transition"
              @input="onNicknameInput"
            />
          </div>
        </div>

        <!-- Real-time Live Preview Card (PRD/Prototype Spec) -->
        <div class="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-1">
          <div class="flex items-center justify-between text-xs text-slate-500">
            <span>{{ t('profile.modal.previewTitle') }}</span>
            <span class="text-[11px] text-slate-400 flex items-center gap-1">
              <svg class="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {{ t('profile.modal.previewSubtitle') }}
            </span>
          </div>

          <div
            class="font-mono text-lg sm:text-xl font-bold tracking-tight"
            :class="previewNickname ? 'text-teal-700' : 'text-slate-300'"
          >
            {{ previewNickname || 'AliceZ12' }}
          </div>

          <!-- Availability & Validation Feedback -->
          <div class="text-xs min-h-[22px] flex items-center gap-1.5 pt-0.5">
            <template v-if="!canPreview">
              <span class="text-slate-400">{{ t('profile.modal.fillPrompt') }}</span>
            </template>
            <template v-else-if="!isNicknameRegexValid">
              <span class="text-rose-600 font-medium">{{ t('profile.modal.invalidFormat') }}</span>
            </template>
            <template v-else-if="checkingAvailability">
              <span class="text-amber-600 flex items-center gap-1">
                <svg class="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                {{ t('profile.modal.checking') }}
              </span>
            </template>
            <template v-else-if="availabilityResult?.available">
              <span class="text-emerald-600 font-medium flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
                {{ t('profile.modal.available') }}
              </span>
            </template>
            <template v-else-if="availabilityResult && !availabilityResult.available">
              <span class="text-rose-600 font-medium flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {{ t('profile.modal.occupied', { suggestion: `${previewNickname}b` }) }}
              </span>
            </template>
          </div>
        </div>

        <!-- Nickname Suffix -->
        <div>
          <label for="student-suffix" class="block text-xs font-semibold text-slate-700 mb-1.5">
            {{ t('profile.modal.suffix') }}
            <span class="font-normal text-slate-400">{{ t('profile.modal.suffixOptional') }}</span>
          </label>
          <input
            id="student-suffix"
            v-model.trim="form.nicknameSuffix"
            type="text"
            maxlength="3"
            :placeholder="t('profile.modal.suffixPlaceholder')"
            class="w-36 h-11 px-3.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm lowercase bg-white transition"
            @input="onNicknameInput"
          />
        </div>

        <!-- Gender Segmented Buttons (44px touch targets) -->
        <div>
          <span class="block text-xs font-semibold text-slate-700 mb-1.5">
            {{ t('profile.modal.gender') }}
          </span>
          <div class="inline-flex rounded-xl bg-slate-100 p-1 text-xs">
            <button
              type="button"
              v-for="genderOption in (['male', 'female', 'undisclosed'] as const)"
              :key="genderOption"
              @click="form.gender = genderOption"
              class="h-11 px-4 rounded-lg font-medium transition min-h-[44px] min-w-[64px]"
              :class="form.gender === genderOption ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
            >
              {{ t(`profile.modal.${genderOption}`) }}
            </button>
          </div>
        </div>

        <!-- Birth Date (Optional) -->
        <div>
          <label for="student-birth-date" class="block text-xs font-semibold text-slate-700 mb-1.5">
            {{ t('profile.modal.birthDate') }}
          </label>
          <input
            id="student-birth-date"
            v-model="form.birthDate"
            type="date"
            class="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-sm bg-white transition"
          />
        </div>

        <!-- Form Error Banner -->
        <div
          v-if="errorMessage"
          class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2"
        >
          <svg class="w-4 h-4 shrink-0 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>
      </div>

      <!-- Modal Footer (Action Buttons with >= 44px height) -->
      <div class="px-5 py-3 border-t border-slate-100 flex gap-3 shrink-0 bg-white">
        <button
          type="button"
          @click="handleClose"
          class="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition min-h-[44px]"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          :disabled="isSubmitDisabled"
          @click="handleSubmit"
          class="flex-[2] h-11 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 min-h-[44px]"
        >
          <svg v-if="submitting" class="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span>{{ isEditMode ? t('profile.modal.submitUpdate') : t('profile.modal.submitCreate') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useProfileStore } from '../stores/profile';
import type {
  StudentProfileDto,
  StudentGender,
  CreateStudentProfileInput,
  UpdateStudentProfileInput,
  NicknameAvailabilityResult,
} from '../types';

interface Props {
  modelValue: boolean;
  editProfile?: StudentProfileDto | null;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  editProfile: null,
});

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'success', profile: StudentProfileDto): void;
  (e: 'close'): void;
}>();

const { t } = useI18n();
const profileStore = useProfileStore();

const visible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val),
});

const isEditMode = computed(() => !!props.editProfile?.id);

const form = reactive({
  realName: '',
  englishName: '',
  surnameInitial: '',
  age: null as number | null,
  nicknameSuffix: '',
  gender: 'undisclosed' as StudentGender,
  birthDate: '',
});

const avatarDataUrl = ref<string>('');
const avatarCroppedInfo = ref<string>('');
const submitting = ref<boolean>(false);
const errorMessage = ref<string>('');

const checkingAvailability = ref<boolean>(false);
const availabilityResult = ref<NicknameAvailabilityResult | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const canPreview = computed(() => {
  return (
    form.englishName.trim().length > 0 &&
    form.surnameInitial.trim().length === 1 &&
    form.age !== null &&
    form.age > 0
  );
});

const previewNickname = computed(() => {
  if (!canPreview.value) return '';
  const en = form.englishName.trim();
  const ini = form.surnameInitial.trim().toUpperCase();
  const age = form.age ?? '';
  const sfx = form.nicknameSuffix.trim().toLowerCase();
  return `${en}${ini}${age}${sfx}`;
});

const NICKNAME_REGEX = /^[A-Za-z]{1,24}[A-Z]\d{1,2}[a-z0-9]{0,3}$/;

const isNicknameRegexValid = computed(() => {
  if (!previewNickname.value) return false;
  return NICKNAME_REGEX.test(previewNickname.value);
});

const isSubmitDisabled = computed(() => {
  if (submitting.value) return true;
  if (!form.realName.trim()) return true;
  if (!canPreview.value) return true;
  if (!isNicknameRegexValid.value) return true;
  if (checkingAvailability.value) return true;

  // In edit mode with unchanged nickname, submit is enabled
  if (isEditMode.value && props.editProfile?.nickname === previewNickname.value) {
    return false;
  }

  return availabilityResult.value ? !availabilityResult.value.available : true;
});

function onInitialInput() {
  if (form.surnameInitial) {
    form.surnameInitial = form.surnameInitial.toUpperCase().replace(/[^A-Z]/g, '');
  }
  onNicknameInput();
}

function onNicknameInput() {
  errorMessage.value = '';
  if (!canPreview.value || !isNicknameRegexValid.value) {
    availabilityResult.value = null;
    checkingAvailability.value = false;
    return;
  }

  // If in edit mode and matches original, mark available
  if (isEditMode.value && props.editProfile?.nickname === previewNickname.value) {
    availabilityResult.value = {
      available: true,
      nickname: previewNickname.value,
    };
    checkingAvailability.value = false;
    return;
  }

  checkingAvailability.value = true;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  const targetNickname = previewNickname.value;
  debounceTimer = setTimeout(async () => {
    try {
      const res = await profileStore.checkNickname(targetNickname);
      // Ensure result is for latest query
      if (previewNickname.value === targetNickname) {
        availabilityResult.value = res;
      }
    } catch {
      if (previewNickname.value === targetNickname) {
        availabilityResult.value = {
          available: false,
          nickname: targetNickname,
          reason: 'Network check failed',
        };
      }
    } finally {
      if (previewNickname.value === targetNickname) {
        checkingAvailability.value = false;
      }
    }
  }, 400);
}

function handleAvatarFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt: ProgressEvent<FileReader>) => {
    const rawUrl = evt.target?.result as string;
    if (!rawUrl) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 200;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

      const webpUrl = canvas.toDataURL('image/webp', 0.85);
      avatarDataUrl.value = webpUrl;
      const approxKb = Math.round((webpUrl.length * 0.75) / 1024);
      avatarCroppedInfo.value = `${t('profile.modal.avatarSuccess')} (${approxKb} KB)`;
    };
    img.src = rawUrl;
  };
  reader.readAsDataURL(file);
}

function resetForm() {
  if (props.editProfile) {
    form.realName = props.editProfile.realName || '';
    form.englishName = props.editProfile.englishName || '';
    form.surnameInitial = props.editProfile.surnameInitial || '';
    form.age = props.editProfile.age || null;
    form.nicknameSuffix = '';
    form.gender = props.editProfile.gender || 'undisclosed';
    form.birthDate = props.editProfile.birthDate || '';
    avatarDataUrl.value = props.editProfile.avatarUrl || '';
    avatarCroppedInfo.value = '';
    availabilityResult.value = {
      available: true,
      nickname: props.editProfile.nickname,
    };
  } else {
    form.realName = '';
    form.englishName = '';
    form.surnameInitial = '';
    form.age = null;
    form.nicknameSuffix = '';
    form.gender = 'undisclosed';
    form.birthDate = '';
    avatarDataUrl.value = '';
    avatarCroppedInfo.value = '';
    availabilityResult.value = null;
  }
  errorMessage.value = '';
  checkingAvailability.value = false;
}

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      resetForm();
    }
  }
);

watch(
  () => props.editProfile,
  () => {
    if (props.modelValue) {
      resetForm();
    }
  }
);

function handleClose() {
  visible.value = false;
  emit('close');
}

async function handleSubmit() {
  if (!form.realName.trim()) {
    errorMessage.value = t('profile.errors.realNameRequired');
    return;
  }
  if (!canPreview.value || !isNicknameRegexValid.value) {
    errorMessage.value = t('profile.errors.nicknameInvalid');
    return;
  }

  submitting.value = true;
  errorMessage.value = '';

  try {
    if (isEditMode.value && props.editProfile) {
      const updatePayload: UpdateStudentProfileInput = {
        realName: form.realName.trim(),
        age: form.age || undefined,
        nicknameSuffix: form.nicknameSuffix.trim() || undefined,
        gender: form.gender,
        birthDate: form.birthDate || undefined,
        avatarDataUrl: avatarDataUrl.value || undefined,
      };
      const updated = await profileStore.updateProfile(props.editProfile.id, updatePayload);
      emit('success', updated);
      handleClose();
    } else {
      const createPayload: CreateStudentProfileInput = {
        realName: form.realName.trim(),
        englishName: form.englishName.trim(),
        surnameInitial: form.surnameInitial.trim().toUpperCase(),
        age: form.age || 1,
        nicknameSuffix: form.nicknameSuffix.trim() || undefined,
        gender: form.gender,
        birthDate: form.birthDate || undefined,
        avatarDataUrl: avatarDataUrl.value || undefined,
      };
      const created = await profileStore.createProfile(createPayload);
      emit('success', created);
      handleClose();
    }
  } catch (err: unknown) {
    const apiErr = err as { code?: string; message?: string };
    if (apiErr.code === 'PROFILE_LIMIT_EXCEEDED') {
      errorMessage.value = t('profile.errors.PROFILE_LIMIT_EXCEEDED');
    } else if (apiErr.code === 'NICKNAME_ALREADY_EXISTS') {
      errorMessage.value = t('profile.errors.NICKNAME_ALREADY_EXISTS');
    } else {
      errorMessage.value = apiErr.message || t('common.failed');
    }
  } finally {
    submitting.value = false;
  }
}
</script>
