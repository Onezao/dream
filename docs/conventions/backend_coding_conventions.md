/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# 后端代码开发与架构规范 (Backend Coding Conventions)

本文档规定了 Dream 后端项目（`dream-backend`, `dream-worker`）的代码架构与实现规范。

---

## 1. 目录结构规范 (Directory Structure)

项目采用“业务核心分包（`dream-core`）+ 接入应用（`dream-backend` / `dream-worker`）”的分层结构：

- **`dream-core/src/` (领域与数据共享核心)**：
  - **`db/`**：数据访问层（DAL）。所有数据库操作及 SQL 拼接必须且只能存在于 `*Mapper.ts` 中（一表一 Mapper 唯一源头）。
  - **`modules/`**：5 大业务模块领域 Services、状态机流转与跨表事务编排。
  - **`calculators/`**：分账、配额纯计算逻辑。
  - **`types/`**：全局与领域级 TypeScript 类型与枚举。
- **`dream-backend/src/` (Fastify HTTP API 接入层)**：
  - **`config/`**：环境变量加载、Zod Schema Fail-Fast 校验及配置单例。
  - **`controllers/`**：HTTP 请求入口，负责入参校验、调用 `dream-core` 领域服务并返回标准化响应。
  - **`loaders/`**：应用启动引导与装配层。依赖注入 (DI) 的装配、Fastify 插件与路由挂载。
  - **`routes/`**：路由声明层。将 Path、Method、Zod Schema 与 Controller 方法进行绑定。
  - **`middlewares/`**：Fastify Hooks（鉴权、审计、日志拦截器）。
- **`dream-worker/src/` (批处理与定时调度接入层)**：
  - **`jobs/`**：02:00 自动结课 Job、周末周结单 Job、超时邮件兜底 Job，直接调用 `dream-core` 提供的批处理 Service。
  - **`scheduler.ts`**：定时器注册与任务守护进程。

---

## 2. 架构分层与 Mapper 隔离规范

严格遵守 **Controller -> Service -> Mapper** 三层架构。

### 2.1 Mapper 的职责与绝对隔离
- **一表一 Mapper**：每个数据库表对应一个 Mapper 文件（如 `StudentProfileMapper.ts`, `TimeslotMapper.ts`, `CourseOrderMapper.ts`），**统一且唯一存放在 `dream-core/src/db/` 目录下**。
- **写操作归属权**：针对某张表的 `INSERT` / `UPDATE` / `DELETE` 必须且只能在其专属 Mapper 中实现。
- **SQL 绝对隔离**：**所有 SQL 语句必须且只能编写在 `dream-core/src/db/*Mapper.ts` 中**。严禁在 Service 或 Controller 中出现任何 SQL 片段。
- **联表只读查询**：允许在 Mapper 中通过 `JOIN` 关联其他表进行只读查询，但严禁跨表写入。
- **严禁越级调用**：Controller 绝对禁止跳过 Service 直接调用 Mapper。

### 2.2 Service 的职责
- 业务编排与状态流转（购课裂变 TS、排期互斥检查、转让变更等）。
- 跨 Mapper 事务控制（通过传递 `PoolClient` 保证原子性）。
- **IDOR 纵深防越权**：强制校验数据所属的 `account_id` 或 `student_profile_id`。

### 2.3 数据库接入与 Mapper DI 规约 (DatabaseService & BaseMapper)
- **零自建连接池铁律 (Zero Pool Implementation)**：
  - 严禁在 `dream-core` 或业务接入层中编写 `new Pool(...)`、连接监听或维护连接池生命周期。
  - 必须统一复用 `@topeetop/shared-core` 的 `DatabaseService` 及辅助工具（`initializeDatabase`, `closePool`, `executeTx`）。参考 `/Users/shanzao/ravll-workspace/packages/shared-core/README.md`。
- **Mapper 继承与构造函数注入 (Constructor Injection)**：
  - 所有表 Mapper 必须继承 `BaseMapper<RowType>`，并提供 `constructor(db?: DatabaseService) { super(db); }` 接口。
  - **查询与事务分流**：
    - **事务分支**：若传入 `client: PoolClient`，直接通过 `client.query(...)` 执行，确保原子性与行级锁（`SELECT ... FOR UPDATE` / `pg_advisory_xact_lock`）。
    - **独立查询分支**：优先通过注入的 `this.db.executeQuery` / `this.db.getOne` 执行；若未注入实例则平滑回退至 `@topeetop/shared-core` 全局单例。
- **DAL 单测标准 (Mapper Testing Standard)**：
  - 必须通过构造函数直接传入 `mockDb: jest.Mocked<DatabaseService>` 进行测试（如 `new StudentProfileMapper(mockDb)`）。
  - 严禁使用 Jest 模块劫持（`jest.mock('../src/db/connection.js')`）等全局 monkey patch 方式。

---

## 3. 依赖注入规范 (Dependency Injection)

系统采用基于 **Composition Root (组合根)** 的手动依赖注入模式。

- **参数注入规则**：
  - 依赖数 $\le$ 3 个：允许构造函数平铺入参 `constructor(mapper: TimeslotMapper, config: AppConfig)`。
  - 依赖数 > 3 个：必须使用 `deps` 对象注入模式，并定义 TypeScript `interface`（如 `OrderServiceDeps`）。
- **统一装配**：在 `src/loaders/` 下分层装配（Infra -> Domain -> Services -> Controllers）。

---

## 4. 配置与环境变量规范 (Config & Env)

- **Schema 强校验 (Fail-Fast)**：所有环境变量必须在 `src/config/env.config.ts` 中通过 `Zod` 定义 Schema。应用启动若有缺失或格式错误，进程必须直接自杀（Process Exit 1）。
- **严禁裸调 `process.env`**：业务代码中严禁直接读取 `process.env`，必须通过 DI 注入的 `getConfig()` 获取已校验配置。
- **敏感字段加密**：生产环境核心凭据（DB_URL, Keys）采用带 `_CIPHER` 后缀密文存储，启动时由 SecretManager 动态解密。
- **报错脱敏**：配置校验失败或日志打印时，严禁输出敏感字段明文。

---

## 5. 实体 ID 与数据库规约

- **禁止自增 ID 与标准 UUID**：严禁使用 `SERIAL` 或标准 36 位 UUID 作为主键。
- **统一 12 位短 ID**：所有业务实体主键统一使用 `@topeetop/shared-core` 的 `generateShortUuid()` 生成 **12 位短 ID** (`VARCHAR(12)`)。
- **显式 Schema 前缀**：所有 SQL 必须显式声明 `dream.` 前缀（如 `dream.timeslots`）。

---

## 6. Serverless 与后台任务合规规范

- **禁止业务中使用裸定时器**：严禁在业务逻辑中使用 `setTimeout` / `setInterval` 处理异步延时。
- **耗时任务解耦与 TaskRelay 集成**：跨服务异步触发、延时执行或耗时任务（如周结单生成、批量邮件通知）优先通过 `@topeetop/task-relay-client` 或异步队列表执行。
  - Payload 必须 Base64 编码：`Buffer.from(JSON.stringify(payload)).toString("base64")`。
  - Worker 执行控制器遵循状态码驱动规范：返回 `200` 即刻成功归档；返回 `202 Accepted` 进入 `PENDING_CALLBACK` 状态（须在 30 分钟内调用 `completeTask` 终结任务）；`4xx/5xx` 自动触发退避重试。详见 [遥测与异步中转规范](./telemetry_and_task_relay_conventions.md)。
- **全链路遥测与结构化日志 (`@topeetop/telemetry-core`)**：
  - 遵循 100% 云原生标准输出（stdout JSON）规约，严禁在业务代码中集成第三方 HTTP 采集 SDK。
  - 全链路透传 W3C 32 位 Hex `trace_id`（通过 Fastify Hook `telemetryContext.run({ traceId }, ...)` 绑定，并跨 HTTP 调用透传 `x-trace-id` 请求头）。
  - 日志记录必须执行 PII 敏感脱敏（密码、Token、手机号、邮箱掩码），严禁记录明文凭证。详见 [遥测与异步中转规范](./telemetry_and_task_relay_conventions.md)。
- **无状态请求**：服务实例必须保持无状态，严禁使用本地内存缓存跨请求的业务状态。
- **TypeScript 强约束**：严格模式，严禁使用 `any`，函数长度尽量控制在 50 行内，优先使用 `Early Return`。

---

## 7. 日历排班并发控制与防超卖规范 (Concurrency Control)

由于项目初期暂不引入 Redis，系统依托 **PostgreSQL 数据库事务与行级排他锁 (`SELECT ... FOR UPDATE`)** 保证排课与约课的原子性与零超卖：

- **排班落盘与约课互斥锁**：
  在执行“学生自主约课”、“固定位排期落盘”或“同师挪位”时，Service 层开启事务（`PoolClient`）后，第一步必须对目标教师对应时段记录加排他行级锁：
  ```sql
  SELECT id, status, current_teacher_id
  FROM dream.timeslots
  WHERE current_teacher_id = $1 AND lesson_date = $2 AND time_slot = $3 AND deleted_at IS NULL
  FOR UPDATE;
  ```
- **早锁校验防超卖**：
  加锁后立即校验该网格状态。若已被其他学生抢占，事务立即回滚并抛出 `ApiError('Time slot already booked by another student', 409, 'SLOT_OCCUPIED')`。
- **锁粒度与事务时长控制**：
  事务内仅包含状态校验、TS 状态更新与日志插入，严禁在锁持有期间调用外部 API 或发送邮件，确保事务在 50ms 内提交并释放行锁。
- **轻量异步任务队列表**：
  邮件并发派发与超时未读兜底，通过数据库表 `dream.notice_logs` 维护待发送状态，由 `dream-worker` 独立轮询扫描并处理，保障任务持久化且无需维护额外 MQ 集群。
