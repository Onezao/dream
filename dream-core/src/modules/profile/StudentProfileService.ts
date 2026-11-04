/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import type { PoolClient } from 'pg';
import { DatabaseService, executeTx as defaultExecuteTx, ApiError } from '@topeetop/shared-core';
import { StudentProfileMapper } from '../../db/StudentProfileMapper.js';
import type {
  StudentProfileRecord,
  UpdateStudentProfileDbInput,
} from '../../types/studentProfile.types.js';
import {
  NICKNAME_REGEX,
  CreateStudentProfileInput,
  UpdateStudentProfileInput,
  StudentProfileDto,
  StudentLookupDto,
  StudentProfileListResponse,
} from './types.js';

function isPgUniqueViolation(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const errorRecord = err as Record<string, unknown>;
    if (errorRecord.code === '23505') {
      return true;
    }
  }
  return false;
}

export interface StudentProfileServiceOptions {
  cdnBaseUrl?: string;
}

export class StudentProfileService {
  private readonly mapper: StudentProfileMapper;
  private readonly db?: DatabaseService;
  private readonly cdnBaseUrl: string;

  constructor(
    mapper?: StudentProfileMapper,
    db?: DatabaseService,
    options?: StudentProfileServiceOptions
  ) {
    this.mapper = mapper ?? new StudentProfileMapper(db);
    this.db = db;
    this.cdnBaseUrl = options?.cdnBaseUrl ?? '';
  }

  private async executeTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (this.db) {
      return this.db.executeTx(callback);
    }
    return defaultExecuteTx(callback);
  }

  private resolveAvatarUrl(avatarKey: string | null | undefined): string | null {
    if (!avatarKey) {
      return null;
    }
    if (!this.cdnBaseUrl) {
      return avatarKey;
    }
    const baseUrl = this.cdnBaseUrl.replace(/\/+$/, '');
    const key = avatarKey.replace(/^\/+/, '');
    return `${baseUrl}/${key}`;
  }

  private mapRecordToDto(record: StudentProfileRecord): StudentProfileDto {
    return {
      id: record.id,
      accountId: record.accountId,
      realName: record.realName,
      englishName: record.englishName,
      surnameInitial: record.surnameInitial,
      age: record.age,
      nickname: record.nickname,
      gender: record.gender,
      birthDate: record.birthDate,
      avatarKey: record.avatarKey,
      avatarUrl: this.resolveAvatarUrl(record.avatarKey),
      preferredCourseTypeIds: record.preferredCourseTypeIds,
      createdAt:
        record.createdAt instanceof Date
          ? record.createdAt.toISOString()
          : new Date(record.createdAt).toISOString(),
      updatedAt:
        record.updatedAt instanceof Date
          ? record.updatedAt.toISOString()
          : new Date(record.updatedAt).toISOString(),
    };
  }

  /**
   * 创建学员档案
   */
  async createProfile(
    accountId: string,
    dto: CreateStudentProfileInput
  ): Promise<StudentProfileDto> {
    const englishName = (dto.englishName || '').trim();
    const surnameInitial = (dto.surnameInitial || '').trim().toUpperCase();
    const suffix = (dto.nicknameSuffix || '').trim();

    if (
      !/^[A-Za-z]{1,24}$/.test(englishName) ||
      !/^[A-Za-z]$/.test(surnameInitial) ||
      typeof dto.age !== 'number' ||
      dto.age < 1 ||
      dto.age > 99 ||
      !Number.isInteger(dto.age) ||
      (dto.nicknameSuffix !== undefined &&
        dto.nicknameSuffix !== '' &&
        !/^[a-z0-9]{1,3}$/.test(dto.nicknameSuffix))
    ) {
      throw new ApiError('Invalid nickname format', 400, 'INVALID_NICKNAME');
    }

    const nickname = `${englishName}${surnameInitial}${dto.age}${suffix}`;
    if (!NICKNAME_REGEX.test(nickname)) {
      throw new ApiError('Invalid nickname format', 400, 'INVALID_NICKNAME');
    }

    const gender = dto.gender || 'undisclosed';
    const preferredCourseTypeIds = dto.preferredCourseTypeIds || [];

    try {
      return await this.executeTransaction(async (client) => {
        // 1. 获取咨询排他锁，强行串行化单账号并发建档
        await this.mapper.lockAccountScope(accountId, client);

        // 2. 检查数量上限 (10个)
        const count = await this.mapper.countActiveByAccountId(accountId, client);
        if (count >= 10) {
          throw new ApiError(
            'Student profile limit (10) reached for this account',
            409,
            'PROFILE_LIMIT_EXCEEDED'
          );
        }

        // 3. 查重名 (含软删除)
        const existing = await this.mapper.findByNickname(nickname, client, true);
        if (existing) {
          throw new ApiError(
            'Student nickname is already taken',
            409,
            'NICKNAME_ALREADY_EXISTS'
          );
        }

        // 4. 执行创建
        const record = await this.mapper.create(
          {
            accountId,
            realName: dto.realName.trim(),
            englishName,
            surnameInitial,
            age: dto.age,
            nickname,
            gender,
            birthDate: dto.birthDate,
            avatarKey: dto.avatarKey,
            preferredCourseTypeIds,
          },
          client
        );

        return this.mapRecordToDto(record);
      });
    } catch (err: unknown) {
      if (isPgUniqueViolation(err)) {
        throw new ApiError(
          'Student nickname is already taken',
          409,
          'NICKNAME_ALREADY_EXISTS'
        );
      }
      throw err;
    }
  }

  /**
   * 根据家长账号 ID 查询名下所有有效学员档案
   */
  async getProfilesByAccountId(accountId: string): Promise<StudentProfileListResponse> {
    const records = await this.mapper.findByAccountId(accountId);
    return {
      data: records.map((record) => this.mapRecordToDto(record)),
      meta: {
        total: records.length,
        limit: 10,
      },
    };
  }

  /**
   * 根据档案 ID 查询单个学员档案 (IDOR 防御)
   */
  async getProfileById(id: string, accountId: string): Promise<StudentProfileDto> {
    const record = await this.mapper.findById(id);
    if (!record || record.accountId !== accountId) {
      throw new ApiError('Student profile not found', 404, 'PROFILE_NOT_FOUND');
    }
    return this.mapRecordToDto(record);
  }

  /**
   * 更新学员档案
   */
  async updateProfile(
    id: string,
    accountId: string,
    dto: UpdateStudentProfileInput
  ): Promise<StudentProfileDto> {
    const record = await this.mapper.findById(id);
    if (!record || record.accountId !== accountId) {
      throw new ApiError('Student profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    const updateData: UpdateStudentProfileDbInput = {};

    if (dto.realName !== undefined) {
      updateData.realName = dto.realName.trim();
    }
    if (dto.gender !== undefined) {
      updateData.gender = dto.gender;
    }
    if (dto.birthDate !== undefined) {
      updateData.birthDate = dto.birthDate;
    }
    if (dto.avatarKey !== undefined) {
      updateData.avatarKey = dto.avatarKey;
    }
    if (dto.preferredCourseTypeIds !== undefined) {
      updateData.preferredCourseTypeIds = dto.preferredCourseTypeIds;
    }

    // 若 age 或 nicknameSuffix 变更，重新组装昵称
    if (dto.age !== undefined || dto.nicknameSuffix !== undefined) {
      const targetAge = dto.age ?? record.age;
      const targetSuffix = (dto.nicknameSuffix ?? '').trim();

      if (
        (dto.age !== undefined &&
          (typeof dto.age !== 'number' ||
            dto.age < 1 ||
            dto.age > 99 ||
            !Number.isInteger(dto.age))) ||
        (dto.nicknameSuffix !== undefined &&
          dto.nicknameSuffix !== '' &&
          !/^[a-z0-9]{1,3}$/.test(dto.nicknameSuffix))
      ) {
        throw new ApiError('Invalid nickname format', 400, 'INVALID_NICKNAME');
      }

      const newNickname = `${record.englishName}${record.surnameInitial}${targetAge}${targetSuffix}`;
      if (!NICKNAME_REGEX.test(newNickname)) {
        throw new ApiError('Invalid nickname format', 400, 'INVALID_NICKNAME');
      }

      const existing = await this.mapper.findByNickname(newNickname, undefined, true);
      if (existing && existing.id !== record.id) {
        throw new ApiError(
          'Student nickname is already taken',
          409,
          'NICKNAME_ALREADY_EXISTS'
        );
      }

      updateData.age = targetAge;
      updateData.nickname = newNickname;
    }

    try {
      const updated = await this.mapper.update(id, accountId, updateData);
      if (!updated) {
        throw new ApiError('Student profile not found', 404, 'PROFILE_NOT_FOUND');
      }
      return this.mapRecordToDto(updated);
    } catch (err: unknown) {
      if (isPgUniqueViolation(err)) {
        throw new ApiError(
          'Student nickname is already taken',
          409,
          'NICKNAME_ALREADY_EXISTS'
        );
      }
      throw err;
    }
  }

  /**
   * 软删除学员档案
   */
  async deleteProfile(id: string, accountId: string): Promise<{ success: boolean }> {
    const success = await this.mapper.softDelete(id, accountId);
    if (!success) {
      throw new ApiError('Student profile not found', 404, 'PROFILE_NOT_FOUND');
    }
    return { success: true };
  }

  /**
   * 检查规范昵称可用性
   */
  async checkNicknameAvailability(nickname: string): Promise<{ available: boolean }> {
    if (!NICKNAME_REGEX.test(nickname)) {
      return { available: false };
    }
    const existing = await this.mapper.findByNickname(nickname, undefined, true);
    return { available: !existing };
  }

  /**
   * 跨家长课程转让脱敏检索学员档案
   */
  async lookupProfileForTransfer(nickname: string): Promise<StudentLookupDto | null> {
    const record = await this.mapper.findByNickname(nickname, undefined, false);
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      nickname: record.nickname,
      avatarUrl: this.resolveAvatarUrl(record.avatarKey),
    };
  }
}
