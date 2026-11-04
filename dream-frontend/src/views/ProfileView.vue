<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <div class="max-w-2xl mx-auto px-4 py-6 space-y-6">
    <!-- Header -->
    <header class="flex justify-between items-center pb-2 border-b border-gray-200">
      <h1 class="text-xl font-bold text-gray-900">个人资料与设置</h1>
      <button @click="router.push('/')" class="text-xs text-indigo-600 font-medium">
        返回工作台
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
          @click="openEdit('avatar')"
          class="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] py-0.5 text-center font-medium"
        >
          修改
        </button>
      </div>
      <div class="flex-1 min-w-0">
        <h2 class="text-lg font-bold text-gray-900 truncate">
          {{ authStore.userInfo?.nickname || authStore.userInfo?.username || '用户' }}
        </h2>
        <p class="text-xs text-gray-500 truncate">
          {{ authStore.userInfo?.email || authStore.userInfo?.phone || '未绑定' }}
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
          <span class="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {{ profileStore.profileCount }}/10
          </span>
        </div>
        <button
          type="button"
          :disabled="profileStore.isMaxProfiles"
          @click="openAddStudentModal"
          class="h-9 px-3 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 active:bg-teal-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition flex items-center gap-1.5 min-h-[44px]"
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
        class="py-8 text-center text-gray-400 text-xs space-y-3"
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
                  class="text-[10px] font-semibold bg-teal-600 text-white px-2 py-0.5 rounded-full"
                >
                  {{ t('common.current') }}
                </span>
                <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {{ student.age }}{{ t('profile.switcher.ageSuffix') }} · {{ formatGender(student.gender) }}
                </span>
              </div>
              <div class="text-xs text-gray-400 mt-1">
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
              设为当前
            </button>
            <button
              type="button"
              @click="copyTransferCode(student.nickname)"
              class="h-9 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium transition flex items-center gap-1 min-h-[44px]"
            >
              <svg class="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

    <!-- Preferences & Security Items -->
    <div class="bg-white rounded-2xl border border-gray-200/80 shadow-sm divide-y divide-gray-100 overflow-hidden">
      <!-- Nickname Edit -->
      <div
        class="px-5 py-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer transition-colors"
        @click="openEdit('nickname')"
      >
        <span class="text-sm font-medium text-gray-800">修改昵称</span>
        <div class="flex items-center text-gray-400 space-x-1">
          <span class="text-xs text-gray-600">{{ authStore.userInfo?.nickname || '未设置' }}</span>
          <t-icon name="chevron-right" size="16px" />
        </div>
      </div>

      <!-- Avatar URL Edit -->
      <div
        class="px-5 py-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer transition-colors"
        @click="openEdit('avatar')"
      >
        <span class="text-sm font-medium text-gray-800">修改头像</span>
        <div class="flex items-center text-gray-400 space-x-1">
          <span class="text-xs text-gray-400">更新图片</span>
          <t-icon name="chevron-right" size="16px" />
        </div>
      </div>

      <!-- Email Edit (Two-Step Verification) -->
      <div
        class="px-5 py-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer transition-colors"
        @click="openEdit('email')"
      >
        <span class="text-sm font-medium text-gray-800">换绑邮箱</span>
        <div class="flex items-center text-gray-400 space-x-1">
          <span class="text-xs text-gray-600">{{ authStore.userInfo?.email || '未绑定' }}</span>
          <t-icon name="chevron-right" size="16px" />
        </div>
      </div>

      <!-- Logout -->
      <div
        class="px-5 py-4 flex justify-between items-center hover:bg-red-50 cursor-pointer transition-colors"
        @click="handleLogout"
      >
        <span class="text-sm font-medium text-red-600">退出登录</span>
        <t-icon name="logout" size="18px" class="text-red-400" />
      </div>
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
          <button @click="editPopup.visible = false" class="text-gray-400 hover:text-gray-600">
            <t-icon name="close" size="18px" />
          </button>
        </div>

        <!-- Nickname Edit -->
        <div v-if="editPopup.type === 'nickname'" class="space-y-3">
          <label class="text-xs text-gray-500 font-medium">新昵称</label>
          <input
            v-model="editForm.nickname"
            placeholder="请输入新昵称"
            class="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <!-- Avatar Edit -->
        <div v-if="editPopup.type === 'avatar'" class="space-y-3">
          <label class="text-xs text-gray-500 font-medium">头像图片地址 (URL)</label>
          <input
            v-model="editForm.avatar"
            placeholder="https://example.com/avatar.png"
            class="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <!-- Email Change Flow (Step 1 & 2) -->
        <div v-if="editPopup.type === 'email'" class="space-y-3">
          <div v-if="emailFlow.step === 1" class="space-y-2">
            <p class="text-xs text-gray-500">
              第 1 步：我们将向原邮箱 <span class="font-bold text-gray-800">{{ authStore.userInfo?.email }}</span> 发送验证码。
            </p>
            <div class="flex gap-2">
              <input
                v-model="emailFlow.oldCode"
                placeholder="原邮箱验证码"
                class="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm"
              />
              <button
                @click="sendEmailVerifyCode('change_email_verify_old')"
                class="px-3 py-2 text-xs font-medium rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200"
              >
                发送验证码
              </button>
            </div>
          </div>

          <div v-if="emailFlow.step === 2" class="space-y-2">
            <p class="text-xs text-gray-500">第 2 步：输入新邮箱并完成验证。</p>
            <input
              v-model="emailFlow.newEmail"
              placeholder="新邮箱地址"
              class="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm mb-2"
            />
            <div class="flex gap-2">
              <input
                v-model="emailFlow.newCode"
                placeholder="新邮箱验证码"
                class="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm"
              />
              <button
                @click="sendEmailVerifyCode('change_email_verify_new')"
                class="px-3 py-2 text-xs font-medium rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200"
              >
                发送验证码
              </button>
            </div>
          </div>
        </div>

        <button
          @click="handleSave"
          :disabled="saving"
          class="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
        >
          {{ saving ? '保存中...' : '确认保存' }}
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
          <p class="text-xs text-gray-500 mt-1">
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
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Toast, Icon as TIcon, Popup as TPopup } from 'tdesign-mobile-vue';
import { useAuthStore } from '../stores/auth';
import { useProfileStore } from '../stores/profile';
import { sendCode, changeEmail } from '../api/auth';
import StudentCreateModal from '../components/StudentCreateModal.vue';
import type { StudentProfileDto, StudentGender } from '../types';

const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const profileStore = useProfileStore();

const saving = ref(false);
const editPopup = reactive({
  visible: false,
  type: '' as 'nickname' | 'avatar' | 'email',
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
    const errorObj = err as { message?: string };
    Toast({ message: errorObj.message || t('common.failed'), theme: 'error' });
  } finally {
    deletingStudent.value = false;
  }
}

function handleStudentSuccess(_profile: StudentProfileDto) {
  Toast({ message: t('common.success'), theme: 'success' });
}

function copyTransferCode(nickname: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(nickname).then(() => {
      Toast({ message: `${t('common.copied')}: ${nickname}`, theme: 'success' });
    }).catch(() => {
      Toast({ message: nickname, theme: 'success' });
    });
  } else {
    Toast({ message: nickname, theme: 'success' });
  }
}

function openEdit(type: 'nickname' | 'avatar' | 'email') {
  editPopup.type = type;
  editPopup.visible = true;
  if (type === 'nickname') {
    editPopup.title = '修改昵称';
    editForm.nickname = authStore.userInfo?.nickname || '';
  } else if (type === 'avatar') {
    editPopup.title = '更新头像';
    editForm.avatar = authStore.userInfo?.avatar || authStore.userInfo?.avatar_url || '';
  } else if (type === 'email') {
    editPopup.title = '换绑邮箱';
    emailFlow.step = 1;
    emailFlow.oldCode = '';
    emailFlow.newEmail = '';
    emailFlow.newCode = '';
  }
}

async function sendEmailVerifyCode(scenario: 'change_email_verify_old' | 'change_email_verify_new') {
  const receiver = scenario === 'change_email_verify_old' ? authStore.userInfo?.email : emailFlow.newEmail;
  if (!receiver) {
    Toast({ message: '请输入有效邮箱', theme: 'error' });
    return;
  }
  try {
    await sendCode({
      receiver,
      channel: 'email',
      scenario,
    });
    Toast({ message: '验证码已发送至邮箱', theme: 'success' });
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    Toast({ message: errorObj.message || '发送失败', theme: 'error' });
  }
}

async function handleSave() {
  saving.value = true;
  try {
    if (editPopup.type === 'nickname') {
      if (!editForm.nickname.trim()) {
        Toast({ message: '昵称不能为空', theme: 'error' });
        return;
      }
      await authStore.updateProfile({ nickname: editForm.nickname.trim() });
      Toast({ message: '昵称修改成功', theme: 'success' });
      editPopup.visible = false;
    } else if (editPopup.type === 'avatar') {
      if (!editForm.avatar.trim()) {
        Toast({ message: '头像地址不能为空', theme: 'error' });
        return;
      }
      await authStore.updateProfile({ avatar: editForm.avatar.trim() });
      Toast({ message: '头像修改成功', theme: 'success' });
      editPopup.visible = false;
    } else if (editPopup.type === 'email') {
      if (emailFlow.step === 1) {
        if (!emailFlow.oldCode) {
          Toast({ message: '请输入原邮箱验证码', theme: 'error' });
          return;
        }
        const res = await changeEmail({ step: 1, code: emailFlow.oldCode });
        emailFlow.securityToken = res.securityToken || res.data?.securityToken;
        emailFlow.step = 2;
        Toast({ message: '原邮箱验证通过，请验证新邮箱', theme: 'success' });
      } else {
        if (!emailFlow.newEmail || !emailFlow.newCode) {
          Toast({ message: '请完整填写新邮箱及验证码', theme: 'error' });
          return;
        }
        await changeEmail({
          step: 2,
          code: emailFlow.newCode,
          newEmail: emailFlow.newEmail,
          securityToken: emailFlow.securityToken,
        });
        Toast({ message: '邮箱换绑成功', theme: 'success' });
        await authStore.fetchAuthUser();
        editPopup.visible = false;
      }
    }
  } catch (error: unknown) {
    const errorObj = error as { response?: { data?: { message?: string } }; message?: string };
    Toast({ message: errorObj.response?.data?.message || errorObj.message || '操作失败', theme: 'error' });
  } finally {
    saving.value = false;
  }
}

async function handleLogout() {
  await authStore.logout();
  Toast({ message: '已安全退出', theme: 'success' });
  router.push('/login');
}
</script>
