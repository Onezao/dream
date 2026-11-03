<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <div class="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
    <WorkspaceHeader />
    <div class="flex-1">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import WorkspaceHeader from './components/WorkspaceHeader.vue';
</script>
