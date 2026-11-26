<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <div class="flex min-h-screen flex-col bg-slate-900 text-white px-6 pb-8">
    <!-- Unified 56-64px Top Bar -->
    <div class="h-14 sm:h-16 flex items-center justify-end shrink-0">
      <button
        type="button"
        @click="toggleLanguage"
        class="h-10 px-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 min-h-[44px]"
      >
        <span>{{ currentLocale === 'zh-CN' ? 'English' : '简体中文' }}</span>
      </button>
    </div>

    <!-- Header Section -->
    <div class="pt-4 mb-6 max-w-md w-full mx-auto">
      <h1 class="text-3xl font-bold tracking-tight text-white mb-2">{{ t('auth.forgotPassword.title') }}</h1>
      <p class="text-sm text-slate-300">{{ t('auth.forgotPassword.subtitle') }}</p>
      <p class="mt-3 text-xs font-semibold text-indigo-300">
        {{ step === 1 ? t('auth.forgotPassword.step1Title') : t('auth.forgotPassword.step2Title') }}
      </p>
    </div>

    <!-- Step 1: Email + Mandatory Graphic Captcha -->
    <form
      v-if="step === 1"
      class="flex flex-col gap-5 max-w-md w-full mx-auto"
      @submit.prevent="handleSendCode"
    >
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
        />
        <div v-if="emailError" class="text-rose-400 text-xs px-1">{{ emailError }}</div>
      </div>

      <!-- Mandatory Graphic Captcha -->
      <div class="space-y-1.5">
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

      <t-button
        theme="primary"
        size="large"
        block
        type="submit"
        :loading="sendingCode"
        class="!h-13 !rounded-xl !text-base !font-bold shadow-lg shadow-indigo-600/30 mt-2 bg-indigo-600 border-none"
        @click="handleSendCode"
      >
        {{ t('auth.forgotPassword.sendResetCode') }}
      </t-button>
    </form>

    <!-- Step 2: Locked Email + Verification Code + New Password -->
    <form
      v-else
      class="flex flex-col gap-5 max-w-md w-full mx-auto"
      @submit.prevent="onSubmit"
    >
      <!-- Locked Readonly Email -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between px-1">
          <label class="text-xs font-semibold text-slate-300">{{ t('auth.common.email') }}</label>
          <button
            type="button"
            class="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            @click="backToStep1"
          >
            {{ t('auth.forgotPassword.changeEmailBack') }}
          </button>
        </div>
        <input
          :value="formData.email"
          type="email"
          readonly
          class="w-full h-12 px-4 rounded-xl bg-slate-800/40 border border-slate-700/60 text-slate-300 text-sm cursor-not-allowed focus:outline-none"
        />
      </div>

      <!-- Verification Code -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between px-1">
          <label class="text-xs font-semibold text-slate-300">{{ t('auth.common.verificationCode') }}</label>
          <span v-if="cooldown > 0" class="text-xs text-slate-300 font-mono">
            {{ t('auth.common.resendIn', { seconds: cooldown }) }}
          </span>
        </div>
        <t-input
          v-model="formData.verificationCode"
          :placeholder="t('auth.common.verificationCodePlaceholder')"
          class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white"
        />
      </div>

      <!-- New Password + Strength Checklist -->
      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-300">{{ t('auth.forgotPassword.newPassword') }}</label>
        <t-input
          v-model="formData.newPassword"
          type="password"
          autocomplete="new-password"
          :placeholder="t('auth.forgotPassword.newPasswordPlaceholder')"
          class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white"
        />
        <div class="rounded-xl bg-slate-800/60 border border-slate-700/60 p-3 space-y-1.5 text-xs">
          <p class="font-semibold text-slate-300">{{ t('auth.passwordRules.title') }}</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1">
            <span :class="passwordStrength.minLength ? 'text-emerald-400' : 'text-slate-300'">
              {{ passwordStrength.minLength ? '✓' : '○' }} {{ t('auth.passwordRules.minLength') }}
            </span>
            <span :class="passwordStrength.hasUppercase ? 'text-emerald-400' : 'text-slate-300'">
              {{ passwordStrength.hasUppercase ? '✓' : '○' }} {{ t('auth.passwordRules.uppercase') }}
            </span>
            <span :class="passwordStrength.hasLowercase ? 'text-emerald-400' : 'text-slate-300'">
              {{ passwordStrength.hasLowercase ? '✓' : '○' }} {{ t('auth.passwordRules.lowercase') }}
            </span>
            <span :class="passwordStrength.hasDigit ? 'text-emerald-400' : 'text-slate-300'">
              {{ passwordStrength.hasDigit ? '✓' : '○' }} {{ t('auth.passwordRules.digit') }}
            </span>
            <span :class="passwordStrength.hasSpecial ? 'text-emerald-400' : 'text-slate-300'" class="sm:col-span-2">
              {{ passwordStrength.hasSpecial ? '✓' : '○' }} {{ t('auth.passwordRules.special') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Confirm New Password -->
      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-300">{{ t('auth.forgotPassword.confirmNewPassword') }}</label>
        <t-input
          v-model="formData.confirmPassword"
          type="password"
          autocomplete="new-password"
          :placeholder="t('auth.forgotPassword.confirmNewPasswordPlaceholder')"
          class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white"
        />
        <div
          v-if="formData.confirmPassword && formData.confirmPassword !== formData.newPassword"
          class="text-rose-400 text-xs px-1"
        >
          {{ t('auth.passwordRules.mismatch') }}
        </div>
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
        {{ loading ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit') }}
      </t-button>
    </form>

    <div class="mt-auto pt-10 text-center max-w-md w-full mx-auto">
      <router-link to="/login" class="text-xs text-slate-300 font-medium hover:text-white transition-colors">
        {{ t('auth.common.backToLogin') }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Toast, Input as TInput, Button as TButton } from 'tdesign-mobile-vue';
import { useAuthStore } from '../stores/auth';
import { getCaptcha, sendCode } from '../api/auth';
import { setLocale } from '../i18n';
import { resolveApiErrorMessage } from '../utils/apiError';
import { isValidEmail, validatePasswordStrength } from '../utils/password';

const router = useRouter();
const { t, locale } = useI18n();
const authStore = useAuthStore();

const currentLocale = computed(() => locale.value);
const step = ref<1 | 2>(1);

const formData = reactive({
  email: '',
  captchaText: '',
  verificationCode: '',
  newPassword: '',
  confirmPassword: '',
});

const emailError = ref('');
const cooldown = ref(0);
const sendingCode = ref(false);
const loading = ref(false);

const captchaImage = ref('');
const captchaId = ref('');
let timer: ReturnType<typeof setInterval> | null = null;

const passwordStrength = computed(() => validatePasswordStrength(formData.newPassword));

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
    console.warn('[ForgotPasswordView] Failed to load captcha:', error);
  }
}

function startCooldown() {
  if (timer) clearInterval(timer);
  cooldown.value = 60;
  timer = setInterval(() => {
    cooldown.value--;
    if (cooldown.value <= 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  }, 1000);
}

async function backToStep1() {
  step.value = 1;
  formData.captchaText = '';
  await fetchCaptcha();
}

async function handleSendCode() {
  if (sendingCode.value) return;
  if (!validateEmail()) return;
  if (!formData.captchaText.trim()) {
    Toast({ message: t('auth.common.captchaRequired'), theme: 'error' });
    return;
  }

  sendingCode.value = true;
  try {
    await sendCode({
      receiver: formData.email.trim(),
      channel: 'email',
      scenario: 'forgot_password',
      captchaId: captchaId.value,
      captchaText: formData.captchaText.trim(),
    });
    Toast({ message: t('auth.forgotPassword.codeSent'), theme: 'success' });
    step.value = 2;
    startCooldown();
  } catch (error: unknown) {
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    const msg = resolveApiErrorMessage(
      errData,
      undefined,
      error instanceof Error ? error.message : t('common.failed')
    );
    Toast({ message: msg, theme: 'error' });
    formData.captchaText = '';
    await fetchCaptcha();
  } finally {
    sendingCode.value = false;
  }
}

async function onSubmit() {
  if (loading.value) return;
  if (!validateEmail()) return;
  if (!formData.verificationCode.trim()) {
    Toast({ message: t('auth.common.verificationCodeRequired'), theme: 'error' });
    return;
  }
  if (!passwordStrength.value.valid) {
    Toast({ message: t('auth.passwordRules.invalid'), theme: 'error' });
    return;
  }
  if (formData.newPassword !== formData.confirmPassword) {
    Toast({ message: t('auth.passwordRules.mismatch'), theme: 'error' });
    return;
  }

  loading.value = true;
  try {
    await authStore.resetPass({
      email: formData.email.trim(),
      code: formData.verificationCode.trim(),
      newPassword: formData.newPassword,
    });
    Toast({ message: t('auth.forgotPassword.success'), theme: 'success' });
    await router.push('/login');
  } catch (error: unknown) {
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    const msg = resolveApiErrorMessage(
      errData,
      undefined,
      error instanceof Error ? error.message : t('auth.forgotPassword.failed')
    );
    Toast({ message: msg, theme: 'error' });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchCaptcha();
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>
