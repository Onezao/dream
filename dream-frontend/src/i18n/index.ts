/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import { createI18n } from 'vue-i18n';

export type SupportedLocale = 'zh-CN' | 'en-US';

const LOCALE_KEY = 'dream_locale';

export const messages = {
  'zh-CN': {
    common: {
      appName: 'Dream 教务系统',
      confirm: '确认',
      cancel: '取消',
      save: '保存',
      edit: '编辑',
      delete: '删除',
      add: '添加',
      close: '关闭',
      loading: '加载中...',
      back: '返回',
      success: '操作成功',
      failed: '操作失败',
      current: '当前',
      transferCode: '转让代码',
      copied: '已复制到剪贴板',
    },
    workspace: {
      title: '工作台',
      parent: '家长工作台',
      monitor: '班长工作台',
      admin: '管理员后台',
      teacher: '教师课表',
    },
    profile: {
      switcher: {
        title: '学生档案',
        noChild: '暂未绑定学员',
        addPrompt: '立即添加孩子',
        addStudent: '添加新宝贝',
        maxReached: '名下档案已达上限 (10/10)',
        switchedTo: '已切换至 {name}',
        ageSuffix: '岁',
        countSummary: '{current}/10',
      },
      modal: {
        createTitle: '添加新学员档案',
        editTitle: '编辑学员档案',
        realName: '宝贝真实姓名',
        realNamePlaceholder: '如：张小丽',
        englishName: '英文名',
        englishNamePlaceholder: '如：Alice',
        englishNameHint: '限1-24位英文字母',
        surnameInitial: '姓首字母',
        surnameInitialPlaceholder: 'Z',
        surnameInitialHint: '单个英文字母，自动转大写',
        age: '年龄',
        agePlaceholder: '12',
        ageHint: '1-99 岁',
        suffix: '微调后缀',
        suffixOptional: '（可选，重名时使用）',
        suffixPlaceholder: '如：b',
        suffixHint: '限1-3位字母/数字',
        gender: '性别',
        male: '男孩',
        female: '女孩',
        undisclosed: '保密',
        birthDate: '出生日期',
        birthDatePlaceholder: '请选择出生日期',
        avatar: '宝贝头像',
        choosePhoto: '选择照片',
        avatarHint: '本地裁剪为 1:1 正方形并压缩为 WebP',
        avatarSuccess: '已就地裁剪为正方形 WebP',
        previewTitle: '系统规范昵称预览',
        previewSubtitle: '全平台唯一，用于转课精准识别',
        fillPrompt: '填写英文名、姓首字母与年龄后自动生成',
        checking: '正在校验昵称唯一性...',
        available: '该昵称全局唯一，可使用',
        occupied: '该昵称已被占用，建议微调后缀（如 {suggestion}）',
        invalidFormat: '格式不合法：首字母必须为单英文字母，年龄为数字',
        submitCreate: '确认创建',
        submitUpdate: '确认保存',
        deleteConfirmTitle: '确认删除档案',
        deleteConfirmMsg: '确定要删除学员档案 “{name}” 吗？此操作不可逆。',
      },
      errors: {
        realNameRequired: '请填写宝贝真实姓名',
        englishNameRequired: '请填写英文名（1-24位英文字母）',
        surnameInitialRequired: '请填写姓首字母（单个字母）',
        ageRequired: '请输入有效年龄（1-99）',
        nicknameInvalid: '生成的昵称格式不合规',
        nicknameOccupied: '该昵称已被占用，请微调后缀',
        PROFILE_LIMIT_EXCEEDED: '名下档案已达 10 个上限，无法继续添加',
        NICKNAME_ALREADY_EXISTS: '该昵称已被占用，请微调后缀',
        PROFILE_NOT_FOUND: '未找到指定学员档案',
        UNAUTHORIZED: '登录态失效，请重新登录',
      },
    },
  },
  'en-US': {
    common: {
      appName: 'Dream Edu System',
      confirm: 'Confirm',
      cancel: 'Cancel',
      save: 'Save',
      edit: 'Edit',
      delete: 'Delete',
      add: 'Add',
      close: 'Close',
      loading: 'Loading...',
      back: 'Back',
      success: 'Success',
      failed: 'Failed',
      current: 'Active',
      transferCode: 'Transfer Code',
      copied: 'Copied to clipboard',
    },
    workspace: {
      title: 'Workspace',
      parent: 'Parent Workspace',
      monitor: 'Monitor Workspace',
      admin: 'Admin Console',
      teacher: 'Teacher Schedule',
    },
    profile: {
      switcher: {
        title: 'Student Profiles',
        noChild: 'No Student Profile',
        addPrompt: 'Add Child Profile',
        addStudent: 'Add New Child',
        maxReached: 'Limit Reached (10/10)',
        switchedTo: 'Switched to {name}',
        ageSuffix: 'yrs',
        countSummary: '{current}/10',
      },
      modal: {
        createTitle: 'Add Student Profile',
        editTitle: 'Edit Student Profile',
        realName: 'Real Name',
        realNamePlaceholder: 'e.g. Alice Zhang',
        englishName: 'English Name',
        englishNamePlaceholder: 'e.g. Alice',
        englishNameHint: '1-24 alphabetic letters',
        surnameInitial: 'Surname Initial',
        surnameInitialPlaceholder: 'Z',
        surnameInitialHint: 'Single letter, auto uppercased',
        age: 'Age',
        agePlaceholder: '12',
        ageHint: '1-99 years old',
        suffix: 'Suffix',
        suffixOptional: '(Optional, for duplicates)',
        suffixPlaceholder: 'e.g. b',
        suffixHint: '1-3 letters or digits',
        gender: 'Gender',
        male: 'Boy',
        female: 'Girl',
        undisclosed: 'Undisclosed',
        birthDate: 'Birth Date',
        birthDatePlaceholder: 'Select birth date',
        avatar: 'Child Avatar',
        choosePhoto: 'Select Photo',
        avatarHint: 'Locally cropped 1:1 square & compressed to WebP',
        avatarSuccess: 'Cropped to square WebP',
        previewTitle: 'Standard Nickname Preview',
        previewSubtitle: 'Platform-wide unique ID for course transfer',
        fillPrompt: 'Fill in English name, initial, and age to generate',
        checking: 'Checking availability...',
        available: 'This nickname is available!',
        occupied: 'Nickname already taken. Try suffix like {suggestion}',
        invalidFormat: 'Invalid format: single initial letter and numeric age',
        submitCreate: 'Create Profile',
        submitUpdate: 'Save Changes',
        deleteConfirmTitle: 'Delete Student Profile',
        deleteConfirmMsg: 'Are you sure you want to delete profile "{name}"? This action cannot be undone.',
      },
      errors: {
        realNameRequired: 'Please enter child real name',
        englishNameRequired: 'Please enter valid English name',
        surnameInitialRequired: 'Please enter single surname initial letter',
        ageRequired: 'Please enter valid age (1-99)',
        nicknameInvalid: 'Generated nickname format is invalid',
        nicknameOccupied: 'Nickname is already taken. Please adjust suffix',
        PROFILE_LIMIT_EXCEEDED: 'Maximum 10 profiles reached',
        NICKNAME_ALREADY_EXISTS: 'Nickname already taken. Please adjust suffix',
        PROFILE_NOT_FOUND: 'Student profile not found',
        UNAUTHORIZED: 'Session expired. Please log in again',
      },
    },
  },
};

function getInitialLocale(): SupportedLocale {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCALE_KEY);
      if (saved === 'zh-CN' || saved === 'en-US') {
        return saved;
      }
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      if (navigator.language.toLowerCase().startsWith('en')) {
        return 'en-US';
      }
    }
  } catch {
    // fallback
  }
  return 'zh-CN';
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'zh-CN',
  messages,
});

export function setLocale(locale: SupportedLocale): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (i18n.global.locale as { value: string }).value = locale;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_KEY, locale);
    }
  } catch {
    // Ignore storage errors
  }
}

export default i18n;
