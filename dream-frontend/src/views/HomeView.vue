<!-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. -->
<template>
  <main class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-gray-900">Dream 教务排班与分账系统</h1>
        <span class="text-xs font-medium px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">
          Phase 0 基建就绪
        </span>
      </div>

      <p class="text-sm text-gray-600 leading-relaxed">
        系统已完成 Monorepo 骨架与多角色工作台物理隔离基础容器搭建。业务数据模型与模块业务逻辑将按照模块规划逐步推进独立设计。
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
        <div class="p-3 bg-gray-50 rounded-lg space-y-1">
          <span class="text-gray-500 font-medium">当前工作台模式</span>
          <p class="text-sm font-semibold text-gray-800">{{ workspaceStore.currentWorkspace }}</p>
        </div>
        <div class="p-3 bg-gray-50 rounded-lg space-y-1">
          <span class="text-gray-500 font-medium">单 Schema 约束</span>
          <p class="text-sm font-semibold text-gray-800">PostgreSQL (dream.*)</p>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useWorkspaceStore } from '../stores/workspace';

const workspaceStore = useWorkspaceStore();
</script>
