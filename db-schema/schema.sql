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

-- -----------------------------------------------------------------------------
-- Module 1C: Unified Classes and Capacity Engine (Classes & Class Students)
-- (统一班级与招生管控)
-- -----------------------------------------------------------------------------

-- 1. 统一班级表
CREATE TABLE IF NOT EXISTS dream.classes (
    id VARCHAR(12) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    class_type VARCHAR(16) NOT NULL,
    course_type_id VARCHAR(12) NOT NULL REFERENCES dream.course_types(id),
    teacher_profile_id VARCHAR(12) NOT NULL REFERENCES dream.teacher_profiles(id),
    owner_monitor_profile_id VARCHAR(12) NOT NULL REFERENCES dream.monitor_profiles(id),
    min_students SMALLINT NOT NULL DEFAULT 1,
    max_students SMALLINT NOT NULL DEFAULT 1,
    teacher_salary_points INT NOT NULL DEFAULT 0,
    platform_commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(16) NOT NULL DEFAULT 'recruiting',
    planned_start_date DATE DEFAULT NULL,
    force_started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    CONSTRAINT chk_class_type CHECK (class_type IN ('1v1', 'small_group')),
    CONSTRAINT chk_class_capacity CHECK (min_students >= 1 AND min_students <= max_students AND max_students <= 20),
    CONSTRAINT chk_class_commission CHECK (platform_commission_rate >= 0.00 AND platform_commission_rate <= 100.00),
    CONSTRAINT chk_class_status CHECK (status IN ('recruiting', 'active', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_classes_monitor 
ON dream.classes (owner_monitor_profile_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_classes_teacher 
ON dream.classes (teacher_profile_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_classes_status 
ON dream.classes (status) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_classes_type 
ON dream.classes (class_type) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_classes_course_type 
ON dream.classes (course_type_id) 
WHERE deleted_at IS NULL;

-- 2. 班级-学员报名关系表
CREATE TABLE IF NOT EXISTS dream.class_students (
    id VARCHAR(12) PRIMARY KEY,
    class_id VARCHAR(12) NOT NULL REFERENCES dream.classes(id),
    student_profile_id VARCHAR(12) NOT NULL REFERENCES dream.student_profiles(id),
    status VARCHAR(16) NOT NULL DEFAULT 'enrolled',
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    removed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_class_student_status CHECK (status IN ('enrolled', 'withdrawn'))
);

-- 单学员在单班级内有效在读关系唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_student_active 
ON dream.class_students (class_id, student_profile_id) 
WHERE (status = 'enrolled');

CREATE INDEX IF NOT EXISTS idx_class_students_student 
ON dream.class_students (student_profile_id);

CREATE INDEX IF NOT EXISTS idx_class_students_class 
ON dream.class_students (class_id);
