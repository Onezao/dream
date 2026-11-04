/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { setActivePinia, createPinia } from 'pinia';
import { useTeacherStore } from '../src/stores/teacher';
import * as teacherApi from '../src/api/teacher';
import * as l3Cache from '../src/utils/l3Cache';
import type { TeacherCardDto, TeacherDetailDto } from '../src/types';

jest.mock('../src/api/teacher', () => ({
  getPublicTeachers: jest.fn(),
  getPublicTeacher: jest.fn(),
  getCourseTypes: jest.fn(),
  getTeacherLevels: jest.fn(),
  getMonitorTeachers: jest.fn(),
  createMonitorTeacher: jest.fn(),
  updateMonitorTeacher: jest.fn(),
  deleteMonitorTeacher: jest.fn(),
}));

jest.mock('../src/utils/l3Cache', () => ({
  setL3Snapshot: jest.fn(),
  getL3Snapshot: jest.fn(),
}));

const mockTeacherCard: TeacherCardDto = {
  id: 'tea123456789',
  displayName: 'Teacher Sarah',
  levelName: '高级外教',
  monitorDisplayName: '班长Alice',
  skillCourseTypes: [{ id: 'ct1234567890', name: '自然拼读' }],
  introZh: '拥有5年幼少儿教学经验',
  introEn: '5 years of ESL experience',
  photoUrl: 'https://cdn.topee.top/photo.webp',
  videoUrl: 'https://cdn.topee.top/video.mp4',
  classinQrUrl: 'https://cdn.topee.top/qr.webp',
};

const mockTeacherDetail: TeacherDetailDto = {
  id: 'tea123456789',
  accountId: null,
  displayName: 'Teacher Sarah',
  levelId: 'lvl123456789',
  levelName: '高级外教',
  monitorProfileId: 'mon123456789',
  monitorDisplayName: '班长Alice',
  skillCourseTypeIds: ['ct1234567890'],
  introZh: '拥有5年幼少儿教学经验',
  introEn: '5 years of ESL experience',
  photoKey: 'dream/teachers/photos/photo.webp',
  photoUrl: 'https://cdn.topee.top/photo.webp',
  videoKey: 'dream/teachers/videos/video.mp4',
  videoUrl: 'https://cdn.topee.top/video.mp4',
  classinQrKey: 'dream/teachers/classin_qr/qr.webp',
  classinQrUrl: 'https://cdn.topee.top/qr.webp',
  resignedAt: null,
  createdAt: '2026-11-04T10:00:00.000Z',
  updatedAt: '2026-11-04T10:00:00.000Z',
};

describe('useTeacherStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  describe('fetchPublicTeachers', () => {
    it('should successfully fetch teachers and persist to L3 snapshot', async () => {
      (teacherApi.getPublicTeachers as jest.Mock).mockResolvedValue({
        data: [mockTeacherCard],
      });

      const store = useTeacherStore();
      await store.fetchPublicTeachers();

      expect(store.publicTeachers).toEqual([mockTeacherCard]);
      expect(store.isOfflineSnapshot).toBe(false);
      expect(l3Cache.setL3Snapshot).toHaveBeenCalledWith('public_teachers', [mockTeacherCard]);
    });

    it('should fall back to L3 snapshot when network fails', async () => {
      (teacherApi.getPublicTeachers as jest.Mock).mockRejectedValue(new Error('Network error'));
      (l3Cache.getL3Snapshot as jest.Mock).mockResolvedValue([mockTeacherCard]);

      const store = useTeacherStore();
      await store.fetchPublicTeachers();

      expect(store.publicTeachers).toEqual([mockTeacherCard]);
      expect(store.isOfflineSnapshot).toBe(true);
    });
  });

  describe('fetchDictionaries', () => {
    it('should load course types and teacher levels', async () => {
      (teacherApi.getCourseTypes as jest.Mock).mockResolvedValue({
        data: [{ id: 'ct1', name: '自然拼读', sortOrder: 1, isActive: true }],
      });
      (teacherApi.getTeacherLevels as jest.Mock).mockResolvedValue({
        data: [{ id: 'lvl1', name: '高级外教', sortOrder: 1, isActive: true }],
      });

      const store = useTeacherStore();
      await store.fetchDictionaries();

      expect(store.courseTypes).toHaveLength(1);
      expect(store.teacherLevels).toHaveLength(1);
    });
  });

  describe('monitor operations', () => {
    it('should load monitor teachers', async () => {
      (teacherApi.getMonitorTeachers as jest.Mock).mockResolvedValue({
        data: [mockTeacherDetail],
      });

      const store = useTeacherStore();
      await store.fetchMonitorTeachers();

      expect(store.monitorTeachers).toHaveLength(1);
      expect(store.monitorTeachers[0].displayName).toBe('Teacher Sarah');
    });

    it('should add teacher and prepend to list', async () => {
      (teacherApi.createMonitorTeacher as jest.Mock).mockResolvedValue({
        data: mockTeacherDetail,
      });

      const store = useTeacherStore();
      await store.addTeacher({
        displayName: 'Teacher Sarah',
        levelId: 'lvl123456789',
        skillCourseTypeIds: ['ct1234567890'],
        introZh: '中文简介内容测试十个字',
        introEn: 'English intro for testing',
      });

      expect(store.monitorTeachers).toHaveLength(1);
    });

    it('should edit teacher and update item in list', async () => {
      const store = useTeacherStore();
      store.monitorTeachers = [{ ...mockTeacherDetail }];

      const updated = { ...mockTeacherDetail, displayName: 'Sarah Updated' };
      (teacherApi.updateMonitorTeacher as jest.Mock).mockResolvedValue({
        data: updated,
      });

      await store.editTeacher('tea123456789', { displayName: 'Sarah Updated' });
      expect(store.monitorTeachers[0].displayName).toBe('Sarah Updated');
    });

    it('should remove teacher from list', async () => {
      const store = useTeacherStore();
      store.monitorTeachers = [{ ...mockTeacherDetail }];

      (teacherApi.deleteMonitorTeacher as jest.Mock).mockResolvedValue({
        data: { success: true },
      });

      await store.removeTeacher('tea123456789');
      expect(store.monitorTeachers).toHaveLength(0);
    });
  });
});
