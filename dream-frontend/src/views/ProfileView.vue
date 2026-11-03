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
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Toast, Icon as TIcon, Popup as TPopup } from 'tdesign-mobile-vue';
import { useAuthStore } from '../stores/auth';
import { sendCode, changeEmail } from '../api/auth';

const router = useRouter();
const authStore = useAuthStore();

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

onMounted(() => {
  authStore.fetchAuthUser();
});

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
  } catch (err: any) {
    Toast({ message: err.message || '发送失败', theme: 'error' });
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
  } catch (error: any) {
    Toast({ message: error.response?.data?.message || error.message || '操作失败', theme: 'error' });
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
