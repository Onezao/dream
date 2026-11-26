<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <div class="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
    <WorkspaceHeader />
    <div :class="['flex-1', showBottomTabs ? 'pb-20' : '']">
      <router-view />
    </div>
    <BottomTabBar />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Toast } from 'tdesign-mobile-vue';
import { useI18n } from 'vue-i18n';
import WorkspaceHeader from './components/WorkspaceHeader.vue';
import BottomTabBar from './components/BottomTabBar.vue';
import { useAuthStore } from './stores/auth';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const showBottomTabs = computed(() => authStore.isLoggedIn && !route.meta.public);

watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      void authStore.connectRoleInvalidationStream(() => {
        const currentPath = router.currentRoute.value.path;
        if (currentPath.startsWith('/admin') && !authStore.hasAnyRole(['admin'])) {
          Toast({ message: t('errors.FORBIDDEN'), theme: 'warning' });
          void router.replace('/');
        }
      });
    } else {
      authStore.disconnectRoleInvalidationStream();
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  authStore.disconnectRoleInvalidationStream();
});
</script>
