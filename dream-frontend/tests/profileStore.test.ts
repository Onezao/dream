/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { setActivePinia, createPinia } from 'pinia';
import { useProfileStore } from '../src/stores/profile';
import * as profileApi from '../src/api/profile';
import type { StudentProfileDto } from '../src/types';

jest.mock('../src/api/profile', () => ({
  getStudentProfiles: jest.fn(),
  createStudentProfile: jest.fn(),
  getStudentProfile: jest.fn(),
  updateStudentProfile: jest.fn(),
  deleteStudentProfile: jest.fn(),
  checkNicknameAvailability: jest.fn(),
  lookupProfileForTransfer: jest.fn(),
}));

const mockProfile1: StudentProfileDto = {
  id: 'sp_alice12345',
  accountId: 'acc_parent001',
  realName: '张小丽',
  englishName: 'Alice',
  surnameInitial: 'Z',
  age: 12,
  nickname: 'AliceZ12',
  gender: 'female',
  birthDate: '2014-05-20',
  avatarKey: null,
  avatarUrl: 'https://img.topee.top/avatar/alice.webp',
  preferredCourseTypeIds: [],
  createdAt: '2026-11-04T10:00:00.000Z',
  updatedAt: '2026-11-04T10:00:00.000Z',
};

const mockProfile2: StudentProfileDto = {
  id: 'sp_bob00000002',
  accountId: 'acc_parent001',
  realName: '张小博',
  englishName: 'Bob',
  surnameInitial: 'Z',
  age: 10,
  nickname: 'BobZ10',
  gender: 'male',
  birthDate: '2016-08-15',
  avatarKey: null,
  avatarUrl: null,
  preferredCourseTypeIds: [],
  createdAt: '2026-11-04T10:05:00.000Z',
  updatedAt: '2026-11-04T10:05:00.000Z',
};

describe('Profile Store (Pinia & L2 Cache Controls)', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => mockStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockStorage[key] = value.toString();
        }),
        removeItem: jest.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: jest.fn(() => {
          mockStorage = {};
        }),
      },
      writable: true,
    });

    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  it('1. should fetch profiles and set default activeProfileId with L2 cache', async () => {
    (profileApi.getStudentProfiles as jest.Mock).mockResolvedValue({
      data: [mockProfile1, mockProfile2],
      meta: { total: 2, limit: 10 },
    });

    const store = useProfileStore();
    expect(store.profiles).toEqual([]);
    expect(store.activeProfile).toBeNull();

    await store.fetchProfiles();

    expect(profileApi.getStudentProfiles).toHaveBeenCalledTimes(1);
    expect(store.profiles.length).toBe(2);
    expect(store.activeProfileId).toBe('sp_alice12345');
    expect(store.activeProfile?.nickname).toBe('AliceZ12');
    expect(mockStorage['dream_active_profile_id']).toBe('sp_alice12345');
  });

  it('2. should switch active profile and update localStorage', () => {
    const store = useProfileStore();
    store.setProfiles([mockProfile1, mockProfile2]);

    expect(store.activeProfileId).toBe('sp_alice12345');

    store.selectProfile('sp_bob00000002');
    expect(store.activeProfileId).toBe('sp_bob00000002');
    expect(store.activeProfile?.nickname).toBe('BobZ10');
    expect(mockStorage['dream_active_profile_id']).toBe('sp_bob00000002');
  });

  it('3. should create a new profile and auto-activate it', async () => {
    (profileApi.createStudentProfile as jest.Mock).mockResolvedValue({
      data: mockProfile2,
    });

    const store = useProfileStore();
    store.setProfiles([mockProfile1]);

    const created = await store.createProfile({
      realName: '张小博',
      englishName: 'Bob',
      surnameInitial: 'Z',
      age: 10,
    });

    expect(created.id).toBe('sp_bob00000002');
    expect(store.profiles.length).toBe(2);
    expect(store.activeProfileId).toBe('sp_bob00000002');
    expect(mockStorage['dream_active_profile_id']).toBe('sp_bob00000002');
  });

  it('4. should update an existing profile in the local store', async () => {
    const updatedProfile: StudentProfileDto = {
      ...mockProfile1,
      realName: '张小丽 (更新)',
      age: 13,
    };
    (profileApi.updateStudentProfile as jest.Mock).mockResolvedValue({
      data: updatedProfile,
    });

    const store = useProfileStore();
    store.setProfiles([mockProfile1, mockProfile2]);

    const res = await store.updateProfile(mockProfile1.id, {
      realName: '张小丽 (更新)',
      age: 13,
    });

    expect(res.realName).toBe('张小丽 (更新)');
    expect(store.profiles[0].realName).toBe('张小丽 (更新)');
    expect(store.profiles[0].age).toBe(13);
  });

  it('5. should delete a profile and fallback activeProfileId smoothly', async () => {
    (profileApi.deleteStudentProfile as jest.Mock).mockResolvedValue({
      data: { success: true },
    });

    const store = useProfileStore();
    store.setProfiles([mockProfile1, mockProfile2]);
    store.selectProfile(mockProfile1.id);

    await store.deleteProfile(mockProfile1.id);

    expect(profileApi.deleteStudentProfile).toHaveBeenCalledWith(mockProfile1.id);
    expect(store.profiles.length).toBe(1);
    expect(store.profiles[0].id).toBe('sp_bob00000002');
    expect(store.activeProfileId).toBe('sp_bob00000002');
    expect(mockStorage['dream_active_profile_id']).toBe('sp_bob00000002');
  });

  it('6. should check nickname availability via API proxy', async () => {
    (profileApi.checkNicknameAvailability as jest.Mock).mockResolvedValue({
      data: { available: true, nickname: 'AliceZ12' },
    });

    const store = useProfileStore();
    const result = await store.checkNickname('AliceZ12');

    expect(profileApi.checkNicknameAvailability).toHaveBeenCalledWith('AliceZ12');
    expect(result.available).toBe(true);
    expect(result.nickname).toBe('AliceZ12');
  });

  it('7. should flag isMaxProfiles when profile count reaches 10', () => {
    const store = useProfileStore();
    const tenProfiles = Array.from({ length: 10 }, (_, i) => ({
      ...mockProfile1,
      id: `sp_kid0000000${i}`,
      nickname: `Kid${i}Z10`,
    }));

    store.setProfiles(tenProfiles);
    expect(store.profileCount).toBe(10);
    expect(store.isMaxProfiles).toBe(true);
  });
});
