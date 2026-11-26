<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <div class="max-w-2xl mx-auto px-4 py-6 space-y-6">
    <!-- Header -->
    <header class="flex justify-between items-center pb-2 border-b border-gray-200">
      <h1 class="text-xl font-bold text-gray-900">{{ t('auth.profile.title') }}</h1>
      <button
        type="button"
        @click="router.push('/')"
        class="text-xs text-indigo-600 font-semibold min-h-[44px] px-2 flex items-center"
      >
        {{ t('auth.profile.backToHome') }}
      </button>
    </header>

    <!-- User Info Card -->
    <div class="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm flex items-center space-x-4">
      <div class="relative w-18 h-18 rounded-full bg-indigo-50 border-2 border-indigo-200 overflow-hidden flex items-center justify-center shrink-0">
        <img
          :src="authStore.userInfo?.avatar_url || authStore.userInfo?.avatar || 'https://tdesign.gtimg.com/mobile/demos/avatar1.png'"
          class="w-full h-full object-cover"
          alt="Avatar"
        />
        <button
          type="button"
          @click="openEdit('avatar')"
          class="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] py-0.5 text-center font-medium"
        >
          {{ t('auth.profile.modify') }}
        </button>
      </div>
      <div class="flex-1 min-w-0">
        <h2 class="text-lg font-bold text-gray-900 truncate">
          {{ authStore.userInfo?.nickname || authStore.userInfo?.username || t('auth.profile.defaultUser') }}
        </h2>
        <p class="text-xs text-gray-600 truncate">
          {{ authStore.emailMasked || maskedCurrentEmail }}
        </p>
      </div>
    </div>

    <!-- Student Profiles Section -->
    <div class="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden p-5 space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-gray-100">
        <div class="flex items-center gap-2">
          <h2 class="text-base font-bold text-gray-900">
            {{ t('profile.switcher.title') }}
          </h2>
          <span class="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
            {{ profileStore.profileCount }}/10
          </span>
        </div>
        <button
          type="button"
          :disabled="profileStore.isMaxProfiles"
          @click="openAddStudentModal"
          class="h-9 px-3 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 active:bg-teal-800 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed transition flex items-center gap-1.5 min-h-[44px]"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>{{ t('common.add') }}</span>
        </button>
      </div>

      <!-- Empty Profiles Warning -->
      <div
        v-if="profileStore.profileCount === 0"
        class="py-8 text-center text-gray-500 text-xs space-y-3"
      >
        <p>{{ t('profile.switcher.noChild') }}</p>
        <button
          type="button"
          @click="openAddStudentModal"
          class="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-teal-50 text-teal-700 font-semibold border border-teal-200 text-xs min-h-[44px]"
        >
          {{ t('profile.switcher.addPrompt') }}
        </button>
      </div>

      <!-- Profiles List -->
      <div v-else class="space-y-3">
        <div
          v-for="student in profileStore.profiles"
          :key="student.id"
          class="p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          :class="student.id === profileStore.activeProfileId ? 'border-teal-500 bg-teal-50/40 ring-1 ring-teal-500/20' : 'border-gray-200 bg-white hover:border-gray-300'"
        >
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full overflow-hidden bg-gray-100 ring-1 ring-gray-200 shrink-0 flex items-center justify-center">
              <img
                v-if="student.avatarUrl"
                :src="student.avatarUrl"
                class="w-full h-full object-cover"
                :alt="student.nickname"
              />
              <span v-else class="text-sm font-bold text-teal-700">
                {{ student.surnameInitial || 'D' }}
              </span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-sm sm:text-base text-gray-900">{{ student.nickname }}</span>
                <span
                  v-if="student.id === profileStore.activeProfileId"
                  class="text-[11px] font-semibold bg-teal-600 text-white px-2 py-0.5 rounded-full"
                >
                  {{ t('common.current') }}
                </span>
                <span class="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                  {{ student.age }}{{ t('profile.switcher.ageSuffix') }} · {{ formatGender(student.gender) }}
                </span>
              </div>
              <div class="text-xs text-gray-600 mt-1">
                {{ student.realName }} · ID: <span class="font-mono">{{ student.id }}</span>
              </div>
            </div>
          </div>

          <!-- Student Actions (Touch friendly >= 44px) -->
          <div class="flex items-center flex-wrap gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
            <button
              v-if="student.id !== profileStore.activeProfileId"
              type="button"
              @click="profileStore.selectProfile(student.id)"
              class="h-9 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition min-h-[44px]"
            >
              {{ t('auth.profile.setAsCurrent') }}
            </button>
            <button
              type="button"
              @click="copyTransferCode(student.nickname)"
              class="h-9 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium transition flex items-center gap-1 min-h-[44px]"
            >
              <svg class="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>{{ t('common.transferCode') }}</span>
            </button>
            <button
              type="button"
              @click="openEditStudentModal(student)"
              class="h-9 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium transition min-h-[44px]"
            >
              {{ t('common.edit') }}
            </button>
            <button
              type="button"
              @click="confirmDeleteStudent(student)"
              class="h-9 px-3 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-medium transition min-h-[44px]"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Preferences & Security Items (V1: Email only, NO phone binding/changing) -->
    <div class="bg-white rounded-2xl border border-gray-200/80 shadow-sm divide-y divide-gray-100 overflow-hidden">
      <!-- Nickname Edit -->
      <button
        type="button"
        class="w-full px-5 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors text-left min-h-[52px]"
        @click="openEdit('nickname')"
      >
        <span class="text-sm font-medium text-gray-800">{{ t('auth.profile.editNickname') }}</span>
        <div class="flex items-center text-gray-500 space-x-1">
          <span class="text-xs text-gray-600">{{ authStore.userInfo?.nickname || t('auth.profile.notSet') }}</span>
          <t-icon name="chevron-right" size="16px" />
        </div>
      </button>

      <!-- Avatar URL Edit -->
      <button
        type="button"
        class="w-full px-5 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors text-left min-h-[52px]"
        @click="openEdit('avatar')"
      >
        <span class="text-sm font-medium text-gray-800">{{ t('auth.profile.editAvatar') }}</span>
        <div class="flex items-center text-gray-500 space-x-1">
          <span class="text-xs text-gray-600">{{ t('auth.profile.updateAvatar') }}</span>
          <t-icon name="chevron-right" size="16px" />
        </div>
      </button>

      <!-- Admin Governance Entry (Shown exclusively when effectiveRoles includes admin) -->
      <router-link
        v-if="authStore.hasAnyRole(['admin'])"
        to="/admin/admins"
        class="w-full px-5 py-4 flex justify-between items-center hover:bg-amber-50/50 transition-colors text-left min-h-[52px]"
      >
        <div>
          <p class="text-sm font-semibold text-amber-900">{{ t('adminGovernance.entryTitle') }}</p>
          <p class="text-xs text-amber-800/80 mt-0.5">{{ t('adminGovernance.entryDesc') }}</p>
        </div>
        <t-icon name="chevron-right" size="16px" class="text-amber-700" />
      </router-link>

      <!-- Email Edit (Independent Secondary Page) -->
      <router-link
        to="/account/change-email"
        class="w-full px-5 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors text-left min-h-[52px]"
      >
        <span class="text-sm font-medium text-gray-800">{{ t('auth.profile.changeEmail') }}</span>
        <div class="flex items-center text-gray-500 space-x-1">
          <span class="text-xs text-gray-600">{{ authStore.emailMasked || maskedCurrentEmail }}</span>
          <t-icon name="chevron-right" size="16px" />
        </div>
      </router-link>

      <!-- Change Password (Independent Secondary Page) -->
      <router-link
        to="/account/change-password"
        class="w-full px-5 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors text-left min-h-[52px]"
      >
        <span class="text-sm font-medium text-gray-800">{{ t('auth.profile.changePassword') }}</span>
        <div class="flex items-center text-gray-500 space-x-1">
          <span class="text-xs text-gray-600">{{ t('auth.profile.passwordHint') }}</span>
          <t-icon name="chevron-right" size="16px" />
        </div>
      </router-link>

      <!-- Account Security & Deactivation Center -->
      <router-link
        to="/account/security"
        class="w-full px-5 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors text-left min-h-[52px]"
      >
        <span class="text-sm font-medium text-gray-800">{{ t('accountSecurity.securityCenterTitle') }}</span>
        <div class="flex items-center text-gray-500 space-x-1">
          <span class="text-xs text-gray-600">{{ t('accountSecurity.deactivateTitle') }}</span>
          <t-icon name="chevron-right" size="16px" />
        </div>
      </router-link>

      <!-- Language Preference -->
      <div class="px-5 py-4 flex justify-between items-center gap-3 min-h-[52px]">
        <span class="text-sm font-medium text-gray-800">{{ t('auth.profile.language') }}</span>
        <div class="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            :disabled="updatingLocale"
            @click="switchLanguage('zh-CN')"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition min-h-[36px]"
            :class="currentLocale === 'zh-CN' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'"
          >
            {{ t('auth.profile.languageZh') }}
          </button>
          <button
            type="button"
            :disabled="updatingLocale"
            @click="switchLanguage('en-US')"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition min-h-[36px]"
            :class="currentLocale === 'en-US' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'"
          >
            {{ t('auth.profile.languageEn') }}
          </button>
        </div>
      </div>

      <!-- Clear Local Cache (Preserves Auth Tokens) -->
      <div class="px-5 py-4 flex justify-between items-center gap-3 min-h-[52px]">
        <div>
          <p class="text-sm font-medium text-gray-800">{{ t('auth.profile.clearCache') }}</p>
          <p class="text-xs text-gray-500 mt-0.5">{{ t('auth.profile.clearCacheDesc') }}</p>
        </div>
        <button
          type="button"
          :disabled="clearingCache"
          @click="handleClearCache"
          class="px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition min-h-[44px] shrink-0 disabled:opacity-50"
        >
          {{ t('auth.profile.clearCacheAction') }}
        </button>
      </div>

      <!-- Logout -->
      <button
        type="button"
        class="w-full px-5 py-4 flex justify-between items-center hover:bg-rose-50 transition-colors text-left min-h-[52px]"
        @click="handleLogout"
      >
        <span class="text-sm font-medium text-rose-600">{{ t('auth.profile.logout') }}</span>
        <t-icon name="logout" size="18px" class="text-rose-500" />
      </button>
    </div>

    <!-- Edit Popup Sheet -->
    <t-popup
      v-model="editPopup.visible"
      placement="bottom"
      class="rounded-t-3xl overflow-hidden"
    >
      <div class="bg-white p-6 pb-10 space-y-5">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-bold text-gray-900">{{ editPopup.title }}</h3>
          <button
            type="button"
            @click="editPopup.visible = false"
            class="text-gray-500 hover:text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-end"
          >
            <t-icon name="close" size="18px" />
          </button>
        </div>

        <!-- Nickname Edit -->
        <div v-if="editPopup.type === 'nickname'" class="space-y-3">
          <label class="text-xs text-gray-600 font-medium">{{ t('auth.profile.editNickname') }}</label>
          <input
            v-model="editForm.nickname"
            :placeholder="t('auth.profile.editNicknamePlaceholder')"
            class="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <!-- Avatar Edit (Browser 1:1 WebP Crop + S3 Presigned PUT Upload) -->
        <div v-if="editPopup.type === 'avatar'" class="space-y-4">
          <div class="flex items-center gap-4">
            <label
              for="account-avatar-file"
              class="h-11 px-4 rounded-xl border border-teal-600 text-teal-700 text-xs font-semibold hover:bg-teal-50 cursor-pointer inline-flex items-center min-h-[44px]"
            >
              {{ uploadingAvatar ? t('common.loading') : t('profile.modal.choosePhoto') }}
              <input
                id="account-avatar-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden"
                @change="handleAvatarFilePicked"
              />
            </label>
            <span class="text-xs text-gray-600">{{ t('profile.modal.avatarHint') }}</span>
          </div>
          <div class="space-y-1">
            <label class="text-xs text-gray-600 font-medium">{{ t('auth.profile.avatarUrlLabel') }}</label>
            <input
              v-model="editForm.avatar"
              placeholder="https://st.topee.top/..."
              class="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <!-- Email Change Flow (Step 1 & 2) -->
        <div v-if="editPopup.type === 'email'" class="space-y-3">
          <div v-if="emailFlow.step === 1" class="space-y-3">
            <p class="text-xs text-gray-600 leading-relaxed">
              {{ t('auth.profile.emailStep1Desc', { email: maskedCurrentEmail }) }}
            </p>
            <div class="flex gap-2">
              <input
                v-model="emailFlow.oldCode"
                :placeholder="t('auth.profile.oldCodePlaceholder')"
                class="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                :disabled="oldCodeCooldown > 0 || sendingOldCode"
                @click="sendEmailVerifyCode('change_email_verify_old')"
                class="px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 min-h-[44px] shrink-0 disabled:opacity-50"
              >
                {{ oldCodeCooldown > 0 ? t('auth.common.resendIn', { seconds: oldCodeCooldown }) : t('auth.profile.sendCode') }}
              </button>
            </div>
          </div>

          <div v-if="emailFlow.step === 2" class="space-y-3">
            <p class="text-xs text-gray-600 leading-relaxed">{{ t('auth.profile.emailStep2Desc') }}</p>
            <input
              v-model="emailFlow.newEmail"
              type="email"
              :placeholder="t('auth.profile.newEmailPlaceholder')"
              class="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div class="flex gap-2">
              <input
                v-model="emailFlow.newCode"
                :placeholder="t('auth.profile.newCodePlaceholder')"
                class="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                :disabled="newCodeCooldown > 0 || sendingNewCode"
                @click="sendEmailVerifyCode('change_email_verify_new')"
                class="px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 min-h-[44px] shrink-0 disabled:opacity-50"
              >
                {{ newCodeCooldown > 0 ? t('auth.common.resendIn', { seconds: newCodeCooldown }) : t('auth.profile.sendCode') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Password Change Flow -->
        <div v-if="editPopup.type === 'password'" class="space-y-3">
          <div class="space-y-1">
            <label class="text-xs text-gray-600 font-medium">{{ t('auth.profile.oldPassword') }}</label>
            <input
              v-model="passwordForm.oldPassword"
              type="password"
              autocomplete="current-password"
              :placeholder="t('auth.profile.oldPasswordPlaceholder')"
              class="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div class="space-y-1">
            <label class="text-xs text-gray-600 font-medium">{{ t('auth.profile.newPassword') }}</label>
            <input
              v-model="passwordForm.newPassword"
              type="password"
              autocomplete="new-password"
              :placeholder="t('auth.profile.newPasswordPlaceholder')"
              class="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div class="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-1 text-xs">
            <p class="font-semibold text-gray-700">{{ t('auth.passwordRules.title') }}</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1">
              <span :class="passwordStrength.minLength ? 'text-emerald-700 font-medium' : 'text-gray-600'">
                {{ passwordStrength.minLength ? '✓' : '○' }} {{ t('auth.passwordRules.minLength') }}
              </span>
              <span :class="passwordStrength.hasUppercase ? 'text-emerald-700 font-medium' : 'text-gray-600'">
                {{ passwordStrength.hasUppercase ? '✓' : '○' }} {{ t('auth.passwordRules.uppercase') }}
              </span>
              <span :class="passwordStrength.hasLowercase ? 'text-emerald-700 font-medium' : 'text-gray-600'">
                {{ passwordStrength.hasLowercase ? '✓' : '○' }} {{ t('auth.passwordRules.lowercase') }}
              </span>
              <span :class="passwordStrength.hasDigit ? 'text-emerald-700 font-medium' : 'text-gray-600'">
                {{ passwordStrength.hasDigit ? '✓' : '○' }} {{ t('auth.passwordRules.digit') }}
              </span>
              <span :class="passwordStrength.hasSpecial ? 'text-emerald-700 font-medium' : 'text-gray-600'" class="sm:col-span-2">
                {{ passwordStrength.hasSpecial ? '✓' : '○' }} {{ t('auth.passwordRules.special') }}
              </span>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-xs text-gray-600 font-medium">{{ t('auth.profile.confirmNewPassword') }}</label>
            <input
              v-model="passwordForm.confirmPassword"
              type="password"
              autocomplete="new-password"
              :placeholder="t('auth.profile.confirmNewPasswordPlaceholder')"
              class="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <button
          type="button"
          @click="handleSave"
          :disabled="saving"
          class="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm min-h-[48px]"
        >
          {{ saving ? t('auth.profile.saving') : t('auth.profile.confirmSave') }}
        </button>
      </div>
    </t-popup>

    <!-- Delete Student Profile Confirmation Popup -->
    <t-popup
      v-model="deleteConfirmVisible"
      placement="center"
      class="rounded-2xl overflow-hidden p-6 max-w-sm w-full mx-4"
    >
      <div class="bg-white p-5 space-y-4 text-center">
        <div class="w-12 h-12 rounded-full bg-rose-50 text-rose-600 grid place-items-center mx-auto">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <div>
          <h3 class="text-base font-bold text-gray-900">
            {{ t('profile.modal.deleteConfirmTitle') }}
          </h3>
          <p class="text-xs text-gray-600 mt-1">
            {{ t('profile.modal.deleteConfirmMsg', { name: studentToDelete?.nickname || '' }) }}
          </p>
        </div>
        <div class="flex gap-2.5 pt-2">
          <button
            type="button"
            @click="deleteConfirmVisible = false"
            class="flex-1 h-11 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 min-h-[44px]"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            :disabled="deletingStudent"
            @click="handleDeleteStudent"
            class="flex-1 h-11 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 min-h-[44px]"
          >
            {{ deletingStudent ? t('common.loading') : t('common.delete') }}
          </button>
        </div>
      </div>
    </t-popup>

    <!-- Student Create/Edit Modal Mount -->
    <StudentCreateModal
      v-model="studentModalVisible"
      :edit-profile="selectedEditProfile"
      @success="handleStudentSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Toast, Icon as TIcon, Popup as TPopup } from 'tdesign-mobile-vue';
import { useAuthStore } from '../stores/auth';
import { useProfileStore } from '../stores/profile';
import {
  sendCode,
  verifyCurrentEmail,
  changeEmail,
  updateUser,
  updateMePreferences,
  requestAvatarUploadUrl,
} from '../api/auth';
import { uploadFileToPresignedUrl } from '../api/file';
import { cropImageToSquareWebp } from '../utils/avatarCrop';
import { setLocale, type SupportedLocale } from '../i18n';
import { extractApiErrorCode, resolveApiErrorMessage } from '../utils/apiError';
import { clearL3Snapshots } from '../utils/l3Cache';
import { isValidEmail, maskEmail, validatePasswordStrength } from '../utils/password';
import StudentCreateModal from '../components/StudentCreateModal.vue';
import type { StudentProfileDto, StudentGender } from '../types';

const router = useRouter();
const { t, locale } = useI18n();
const authStore = useAuthStore();
const profileStore = useProfileStore();

const currentLocale = computed(() => locale.value);
const currentAccountEmail = computed(
  () => authStore.userInfo?.email || authStore.dreamContext?.email || ''
);
const maskedCurrentEmail = computed(() =>
  currentAccountEmail.value ? maskEmail(currentAccountEmail.value) : t('auth.profile.unbound')
);

const saving = ref(false);
const updatingLocale = ref(false);
const clearingCache = ref(false);
const uploadingAvatar = ref(false);

async function handleAvatarFilePicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || uploadingAvatar.value) return;

  uploadingAvatar.value = true;
  try {
    const webpBlob = await cropImageToSquareWebp(file);
    const res = await requestAvatarUploadUrl({
      contentType: 'image/webp',
      fileSizeBytes: webpBlob.size,
    });
    const presigned = res.data;
    if (!presigned?.uploadUrl || !presigned.publicUrl) {
      throw new Error('Failed to request upload URL');
    }
    await uploadFileToPresignedUrl(presigned.uploadUrl, webpBlob, 'image/webp');
    editForm.avatar = presigned.publicUrl;
    Toast({ message: t('profile.modal.avatarSuccess'), theme: 'success' });
  } catch (error: unknown) {
    const errData = (error as { response?: { data?: unknown } })?.response?.data;
    Toast({
      message: resolveApiErrorMessage(
        errData,
        undefined,
        error instanceof Error ? error.message : t('common.failed')
      ),
      theme: 'error',
    });
  } finally {
    uploadingAvatar.value = false;
    input.value = '';
  }
}

const editPopup = reactive({
  visible: false,
  type: '' as 'nickname' | 'avatar' | 'email' | 'password',
  title: '',
});

const editForm = reactive({
  nickname: '',
  avatar: '',
});

const emailFlow = reactive({
  step: 1 as 1 | 2,
  oldCode: '',
  securityToken: '',
  newEmail: '',
  newCode: '',
});

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const passwordStrength = computed(() => validatePasswordStrength(passwordForm.newPassword));

const oldCodeCooldown = ref(0);
const newCodeCooldown = ref(0);
const sendingOldCode = ref(false);
const sendingNewCode = ref(false);
let oldCodeTimer: ReturnType<typeof setInterval> | null = null;
let newCodeTimer: ReturnType<typeof setInterval> | null = null;

// Student Profile Management State
const studentModalVisible = ref(false);
const selectedEditProfile = ref<StudentProfileDto | null>(null);
const deleteConfirmVisible = ref(false);
const studentToDelete = ref<StudentProfileDto | null>(null);
const deletingStudent = ref(false);

onMounted(() => {
  authStore.fetchAuthUser();
  profileStore.fetchProfiles().catch(() => {
    // Ignore initial profile fetch error
  });
});

onUnmounted(() => {
  if (oldCodeTimer) clearInterval(oldCodeTimer);
  if (newCodeTimer) clearInterval(newCodeTimer);
});

function formatGender(gender: StudentGender): string {
  switch (gender) {
    case 'male':
      return t('profile.modal.male');
    case 'female':
      return t('profile.modal.female');
    default:
      return t('profile.modal.undisclosed');
  }
}

function openAddStudentModal() {
  if (profileStore.isMaxProfiles) {
    Toast({ message: t('profile.errors.PROFILE_LIMIT_EXCEEDED'), theme: 'warning' });
    return;
  }
  selectedEditProfile.value = null;
  studentModalVisible.value = true;
}

function openEditStudentModal(student: StudentProfileDto) {
  selectedEditProfile.value = student;
  studentModalVisible.value = true;
}

function confirmDeleteStudent(student: StudentProfileDto) {
  studentToDelete.value = student;
  deleteConfirmVisible.value = true;
}

async function handleDeleteStudent() {
  if (!studentToDelete.value) return;
  deletingStudent.value = true;
  try {
    await profileStore.deleteProfile(studentToDelete.value.id);
    Toast({ message: t('common.success'), theme: 'success' });
    deleteConfirmVisible.value = false;
    studentToDelete.value = null;
  } catch (err: unknown) {
    const errData = (err as { response?: { data?: unknown } })?.response?.data;
    const msg = resolveApiErrorMessage(
      errData,
      undefined,
      err instanceof Error ? err.message : t('common.failed')
    );
    Toast({ message: msg, theme: 'error' });
  } finally {
    deletingStudent.value = false;
  }
}

function handleStudentSuccess(_profile: StudentProfileDto) {
  Toast({ message: t('common.success'), theme: 'success' });
}

function copyTransferCode(nickname: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard
      .writeText(nickname)
      .then(() => {
        Toast({ message: `${t('common.copied')}: ${nickname}`, theme: 'success' });
      })
      .catch(() => {
        Toast({ message: nickname, theme: 'success' });
      });
  } else {
    Toast({ message: nickname, theme: 'success' });
  }
}

function openEdit(type: 'nickname' | 'avatar' | 'email' | 'password') {
  editPopup.type = type;
  editPopup.visible = true;
  if (type === 'nickname') {
    editPopup.title = t('auth.profile.editNickname');
    editForm.nickname = authStore.userInfo?.nickname || '';
  } else if (type === 'avatar') {
    editPopup.title = t('auth.profile.updateAvatar');
    editForm.avatar = authStore.userInfo?.avatar || authStore.userInfo?.avatar_url || '';
  } else if (type === 'email') {
    editPopup.title = t('auth.profile.changeEmail');
    emailFlow.step = 1;
    emailFlow.oldCode = '';
    emailFlow.securityToken = '';
    emailFlow.newEmail = '';
    emailFlow.newCode = '';
  } else if (type === 'password') {
    editPopup.title = t('auth.profile.changePassword');
    passwordForm.oldPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
  }
}

function startEmailCooldown(which: 'old' | 'new') {
  if (which === 'old') {
    if (oldCodeTimer) clearInterval(oldCodeTimer);
    oldCodeCooldown.value = 60;
    oldCodeTimer = setInterval(() => {
      oldCodeCooldown.value--;
      if (oldCodeCooldown.value <= 0 && oldCodeTimer) {
        clearInterval(oldCodeTimer);
        oldCodeTimer = null;
      }
    }, 1000);
  } else {
    if (newCodeTimer) clearInterval(newCodeTimer);
    newCodeCooldown.value = 60;
    newCodeTimer = setInterval(() => {
      newCodeCooldown.value--;
      if (newCodeCooldown.value <= 0 && newCodeTimer) {
        clearInterval(newCodeTimer);
        newCodeTimer = null;
      }
    }, 1000);
  }
}

async function sendEmailVerifyCode(scenario: 'change_email_verify_old' | 'change_email_verify_new') {
  const isOld = scenario === 'change_email_verify_old';
  const receiver = isOld ? currentAccountEmail.value : emailFlow.newEmail.trim();

  if (!receiver || !isValidEmail(receiver)) {
    Toast({
      message: isOld ? t('auth.profile.unbound') : t('auth.profile.newEmailInvalid'),
      theme: 'error',
    });
    return;
  }

  if (isOld) {
    if (sendingOldCode.value || oldCodeCooldown.value > 0) return;
    sendingOldCode.value = true;
  } else {
    if (sendingNewCode.value || newCodeCooldown.value > 0) return;
    sendingNewCode.value = true;
  }

  try {
    await sendCode({
      receiver,
      channel: 'email',
      scenario,
    });
    Toast({ message: t('auth.common.codeSent'), theme: 'success' });
    startEmailCooldown(isOld ? 'old' : 'new');
  } catch (err: unknown) {
    const errData = (err as { response?: { data?: unknown } })?.response?.data;
    const msg = resolveApiErrorMessage(
      errData,
      undefined,
      err instanceof Error ? err.message : t('common.failed')
    );
    Toast({ message: msg, theme: 'error' });
  } finally {
    if (isOld) sendingOldCode.value = false;
    else sendingNewCode.value = false;
  }
}

async function handleSave() {
  if (saving.value) return;
  saving.value = true;
  try {
    if (editPopup.type === 'nickname') {
      if (!editForm.nickname.trim()) {
        Toast({ message: t('auth.profile.nicknameEmpty'), theme: 'error' });
        return;
      }
      await authStore.updateProfile({ nickname: editForm.nickname.trim() });
      Toast({ message: t('auth.profile.nicknameSuccess'), theme: 'success' });
      editPopup.visible = false;
    } else if (editPopup.type === 'avatar') {
      if (!editForm.avatar.trim()) {
        Toast({ message: t('auth.profile.avatarEmpty'), theme: 'error' });
        return;
      }
      await authStore.updateProfile({ avatar: editForm.avatar.trim() });
      Toast({ message: t('auth.profile.avatarSuccess'), theme: 'success' });
      editPopup.visible = false;
    } else if (editPopup.type === 'email') {
      if (emailFlow.step === 1) {
        if (!emailFlow.oldCode.trim()) {
          Toast({ message: t('auth.profile.oldCodeRequired'), theme: 'error' });
          return;
        }
        const res = await verifyCurrentEmail({ code: emailFlow.oldCode.trim() });
        const token =
          res.securityToken ||
          (res as { data?: { securityToken?: string } }).data?.securityToken ||
          '';
        emailFlow.securityToken = token;
        emailFlow.step = 2;
        Toast({ message: t('auth.profile.step1Verified'), theme: 'success' });
      } else {
        if (!isValidEmail(emailFlow.newEmail)) {
          Toast({ message: t('auth.profile.newEmailInvalid'), theme: 'error' });
          return;
        }
        if (!emailFlow.newCode.trim()) {
          Toast({ message: t('auth.profile.newCodeRequired'), theme: 'error' });
          return;
        }
        await changeEmail({
          code: emailFlow.newCode.trim(),
          newEmail: emailFlow.newEmail.trim(),
          securityToken: emailFlow.securityToken,
        });
        Toast({ message: t('auth.profile.emailChanged'), theme: 'success' });
        await authStore.fetchAuthUser();
        await authStore.fetchDreamContext().catch(() => {});
        editPopup.visible = false;
      }
    } else if (editPopup.type === 'password') {
      if (!passwordForm.oldPassword) {
        Toast({ message: t('auth.profile.oldPasswordRequired'), theme: 'error' });
        return;
      }
      if (!passwordStrength.value.valid) {
        Toast({ message: t('auth.passwordRules.invalid'), theme: 'error' });
        return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        Toast({ message: t('auth.passwordRules.mismatch'), theme: 'error' });
        return;
      }
      await updateUser({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      });
      editPopup.visible = false;
      Toast({ message: t('auth.profile.passwordChangedRelogin'), theme: 'success' });
      await authStore.logout();
      await router.push('/login');
    }
  } catch (error: unknown) {
    const errCode = extractApiErrorCode(error);
    if (editPopup.type === 'email' && emailFlow.step === 2 && errCode === 'SECURITY_TOKEN_INVALID') {
      emailFlow.step = 1;
      emailFlow.securityToken = '';
      emailFlow.oldCode = '';
      emailFlow.newCode = '';
      Toast({ message: t('auth.profile.securityTokenExpired'), theme: 'warning' });
      return;
    }

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

async function switchLanguage(nextLocale: SupportedLocale) {
  if (currentLocale.value === nextLocale || updatingLocale.value) return;
  setLocale(nextLocale);
  updatingLocale.value = true;
  try {
    await updateMePreferences({ locale: nextLocale });
    if (authStore.dreamContext) {
      authStore.dreamContext.preferences = {
        ...authStore.dreamContext.preferences,
        locale: nextLocale,
      };
    }
    Toast({ message: t('auth.profile.languageUpdated'), theme: 'success' });
  } catch {
    // Keep local dream_locale applied even if remote sync fails
    Toast({ message: t('auth.profile.languageUpdated'), theme: 'success' });
  } finally {
    updatingLocale.value = false;
  }
}

async function handleClearCache() {
  if (clearingCache.value) return;
  clearingCache.value = true;
  try {
    await clearL3Snapshots();
    Toast({ message: t('auth.profile.cacheCleared'), theme: 'success' });
  } finally {
    clearingCache.value = false;
  }
}

async function handleLogout() {
  await authStore.logout();
  Toast({ message: t('auth.profile.logoutSuccess'), theme: 'success' });
  await router.push('/login');
}
</script>
