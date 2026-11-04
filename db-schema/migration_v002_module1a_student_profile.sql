-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential.
-- Migration: migration_v002_module1a_student_profile.sql
-- Description: Module 1A Student Profile table, constraints and indexes

CREATE SCHEMA IF NOT EXISTS dream;

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

-- 索引 1：家长名下有效档案索引 (WHERE deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_student_profiles_account 
ON dream.student_profiles (account_id) 
WHERE deleted_at IS NULL;

-- 索引 2：规范昵称大小写不敏感全局唯一（永久防重，不带 deleted_at 过滤）
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_profiles_nickname_lower 
ON dream.student_profiles (LOWER(nickname));
