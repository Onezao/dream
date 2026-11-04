/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  TeacherCardDto,
  TeacherDetailDto,
  CourseTypeDto,
  TeacherLevelDto,
  CreateTeacherProfileInput,
  UpdateTeacherProfileInput,
} from '../types';
import {
  getPublicTeachers,
  getPublicTeacher,
  getCourseTypes,
  getTeacherLevels,
  getMonitorTeachers,
  createMonitorTeacher,
  updateMonitorTeacher,
  deleteMonitorTeacher,
} from '../api/teacher';
import { setL3Snapshot, getL3Snapshot } from '../utils/l3Cache';

export const useTeacherStore = defineStore('teacher', () => {
  const publicTeachers = ref<TeacherCardDto[]>([]);
  const monitorTeachers = ref<TeacherDetailDto[]>([]);
  const courseTypes = ref<CourseTypeDto[]>([]);
  const teacherLevels = ref<TeacherLevelDto[]>([]);
  const isLoading = ref<boolean>(false);
  const isOfflineSnapshot = ref<boolean>(false);
  const errorMessage = ref<string | null>(null);

  /**
   * 拉取家长/公开端教师列表 (集成 L3 弱网缓存降级)
   */
  async function fetchPublicTeachers(filter?: {
    levelId?: string;
    courseTypeId?: string;
  }): Promise<void> {
    isLoading.value = true;
    errorMessage.value = null;

    try {
      const res = await getPublicTeachers(filter);
      publicTeachers.value = res.data;
      isOfflineSnapshot.value = false;

      // 仅在无过滤条件时更新通用快照
      if (!filter?.levelId && !filter?.courseTypeId) {
        await setL3Snapshot('public_teachers', res.data);
      }
    } catch (err: any) {
      // 网络故障降级：读取 IndexedDB L3 离线快照
      const snapshot = await getL3Snapshot<TeacherCardDto[]>('public_teachers');
      if (snapshot && snapshot.length > 0) {
        publicTeachers.value = snapshot;
        isOfflineSnapshot.value = true;
      } else {
        errorMessage.value = err.message || '加载教师列表失败';
      }
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 加载字典 (课程类型 & 教师定级)
   */
  async function fetchDictionaries(): Promise<void> {
    try {
      const [typesRes, levelsRes] = await Promise.all([
        getCourseTypes(),
        getTeacherLevels(),
      ]);
      courseTypes.value = typesRes.data;
      teacherLevels.value = levelsRes.data;
    } catch {
      // 容错处理
    }
  }

  /**
   * 班长端：拉取负责的外教列表
   */
  async function fetchMonitorTeachers(): Promise<void> {
    isLoading.value = true;
    errorMessage.value = null;
    try {
      const res = await getMonitorTeachers();
      monitorTeachers.value = res.data;
    } catch (err: any) {
      errorMessage.value = err.message || '加载教师档案失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 班长端：新增外教
   */
  async function addTeacher(input: CreateTeacherProfileInput): Promise<TeacherDetailDto> {
    isLoading.value = true;
    try {
      const res = await createMonitorTeacher(input);
      monitorTeachers.value.unshift(res.data);
      return res.data;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 班长端：修改外教
   */
  async function editTeacher(
    id: string,
    input: UpdateTeacherProfileInput
  ): Promise<TeacherDetailDto> {
    isLoading.value = true;
    try {
      const res = await updateMonitorTeacher(id, input);
      const index = monitorTeachers.value.findIndex((t) => t.id === id);
      if (index !== -1) {
        monitorTeachers.value[index] = res.data;
      }
      return res.data;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 班长端：删除外教
   */
  async function removeTeacher(id: string): Promise<void> {
    isLoading.value = true;
    try {
      await deleteMonitorTeacher(id);
      monitorTeachers.value = monitorTeachers.value.filter((t) => t.id !== id);
    } finally {
      isLoading.value = false;
    }
  }

  return {
    publicTeachers,
    monitorTeachers,
    courseTypes,
    teacherLevels,
    isLoading,
    isOfflineSnapshot,
    errorMessage,
    fetchPublicTeachers,
    fetchDictionaries,
    fetchMonitorTeachers,
    addTeacher,
    editTeacher,
    removeTeacher,
  };
});
