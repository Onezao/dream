-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential.
-- Database Schema for Dream System (PostgreSQL Single Schema: dream)
-- Phase 0: Base Schema Initialization
-- Note: Specific business tables will be individually designed and migrated module by module.

CREATE SCHEMA IF NOT EXISTS dream;

-- -----------------------------------------------------------------------------
-- Module 1A: Student Profiles (学员与多孩档案)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dream.student_profiles (
    id VARCHAR(12) PRIMARY KEY,
    account_id VARCHAR(12) NOT NULL,
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
    CONSTRAINT chk_student_gender CHECK (gender IN ('male', 'female', 'undisclosed')),
    CONSTRAINT chk_student_age CHECK (age >= 1 AND age <= 99)
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_account 
ON dream.student_profiles (account_id) 
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_profiles_nickname_lower 
ON dream.student_profiles (LOWER(nickname));

-- -----------------------------------------------------------------------------
-- Module 1B: Teacher Team, Levels, Course Types and Monitor Profile
-- (教师团队、定级字典、课程类型字典与班长档案)
-- -----------------------------------------------------------------------------

-- 1. 字典：课程类型字典
CREATE TABLE IF NOT EXISTS dream.course_types (
    id VARCHAR(12) PRIMARY KEY,
    name VARCHAR(32) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_course_types_name ON dream.course_types (name);

-- 2. 字典：教师定级字典
CREATE TABLE IF NOT EXISTS dream.teacher_levels (
    id VARCHAR(12) PRIMARY KEY,
    name VARCHAR(32) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_levels_name ON dream.teacher_levels (name);

-- 3. 班长档案表 (教务经纪人)
CREATE TABLE IF NOT EXISTS dream.monitor_profiles (
    id VARCHAR(12) PRIMARY KEY,
    account_id VARCHAR(12) NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    phone VARCHAR(32) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_monitor_profiles_account 
ON dream.monitor_profiles (account_id) 
WHERE deleted_at IS NULL;

-- 4. 教师档案表 (1:1 强绑定负责班长)
CREATE TABLE IF NOT EXISTS dream.teacher_profiles (
    id VARCHAR(12) PRIMARY KEY,
    account_id VARCHAR(12) DEFAULT NULL,
    display_name VARCHAR(64) NOT NULL,
    level_id VARCHAR(12) NOT NULL REFERENCES dream.teacher_levels(id),
    monitor_profile_id VARCHAR(12) NOT NULL REFERENCES dream.monitor_profiles(id),
    skill_course_type_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    intro_zh TEXT NOT NULL,
    intro_en TEXT NOT NULL,
    photo_key VARCHAR(255) DEFAULT NULL,
    video_key VARCHAR(255) DEFAULT NULL,
    classin_qr_key VARCHAR(255) DEFAULT NULL,
    resigned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_monitor 
ON dream.teacher_profiles (monitor_profile_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_level 
ON dream.teacher_profiles (level_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_account 
ON dream.teacher_profiles (account_id) 
WHERE deleted_at IS NULL AND account_id IS NOT NULL;
