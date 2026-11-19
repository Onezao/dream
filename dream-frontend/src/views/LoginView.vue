<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <div class="flex min-h-screen flex-col bg-slate-900 text-white px-6 pt-8 pb-8">
    <!-- Top Language Toggle -->
    <div class="flex justify-end mb-4">
      <button
        type="button"
        @click="toggleLanguage"
        class="h-10 px-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 min-h-[44px]"
      >
        <span>{{ currentLocale === 'zh-CN' ? 'English' : '简体中文' }}</span>
      </button>
    </div>

    <!-- Header Section -->
    <div class="mb-8 max-w-md w-full mx-auto">
      <div class="w-12 h-12 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl flex items-center justify-center mb-4 text-indigo-400 font-black text-xl shadow-lg">
        D
      </div>
      <h1 class="text-3xl font-bold tracking-tight text-white">{{ t('auth.login.title') }}</h1>
      <p class="mt-2 text-sm text-slate-300">{{ t('auth.login.subtitle') }}</p>
    </div>

    <!-- Form Section -->
    <form class="flex flex-col gap-5 max-w-md w-full mx-auto" @submit.prevent="onSubmit">
      <!-- Error Banner -->
      <div
        v-if="errorBanner"
        role="alert"
        class="rounded-2xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-xs text-rose-200 space-y-1"
      >
        <p class="font-semibold text-rose-100">{{ errorBanner.title }}</p>
        <p v-if="errorBanner.guidance" class="text-rose-200/90 leading-relaxed">{{ errorBanner.guidance }}</p>
        <div v-if="errorBanner.showForgotLink" class="pt-1">
          <router-link to="/forgot-password" class="font-semibold text-indigo-300 underline hover:text-indigo-200">
            {{ t('auth.login.forgotLink') }}
          </router-link>
        </div>
      </div>

      <!-- Email -->
      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-300">{{ t('auth.common.email') }}</label>
        <t-input
          v-model="formData.email"
          type="text"
          autocomplete="email"
          :placeholder="t('auth.common.emailPlaceholder')"
          :status="emailError ? 'error' : 'default'"
          @blur="validateEmail"
          @focus="emailError = ''"
          class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white"
        >
          <template #suffix>
            <t-icon name="mail" class="text-slate-400" size="18px" />
          </template>
        </t-input>
        <div v-if="emailError" class="text-rose-400 text-xs px-1">{{ emailError }}</div>
      </div>

      <!-- Password -->
      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-300">{{ t('auth.common.password') }}</label>
        <t-input
          v-model="formData.password"
          type="password"
          autocomplete="current-password"
          :placeholder="t('auth.common.passwordPlaceholder')"
          :status="passwordError ? 'error' : 'default'"
          @focus="passwordError = ''"
          class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white"
        >
          <template #suffix>
            <t-icon name="lock-on" class="text-slate-400" size="18px" />
          </template>
        </t-input>
        <div v-if="passwordError" class="text-rose-400 text-xs px-1">{{ passwordError }}</div>
      </div>

      <!-- Security Captcha Check (Triggered dynamically on CAPTCHA_REQUIRED) -->
      <div v-if="showCaptcha" class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-300">{{ t('auth.common.captcha') }}</label>
        <div class="flex gap-2">
          <t-input
            v-model="formData.captchaText"
            :placeholder="t('auth.common.captchaPlaceholder')"
            class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white flex-1"
          />
          <button
            type="button"
            class="w-28 h-12 rounded-xl overflow-hidden cursor-pointer bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 active:scale-95 transition-transform"
            :title="t('auth.common.captchaRefresh')"
            @click="fetchCaptcha"
          >
            <div
              v-if="isSvgCaptcha"
              v-html="captchaImage"
              class="w-full h-full [&>svg]:w-full [&>svg]:h-full"
            ></div>
            <img
              v-else-if="captchaImageSrc"
              :src="captchaImageSrc"
              alt="Captcha"
              class="w-full h-full object-contain"
            />
            <span v-else class="text-xs text-slate-300">{{ t('auth.common.captchaLoading') }}</span>
          </button>
        </div>
      </div>

      <!-- Remember Me -->
      <div class="mt-1 flex items-center justify-between">
        <t-checkbox v-model="formData.rememberMe" class="!bg-transparent !p-0">
          <span class="text-xs text-slate-300">{{ t('auth.login.rememberMe') }}</span>
        </t-checkbox>
      </div>

      <t-button
        theme="primary"
        size="large"
        block
        type="submit"
        :loading="loading"
        class="!h-13 !rounded-xl !text-base !font-bold shadow-lg shadow-indigo-600/30 mt-2 bg-indigo-600 border-none"
        @click="onSubmit"
      >
        {{ loading ? t('auth.login.submitting') : t('auth.login.submit') }}
      </t-button>
    </form>

    <!-- Footer Links -->
    <div class="mt-auto pt-10 text-center max-w-md w-full mx-auto">
      <div class="flex items-center justify-center gap-4 text-xs text-slate-300">
        <router-link to="/register" class="font-bold text-indigo-400 hover:text-indigo-300">
          {{ t('auth.login.registerLink') }}
        </router-link>
        <span class="text-slate-600">|</span>
        <router-link to="/forgot-password" class="text-slate-300 hover:text-white transition-colors">
          {{ t('auth.login.forgotLink') }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Toast,
  Input as TInput,
  Button as TButton,
  Checkbox as TCheckbox,
  Icon as TIcon,
} from 'tdesign-mobile-vue';
import { useAuthStore } from '../stores/auth';
import { getCaptcha } from '../api/auth';
import { setLocale } from '../i18n';
import { extractApiErrorCode, resolveApiErrorMessage } from '../utils/apiError';
import { isSafeInternalRedirect, isValidEmail } from '../utils/password';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const authStore = useAuthStore();

const currentLocale = computed(() => locale.value);

const formData = reactive({
  email: '',
  password: '',
  captchaText: '',
  rememberMe: true,
});

const emailError = ref('');
const passwordError = ref('');
const loading = ref(false);

const showCaptcha = ref(false);
const captchaImage = ref('');
const captchaId = ref('');

const errorBanner = ref<{
  title: string;
  guidance?: string;
  showForgotLink?: boolean;
} | null>(null);

const isSvgCaptcha = computed(() => captchaImage.value.trim().startsWith('<svg'));
const captchaImageSrc = computed(() => {
  const val = captchaImage.value.trim();
  if (!val || isSvgCaptcha.value) return '';
  if (val.startsWith('data:')) return val;
  return `data:image/png;base64,${val}`;
});

function toggleLanguage() {
  const next = currentLocale.value === 'zh-CN' ? 'en-US' : 'zh-CN';
  setLocale(next);
}

function validateEmail(): boolean {
  emailError.value = '';
  const val = formData.email.trim();
  if (!val) {
    emailError.value = t('auth.common.emailRequired');
    return false;
  }
  if (!isValidEmail(val)) {
    emailError.value = t('auth.common.emailInvalid');
    return false;
  }
  return true;
}

async function fetchCaptcha() {
  try {
    const res = await getCaptcha();
    captchaId.value = res.id;
    captchaImage.value = res.data;
  } catch (error) {
    console.warn('[LoginView] Failed to load captcha:', error);
  }
}

function buildErrorBanner(error: unknown): {
  title: string;
  guidance?: string;
  showForgotLink?: boolean;
} {
  const errCode = extractApiErrorCode(error);
  const errData = (error as { response?: { data?: unknown } })?.response?.data;

  switch (errCode) {
    case 'ACCOUNT_LOCKED':
      return {
        title: t('errors.ACCOUNT_LOCKED'),
        guidance: t('auth.login.lockedGuidance'),
        showForgotLink: true,
      };
    case 'ACCOUNT_BANNED':
      return {
        title: t('errors.ACCOUNT_BANNED'),
        guidance: t('auth.login.bannedGuidance'),
      };
    case 'ACCOUNT_NOT_CONFIRMED':
      return {
        title: t('errors.ACCOUNT_NOT_CONFIRMED'),
        guidance: t('auth.login.notConfirmedGuidance'),
      };
    case 'INVALID_CREDENTIALS':
      formData.password = '';
      return {
        title: t('errors.INVALID_CREDENTIALS'),
      };
    default: {
      const fallbackMsg =
        error instanceof Error ? error.message : t('auth.login.failed');
      return {
        title: resolveApiErrorMessage(errData, undefined, fallbackMsg),
      };
    }
  }
}

async function onSubmit() {
  if (loading.value) return;
  emailError.value = '';
  passwordError.value = '';
  errorBanner.value = null;

  if (!validateEmail()) return;
  if (!formData.password) {
    passwordError.value = t('auth.common.passwordRequired');
    return;
  }
  if (showCaptcha.value && !formData.captchaText.trim()) {
    Toast({ message: t('auth.common.captchaRequired'), theme: 'error' });
    return;
  }

  loading.value = true;
  try {
    await authStore.login({
      account: formData.email.trim(),
      password: formData.password,
      rememberMe: formData.rememberMe,
      captchaId: showCaptcha.value ? captchaId.value : undefined,
      captchaText: showCaptcha.value ? formData.captchaText.trim() : undefined,
    });
    Toast({ message: t('auth.login.success'), theme: 'success' });
    const rawRedirect =
      typeof route.query.redirect === 'string' ? route.query.redirect : '';
    const targetPath = isSafeInternalRedirect(rawRedirect) ? rawRedirect : '/';
    await router.push(targetPath);
  } catch (error: unknown) {
    const errCode = extractApiErrorCode(error);
    if (errCode === 'CAPTCHA_REQUIRED' || errCode === 'INVALID_CAPTCHA') {
      showCaptcha.value = true;
      formData.captchaText = '';
      const promptBanner = {
        title:
          errCode === 'INVALID_CAPTCHA'
            ? t('errors.INVALID_CAPTCHA')
            : t('auth.login.captchaPrompt'),
      };
      errorBanner.value = promptBanner;
      Toast({ message: promptBanner.title, theme: 'warning' });
      await fetchCaptcha();
    } else {
      const nextBanner = buildErrorBanner(error);
      errorBanner.value = nextBanner;
      Toast({ message: nextBanner.title, theme: 'error' });
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  authStore.fetchSystemConfig();
});
</script>
