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
      <h1 class="text-base font-bold text-slate-900">{{ t('accountSecurity.securityCenterTitle') }}</h1>
      <div class="w-14" />
    </div>

    <!-- Account Status Summary -->
    <section class="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
      <div class="px-5 py-4 flex items-center justify-between">
        <span class="text-sm text-slate-700 font-medium">{{ t('accountSecurity.currentStatusLabel') }}</span>
        <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          {{ t('accountSecurity.statusNormal') }}
        </span>
      </div>
      <div class="px-5 py-4 flex items-center justify-between">
        <span class="text-sm text-slate-700 font-medium">{{ t('accountSecurity.emailBoundLabel') }}</span>
        <span class="text-xs font-mono text-slate-700">
          {{ authStore.emailMasked || authStore.userInfo?.email || t('auth.profile.unbound') }}
        </span>
      </div>
    </section>

    <!-- Deactivate Account Card -->
    <section class="bg-white rounded-2xl border border-rose-200 shadow-sm p-5 space-y-4">
      <h2 class="text-base font-bold text-rose-700">{{ t('accountSecurity.deactivateTitle') }}</h2>
      <p class="text-xs text-slate-700 leading-relaxed">
        {{ t('accountSecurity.deactivateWarning') }}
      </p>

      <div
        v-if="authStore.isPermanentPrimary"
        class="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 font-medium leading-relaxed"
      >
        {{ t('accountSecurity.deactivateBlockedMaster') }}
      </div>

      <form v-else class="space-y-4" @submit.prevent="handleDeactivate">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5">
            {{ t('accountSecurity.deactivateConfirmLabel') }}
          </label>
          <input
            v-model.trim="confirmEmail"
            type="email"
            autocomplete="email"
            :placeholder="t('accountSecurity.deactivateConfirmPlaceholder')"
            class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:border-rose-600"
          />
        </div>

        <button
          type="submit"
          :disabled="submitting || !confirmEmail"
          class="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-sm font-semibold transition min-h-[44px]"
        >
          {{ submitting ? t('accountSecurity.deactivating') : t('accountSecurity.deactivateSubmit') }}
        </button>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Toast } from 'tdesign-mobile-vue';
import { useAuthStore } from '../../stores/auth';
import { resolveApiErrorMessage } from '../../utils/apiError';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const confirmEmail = ref('');
const submitting = ref(false);

async function handleDeactivate() {
  if (submitting.value || !confirmEmail.value) return;
  submitting.value = true;
  try {
    await authStore.deactivateAccount(confirmEmail.value);
    Toast({ message: t('accountSecurity.deactivateSuccess'), theme: 'success' });
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
    submitting.value = false;
  }
}
</script>
