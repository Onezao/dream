<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <div class="flex min-h-screen flex-col bg-slate-900 text-white px-6 pt-12 pb-8">
    <!-- Header Section -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight text-white mb-2">创建账号</h1>
      <p class="text-sm text-slate-400">注册加入 Dream 教务与分账管理系统</p>
    </div>

    <!-- Form Section -->
    <div class="flex flex-col gap-5">
      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-400">手机号或邮箱</label>
        <t-input
          v-model="formData.receiver"
          placeholder="请输入手机号或邮箱"
          :status="receiverError ? 'error' : 'default'"
          @blur="validateReceiver"
          @focus="receiverError = ''"
          class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white"
        />
        <div v-if="receiverError" class="text-red-400 text-xs px-1">{{ receiverError }}</div>
      </div>

      <!-- Graphic Captcha -->
      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-400">安全图形验证码</label>
        <div class="flex gap-2">
          <t-input
            v-model="formData.captchaText"
            placeholder="输入图形验证码"
            class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white flex-1"
          />
          <div
            class="w-24 h-12 rounded-xl overflow-hidden cursor-pointer bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 active:scale-95 transition-transform"
            @click="fetchCaptcha"
          >
            <div v-if="captchaImage" v-html="captchaImage" class="w-full h-full [&>svg]:w-full [&>svg]:h-full"></div>
            <span v-else class="text-xs text-slate-400">刷新码</span>
          </div>
        </div>
      </div>

      <!-- SMS/Email Verification Code -->
      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-400">动态验证码</label>
        <div class="flex gap-2">
          <t-input
            v-model="formData.verificationCode"
            placeholder="输入接收到的验证码"
            class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white flex-1"
          />
          <t-button
            theme="primary"
            variant="outline"
            :disabled="cooldown > 0"
            :loading="sendingCode"
            @click="handleSendCode"
            class="!rounded-xl !h-12 w-28 !border-indigo-500/50 !text-indigo-400 shrink-0"
          >
            {{ cooldown > 0 ? `${cooldown}s` : '获取验证码' }}
          </t-button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="px-1 text-xs font-semibold text-slate-400">设置密码</label>
        <t-input
          v-model="formData.password"
          type="password"
          placeholder="请设置 8 位以上包含字母与数字的密码"
          class="!bg-slate-800/80 !rounded-xl border border-slate-700/80 focus-within:border-indigo-500 transition-colors !text-white"
        />
      </div>

      <!-- Agreement -->
      <div class="mt-1 text-left">
        <t-checkbox v-model="formData.agreement" class="!bg-transparent !p-0">
          <span class="text-xs text-slate-400 leading-relaxed">
            我已阅读并同意
            <span class="text-indigo-400 hover:text-indigo-300">《用户协议》</span>
            <span> 与 </span>
            <span class="text-indigo-400 hover:text-indigo-300">《隐私政策》</span>
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
        确认注册
      </t-button>
    </div>

    <!-- Back to Login -->
    <div class="mt-auto pt-10 text-center">
      <router-link to="/login" class="text-xs text-slate-400 font-medium hover:text-white transition-colors">
        已有账号？返回登录
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Toast,
  Input as TInput,
  Button as TButton,
  Checkbox as TCheckbox,
} from 'tdesign-mobile-vue';
import { useAuthStore } from '../stores/auth';
import { getCaptcha, sendCode } from '../api/auth';

const router = useRouter();
const authStore = useAuthStore();

const formData = reactive({
  receiver: '',
  password: '',
  verificationCode: '',
  captchaText: '',
  agreement: true,
});

const receiverError = ref('');
const cooldown = ref(0);
const sendingCode = ref(false);
const loading = ref(false);

const captchaImage = ref('');
const captchaId = ref('');
let timer: any = null;

function validateReceiver(): boolean {
  receiverError.value = '';
  const val = formData.receiver.trim();
  if (!val) {
    receiverError.value = '请输入手机号或邮箱';
    return false;
  }
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isPhone = /^1[3-9]\d{9}$/.test(val);
  if (!isEmail && !isPhone) {
    receiverError.value = '手机号或邮箱格式不正确';
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

async function handleSendCode() {
  if (!validateReceiver()) return;
  if (!formData.captchaText) {
    Toast({ message: '请输入图形验证码', theme: 'error' });
    return;
  }
  if (cooldown.value > 0) return;

  sendingCode.value = true;
  try {
    const isEmail = formData.receiver.includes('@');
    await sendCode({
      receiver: formData.receiver,
      channel: isEmail ? 'email' : 'sms',
      scenario: 'signup',
      captchaId: captchaId.value,
      captchaText: formData.captchaText,
    });
    Toast({ message: '验证码已发送', theme: 'success' });
    cooldown.value = 60;
    timer = setInterval(() => {
      cooldown.value--;
      if (cooldown.value <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message || '发送失败';
    Toast({ message: msg, theme: 'error' });
    await fetchCaptcha();
    formData.captchaText = '';
  } finally {
    sendingCode.value = false;
  }
}

async function onSubmit() {
  if (!validateReceiver()) return;
  if (!formData.verificationCode || !formData.password) {
    Toast({ message: '请完整填写所有项', theme: 'error' });
    return;
  }
  if (!formData.agreement) {
    Toast({ message: '请同意用户协议', theme: 'error' });
    return;
  }

  loading.value = true;
  try {
    const isEmail = formData.receiver.includes('@');
    await authStore.register({
      email: isEmail ? formData.receiver : undefined,
      phone: !isEmail ? formData.receiver : undefined,
      password: formData.password,
      verificationCode: formData.verificationCode,
    });
    Toast({ message: '注册成功，请使用新账号登录', theme: 'success' });
    router.push('/login');
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message || '注册失败';
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
