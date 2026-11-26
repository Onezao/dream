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
      <h1 class="text-3xl font-bold tracking-tight text-white mb-2">{{ t('auth.register.title') }}</h1>
      <p class="text-sm text-slate-300">{{ t('auth.register.subtitle') }}</p>
    </div>

    <!-- Registration Disabled Notice -->
    <div
      v-if="configLoaded && !authStore.sysConfig.allowRegister"
      role="alert"
      class="max-w-md w-full mx-auto mb-6 rounded-2xl border border-amber-500/40 bg-amber-950/50 px-4 py-3.5 text-xs text-amber-200 space-y-1"
    >
      <p class="font-bold text-amber-100">{{ t('auth.register.disabledTitle') }}</p>
      <p class="leading-relaxed text-amber-200/90">{{ t('auth.register.disabledNotice') }}</p>
    </div>

    <!-- Form Section -->
    <form class="flex flex-col gap-5 max-w-md w-full mx-auto" @submit.prevent="onSubmit">
      <!-- Email Only -->
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

      <!-- Dynamic Graphic Captcha (Shown when CAPTCHA_REQUIRED) -->
      <div v-if="showCaptcha" class="space-y-1.5 rounded-2xl border border-amber-500/40 bg-slate-800/60 p-3">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-amber-300">{{ t('auth.register.captchaModalTitle') }}</label>
          <span class="text-xs text-slate-300">{{ t('auth.register.captchaPrompt') }}</span>
        </div>
        <div class="flex gap-2 mt-2">
          <t-input
            v-model="formData.captchaText"
            :placeholder="t('auth.common.captchaPlaceholder')"
            class="!bg-slate-900/90 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white flex-1"
          />
          <button
            type="button"
            class="w-28 h-12 rounded-xl overflow-hidden cursor-pointer bg-slate-900 flex items-center justify-center shrink-0 border border-slate-700 active:scale-95 transition-transform"
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

      <!-- Email Verification Code -->
      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-300">{{ t('auth.common.verificationCode') }}</label>
        <div class="flex gap-2">
          <t-input
            v-model="formData.verificationCode"
            :placeholder="t('auth.common.verificationCodePlaceholder')"
            class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white flex-1"
          />
          <t-button
            type="button"
            theme="primary"
            variant="outline"
            :disabled="cooldown > 0 || !authStore.sysConfig.allowRegister"
            :loading="sendingCode"
            @click="handleSendCode"
            class="!rounded-xl !h-12 w-32 !border-indigo-500/50 !text-indigo-300 shrink-0"
          >
            {{ cooldown > 0 ? t('auth.common.resendIn', { seconds: cooldown }) : t('auth.common.sendCode') }}
          </t-button>
        </div>
      </div>

      <!-- Password + Strength Hint -->
      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-300">{{ t('auth.common.password') }}</label>
        <t-input
          v-model="formData.password"
          type="password"
          autocomplete="new-password"
          :placeholder="t('auth.common.passwordPlaceholder')"
          class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white"
        />
        <!-- Real-time Password Strength Checklist -->
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

      <!-- Confirm Password -->
      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-300">{{ t('auth.register.confirmPassword') }}</label>
        <t-input
          v-model="formData.confirmPassword"
          type="password"
          autocomplete="new-password"
          :placeholder="t('auth.register.confirmPasswordPlaceholder')"
          class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white"
        />
        <div
          v-if="formData.confirmPassword && formData.confirmPassword !== formData.password"
          class="text-rose-400 text-xs px-1"
        >
          {{ t('auth.passwordRules.mismatch') }}
        </div>
      </div>

      <!-- Agreement Checkbox & Policy Links -->
      <div class="mt-1 text-left">
        <t-checkbox v-model="formData.agreement" class="!bg-transparent !p-0">
          <span class="text-xs text-slate-300 leading-relaxed">
            {{ t('auth.register.agreementPrefix') }}
            <button
              type="button"
              class="text-indigo-400 hover:text-indigo-300 underline font-medium"
              @click.stop.prevent="openPolicyModal('user_agreement')"
            >
              {{ t('auth.register.userAgreement') }}
            </button>
            <span> {{ t('auth.register.and') }} </span>
            <button
              type="button"
              class="text-indigo-400 hover:text-indigo-300 underline font-medium"
              @click.stop.prevent="openPolicyModal('privacy_policy')"
            >
              {{ t('auth.register.privacyPolicy') }}
            </button>
          </span>
        </t-checkbox>
      </div>

      <t-button
        theme="primary"
        size="large"
        block
        type="submit"
        :loading="loading"
        :disabled="!authStore.sysConfig.allowRegister || loading"
        class="!h-13 !rounded-xl !text-base !font-bold shadow-lg shadow-indigo-600/30 mt-2 bg-indigo-600 border-none disabled:opacity-50"
        @click="onSubmit"
      >
        {{ loading ? t('auth.register.submitting') : t('auth.register.submit') }}
      </t-button>
    </form>

    <!-- Policy Modal -->
    <t-dialog
      v-model:visible="showPolicyModal"
      confirm-btn=""
      cancel-btn=""
      :close-btn="false"
      class="!bg-transparent !w-full !max-w-none !p-0 !border-none"
    >
      <div class="bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden w-[94%] max-w-lg mx-auto relative p-6">
        <div class="flex justify-between items-start gap-3 pb-3 border-b border-slate-800">
          <div class="space-y-1">
            <h2 class="text-base font-bold text-white">{{ activePolicyTitle }}</h2>
            <div class="flex items-center gap-2 text-xs text-slate-300">
              <span class="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                {{ t('auth.register.policyVersion', { version: activePolicyVersion }) }}
              </span>
              <span v-if="activePolicyEffectiveDate">
                {{ t('auth.register.policyEffective', { date: activePolicyEffectiveDate }) }}
              </span>
            </div>
          </div>
          <button
            type="button"
            @click="showPolicyModal = false"
            class="text-slate-300 hover:text-white p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <t-icon name="close" size="18px" />
          </button>
        </div>
        <div class="text-xs text-slate-200 max-h-[60vh] overflow-y-auto mt-4 leading-relaxed whitespace-pre-wrap">
          {{ activePolicyContent }}
        </div>
      </div>
    </t-dialog>

    <!-- Back to Login -->
    <div class="mt-auto pt-10 text-center max-w-md w-full mx-auto">
      <router-link to="/login" class="text-xs text-slate-300 font-medium hover:text-white transition-colors">
        {{ t('auth.register.hasAccount') }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Toast,
  Input as TInput,
  Button as TButton,
  Checkbox as TCheckbox,
  Dialog as TDialog,
  Icon as TIcon,
} from 'tdesign-mobile-vue';
import { useAuthStore } from '../stores/auth';
import { getCaptcha, getPolicy, sendCode } from '../api/auth';
import { setLocale } from '../i18n';
import { extractApiErrorCode, resolveApiErrorMessage } from '../utils/apiError';
import { isValidEmail, validatePasswordStrength } from '../utils/password';

type PolicyKey = 'user_agreement' | 'privacy_policy';

interface PolicyRecord {
  title: string;
  content: string;
  version: number;
  effectiveDate?: string;
}

const router = useRouter();
const { t, locale } = useI18n();
const authStore = useAuthStore();

const currentLocale = computed(() => locale.value);

const formData = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  verificationCode: '',
  captchaText: '',
  agreement: false,
});

const emailError = ref('');
const configLoaded = ref(false);
const cooldown = ref(0);
const sendingCode = ref(false);
const loading = ref(false);

const showCaptcha = ref(false);
const captchaImage = ref('');
const captchaId = ref('');
let timer: ReturnType<typeof setInterval> | null = null;

const policies = reactive<Record<PolicyKey, PolicyRecord>>({
  user_agreement: { title: '', content: '', version: 1, effectiveDate: '' },
  privacy_policy: { title: '', content: '', version: 1, effectiveDate: '' },
});

const showPolicyModal = ref(false);
const activePolicyKey = ref<PolicyKey>('user_agreement');
const policyLoading = ref(false);
const policyLoadFailed = ref(false);

const passwordStrength = computed(() => validatePasswordStrength(formData.password));

const isSvgCaptcha = computed(() => captchaImage.value.trim().startsWith('<svg'));
const captchaImageSrc = computed(() => {
  const val = captchaImage.value.trim();
  if (!val || isSvgCaptcha.value) return '';
  if (val.startsWith('data:')) return val;
  return `data:image/png;base64,${val}`;
});

const activePolicyTitle = computed(() => {
  const policy = policies[activePolicyKey.value];
  if (policy.title) return policy.title;
  return activePolicyKey.value === 'user_agreement'
    ? t('auth.register.userAgreement')
    : t('auth.register.privacyPolicy');
});

const activePolicyVersion = computed(() => policies[activePolicyKey.value].version);
const activePolicyEffectiveDate = computed(() => policies[activePolicyKey.value].effectiveDate || '');

const activePolicyContent = computed(() => {
  if (policyLoading.value) return t('auth.register.policyLoading');
  if (policyLoadFailed.value) return t('auth.register.policyLoadFailed');
  return policies[activePolicyKey.value].content || t('auth.register.policyEmpty');
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
    console.warn('[RegisterView] Failed to load captcha:', error);
  }
}

async function loadPolicy(key: PolicyKey) {
  try {
    const res = await getPolicy(key);
    const data = (res?.data || res || {}) as {
      title?: string;
      content?: string;
      version?: number | string;
      effectiveDate?: string;
      effective_date?: string;
      updatedAt?: string;
    };
    policies[key] = {
      title: data.title || '',
      content: data.content || '',
      version: Number(data.version) || 1,
      effectiveDate: data.effectiveDate || data.effective_date || data.updatedAt || '',
    };
    return true;
  } catch {
    return false;
  }
}

async function openPolicyModal(key: PolicyKey) {
  activePolicyKey.value = key;
  policyLoadFailed.value = false;
  showPolicyModal.value = true;
  if (!policies[key].content) {
    policyLoading.value = true;
    const ok = await loadPolicy(key);
    policyLoading.value = false;
    if (!ok) {
      policyLoadFailed.value = true;
    }
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

async function handleSendCode() {
  if (!authStore.sysConfig.allowRegister) {
    Toast({ message: t('auth.register.disabledNotice'), theme: 'warning' });
    return;
  }
  if (!validateEmail()) return;
  if (showCaptcha.value && !formData.captchaText.trim()) {
    Toast({ message: t('auth.common.captchaRequired'), theme: 'error' });
    return;
  }
  if (cooldown.value > 0 || sendingCode.value) return;

  sendingCode.value = true;
  try {
    await sendCode({
      receiver: formData.email.trim(),
      channel: 'email',
      scenario: 'signup',
      captchaId: showCaptcha.value ? captchaId.value : undefined,
      captchaText: showCaptcha.value ? formData.captchaText.trim() : undefined,
    });
    Toast({ message: t('auth.common.codeSent'), theme: 'success' });
    startCooldown();
  } catch (error: unknown) {
    const errCode = extractApiErrorCode(error);
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    if (errCode === 'CAPTCHA_REQUIRED' || errCode === 'INVALID_CAPTCHA') {
      showCaptcha.value = true;
      formData.captchaText = '';
      await fetchCaptcha();
      Toast({
        message:
          errCode === 'INVALID_CAPTCHA'
            ? t('errors.INVALID_CAPTCHA')
            : t('auth.register.captchaPrompt'),
        theme: 'warning',
      });
    } else {
      const msg = resolveApiErrorMessage(
        errData,
        undefined,
        error instanceof Error ? error.message : t('common.failed')
      );
      Toast({ message: msg, theme: 'error' });
    }
  } finally {
    sendingCode.value = false;
  }
}

async function onSubmit() {
  if (loading.value) return;
  if (!authStore.sysConfig.allowRegister) {
    Toast({ message: t('auth.register.disabledNotice'), theme: 'error' });
    return;
  }
  if (!validateEmail()) return;
  if (!formData.verificationCode.trim()) {
    Toast({ message: t('auth.common.verificationCodeRequired'), theme: 'error' });
    return;
  }
  if (!passwordStrength.value.valid) {
    Toast({ message: t('auth.passwordRules.invalid'), theme: 'error' });
    return;
  }
  if (formData.password !== formData.confirmPassword) {
    Toast({ message: t('auth.passwordRules.mismatch'), theme: 'error' });
    return;
  }
  if (!formData.agreement) {
    Toast({ message: t('auth.register.agreementRequired'), theme: 'error' });
    return;
  }

  loading.value = true;
  try {
    await authStore.register({
      email: formData.email.trim(),
      password: formData.password,
      verificationCode: formData.verificationCode.trim(),
      agreements: [
        { key: 'user_agreement', version: policies.user_agreement.version },
        { key: 'privacy_policy', version: policies.privacy_policy.version },
      ],
    });
    Toast({ message: t('auth.register.success'), theme: 'success' });
    await router.push('/login');
  } catch (error: unknown) {
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    const msg = resolveApiErrorMessage(
      errData,
      undefined,
      error instanceof Error ? error.message : t('auth.register.failed')
    );
    Toast({ message: msg, theme: 'error' });
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([
    authStore.fetchSystemConfig().finally(() => {
      configLoaded.value = true;
    }),
    loadPolicy('user_agreement'),
    loadPolicy('privacy_policy'),
  ]);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>
