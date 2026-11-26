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
      <h1 class="text-base font-bold text-slate-900">{{ t('accountSecurity.changeEmailTitle') }}</h1>
      <div class="w-14" />
    </div>

    <p class="text-xs text-slate-600 leading-relaxed bg-slate-100 rounded-xl p-3.5">
      {{ t('accountSecurity.changeEmailDesc') }}
    </p>

    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div v-if="step === 1" class="space-y-4">
        <p class="text-xs text-slate-700 leading-relaxed bg-indigo-50 border border-indigo-200 rounded-xl p-3">
          {{ t('auth.profile.emailStep1Desc', { email: currentDisplayEmail }) }}
        </p>

        <div class="flex gap-2">
          <input
            v-model="oldCode"
            type="text"
            maxlength="6"
            inputmode="numeric"
            :placeholder="t('auth.profile.oldCodePlaceholder')"
            class="flex-1 h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:border-teal-600"
          />
          <button
            type="button"
            :disabled="oldCooldown > 0 || sendingCode"
            @click="sendOldEmailCode"
            class="h-11 px-4 rounded-xl border border-teal-600 text-teal-700 text-xs font-semibold hover:bg-teal-50 disabled:border-slate-300 disabled:text-slate-500 transition shrink-0 min-h-[44px]"
          >
            {{ oldCooldown > 0 ? `${oldCooldown}s` : t('auth.profile.sendCode') }}
          </button>
        </div>

        <button
          type="button"
          :disabled="submitting"
          @click="verifyOldEmailStep"
          class="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm font-semibold transition min-h-[44px]"
        >
          {{ submitting ? t('auth.profile.saving') : t('common.confirm') }}
        </button>
      </div>

      <div v-else class="space-y-4">
        <p class="text-xs text-emerald-800 leading-relaxed bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          {{ t('auth.profile.emailStep2Desc') }}
        </p>

        <div>
          <input
            v-model="newEmail"
            type="email"
            autocomplete="email"
            :placeholder="t('auth.profile.newEmailPlaceholder')"
            class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:border-teal-600"
          />
        </div>

        <div class="flex gap-2">
          <input
            v-model="newCode"
            type="text"
            maxlength="6"
            inputmode="numeric"
            :placeholder="t('auth.profile.newCodePlaceholder')"
            class="flex-1 h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:border-teal-600"
          />
          <button
            type="button"
            :disabled="newCooldown > 0 || sendingCode"
            @click="sendNewEmailCode"
            class="h-11 px-4 rounded-xl border border-teal-600 text-teal-700 text-xs font-semibold hover:bg-teal-50 disabled:border-slate-300 disabled:text-slate-500 transition shrink-0 min-h-[44px]"
          >
            {{ newCooldown > 0 ? `${newCooldown}s` : t('auth.profile.sendCode') }}
          </button>
        </div>

        <button
          type="button"
          :disabled="submitting"
          @click="submitNewEmail"
          class="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm font-semibold transition min-h-[44px]"
        >
          {{ submitting ? t('auth.profile.saving') : t('auth.profile.confirmSave') }}
        </button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Toast } from 'tdesign-mobile-vue';
import { useAuthStore } from '../../stores/auth';
import { changeEmail, sendCode, verifyCurrentEmail } from '../../api/auth';
import { extractApiErrorCode, resolveApiErrorMessage } from '../../utils/apiError';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const step = ref<1 | 2>(1);
const oldCode = ref('');
const newEmail = ref('');
const newCode = ref('');
const securityToken = ref('');
const sendingCode = ref(false);
const submitting = ref(false);
const oldCooldown = ref(0);
const newCooldown = ref(0);
let timerHandle: ReturnType<typeof setInterval> | null = null;

const currentRawEmail = computed(() => authStore.userInfo?.email || '');
const currentDisplayEmail = computed(
  () => authStore.emailMasked || authStore.userInfo?.email || t('auth.profile.unbound')
);

function startCooldown(target: typeof oldCooldown) {
  target.value = 60;
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    if (oldCooldown.value > 0) oldCooldown.value -= 1;
    if (newCooldown.value > 0) newCooldown.value -= 1;
    if (oldCooldown.value <= 0 && newCooldown.value <= 0 && timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
  }, 1000);
}

onUnmounted(() => {
  if (timerHandle) clearInterval(timerHandle);
});

async function sendOldEmailCode() {
  if (!currentRawEmail.value || sendingCode.value || oldCooldown.value > 0) return;
  sendingCode.value = true;
  try {
    await sendCode({
      receiver: currentRawEmail.value,
      channel: 'email',
      scenario: 'change_email_verify_old',
    });
    Toast({ message: t('auth.common.codeSent'), theme: 'success' });
    startCooldown(oldCooldown);
  } catch (error: unknown) {
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    Toast({ message: resolveApiErrorMessage(errData, undefined, t('common.failed')), theme: 'error' });
  } finally {
    sendingCode.value = false;
  }
}

async function sendNewEmailCode() {
  const email = newEmail.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    Toast({ message: t('auth.profile.newEmailInvalid'), theme: 'error' });
    return;
  }
  if (sendingCode.value || newCooldown.value > 0) return;
  sendingCode.value = true;
  try {
    await sendCode({
      receiver: email,
      channel: 'email',
      scenario: 'change_email_verify_new',
    });
    Toast({ message: t('auth.common.codeSent'), theme: 'success' });
    startCooldown(newCooldown);
  } catch (error: unknown) {
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    Toast({ message: resolveApiErrorMessage(errData, undefined, t('common.failed')), theme: 'error' });
  } finally {
    sendingCode.value = false;
  }
}

async function verifyOldEmailStep() {
  if (!oldCode.value.trim()) {
    Toast({ message: t('auth.profile.oldCodeRequired'), theme: 'error' });
    return;
  }
  submitting.value = true;
  try {
    const res = await verifyCurrentEmail({ code: oldCode.value.trim() });
    securityToken.value = res.securityToken;
    step.value = 2;
    Toast({ message: t('auth.profile.step1Verified'), theme: 'success' });
  } catch (error: unknown) {
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    Toast({ message: resolveApiErrorMessage(errData, undefined, t('common.failed')), theme: 'error' });
  } finally {
    submitting.value = false;
  }
}

async function submitNewEmail() {
  const email = newEmail.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    Toast({ message: t('auth.profile.newEmailInvalid'), theme: 'error' });
    return;
  }
  if (!newCode.value.trim()) {
    Toast({ message: t('auth.profile.newCodeRequired'), theme: 'error' });
    return;
  }
  submitting.value = true;
  try {
    await changeEmail({
      newEmail: email,
      code: newCode.value.trim(),
      securityToken: securityToken.value,
    });
    await authStore.fetchAuthUser();
    await authStore.fetchDreamContext();
    Toast({ message: t('auth.profile.emailChanged'), theme: 'success' });
    await router.push('/profile');
  } catch (error: unknown) {
    const errCode = extractApiErrorCode(error);
    if (errCode === 'SECURITY_TOKEN_INVALID') {
      step.value = 1;
      securityToken.value = '';
      oldCode.value = '';
      newCode.value = '';
      Toast({ message: t('auth.profile.securityTokenExpired'), theme: 'warning' });
      return;
    }
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    Toast({ message: resolveApiErrorMessage(errData, undefined, t('common.failed')), theme: 'error' });
  } finally {
    submitting.value = false;
  }
}
</script>
