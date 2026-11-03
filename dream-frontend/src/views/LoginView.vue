<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <div class="flex min-h-screen flex-col bg-slate-900 text-white px-6 pt-12 pb-8">
    <!-- Header Section -->
    <div class="mb-8">
      <div class="w-12 h-12 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl flex items-center justify-center mb-4 text-indigo-400 font-black text-xl shadow-lg">
        D
      </div>
      <h1 class="text-3xl font-bold tracking-tight text-white">欢迎登录</h1>
      <p class="mt-2 text-sm text-slate-400">Dream 教务排班与分账管理系统</p>
    </div>

    <!-- Form Section -->
    <div class="flex flex-col gap-5">
      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-400">账号 (手机号或邮箱)</label>
        <t-input
          v-model="formData.account"
          placeholder="请输入手机号或邮箱"
          :status="accountError ? 'error' : 'default'"
          @blur="validateAccount"
          @focus="accountError = ''"
          class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white"
        >
          <template #suffix>
            <t-icon name="user" class="text-slate-500" size="18px" />
          </template>
        </t-input>
        <div v-if="accountError" class="text-red-400 text-xs px-1">{{ accountError }}</div>
      </div>

      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-400">登录密码</label>
        <t-input
          v-model="formData.password"
          type="password"
          placeholder="请输入密码"
          :status="passwordError ? 'error' : 'default'"
          class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white"
        >
          <template #suffix>
            <t-icon name="lock-on" class="text-slate-500" size="18px" />
          </template>
        </t-input>
        <div v-if="passwordError" class="text-red-400 text-xs px-1">{{ passwordError }}</div>
      </div>

      <!-- Security Captcha Check (Triggered dynamically on CAPTCHA_REQUIRED) -->
      <div v-if="showCaptcha" class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-400">安全图形验证码</label>
        <div class="flex gap-2">
          <t-input
            v-model="formData.captchaText"
            placeholder="输入验证码"
            class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white flex-1"
          />
          <div
            class="w-24 h-12 rounded-xl overflow-hidden cursor-pointer bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 active:scale-95 transition-transform"
            @click="fetchCaptcha"
          >
            <div v-if="captchaImage" v-html="captchaImage" class="w-full h-full [&>svg]:w-full [&>svg]:h-full"></div>
            <span v-else class="text-xs text-slate-400">加载中...</span>
          </div>
        </div>
      </div>

      <!-- Agreement Checkbox -->
      <div class="mt-1 text-left">
        <t-checkbox v-model="formData.agreement" class="!bg-transparent !p-0">
          <span class="text-xs text-slate-400 leading-relaxed">
            我已阅读并同意
            <span class="text-indigo-400 hover:text-indigo-300" @click.stop.prevent="openDocument('user_agreement', '用户服务协议')">《用户协议》</span>
            <span> 与 </span>
            <span class="text-indigo-400 hover:text-indigo-300" @click.stop.prevent="openDocument('privacy_policy', '隐私政策')">《隐私声明》</span>
          </span>
        </t-checkbox>
      </div>

      <t-button
        theme="primary"
        size="large"
        block
        :loading="loading"
        class="!h-13 !rounded-xl !text-base !font-bold shadow-lg shadow-indigo-600/30 mt-2 bg-indigo-600 border-none"
        @click="onSubmit"
      >
        立即登录
      </t-button>
    </div>

    <!-- Document Modal -->
    <t-dialog
      v-model:visible="showDocumentModal"
      confirm-btn=""
      cancel-btn=""
      :close-btn="false"
      class="!bg-transparent !w-full !max-w-none !p-0 !border-none"
    >
      <div class="bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden w-[94%] mx-auto relative p-6">
        <div class="flex justify-between items-center pb-3 border-b border-slate-800">
          <h2 class="text-base font-bold text-white">{{ currentDocumentTitle }}</h2>
          <button @click="showDocumentModal = false" class="text-slate-400 hover:text-white p-1">
            <t-icon name="close" size="18px" />
          </button>
        </div>
        <div class="text-xs text-slate-300 max-h-[60vh] overflow-y-auto mt-4 leading-relaxed whitespace-pre-wrap">
          {{ currentDocumentContent }}
        </div>
      </div>
    </t-dialog>

    <!-- Footer Links -->
    <div class="mt-auto pt-10 text-center">
      <div class="flex items-center justify-center gap-4 text-xs text-slate-400">
        <router-link to="/register" class="font-bold text-indigo-400 hover:text-indigo-300">注册新账号</router-link>
        <span class="text-slate-600">|</span>
        <router-link to="/forgot-password" class="text-slate-400 hover:text-white transition-colors">找回密码</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Toast,
  Input as TInput,
  Button as TButton,
  Checkbox as TCheckbox,
  Icon as TIcon,
  Dialog as TDialog,
} from 'tdesign-mobile-vue';
import { useAuthStore } from '../stores/auth';
import { getCaptcha, getPolicy } from '../api/auth';

const router = useRouter();
const authStore = useAuthStore();

const formData = reactive({
  account: '',
  password: '',
  captchaText: '',
  agreement: true,
});

const accountError = ref('');
const passwordError = ref('');
const loading = ref(false);

const showCaptcha = ref(false);
const captchaImage = ref('');
const captchaId = ref('');

const showDocumentModal = ref(false);
const currentDocumentTitle = ref('');
const currentDocumentContent = ref('');

function validateAccount(): boolean {
  accountError.value = '';
  const val = formData.account.trim();
  if (!val) {
    accountError.value = '请输入手机号或邮箱';
    return false;
  }
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isPhone = /^1[3-9]\d{9}$/.test(val);
  if (!isEmail && !isPhone) {
    accountError.value = '手机号或邮箱格式不正确';
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

async function openDocument(key: string, defaultTitle: string) {
  currentDocumentTitle.value = defaultTitle;
  currentDocumentContent.value = '加载中...';
  showDocumentModal.value = true;
  try {
    const res = await getPolicy(key);
    currentDocumentTitle.value = res.title || defaultTitle;
    currentDocumentContent.value = res.content || '暂无内容';
  } catch {
    currentDocumentContent.value = '未能获取协议内容，请稍后再试。';
  }
}

async function onSubmit() {
  accountError.value = '';
  passwordError.value = '';

  if (!validateAccount()) return;
  if (!formData.password) {
    passwordError.value = '请输入密码';
    return;
  }
  if (!formData.agreement) {
    Toast({ message: '请勾选同意用户协议与隐私声明', theme: 'error' });
    return;
  }
  if (showCaptcha.value && !formData.captchaText) {
    Toast({ message: '请输入图形验证码', theme: 'error' });
    return;
  }

  loading.value = true;
  try {
    await authStore.login({
      account: formData.account,
      password: formData.password,
      captchaId: showCaptcha.value ? captchaId.value : undefined,
      captchaText: showCaptcha.value ? formData.captchaText : undefined,
    });
    Toast({ message: '登录成功', theme: 'success' });
    router.push('/');
  } catch (error: any) {
    const errData = error.response?.data || {};
    const errCode = errData.code || errData.error || error.message;

    if (errCode === 'CAPTCHA_REQUIRED' || errCode === 'INVALID_CAPTCHA') {
      Toast({ message: '请输入安全验证码', theme: 'warning' });
      showCaptcha.value = true;
      await fetchCaptcha();
    } else {
      Toast({ message: errData.message || error.message || '登录失败', theme: 'error' });
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  authStore.fetchSystemConfig();
});
</script>
