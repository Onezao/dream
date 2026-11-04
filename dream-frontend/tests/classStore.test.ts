/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { setActivePinia, createPinia } from 'pinia';
import { useClassStore } from '../src/stores/class';
import * as classApi from '../src/api/class';
import type {
  PublicSmallGroupClassDto,
  MonitorClassDto,
  AdminClassDto,
} from '../src/types';

jest.mock('../src/api/class', () => ({
  getPublicSmallGroupClasses: jest.fn(),
  getMonitorClasses: jest.fn(),
  createMonitorClass: jest.fn(),
  forceStartMonitorClass: jest.fn(),
  cancelMonitorClass: jest.fn(),
  getAdminClasses: jest.fn(),
  updateAdminClass: jest.fn(),
}));

const mockPublicClass: PublicSmallGroupClassDto = {
  id: 'cls123456789',
  name: '自然拼读精读一班',
  courseTypeName: '自然拼读',
  teacherDisplayName: 'Teacher Sarah',
  teacherPhotoUrl: 'https://cdn.topee.top/photo.webp',
  minStudents: 2,
  maxStudents: 4,
  enrolledCount: 2,
  isFull: false,
  plannedStartDate: '2026-11-20',
  status: 'recruiting',
};

const mockMonitorClass: MonitorClassDto = {
  ...mockPublicClass,
  ownerMonitorProfileId: 'mon123456789',
  teacherSalaryPoints: 100,
  platformCommissionRate: 15.0,
  forceStartedAt: null,
  createdAt: '2026-11-04T12:00:00.000Z',
  enrolledStudents: [],
};

const mockAdminClass: AdminClassDto = {
  ...mockMonitorClass,
  classType: 'small_group',
  updatedAt: '2026-11-04T12:00:00.000Z',
};

describe('useClassStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
    });
  });

  describe('1. Public Classes Operations', () => {
    it('should fetch public small group classes successfully', async () => {
      (classApi.getPublicSmallGroupClasses as jest.Mock).mockResolvedValue({
        data: [mockPublicClass],
      });

      const store = useClassStore();
      await store.fetchPublicSmallGroupClasses();

      expect(store.publicClasses).toHaveLength(1);
      expect(store.publicClasses[0].name).toBe('自然拼读精读一班');
      expect(store.isLoading).toBe(false);
      expect(store.errorMessage).toBeNull();
    });

    it('should handle fetch errors gracefully', async () => {
      (classApi.getPublicSmallGroupClasses as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const store = useClassStore();
      await expect(store.fetchPublicSmallGroupClasses()).rejects.toThrow('Network error');

      expect(store.errorMessage).toBe('Network error');
      expect(store.isLoading).toBe(false);
    });
  });

  describe('2. Monitor Classes Operations', () => {
    it('should fetch monitor classes successfully', async () => {
      (classApi.getMonitorClasses as jest.Mock).mockResolvedValue({
        data: [mockMonitorClass],
      });

      const store = useClassStore();
      await store.fetchMonitorClasses('recruiting');

      expect(store.monitorClasses).toHaveLength(1);
      expect(classApi.getMonitorClasses).toHaveBeenCalledWith('recruiting');
    });

    it('should create new class and prepend to list', async () => {
      (classApi.createMonitorClass as jest.Mock).mockResolvedValue({
        data: mockMonitorClass,
      });

      const store = useClassStore();
      const result = await store.createClass({
        name: '自然拼读精读一班',
        courseTypeId: 'ct1234567890',
        teacherProfileId: 'tea123456789',
        minStudents: 2,
        maxStudents: 4,
        plannedStartDate: '2026-11-20',
      });

      expect(result.id).toBe('cls123456789');
      expect(store.monitorClasses).toHaveLength(1);
    });

    it('should block creation when offline (L4 NetworkOnly)', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      const store = useClassStore();
      await expect(
        store.createClass({
          name: '自然拼读精读一班',
          courseTypeId: 'ct1234567890',
          teacherProfileId: 'tea123456789',
          plannedStartDate: '2026-11-20',
        })
      ).rejects.toThrow('离线模式不可用');
    });

    it('should force start class and update state', async () => {
      (classApi.getMonitorClasses as jest.Mock).mockResolvedValue({
        data: [mockMonitorClass],
      });
      (classApi.forceStartMonitorClass as jest.Mock).mockResolvedValue({
        data: { ...mockMonitorClass, status: 'active' },
      });

      const store = useClassStore();
      await store.fetchMonitorClasses();
      const updated = await store.forceStart('cls123456789');

      expect(updated.status).toBe('active');
      expect(store.monitorClasses[0].status).toBe('active');
    });

    it('should cancel class and mark status as cancelled', async () => {
      (classApi.getMonitorClasses as jest.Mock).mockResolvedValue({
        data: [mockMonitorClass],
      });
      (classApi.cancelMonitorClass as jest.Mock).mockResolvedValue({
        data: { success: true },
      });

      const store = useClassStore();
      await store.fetchMonitorClasses();
      await store.cancelClass('cls123456789', '人数未达标');

      expect(store.monitorClasses[0].status).toBe('cancelled');
    });
  });

  describe('3. Admin Operations', () => {
    it('should fetch admin classes with pagination', async () => {
      (classApi.getAdminClasses as jest.Mock).mockResolvedValue({
        data: [mockAdminClass],
        meta: { total: 10, page: 1, pageSize: 20 },
      });

      const store = useClassStore();
      await store.fetchAdminClasses({ page: 1, pageSize: 20 });

      expect(store.adminClasses).toHaveLength(1);
      expect(store.adminTotal).toBe(10);
    });

    it('should update admin class and refresh list item', async () => {
      (classApi.getAdminClasses as jest.Mock).mockResolvedValue({
        data: [mockAdminClass],
        meta: { total: 1 },
      });
      (classApi.updateAdminClass as jest.Mock).mockResolvedValue({
        data: { ...mockAdminClass, name: '修改后的班名' },
      });

      const store = useClassStore();
      await store.fetchAdminClasses();
      const updated = await store.updateAdminClass('cls123456789', {
        name: '修改后的班名',
      });

      expect(updated.name).toBe('修改后的班名');
      expect(store.adminClasses[0].name).toBe('修改后的班名');
    });
  });
});
