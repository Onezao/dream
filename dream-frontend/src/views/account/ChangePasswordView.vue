<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <main class="max-w-xl mx-auto px-4 pt-4 pb-10 space-y-5">
    <!-- Unified Subpage Top Bar -->
    <div class="h-14 flex items-center justify-between border-b border-slate-200">
      <button
        type="button"
        @click="router.push('/profile')"
        class="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-800 min-h-[44px] pr-3"
      >
        <t-icon name="chevron-left" size="18px" />
        <span>{{ t('common.back') }}</span>
      </button>
      <h1 class="text-base font-bold text-slate-900">{{ t('accountSecurity.changePasswordTitle') }}</h1>
      <div class="w-14" />
    </div>

    <p class="text-xs text-slate-600 leading-relaxed bg-slate-100 rounded-xl p-3.5">
      {{ t('accountSecurity.changePasswordDesc') }}
    </p>

    <form class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1.5">
          {{ t('auth.profile.oldPassword') }}
        </label>
        <input
          v-model="oldPassword"
          type="password"
          autocomplete="current-password"
          :placeholder="t('auth.profile.oldPasswordPlaceholder')"
          class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:border-teal-600"
        />
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1.5">
          {{ t('auth.profile.newPassword') }}
        </label>
        <input
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          :placeholder="t('auth.profile.newPasswordPlaceholder')"
          class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:border-teal-600"
        />
        <div class="mt-2.5 rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1 text-xs">
          <p class="font-semibold text-slate-700 mb-1">{{ t('auth.passwordRules.title') }}</p>
          <p :class="strength.minLength ? 'text-emerald-700 font-medium' : 'text-slate-600'">
            {{ strength.minLength ? '✓' : '•' }} {{ t('auth.passwordRules.minLength') }}
          </p>
          <p :class="strength.hasUppercase ? 'text-emerald-700 font-medium' : 'text-slate-600'">
            {{ strength.hasUppercase ? '✓' : '•' }} {{ t('auth.passwordRules.uppercase') }}
          </p>
          <p :class="strength.hasLowercase ? 'text-emerald-700 font-medium' : 'text-slate-600'">
            {{ strength.hasLowercase ? '✓' : '•' }} {{ t('auth.passwordRules.lowercase') }}
          </p>
          <p :class="strength.hasDigit ? 'text-emerald-700 font-medium' : 'text-slate-600'">
            {{ strength.hasDigit ? '✓' : '•' }} {{ t('auth.passwordRules.digit') }}
          </p>
          <p :class="strength.hasSpecial ? 'text-emerald-700 font-medium' : 'text-slate-600'">
            {{ strength.hasSpecial ? '✓' : '•' }} {{ t('auth.passwordRules.special') }}
          </p>
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1.5">
          {{ t('auth.profile.confirmNewPassword') }}
        </label>
        <input
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          :placeholder="t('auth.profile.confirmNewPasswordPlaceholder')"
          class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:border-teal-600"
        />
      </div>

      <button
        type="submit"
        :disabled="saving"
        class="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm font-semibold transition min-h-[44px]"
      >
        {{ saving ? t('auth.profile.saving') : t('auth.profile.confirmSave') }}
      </button>
    </form>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Toast } from 'tdesign-mobile-vue';
import { useAuthStore } from '../../stores/auth';
import { updateUser } from '../../api/auth';
import { resolveApiErrorMessage } from '../../utils/apiError';
import { validatePasswordStrength } from '../../utils/password';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const saving = ref(false);

const strength = computed(() => validatePasswordStrength(newPassword.value));

async function handleSubmit() {
  if (saving.value) return;
  if (!oldPassword.value) {
    Toast({ message: t('auth.profile.oldPasswordRequired'), theme: 'error' });
    return;
  }
  if (!strength.value.valid) {
    Toast({ message: t('auth.passwordRules.invalid'), theme: 'error' });
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    Toast({ message: t('auth.passwordRules.mismatch'), theme: 'error' });
    return;
  }

  saving.value = true;
  try {
    await updateUser({
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    });
    Toast({ message: t('auth.profile.passwordChangedRelogin'), theme: 'success' });
    await authStore.logout();
    await router.push('/login');
  } catch (error: unknown) {
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    const msg = resolveApiErrorMessage(
      errData,
      undefined,
      error instanceof Error ? error.message : t('common.failed')
    );
    Toast({ message: msg, theme: 'error' });
  } finally {
    saving.value = false;
  }
}
</script>
