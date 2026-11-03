---
name: database-ops
description: 用于在 Dream 项目中安全、规范地执行 psql 命令与数据库迁移。当用户输入 "db"、"psql" 或要求操作数据库时必须使用此技能。
---

# Database Operations Skill

## Instructions

当你需要执行 `psql` 命令、数据库迁移或任何数据库交互任务时，必须遵循以下步骤：

1. **获取环境凭据**：
   - 优先读取项目根目录下的 `tmp/local_env.dev` 文件。
   - 提取 `DB_URL` 变量。如果文件不存在，必须主动询问用户连接字符串，严禁硬编码或猜测。

2. **遵循建模规约**：
   - 在构造 SQL 时，必须显式指定 Schema 前缀 `dream.`（例如 `dream.student_profiles`, `dream.timeslots`, `dream.course_orders` 等）。
   - 严禁在 SQL 中使用自增 ID 或标准 UUID，必须遵循 12 位短 ID 规范（使用 `@topeetop/shared-core` 的 `generateShortUuid()`）。
   - 详细设计标准参考：[数据库设计规范](../../docs/conventions/database_design_conventions.md)。

3. **安全与防越权 (IDOR)**：
   - 对于 `UPDATE` 或 `DELETE` 操作，必须带上 `account_id` 或 `student_profile_id` 过滤条件以防止越权。
   - 生产环境的 DDL 变更必须先记录在 `db-schema/migration_vXXX.sql` 中，保证幂等性。

4. **命令构造示例**：
   ```bash
   psql "$DB_URL" -c "SELECT * FROM dream.student_profiles WHERE account_id = 'ACCOUNT_ID' LIMIT 10;"
   ```

## Available Resources

- `docs/conventions/database_design_conventions.md`: 核心数据库设计准则。
- `db-schema/`: 物理表结构定义与版本化迁移脚本。
