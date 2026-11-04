-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential.
-- Migration: migration_v004_module1c_classes.sql
-- Description: Module 1C Unified Classes and Capacity Engine (Classes & Class Students)

CREATE SCHEMA IF NOT EXISTS dream;

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
