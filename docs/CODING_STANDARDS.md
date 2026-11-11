/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# Dream 工程与编码规范 (Engineering & Coding Standards)

本文档是 Dream（教务排班与分账管理系统）技术研发的**工程架构与编码唯一真相源（Single Source of Truth）**。收敛整合了原有的 Monorepo 模块边界、依赖红线、三层分层模型与 Mapper 绝对隔离、数据库设计与短 ID 规约、REST API 与 Zod 校验、ApiError 错误码治理、文件预签名上传、云原生遥测与异步中转、以及构建混淆与运维部署规范。

---

## 1. Monorepo 模块划分与依赖红线 (Module Positioning & Architecture)

系统基于 Monorepo 架构，实现前端外壳、业务 API、独立批处理与共享领域核心的物理隔离：

```
dream/
├── dream-frontend/             # 前端 Web 应用 (Vue 3 + Vite + Tailwind CSS + TDesign)
├── dream-backend/              # 核心业务 HTTP API 服务 (Fastify Node.js)
├── dream-worker/               # 独立后台调度与异步批处理服务 (02:00 结课、周末周结单、邮件兜底)
├── dream-core/                 # 领域核心与数据共享库 (@topeetop/dream-core)
│   ├── src/db/                 # 统一数据访问层 (一表一 Mapper 唯一真相源)
│   ├── src/modules/            # 5 大业务模块领域服务 (状态机编排、纯业务计算器)
│   └── src/types/              # 实体与领域 DTO 契约
├── db-schema/                  # PostgreSQL 结构定义与版本化迁移脚本 (migration_vxxx.sql)
└── docs/                       # 需求文档、设计系统与工程规范
```

### 1.1 核心应用定位与职责
- **`dream-frontend` (统一多工作台 Web 前端)**：
  - 纯静态前端交互外壳。基于 `user.roles` 实现管理员后台、班长工作台、家长工作台、教师课表四套工作台物理隔离；内置多孩档案切换器。
  - **红线**：严禁包含敏感密钥；严禁直连数据库；**严禁手写 CSS（100% Tailwind CSS）**；无防护严禁使用 `v-html`。
- **`dream-backend` (主业务 HTTP API 服务)**：
  - 业务编排与 API 接入层（Fastify）。负责入参 Zod 强校验、路由分发、Controller 结果包装、IDOR 纵深防越权以及跨表事务编排。
  - **红线**：严格执行 `Controller -> Service -> Mapper` 三层架构；**严禁在 Controller 或 Service 中直接书写 SQL 语句**；严禁在 HTTP 请求线程中同步执行耗时过长的重计算或批量发信。
- **`dream-worker` (独立后台调度与异步批处理服务)**：
  - 独立后台批处理与任务调度执行器。承担每日凌晨 02:00 自动结课跑批、周末周结单生成、站内信超时兜底邮件补发等。
  - **红线**：严禁对外暴露公网业务 HTTP 接口（仅限健康检查与内部触发）；严禁绕过 Mapper 进行无校验写入。
- **`dream-core` (领域与数据共享核心库 - `@topeetop/dream-core`)**：
  - 系统业务逻辑与数据访问的唯一核心。收敛所有数据库表专属 Mapper（一表一 Mapper）、五大业务模块领域 Services、纯业务计算器（12.5% 请假配额、小班课自负盈亏与预留盈余公式、尾差吸收算法）、实体与 DTO 类型。供 `dream-backend` 与 `dream-worker` 共同依赖。
  - **红线**：严禁依赖 Fastify 等上层 HTTP 框架或定时器组件（保持纯净领域库）；**语言中立铁律**：严禁硬编码中文字符串（Zod 报错、ApiError 诊断日志统一为英文）。
- **`db-schema` (数据库唯一真相源)**：
  - 管理单 Schema `dream` 下的 DDL 结构及初始字典数据，管理幂等的版本化迁移脚本 (`migration_vxxx.sql`)。

### 1.2 跨包引用准则与依赖红线
1. **严禁深层相对路径**：严禁在源码中使用 `../../packages/...` 这种跨包相对路径引用。
2. **强制统一 `@topeetop/` 作用域包名**：
   - `@topeetop/dream-core`：本项目专属领域与数据核心；
   - `@topeetop/shared-core`：数据库服务 (`DatabaseService`、连接池与事务管理)、12位短 ID 生成器 (`generateShortUuid`)、JwtAuthHook、ApiError；
   - `@topeetop/auth-core`：JWT 鉴权与账号体系；
   - `@topeetop/security-core`：数据加密、防篡改签名；
   - `@topeetop/notification-client`：站内信与邮件派发；
   - `@topeetop/task-relay-client`：异步中转调度；
   - `@topeetop/telemetry-core`：云原生结构化日志与链路追踪；
   - `@topeetop/env-secure-conf`：配置动态解密与 Schema 注入。
3. **禁止循环依赖**：A 依赖 B 则 B 严禁依赖 A。
4. **单向依赖原则**：底层 Shared 库严禁依赖上层业务应用；`dream-core` 严禁依赖 `dream-backend` 或 `dream-worker`。

---

## 2. 后端分层与 Mapper 绝对隔离模型 (Backend Architecture)

严格执行 **Controller -> Service -> Mapper (Data Access)** 三层架构：

### 2.1 Mapper 职责与隔离红线
- **一表一 Mapper**：每个数据库表对应一个 Mapper 文件，**统一且唯一存放在 `dream-core/src/db/` 目录下**（如 `StudentProfileMapper.ts`, `TeacherProfileMapper.ts`, `ClassMapper.ts`, `CourseOrderMapper.ts`, `TimeslotMapper.ts`, `TransferOrderMapper.ts`, `SettlementMapper.ts`）。
- **SQL 绝对隔离**：**所有 SQL 语句（`SELECT/INSERT/UPDATE/DELETE`）必须且只能编写在 `dream-core/src/db/*Mapper.ts` 中**。严禁在 Service 或 Controller 中出现任何 SQL 片段。
- **写操作归属权**：单表的写入操作必须且只能由对应的表 Mapper 执行。
- **联表只读查询**：允许在 Mapper 中通过 `LEFT JOIN / INNER JOIN` 关联其他表进行只读 DTO 组装，但严禁跨表写入。
- **严禁越级调用**：Controller 绝对禁止跳过 Service 直接调用 Mapper。

### 2.2 数据库连接池与依赖注入 (DatabaseService & BaseMapper)
- **零自建连接池铁律**：严禁在项目源码中手写 `new Pool(...)`、连接事件监听或重写连接池生命周期逻辑。必须且只能统一委托使用 `@topeetop/shared-core` 的 `DatabaseService`。
- **BaseMapper 继承与构造函数注入 (DI)**：
  - 所有表 Mapper 必须继承 `BaseMapper<RowType>`，构造函数必须支持注入 `DatabaseService` (`constructor(db?: DatabaseService) { super(db); }`)。
  - **事务分流**：若方法传入 `client: PoolClient`，直接通过 `client.query(...)` 执行，确保原子性与行级排他锁（`SELECT ... FOR UPDATE`）；
  - **独立查询分流**：优先通过注入的 `this.db.executeQuery` 执行；若未注入实例则平滑回退至 `@topeetop/shared-core` 全局单例。
- **白盒单测标准**：单元测试必须通过构造函数直接传入 `mockDb: jest.Mocked<DatabaseService>`，严禁使用模块级劫持（Monkey Patching）。

### 2.3 Service 职责
- 负责复杂业务编排、状态机流转与计算器调度；
- 负责跨表事务控制（通过传递 `PoolClient` 保证原子性）；
- 负责 IDOR 纵深防越权校验。

### 2.4 Controller 职责
- 仅负责 HTTP 请求参数解析、Zod 入参校验与结果包装分发；
- 严禁包含复杂业务逻辑或直接触碰数据库。

---

## 3. 数据库设计与建模规范 (Database Conventions)

### 3.1 Schema 规划与表命名
- **单 Schema 集中承载 (`dream`)**：
  - 统一使用 **`dream`** 单 Schema 承载所有实体与单据。
  - 所有 SQL 语句中**必须显式声明 `dream.` 前缀**（如 `dream.student_profiles`, `dream.timeslots`）。
- **表命名规约**：采用小写下划线复数形式 (`snake_case`)，如 `student_profiles`, `classes`, `course_orders`, `timeslots`, `transfer_orders`。

### 3.2 标识符与主键规约 (Primary Keys)
- **统一 12 位短 ID**：所有业务实体表主键固定为 **`VARCHAR(12)`**，必须且只能通过 `@topeetop/shared-core` 的 `generateShortUuid()` 生成。
- **严禁使用**：数据库自增 `SERIAL` / `BIGSERIAL` 或标准 36 位 UUID 作为业务主键。

### 3.3 账号体系解耦与防越权 (IDOR Defense)
- **账号体系归属**：统一由 `@topeetop/auth-core` 承载，业务库**严禁重复自建 `accounts` 或用户密码表**。
- **物理 IDOR 防御底线**：
  - 永远不要信任前端传递的归属权 ID。从 `request.user.id` 获取当前登录账号的真实 `accountId`；
  - 查询和更新家长或学生关联数据时，Service 与 SQL 必须物理包含 `account_id` 或 `student_profile_id` 过滤条件（如 `WHERE id = :id AND account_id = :accountId AND deleted_at IS NULL`）。

### 3.4 软删除与高频并发索引规范
- **标准时间戳与软删除**：
  - `created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
  - `updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
  - `deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL`（软删除标记）
- **部分索引 (Partial Index)**：核心查询建立 `WHERE (deleted_at IS NULL)` 部分索引。
- **排课并发防超卖行锁与索引**：
  - 为保障 `SELECT ... FOR UPDATE` 在高并发约课与排班落盘时精准锁定单行网格、杜绝表锁隐患，`dream.timeslots` 必须建立专用复合部分索引：
    ```sql
    CREATE INDEX idx_timeslots_booking_lock 
    ON dream.timeslots (current_teacher_id, lesson_date, time_slot) 
    WHERE deleted_at IS NULL;
    ```
- **事务时长控制**：持有行级排他锁期间仅执行状态校验与更新，严禁调用外部 HTTP API 或派发网络邮件，确保事务在 50ms 内提交释放锁。

---

## 4. REST API、入参校验与双语错误码治理 (REST API & Error Handling)

### 4.1 统一响应格式
- **成功响应 (`200 OK` / `201 Created`)**：
  ```json
  {
    "data": {
      "id": "1234567890ab",
      "status": "scheduled"
    },
    "meta": {
      "total": 36,
      "page": 1,
      "pageSize": 20
    }
  }
  ```
- **错误响应 (`4xx` / `5xx`)**：
  ```json
  {
    "error": "Class is already full",
    "code": "CLASS_FULL",
    "timestamp": "2026-11-06T12:00:00Z"
  }
  ```

### 4.2 两道防线入参校验契约 (Zod Validation)
1. **第一道防线（前端 UI 表单本地化校验）**：
   - 页面表单组件（TDesign Form）在客户端直接绑定基于 `vue-i18n` 的响应式校验规则（如 `t('form.rules.required')`），在用户触发提交前即时完成本地化校验与标红，避免向后端发送无效请求。
2. **第二道防线（后端 Zod 强校验防御底线）**：
   - 采用 `zod` + `fastify-type-provider-zod` 实现 Fail-Fast 校验。
   - `class.types.ts`、`types.ts`、`teacher.types.ts` 等类型契约中的 Zod 错误信息**统一使用标准英文**（如 `min(2, 'Class name must be at least 2 characters')`），保持领域中立。
   - 若绕过前端请求接口触发校验，后端统一返回 `400 Bad Request` 与 `VALIDATION_ERROR`，前端统一错误拦截器将其本地化提示。

### 4.3 全栈双语与错误码交互范式 (ErrorCode Protocol)
对齐 `@topeetop/auth-core` 官方范式，遵循**“后端传标准 Code 与英文 Fallback，前端按 Code 翻译双语”**：
- **`dream-core` 语言中立铁律**：
  - 严禁在 `dream-core` 中硬编码中文字符串；
  - 业务异常统一使用 `@topeetop/shared-core` 的 `new ApiError(message, statusCode, code)` 抛出；
  - `message` 统一使用**标准英文**（用于云原生 stdout 日志审计、研发排障及前端未匹配时的安全回退）；
  - **必须显式声明语义精准的全局大写业务错误码 (`code`)**（如 `CLASS_FULL`, `ALREADY_ENROLLED`, `CLASS_STATE_INVALID`, `TEACHER_MONITOR_MISSING`, `PRICE_CALCULATION_MISMATCH`）；
  - DTO 组装严禁中文兜底（统一使用英文如 `'Unknown Course'` 或保持 `null`）。
- **前端网络拦截器自动翻译 (`dream-frontend/src/utils/apiError.ts`)**：
  - 拦截非 2xx 响应时，自动提取 `code || errorCode`；
  - 优先通过 `i18n.global.te('errors.' + code)` 动态匹配前端语言包并 Toast，未定义则安全回退至后端英文 message。

### 4.4 Header 上下文穿透与档案归属校验 (`X-Profile-Id`)
- 家长端进行与具体孩子档案关联的操作时，请求头统一携带 `X-Profile-Id: <12位档案ID>`。
- 后端中间件检测到该头时，**必须物理校验该档案是否属于当前登录账号**：
  `SELECT 1 FROM dream.student_profiles WHERE id = :profileId AND account_id = :accountId AND deleted_at IS NULL;`
- 不属于当前账号立即阻断：`ApiError('Forbidden: Profile does not belong to your account', 403, 'PROFILE_ACCESS_DENIED')`。校验通过后注入 `request.currentProfileId`。

### 4.5 防呆金额强提醒交互契约 (Force Submit Pattern)
- 购课录单时若实填金额与系统根据公式计算的标准总积分不一致，且 `forceSubmit !== true`：
  - 后端直接抛出 `400 Bad Request`，包含错误码 `PRICE_CALCULATION_MISMATCH` 与对比数据：
    ```json
    {
      "error": "Input points do not match standard pricing formula",
      "code": "PRICE_CALCULATION_MISMATCH",
      "data": {
        "expectedPoints": 360,
        "providedPoints": 320,
        "formula": "10 lessons × (standard 32 + tool 2 + extra 10)"
      }
    }
    ```
  - 前端据此弹出“强提醒确认弹窗”，操作者点击“确认强制提交”后，携带 `forceSubmit: true` 重新发起请求，后端放行落盘。

---

## 5. 文件上传与多媒体存储规范 (File Upload & Storage)

### 5.1 客户端预签名直传架构 (Presigned URL)
所有图片与视频资料采用**客户端预签名直传对象存储（Cloudflare R2 / AWS S3 / 腾讯云 COS）**模式：
1. **获取预签名 URL**：前端调用 `POST /api/dream/v1/files/upload-url`（校验身份与业务类型合法性），后端生成时效 300 秒的 `PUT` 预签名地址。
2. **客户端直传**：前端通过 `axios/fetch` 将预处理后的图片或视频直接上传到云端对象存储。
3. **提交相对 Key**：上传成功后，前端将对象存储相对路径（`key`）随业务表单提交持久化。

### 5.2 媒体格式与体积刚性约束
- **教师照片、ClassIn 二维码、学生头像**：推荐 **WebP**，兼容 PNG / JPEG。必须在前端本地裁剪为 1:1 正方形并压缩，**单图体积严格锁定 `<= 1MB`**。
- **教师介绍视频**：统一锁定格式为 **MP4 (H.264 + AAC)**（杜绝 WebM 在 iOS 及部分机型上的解码黑屏），时长 1-3 分钟，**体积严格锁定 `<= 50MB`**。
- **转账打款凭证截图**：PNG / JPEG / WebP，体积 `<= 5MB`。

### 5.3 存储路径规范与数据库存储规约
- **存储路径格式**：`dream/{biz_type}/{yyyy}/{mm}/{dd}/{uuid12}.{ext}`
  - `biz_type`:
    - `students/avatars/`：学生头像
    - `teachers/photos/`：教师个人照片
    - `teachers/videos/`：教师介绍视频 (MP4)
    - `teachers/classin_qr/`：教师 ClassIn 二维码
    - `transfers/proofs/`：转账打款凭证截图
    - `orders/proofs/`：购课打款凭证截图
  - `{uuid12}`：使用 12 位短 ID 作为文件名，杜绝中文或特殊字符破坏 URL 解析。
- **数据库只存相对 Key 铁律**：
  - 数据库字段（如 `photo_key`, `video_key`, `classin_qr_key`, `avatar_key`, `proof_key`）**严禁存储带域名的绝对 URL**，只持久化存储相对 Key。
  - 后端返回 DTO 或前端渲染时，根据当前环境的 CDN 域名动态拼装完整加速 URL。

---

## 6. 云原生遥测、结构化日志与异步任务中转 (Telemetry & Task Relay)

### 6.1 统一云原生遥测系统 (`@topeetop/telemetry-core`)
- **Stdout 结构化日志**：业务代码中完全抛弃通过 HTTP 同步/异步网络推送日志的方式，统一向 `stdout` 输出结构化 JSON。由云运行时（Cloud Run / 容器）内生捕获，实现 **0 网络阻塞与 0 外部依赖**。
- **全链路追踪 (Trace Propagation)**：基于 W3C Trace Context 规范，通过 32 位 Hex `trace_id` 串联请求链路。
  - 在 Fastify preHandler 钩子中初始化链路上下文：
    ```typescript
    const traceId = (request.headers['x-trace-id'] as string) || generateTraceId();
    reply.header('x-trace-id', traceId);
    telemetryContext.enterWith({ traceId });
    ```
- **PII 敏感字段自动脱敏**：以下敏感字段在输出至日志前必须自动转换为 `***`：`password`, `token`, `secret`, `authorization`, `cookie`, `credential`, `email`, `phone`。

### 6.2 异步任务中转与定时调度 (`@topeetop/task-relay-client`)
主业务 HTTP 请求线程严禁同步执行阻塞性重计算与网络 IO，以下场景必须委托给 TaskRelay 或交由 `dream-worker`：
1. **多用户批量邮件/短信并发派发**；
2. **延迟状态校验**（如 30 分钟未读自动超时补发兜底 Email）；
3. **周度财务单据批量对账跑批**。
- **调用规范**：
  - 任务 Payload 强制 Base64 编码：`Buffer.from(JSON.stringify(payload)).toString("base64")`；
  - 必须设置幂等 Key（`idempotencyKey`）防止重试引发重复扣款或重复发信；
  - 声明 SSRF 域名白名单（`allowed_domains`），严禁向未报备的私有内网或未知公网 IP 发送流量。
- **Worker 响应码生命周期标准**：
  - `200 OK`：任务同步完结，TaskRelay 立即归档为 `SUCCESS`；
  - `202 Accepted`：耗时任务进入 `PENDING_CALLBACK` 状态，暂停主动重试，Worker 必须在 30 分钟内调用 `completeTask` 结案；
  - `4xx / 5xx`：执行失败，自动触发指数退避重试。

---

## 7. 运维、部署与构建安全规范 (DevOps & Build Protection)

全面复用 **topee.top** 统一基础设施体系：

### 7.1 本地开发与网络端口规范
为了避免端口冲突，本地开发端口固定如下：
- **`5173`**：`dream-frontend` (Vite 开发服务)
- **`8070`**：`dream-backend` (教务核心 HTTP API 服务)
- **`8072`**：`dream-worker` (独立批处理与任务调度服务)
- **资源清理铁律**：AI 或开发者本地启动服务完成验证后，**必须立即主动杀死进程并释放端口**（如 `lsof -ti :PORT | xargs kill -9`），严禁在退出时保持端口占用。

### 7.2 生产构建安全与代码混淆 (Zero-Install & Obfuscation)
- **CI 侧组装，容器内零安装 (Zero-Install Pattern)**：
  - 生产镜像基于精简安全的 `node:20-alpine`；
  - 镜像内部**严禁执行 `npm install`**；
  - 采用“CI 侧组装，容器内只读复制”模式，镜像仅包含构建产物 `dist/`、精简后的生产 `node_modules/` 与静态资源，严禁包含 `docs/`, `tests/`, `.env` 或源码。
- **后端代码混淆与压缩**：
  - 后端生产构建必须经过 `esbuild --minify` 和 `javascript-obfuscator` 处理（开启 `compact: true`, `stringArray: true`, `stringArrayRotate: true`）；严禁打包进 `@topeetop/*` 等外部依赖。
- **配置与安全**：
  - 业务代码严禁直接访问 `process.env`，必须通过 DI 注入的 `getConfig()` 获取经过 Zod Schema Fail-Fast 校验的配置单例；
  - 生产环境核心敏感凭据（DB_URL, Keys）采用带 `_CIPHER` 后缀密文存储，启动时由 Secret Manager 动态解密加载。
- **版权声明头 (Copyright Headers)**：
  - 所有 `.ts`, `.js`, `.vue` 源码文件顶部必须包含统一版权声明：
    `/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */`
- **私有库认证**：构建首步必须配置 Google Artifact Registry 认证：`npx google-artifactregistry-auth`。

---

## 8. 前端工程、双轨制路由与多角色场域隔离规范 (Frontend Architecture & Routing Standards)

针对少儿教务中“不同角色页面显示内容差异巨大、后端数据 API 差异巨大”的现实，前端工程严格执行**“双轨制路由策略 (Dual-Track Routing Strategy)”**与**“场域代码物理分包”**铁律，彻底杜绝多角色巨石组件（Mega-Components）与权限逻辑混杂：

### 8.1 双轨制路由策略 (Dual-Track Routing Strategy)
1. **差异巨大页面：强制实行【角色前缀物理隔离路由】**：
   - 首页、业务中心/教务中心、个人治理等在 UI 版式、操作权限与后端数据模型上 100% 毫无共同点的页面，必须采用独立的角色路由前缀：
     - 家长专属场域：`/parent/home`, `/parent/services`, `/parent/me`
     - 班长专属场域：`/monitor/home`, `/monitor/ops`, `/monitor/me`
     - 教师专属场域：`/teacher/home`, `/teacher/resources`, `/teacher/me`
     - 管理员专属场域：`/admin/home`, `/admin/settings`
   - **根路由智能分流**：用户访问根路径 `/` 或登录成功后，Vue Router 守卫仅根据当前登录账号的最高主角色直接 302 重定向到对应场域主页（如 `/monitor/home`），严禁共用单个巨型 `/home`。
2. **结构高度一致页面：保持【通用资产路由 + 实体参数】**：
   - 视觉表现、核心算法与数据模型全站统一的时间资产与单据页面，保持通用路径，避免重复造轮子：
     - 7 色周度日历看板：`/calendar`（通过 `?studentId=` 或 `?teacherId=` 自适应加载）；
     - 消息通知中心：`/notifications`（全站唯一的单列表手风琴页面）；
     - 购课单详情：`/orders/:orderId`；
     - 退款单详情：`/refunds/:refundId`；
     - 课件样章大屏预览：`/courseware/:cwId/preview`。

### 8.2 前端路由与后端 API 1:1 镜像对称铁律
- **镜像映射**：前端在特定角色路由下发起的数据请求，必须且只能映射到后端对应角色前缀的 API 接入层：
  - 前端 `/parent/*` $\longleftrightarrow$ 后端 `/api/dream/v1/parent/*` (挂载 `requireRole('parent')`)
  - 前端 `/monitor/*` $\longleftrightarrow$ 后端 `/api/dream/v1/monitor/*` (挂载 `requireRole('monitor')`)
  - 前端 `/teacher/*` $\longleftrightarrow$ 后端 `/api/dream/v1/teacher/*` (挂载 `requireRole('teacher')`)
  - 前端 `/admin/*` $\longleftrightarrow$ 后端 `/api/dream/v1/admin/*` (挂载 `requireRole('admin')`)
- **路由级防越权拦截**：Vue Router `beforeEach` 守卫依据 `meta.roles` 实施物理拦截，严禁无该角色权限的用户进入对应场域；后端 API 实施第二道绝对防线，严禁仅依靠前端做权限判断。

### 8.3 视图代码目录物理隔离与异步加载
- **分角色物理分包**：`dream-frontend/src/views/` 目录下必须按角色设立独立子目录：
  - `src/views/parent/` (ParentHomeView.vue, ParentServicesView.vue 等)
  - `src/views/monitor/` (MonitorHomeView.vue, MonitorOpsView.vue 等)
  - `src/views/teacher/` (TeacherHomeView.vue, TeacherResourcesView.vue 等)
  - `src/views/admin/` (AdminHomeView.vue, AdminSettingsView.vue 等)
- **零巨石组件红线**：严禁在一个 View 中编写跨角色的巨型 `v-if/v-else` 逻辑；单页面代码量原则上控制在 300 行以内。
- **异步按需分包**：所有路由组件必须采用 `() => import(...)` 动态加载，确保纯家长用户绝对不会下载管理员或班长的重型管理代码包，实现极致首屏性能与构建安全。

### 8.4 移动端 4 主 Tab 底部导航与场域穿透锁定规范 (AC-M0-28)
- 全系统移动端（PWA）统一遵循底部 4 个主 Tab 布局，主 Tab 之间切换不展示返回箭头；
- **公私隔离穿透锁定**：当班长在 Tab 3【教务中心】穿透查阅学员课表时，路由显式声明为 `/monitor/ops/students/:studentId/calendar`，路由元信息标记 `meta: { activeTab: 'ops' }`，底栏必须 100% 锁定高亮在 Tab 3，严禁跳切到私域 Tab 2 课表，杜绝公私数据串扰。
