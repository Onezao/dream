<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <nav
    v-if="authStore.isLoggedIn && !route.meta.public"
    aria-label="Bottom Navigation"
    class="fixed bottom-0 inset-x-0 z-30 h-16 bg-white/95 backdrop-blur border-t border-slate-200 shadow-lg"
  >
    <div class="max-w-2xl mx-auto h-full grid grid-cols-4">
      <router-link
        v-for="tab in tabs"
        :key="tab.id"
        :to="tab.to"
        class="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition min-h-[44px]"
        :class="isTabActive(tab.id) ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800'"
      >
        <t-icon :name="tab.icon" size="20px" />
        <span class="truncate max-w-full px-1">{{ tab.label }}</span>
      </router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

interface NavTabItem {
  id: 'home' | 'schedule' | 'catalog' | 'profile';
  label: string;
  to: string;
  icon: string;
}

const { t } = useI18n();
const route = useRoute();
const authStore = useAuthStore();

const tabs = computed<NavTabItem[]>(() => {
  const role = authStore.primaryRole;
  const hasParentSchedule = role === 'parent' || authStore.effectiveRoles.includes('parent');

  if (role === 'admin') {
    return [
      { id: 'home', label: t('nav.home'), to: '/', icon: 'home' },
      { id: 'schedule', label: t('nav.parentSchedule'), to: '/', icon: 'calendar' },
      { id: 'catalog', label: t('nav.adminClasses'), to: '/', icon: 'view-list' },
      { id: 'profile', label: t('nav.me'), to: '/profile', icon: 'user' },
    ];
  }

  if (role === 'monitor') {
    return [
      { id: 'home', label: t('nav.home'), to: '/', icon: 'home' },
      {
        id: 'schedule',
        label: hasParentSchedule ? t('nav.parentSchedule') : t('nav.monitorSchedule'),
        to: '/',
        icon: 'calendar',
      },
      { id: 'catalog', label: t('nav.teachers'), to: '/', icon: 'usergroup' },
      { id: 'profile', label: t('nav.me'), to: '/profile', icon: 'user' },
    ];
  }

  if (role === 'teacher') {
    return [
      { id: 'home', label: t('nav.home'), to: '/', icon: 'home' },
      { id: 'schedule', label: t('nav.teacherSchedule'), to: '/', icon: 'calendar' },
      { id: 'catalog', label: t('nav.teacherStudents'), to: '/', icon: 'usergroup' },
      { id: 'profile', label: t('nav.me'), to: '/profile', icon: 'user' },
    ];
  }

  return [
    { id: 'home', label: t('nav.home'), to: '/', icon: 'home' },
    { id: 'schedule', label: t('nav.parentSchedule'), to: '/', icon: 'calendar' },
    { id: 'catalog', label: t('nav.classes'), to: '/', icon: 'app' },
    { id: 'profile', label: t('nav.me'), to: '/profile', icon: 'user' },
  ];
});

function isTabActive(tabId: NavTabItem['id']): boolean {
  const path = route.path;
  if (tabId === 'profile') {
    return (
      path.startsWith('/profile') ||
      path.startsWith('/account') ||
      path.startsWith('/admin/admins')
    );
  }
  if (tabId === 'home') {
    return path === '/';
  }
  return false;
}
</script>
