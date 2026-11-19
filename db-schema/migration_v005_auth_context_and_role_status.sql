-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential.
-- Migration v005: Auth Context, User Preferences & Minimal Role Status Columns
-- Scope: Ensure essential status & account_id fields exist for all 4 roles (admin/monitor/teacher/parent)

-- 1. 平台管理员白名单表（解耦 auth-core 角色字段）
CREATE TABLE IF NOT EXISTS dream.admin_accounts (
    id VARCHAR(12) PRIMARY KEY,
    account_id VARCHAR(12) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    note VARCHAR(128) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    CONSTRAINT chk_admin_account_status CHECK (status IN ('ACTIVE', 'DISABLED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_accounts_account
ON dream.admin_accounts (account_id)
WHERE deleted_at IS NULL;

-- 2. 用户语言与界面偏好表（M0-T5）
CREATE TABLE IF NOT EXISTS dream.user_preferences (
    id VARCHAR(12) PRIMARY KEY,
    account_id VARCHAR(12) NOT NULL,
    locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_user_pref_locale CHECK (locale IN ('zh-CN', 'en-US'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_preferences_account
ON dream.user_preferences (account_id);

-- 3. 班长档案补齐 status 与 resigned_at
ALTER TABLE dream.monitor_profiles
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS resigned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_monitor_status') THEN
        ALTER TABLE dream.monitor_profiles
            ADD CONSTRAINT chk_monitor_status CHECK (status IN ('ACTIVE', 'RESIGNED'));
    END IF;
END $$;

-- 4. 教师档案补齐 status
ALTER TABLE dream.teacher_profiles
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_teacher_status') THEN
        ALTER TABLE dream.teacher_profiles
            ADD CONSTRAINT chk_teacher_status CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'RESIGNED'));
    END IF;
END $$;

-- 5. 学员档案放宽 account_id 可空（支撑 UNBOUND 试课代建档）并补齐 status
ALTER TABLE dream.student_profiles
    ALTER COLUMN account_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_status') THEN
        ALTER TABLE dream.student_profiles
            ADD CONSTRAINT chk_student_status CHECK (status IN ('ACTIVE', 'UNBOUND', 'ARCHIVED'));
    END IF;
END $$;
