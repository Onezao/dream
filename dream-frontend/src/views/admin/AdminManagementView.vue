<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <main class="max-w-2xl mx-auto px-4 pt-4 pb-12 space-y-5">
    <!-- Top Subpage Bar -->
    <div class="h-14 flex items-center justify-between border-b border-slate-200">
      <button
        type="button"
        @click="router.push('/profile')"
        class="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-800 min-h-[44px] pr-3"
      >
        <t-icon name="chevron-left" size="18px" />
        <span>{{ t('common.back') }}</span>
      </button>
      <h1 class="text-base font-bold text-slate-900">{{ t('adminGovernance.pageTitle') }}</h1>
      <button
        v-if="canManage"
        type="button"
        @click="openGrantDialog"
        class="h-10 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold min-h-[44px] shrink-0"
      >
        + {{ t('adminGovernance.addAdmin') }}
      </button>
      <div v-else class="w-14" />
    </div>

    <!-- Read-only Banner for Ordinary Admins -->
    <div
      v-if="!loading && !canManage"
      class="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-xs text-slate-700 leading-relaxed"
    >
      {{ t('adminGovernance.readonlyBanner') }}
    </div>

    <!-- Client-Side Search & Filter Bar (Mode A) -->
    <div class="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm space-y-3">
      <input
        v-model.trim="searchKeyword"
        type="text"
        :placeholder="t('adminGovernance.searchPlaceholder')"
        class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:border-teal-600"
      />
      <div class="flex gap-2">
        <button
          v-for="tab in (['ALL', 'ACTIVE', 'REVOKED'] as const)"
          :key="tab"
          type="button"
          @click="statusFilter = tab"
          class="flex-1 h-10 rounded-xl text-xs font-semibold transition min-h-[44px]"
          :class="
            statusFilter === tab
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          "
        >
          {{
            tab === 'ALL'
              ? t('adminGovernance.filterAll')
              : tab === 'ACTIVE'
                ? t('adminGovernance.filterActive')
                : t('adminGovernance.filterRevoked')
          }}
        </button>
      </div>
    </div>

    <!-- Admin Roster List (Zero Audit Log UI) -->
    <div v-if="loading" class="py-10 text-center text-xs text-slate-600">
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="filteredItems.length === 0"
      class="py-10 text-center text-xs text-slate-600 bg-white rounded-2xl border border-slate-200"
    >
      {{ t('adminGovernance.emptyList') }}
    </div>

    <div v-else class="space-y-3">
      <article
        v-for="item in filteredItems"
        :key="item.id"
        class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-bold text-slate-900 truncate">
                {{ item.displayName || item.accountId }}
              </span>
              <span
                v-if="item.isPermanentPrimary"
                class="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300"
              >
                <span>{{ t('adminGovernance.permanentBadge') }}</span>
                <button
                  type="button"
                  :aria-label="t('adminGovernance.emergencyInfoTitle')"
                  @click="showEmergencyInfo = !showEmergencyInfo"
                  class="w-5 h-5 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-[11px] inline-flex items-center justify-center"
                >
                  i
                </button>
              </span>
              <span
                v-else-if="item.status === 'ACTIVE'"
                class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                {{ t('adminGovernance.activeBadge') }}
              </span>
              <span
                v-else
                class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300"
              >
                {{ t('adminGovernance.revokedBadge') }}
              </span>
            </div>

            <p class="text-xs font-mono text-slate-600">{{ item.emailMasked }}</p>

            <!-- Co-Role Badges -->
            <div class="flex flex-wrap gap-1.5 pt-0.5">
              <span
                v-for="role in item.coRoles"
                :key="role"
                class="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
              >
                {{ t(`adminGovernance.roleLabel.${role}`) }}
              </span>
            </div>
          </div>

          <!-- Action Buttons: Only Permanent Master Admin sees write buttons -->
          <div v-if="canManage && item.status === 'ACTIVE'" class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              @click="openRenameDialog(item)"
              class="h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[44px]"
            >
              {{ t('adminGovernance.editName') }}
            </button>
            <button
              v-if="!item.isPermanentPrimary"
              type="button"
              @click="openRevokeDialog(item)"
              class="h-10 px-3 rounded-xl border border-rose-300 text-xs font-semibold text-rose-700 hover:bg-rose-50 min-h-[44px]"
            >
              {{ t('adminGovernance.revokeAdmin') }}
            </button>
          </div>
        </div>

        <!-- Collapsible Emergency Recovery Info Popover (Natural Language) -->
        <div
          v-if="item.isPermanentPrimary && showEmergencyInfo"
          class="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-1.5 leading-relaxed"
        >
          <p class="font-bold">{{ t('adminGovernance.emergencyInfoTitle') }}</p>
          <p>{{ t('adminGovernance.emergencyInfoBody') }}</p>
        </div>

        <div class="text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-slate-100">
          <span v-if="item.grantedByName">
            {{ t('adminGovernance.grantedBy', { name: item.grantedByName }) }}
          </span>
          <span v-if="item.revokedByName">
            {{ t('adminGovernance.revokedBy', { name: item.revokedByName }) }}
          </span>
        </div>
      </article>
    </div>

    <!-- Grant Ordinary Admin Sheet -->
    <t-popup v-model="grantDialog.visible" placement="bottom" class="rounded-t-3xl overflow-hidden">
      <div class="bg-white p-6 pb-8 space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-bold text-slate-900">{{ t('adminGovernance.addAdmin') }}</h3>
          <button type="button" @click="grantDialog.visible = false" class="p-2 text-slate-600 min-h-[44px]">
            <t-icon name="close" size="20px" />
          </button>
        </div>

        <div class="space-y-2">
          <label class="block text-xs font-semibold text-slate-700">{{ t('adminGovernance.lookupEmailLabel') }}</label>
          <div class="flex gap-2">
            <input
              v-model.trim="grantDialog.email"
              type="email"
              :placeholder="t('adminGovernance.lookupEmailPlaceholder')"
              class="flex-1 h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white"
            />
            <button
              type="button"
              :disabled="grantDialog.lookingUp"
              @click="handleLookup"
              class="h-11 px-3.5 rounded-xl border border-teal-600 text-teal-700 text-xs font-semibold min-h-[44px] shrink-0"
            >
              {{ t('adminGovernance.lookupBtn') }}
            </button>
          </div>
        </div>

        <div
          v-if="grantDialog.lookup"
          class="rounded-xl p-3 text-xs space-y-1 border"
          :class="
            grantDialog.lookup.isEligibleToGrant
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          "
        >
          <p class="font-semibold">{{ grantDialog.lookup.emailMasked }}</p>
          <p>
            {{
              grantDialog.lookup.currentAdminStatus === 'ACTIVE'
                ? t('adminGovernance.lookupAlreadyActive')
                : grantDialog.lookup.isEligibleToGrant
                  ? t('adminGovernance.lookupEligible')
                  : t('adminGovernance.lookupNotActive')
            }}
          </p>
        </div>

        <template v-if="grantDialog.lookup?.isEligibleToGrant">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">
              {{ t('adminGovernance.displayNameLabel') }}
            </label>
            <input
              v-model.trim="grantDialog.displayName"
              type="text"
              maxlength="50"
              :placeholder="t('adminGovernance.displayNamePlaceholder')"
              class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">
              {{ t('adminGovernance.grantConfirmLabel') }}
            </label>
            <input
              v-model.trim="grantDialog.confirmText"
              type="text"
              class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white"
            />
          </div>
          <button
            type="button"
            :disabled="grantDialog.submitting"
            @click="submitGrant"
            class="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm font-semibold min-h-[44px]"
          >
            {{ t('adminGovernance.grantSubmit') }}
          </button>
        </template>
      </div>
    </t-popup>

    <!-- Rename Admin Sheet -->
    <t-popup v-model="renameDialog.visible" placement="bottom" class="rounded-t-3xl overflow-hidden">
      <div class="bg-white p-6 pb-8 space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-bold text-slate-900">{{ t('adminGovernance.renameTitle') }}</h3>
          <button type="button" @click="renameDialog.visible = false" class="p-2 text-slate-600 min-h-[44px]">
            <t-icon name="close" size="20px" />
          </button>
        </div>
        <input
          v-model.trim="renameDialog.displayName"
          type="text"
          maxlength="50"
          :placeholder="t('adminGovernance.displayNamePlaceholder')"
          class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white"
        />
        <button
          type="button"
          :disabled="renameDialog.submitting"
          @click="submitRename"
          class="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-sm font-semibold min-h-[44px]"
        >
          {{ t('auth.profile.confirmSave') }}
        </button>
      </div>
    </t-popup>

    <!-- Revoke Admin Sheet -->
    <t-popup v-model="revokeDialog.visible" placement="bottom" class="rounded-t-3xl overflow-hidden">
      <div class="bg-white p-6 pb-8 space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-bold text-rose-700">{{ t('adminGovernance.revokeTitle') }}</h3>
          <button type="button" @click="revokeDialog.visible = false" class="p-2 text-slate-600 min-h-[44px]">
            <t-icon name="close" size="20px" />
          </button>
        </div>
        <p class="text-xs text-slate-700 bg-rose-50 border border-rose-200 rounded-xl p-3 leading-relaxed">
          {{ t('adminGovernance.revokeNotice', { name: revokeDialog.target?.displayName || '' }) }}
        </p>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">
            {{ t('adminGovernance.revokeConfirmLabel', { name: revokeDialog.target?.displayName || '' }) }}
          </label>
          <input
            v-model.trim="revokeDialog.confirmText"
            type="text"
            class="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white"
          />
        </div>
        <button
          type="button"
          :disabled="revokeDialog.submitting || !revokeDialog.confirmText"
          @click="submitRevoke"
          class="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-sm font-semibold min-h-[44px]"
        >
          {{ t('adminGovernance.revokeSubmit') }}
        </button>
      </div>
    </t-popup>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Toast } from 'tdesign-mobile-vue';
import {
  grantAdmin,
  listAdmins,
  lookupAdminCandidate,
  revokeAdmin,
  updateAdminDisplayName,
  type AdminAccountItem,
  type AdminLookupResult,
} from '../../api/auth';
import { resolveApiErrorMessage } from '../../utils/apiError';

const { t } = useI18n();
const router = useRouter();

const loading = ref(true);
const canManage = ref(false);
const items = ref<AdminAccountItem[]>([]);
const searchKeyword = ref('');
const statusFilter = ref<'ALL' | 'ACTIVE' | 'REVOKED'>('ALL');
const showEmergencyInfo = ref(false);

const grantDialog = reactive<{
  visible: boolean;
  email: string;
  lookingUp: boolean;
  lookup: AdminLookupResult | null;
  displayName: string;
  confirmText: string;
  submitting: boolean;
}>({
  visible: false,
  email: '',
  lookingUp: false,
  lookup: null,
  displayName: '',
  confirmText: '',
  submitting: false,
});

const renameDialog = reactive<{
  visible: boolean;
  target: AdminAccountItem | null;
  displayName: string;
  submitting: boolean;
}>({
  visible: false,
  target: null,
  displayName: '',
  submitting: false,
});

const revokeDialog = reactive<{
  visible: boolean;
  target: AdminAccountItem | null;
  confirmText: string;
  submitting: boolean;
}>({
  visible: false,
  target: null,
  confirmText: '',
  submitting: false,
});

const filteredItems = computed(() => {
  const kw = searchKeyword.value.toLowerCase();
  return items.value.filter((item) => {
    if (statusFilter.value !== 'ALL' && item.status !== statusFilter.value) {
      return false;
    }
    if (!kw) return true;
    return (
      item.displayName.toLowerCase().includes(kw) ||
      item.emailMasked.toLowerCase().includes(kw)
    );
  });
});

async function loadRoster() {
  loading.value = true;
  try {
    const res = await listAdmins();
    canManage.value = Boolean(res.data?.canManage);
    items.value = res.data?.items ?? [];
  } catch (error: unknown) {
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    Toast({ message: resolveApiErrorMessage(errData, undefined, t('common.failed')), theme: 'error' });
  } finally {
    loading.value = false;
  }
}

function openGrantDialog() {
  grantDialog.email = '';
  grantDialog.lookup = null;
  grantDialog.displayName = '';
  grantDialog.confirmText = '';
  grantDialog.visible = true;
}

async function handleLookup() {
  if (!grantDialog.email || grantDialog.lookingUp) return;
  grantDialog.lookingUp = true;
  try {
    const res = await lookupAdminCandidate(grantDialog.email);
    grantDialog.lookup = res.data ?? null;
    if (res.data?.currentDisplayName) {
      grantDialog.displayName = res.data.currentDisplayName;
    }
  } catch (error: unknown) {
    grantDialog.lookup = null;
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    Toast({ message: resolveApiErrorMessage(errData, undefined, t('common.failed')), theme: 'error' });
  } finally {
    grantDialog.lookingUp = false;
  }
}

async function submitGrant() {
  if (grantDialog.submitting) return;
  grantDialog.submitting = true;
  try {
    await grantAdmin({
      email: grantDialog.email,
      displayName: grantDialog.displayName,
      confirmText: grantDialog.confirmText,
    });
    Toast({ message: t('adminGovernance.grantSuccess'), theme: 'success' });
    grantDialog.visible = false;
    await loadRoster();
  } catch (error: unknown) {
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    Toast({ message: resolveApiErrorMessage(errData, undefined, t('common.failed')), theme: 'error' });
  } finally {
    grantDialog.submitting = false;
  }
}

function openRenameDialog(item: AdminAccountItem) {
  renameDialog.target = item;
  renameDialog.displayName = item.displayName;
  renameDialog.visible = true;
}

async function submitRename() {
  if (!renameDialog.target || renameDialog.submitting) return;
  renameDialog.submitting = true;
  try {
    await updateAdminDisplayName(renameDialog.target.id, renameDialog.displayName);
    Toast({ message: t('adminGovernance.renameSuccess'), theme: 'success' });
    renameDialog.visible = false;
    await loadRoster();
  } catch (error: unknown) {
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    Toast({ message: resolveApiErrorMessage(errData, undefined, t('common.failed')), theme: 'error' });
  } finally {
    renameDialog.submitting = false;
  }
}

function openRevokeDialog(item: AdminAccountItem) {
  revokeDialog.target = item;
  revokeDialog.confirmText = '';
  revokeDialog.visible = true;
}

async function submitRevoke() {
  if (!revokeDialog.target || revokeDialog.submitting) return;
  revokeDialog.submitting = true;
  try {
    await revokeAdmin(revokeDialog.target.id, revokeDialog.confirmText);
    Toast({ message: t('adminGovernance.revokeSuccess'), theme: 'success' });
    revokeDialog.visible = false;
    await loadRoster();
  } catch (error: unknown) {
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    Toast({ message: resolveApiErrorMessage(errData, undefined, t('common.failed')), theme: 'error' });
  } finally {
    revokeDialog.submitting = false;
  }
}

onMounted(() => {
  void loadRoster();
});
</script>
