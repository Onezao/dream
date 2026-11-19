-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential.
-- Database Schema for Dream System (PostgreSQL Single Schema: dream)
-- Phase 0: Base Schema Initialization
-- Note: Specific business tables will be individually designed and migrated module by module.

CREATE SCHEMA IF NOT EXISTS dream;

-- -----------------------------------------------------------------------------
-- Module 0A: Admin Accounts & User Preferences (平台管理员白名单与用户偏好)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Module 1A: Student Profiles (学员与多孩档案)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dream.student_profiles (
    id VARCHAR(12) PRIMARY KEY,
    account_id VARCHAR(12) DEFAULT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    real_name VARCHAR(32) NOT NULL,
    english_name VARCHAR(24) NOT NULL,
    surname_initial CHAR(1) NOT NULL,
    age SMALLINT NOT NULL,
    nickname VARCHAR(30) NOT NULL,
    gender VARCHAR(12) NOT NULL DEFAULT 'undisclosed',
    birth_date DATE DEFAULT NULL,
    avatar_key VARCHAR(255) DEFAULT NULL,
    preferred_course_type_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    CONSTRAINT chk_student_status CHECK (status IN ('ACTIVE', 'UNBOUND', 'ARCHIVED')),
    CONSTRAINT chk_student_gender CHECK (gender IN ('male', 'female', 'undisclosed')),
    CONSTRAINT chk_student_age CHECK (age >= 1 AND age <= 99)
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_account 
ON dream.student_profiles (account_id) 
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_profiles_nickname_lower 
ON dream.student_profiles (LOWER(nickname));

-- -----------------------------------------------------------------------------
-- Module 1B: Teacher Team and Monitor Profile
-- (教师团队与班长档案 - 仅保留基础身份与 status 字段，其余字段随具体模块设计补充)
-- -----------------------------------------------------------------------------

-- 1. 班长档案表 (教务经纪人)
CREATE TABLE IF NOT EXISTS dream.monitor_profiles (
    id VARCHAR(12) PRIMARY KEY,
    account_id VARCHAR(12) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    display_name VARCHAR(64) NOT NULL,
    phone VARCHAR(32) DEFAULT NULL,
    resigned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    CONSTRAINT chk_monitor_status CHECK (status IN ('ACTIVE', 'RESIGNED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_monitor_profiles_account 
ON dream.monitor_profiles (account_id) 
WHERE deleted_at IS NULL;

-- 2. 教师档案表 (1:1 强绑定负责班长)
CREATE TABLE IF NOT EXISTS dream.teacher_profiles (
    id VARCHAR(12) PRIMARY KEY,
    account_id VARCHAR(12) DEFAULT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    display_name VARCHAR(64) NOT NULL,
    monitor_profile_id VARCHAR(12) NOT NULL REFERENCES dream.monitor_profiles(id),
    intro_zh TEXT NOT NULL,
    intro_en TEXT NOT NULL,
    photo_key VARCHAR(255) DEFAULT NULL,
    video_key VARCHAR(255) DEFAULT NULL,
    classin_qr_key VARCHAR(255) DEFAULT NULL,
    resigned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    CONSTRAINT chk_teacher_status CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'RESIGNED'))
);

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_monitor 
ON dream.teacher_profiles (monitor_profile_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_account 
ON dream.teacher_profiles (account_id) 
WHERE deleted_at IS NULL AND account_id IS NOT NULL;
