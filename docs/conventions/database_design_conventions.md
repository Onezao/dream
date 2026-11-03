/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# 数据库设计与建模规范 (Database Design Conventions)

本文档规定了 Dream 项目在 PostgreSQL 数据库中的设计标准与数据建模准则。

---

## 1. Schema 规划与表命名

- **单 Schema 架构 (`dream`)**：
  - 本项目数据库层统一使用 **`dream`** 单 Schema 集中承载所有教务与财务排课业务实体。
  - 所有 SQL 查询中**必须且只能显式带前缀** `dream.`（如 `dream.accounts`, `dream.student_profiles`, `dream.timeslots`）。
- **表命名规约**：
  - 采用小写字母加下划线命名法 (`snake_case`)。
  - 表名统一使用复数形式（例如 `accounts`, `student_profiles`, `classes`, `course_orders`, `timeslots`, `transfer_orders`）。

---

## 2. 核心数据实体清单

| 表名 (带有 dream. 前缀) | 业务实体描述 | 核心关键字段 |
| :--- | :--- | :--- |
| `accounts` | 登录账号 (操作主体) | `id (VARCHAR(12))`, `email (UNIQUE)`, `password_hash`, `roles (JSONB)` |
| `student_profiles` | 学生档案 (上课实体) | `id`, `account_id`, `nickname (英文名+姓首字母+年龄)`, `gender`, `birth_date` |
| `teacher_profiles` | 教师档案 (授课方) | `id`, `account_id`, `level`, `skills (JSONB)`, `monitor_id`, `intro_text`, `video_url`, `photo_url`, `classin_qr_url` |
| `monitor_profiles` | 班长档案 (经纪人) | `id`, `account_id`, `name`, `phone` |
| `classes` | 班级 (1v1个人班/小班课) | `id`, `name`, `type (1v1/small_group)`, `teacher_id`, `monitor_id`, `min_students`, `max_students`, `teacher_salary_points`, `platform_commission_rate` |
| `course_types` | 课程类型字典 | `id`, `name (少儿英语/生活口语/KET/PET等)`, `is_active` |
| `course_orders` | 购课单 (购课出资单据) | `id`, `account_id`, `student_profile_id`, `order_type`, `teacher_id`, `holder_id`, `has_extra_fee`, `total_lessons`, `total_points`, `cancel_quota`, `used_cancel_count`, `status` |
| `timeslots` | TS 最小课次单元 (核心原子账本) | `id`, `order_id`, `original_account_id`, `original_student_id`, `actual_student_id`, `holder_id`, `class_type`, `schedule_type`, `lesson_date`, `time_slot`, `current_teacher_id`, `is_substitute`, `original_teacher_id`, `is_transferred`, `total_points`, `teacher_salary_points`, `extra_prep_fee_points`, `tool_fee_points`, `status` |
| `refund_orders` | 退款单 | `id`, `order_id`, `student_profile_id`, `operator_id`, `refund_points`, `penalty_points`, `status` |
| `transfer_orders` | 班长向平台周转账单 | `id`, `sender_monitor_id`, `receiver_admin_id`, `transfer_type`, `total_points`, `monitor_reserved_profit`, `actual_transfer_points`, `status` |
| `teacher_settlements`| 教师周课酬单 (每师一单) | `id`, `teacher_id`, `settlement_week (如2026W31)`, `one_to_one_count`, `one_to_one_extra_count`, `small_group_count`, `status` |
| `platform_tool_settlements`| 平台周工具费报表 | `id`, `settlement_week`, `total_1v1_tool_points`, `total_group_tool_points`, `total_commission_points`, `total_platform_net_points` |
| `profile_messages` | 学生档案简易留言板 | `id`, `student_profile_id`, `author_account_id`, `author_role`, `content`, `visibility (public_teacher_student / internal_teaching_only)` |
| `audit_logs` | 操作审计日志表 | `id`, `operator_id`, `target_entity`, `target_id`, `action`, `reason`, `changes (JSONB)` |

---

## 3. 字段设计与标识规约

### 3.1 主键 (Primary Keys)
- **12 位短 ID**：所有表主键类型固定为 `VARCHAR(12)`，必须通过 `@topeetop/shared-core` 的 `generateShortUuid()` 生成。
- **严禁使用**：数据库自增 `SERIAL` / `BIGSERIAL` 或标准 36 位 UUID。

### 3.2 归属权字段与 IDOR 物理防御
- 除全局字典表外，所有涉及家长/学生的数据表必须包含 `account_id` 或 `student_profile_id` 归属字段。
- 在构建查询和更新语句时，必须强制将归属权字段加入 `WHERE` 条件。

### 3.3 审计与软删除规范
- **标准时间戳**：
  - `created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
  - `updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
- **软删除**：核心业务表包含 `deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL`。
- **部分索引 (Partial Index)**：在常用查询上建立 `WHERE (deleted_at IS NULL)` 部分索引以提升活跃数据扫描性能。

### 3.4 高频排课并发防超卖索引
为保证 `SELECT ... FOR UPDATE` 在高并发约课与排班落盘时精准锁定单行网格、杜绝表锁隐患：
- `dream.timeslots` 必须建立专用复合部分索引：
  ```sql
  CREATE INDEX idx_timeslots_booking_lock 
  ON dream.timeslots (current_teacher_id, lesson_date, time_slot) 
  WHERE deleted_at IS NULL;
  ```

---

## 4. DDL 迁移工作流

- 所有本地及线上 DDL 变更必须统一写入 `db-schema/migration_vXXX.sql`。
- 迁移脚本必须是幂等的（使用 `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` 等）。
- 严禁在未经版本化的情况下直接手动修改生产数据库结构。
