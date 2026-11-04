/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  PublicSmallGroupClassDto,
  MonitorClassDto,
  AdminClassDto,
  CreateSmallGroupClassInput,
  AdminClassQueryInput,
  AdminUpdateClassInput,
  ClassStatus,
} from '../types';
import {
  getPublicSmallGroupClasses,
  getMonitorClasses,
  createMonitorClass,
  forceStartMonitorClass,
  cancelMonitorClass,
  getAdminClasses,
  updateAdminClass,
} from '../api/class';

export const useClassStore = defineStore('class', () => {
  const publicClasses = ref<PublicSmallGroupClassDto[]>([]);
  const monitorClasses = ref<MonitorClassDto[]>([]);
  const adminClasses = ref<AdminClassDto[]>([]);
  const adminTotal = ref<number>(0);
  const isLoading = ref<boolean>(false);
  const errorMessage = ref<string | null>(null);

  /**
   * 网络状态检测：L4 级业务强依赖在线模式
   */
  function assertOnline(actionName: string): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error(`离线模式不可用：${actionName}需要强网络一致性支持`);
    }
  }

  /**
   * 家长/公共端：拉取公开招募小班课列表
   */
  async function fetchPublicSmallGroupClasses(filter?: {
    courseTypeId?: string;
  }): Promise<void> {
    isLoading.value = true;
    errorMessage.value = null;
    try {
      const res = await getPublicSmallGroupClasses(filter);
      publicClasses.value = res.data;
    } catch (err: any) {
      errorMessage.value = err.message || '加载公开班级列表失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 班长端：拉取所辖班级列表
   */
  async function fetchMonitorClasses(status?: ClassStatus): Promise<void> {
    isLoading.value = true;
    errorMessage.value = null;
    try {
      const res = await getMonitorClasses(status);
      monitorClasses.value = res.data;
    } catch (err: any) {
      errorMessage.value = err.message || '加载班长看板失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 班长端：新建招募小班课 (L4 强制在线 NetworkOnly)
   */
  async function createClass(
    input: CreateSmallGroupClassInput
  ): Promise<MonitorClassDto> {
    assertOnline('创建班级');
    isLoading.value = true;
    errorMessage.value = null;
    try {
      const res = await createMonitorClass(input);
      monitorClasses.value.unshift(res.data);
      return res.data;
    } catch (err: any) {
      errorMessage.value = err.message || '创建班级失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 班长端：强制开班 (L4 强制在线 NetworkOnly)
   */
  async function forceStart(id: string): Promise<MonitorClassDto> {
    assertOnline('强制开班');
    isLoading.value = true;
    errorMessage.value = null;
    try {
      const res = await forceStartMonitorClass(id);
      const index = monitorClasses.value.findIndex((c) => c.id === id);
      if (index !== -1) {
        monitorClasses.value[index] = res.data;
      }
      return res.data;
    } catch (err: any) {
      errorMessage.value = err.message || '强制开班失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 班长端：取消小班课 (L4 强制在线 NetworkOnly)
   */
  async function cancelClass(id: string, reason: string): Promise<void> {
    assertOnline('取消班级');
    isLoading.value = true;
    errorMessage.value = null;
    try {
      await cancelMonitorClass(id, reason);
      const target = monitorClasses.value.find((c) => c.id === id);
      if (target) {
        target.status = 'cancelled';
      }
    } catch (err: any) {
      errorMessage.value = err.message || '取消班级失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 管理员端：分页检索全平台班级
   */
  async function fetchAdminClasses(query?: AdminClassQueryInput): Promise<void> {
    isLoading.value = true;
    errorMessage.value = null;
    try {
      const res = await getAdminClasses(query);
      adminClasses.value = res.data;
      adminTotal.value = res.meta?.total ?? res.data.length;
    } catch (err: any) {
      errorMessage.value = err.message || '获取管理员班级列表失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 管理员端：更新班级参数
   */
  async function updateClassByAdmin(
    id: string,
    input: AdminUpdateClassInput
  ): Promise<AdminClassDto> {
    assertOnline('更新班级配置');
    isLoading.value = true;
    errorMessage.value = null;
    try {
      const res = await updateAdminClass(id, input);
      const index = adminClasses.value.findIndex((c) => c.id === id);
      if (index !== -1) {
        adminClasses.value[index] = res.data;
      }
      return res.data;
    } catch (err: any) {
      errorMessage.value = err.message || '更新班级失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    publicClasses,
    monitorClasses,
    adminClasses,
    adminTotal,
    isLoading,
    errorMessage,
    fetchPublicSmallGroupClasses,
    fetchMonitorClasses,
    createClass,
    forceStart,
    cancelClass,
    fetchAdminClasses,
    updateClassByAdmin,
    updateAdminClass: updateClassByAdmin,
  };
});
