-- (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential.
-- Idempotent Development Seed Data for dream schema (PostgreSQL)
-- Maps existing tauth.users accounts into Dream's 4 business role tables (admin / monitor / teacher / parent)

-- 1. 管理员白名单 (admin_accounts)
INSERT INTO dream.admin_accounts (id, account_id, status, note)
VALUES
    ('admDev000001', '89753001', 'ACTIVE', 'Superadmin seed account'),
    ('admDev000002', 'IZ3VGJCTN6DA', 'ACTIVE', 'Three-in-one Admin + Monitor + Parent seed')
ON CONFLICT (account_id) WHERE deleted_at IS NULL DO NOTHING;

-- 2. 班长档案 (monitor_profiles)
INSERT INTO dream.monitor_profiles (id, account_id, status, display_name, phone)
VALUES
    ('monDev000001', 'IZ3VGJCTN6DA', 'ACTIVE', 'Leo (班长)', '+8613800000001'),
    ('monDev000002', 'R4TQV2dtR22J', 'ACTIVE', 'Mia (班长)', '+8613800000002')
ON CONFLICT (account_id) WHERE deleted_at IS NULL DO NOTHING;

-- 3. 教师档案 (teacher_profiles)
INSERT INTO dream.teacher_profiles (id, account_id, status, display_name, monitor_profile_id, intro_zh, intro_en)
VALUES
    (
        'tchDev000001',
        'wtbBG54vYqJT',
        'ACTIVE',
        'Teacher David',
        'monDev000002',
        '拥有8年少儿英语线上教学经验，擅长自然拼读与口语启发。',
        '8 years of online ESL teaching experience, specializing in phonics and conversational fluency.'
    )
ON CONFLICT (id) DO NOTHING;

-- 4. 学员档案 (student_profiles: 多孩家长 + 兼职家长 + UNBOUND 试课档案)
INSERT INTO dream.student_profiles (
    id, account_id, status, real_name, english_name, surname_initial, age, nickname, gender
)
VALUES
    ('stuDev000001', 'gsi7l5krHhWM', 'ACTIVE', '张爱丽丝', 'Alice', 'Z', 12, 'AliceZ12', 'female'),
    ('stuDev000002', 'gsi7l5krHhWM', 'ACTIVE', '张鲍勃', 'Bob', 'Z', 10, 'BobZ10', 'male'),
    ('stuDev000003', 'IZ3VGJCTN6DA', 'ACTIVE', '陈辛迪', 'Cindy', 'C', 9, 'CindyC09', 'female'),
    ('stuDev000004', NULL, 'UNBOUND', '林试听', 'Leo', 'L', 8, 'LeoL08', 'male')
ON CONFLICT (id) DO NOTHING;

-- 5. 用户语言与时区偏好 (user_preferences)
INSERT INTO dream.user_preferences (id, account_id, locale, timezone)
VALUES
    ('prfDev000001', '89753001', 'zh-CN', 'Asia/Shanghai'),
    ('prfDev000002', 'IZ3VGJCTN6DA', 'zh-CN', 'Asia/Shanghai'),
    ('prfDev000003', 'R4TQV2dtR22J', 'zh-CN', 'Asia/Shanghai'),
    ('prfDev000004', 'wtbBG54vYqJT', 'en-US', 'America/New_York'),
    ('prfDev000005', 'gsi7l5krHhWM', 'zh-CN', 'Asia/Shanghai')
ON CONFLICT (account_id) DO NOTHING;
