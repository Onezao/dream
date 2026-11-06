# Dream (教务排班与分账管理系统) Project Guidelines (Local)

> **[MANDATORY] 强制合规指令**:
>
> 1. 在执行任何代码实现、数据库变更或架构调整前，**必须**阅读并遵循 `docs/conventions/` 目录下对应的规范文档，并严格对齐 `docs/Prd-v5.md` 业务规格。
> 2. 任务完成后，**必须**根据规范文档进行“架构审计自检”，确保 100% 符合工程标准与财务合规底线。

---

## 1. 项目架构与技术栈 (Architecture & Tech Stack)

- **Monorepo 结构**：
  - `dream-frontend`：前端统一 Web 应用。内置多角色“工作台物理隔离”（管理员后台、班长工作台、家长工作台、教师课表）与多孩“全局档案切换器”（Profile Switcher）。
  - `dream-backend`：教务排班与分账 HTTP API 服务（Fastify Node.js），基于 Controller 与路由入参校验。
  - `dream-worker`：独立后台批处理与异步任务服务（承担次日凌晨 02:00 自动结课跑批、周末周结单生成、站内信超时兜底邮件派发等）。
  - `dream-core`：领域与数据共享核心库（`@topeetop/dream-core`）。统一收敛所有数据库 Mapper（一表一 Mapper 唯一真相源）、五大业务模块领域 Services、状态机与分账计算公式，供 `dream-backend` 与 `dream-worker` 共同依赖。
  - `db-schema`：PostgreSQL 结构定义与版本化迁移脚本 (`migration_vxxx.sql`)。
  - **跨包引用准则**：**严禁**使用 `../../packages/...` 这种深层相对路径跨包引用源码。所有外部或底层工具引用必须统一使用 `@topeetop/` 作用域下的标准包名（如 `@topeetop/dream-core`, `@topeetop/shared-core`, `@topeetop/security-core`, `@topeetop/auth-core`, `@topeetop/notification-core`, `@topeetop/task-relay-client`, `@topeetop/telemetry-core`, `@topeetop/env-secure-conf`）。

- **核心技术栈 (Tech Stack)**:
  - _Frontend_: **Vue 3**, **Pinia**, **Vue Router**, **Vite**, **vite-plugin-pwa (PWA)**, **vue-i18n (中英双语)**, **TDesign Mobile (`tdesign-mobile-vue`) / TDesign Web (`tdesign-vue-next`)**, **Tailwind CSS**.
  - _Backend_: **Fastify** Node.js.
  - _Languages_: **TypeScript**（开启严格模式，严禁使用 `any`，严格使用 `interface`/`type` 约束）.
  - _Database_: **PostgreSQL** (pg pool 驱动，利用事务与 `SELECT FOR UPDATE` 原生行级锁实现并发防超卖，初期不引入 Redis).
  - _Validation_: **Zod**（入参及环境变量 Schema Fail-Fast 校验）.
  - _Testing_: **Jest**（单元与集成测试）, **Playwright**（E2E 测试）.
  - _Build/Infra_: **tsup**, **esbuild**, **Docker**, **Google Cloud Build**, **Artifact Registry**。基础设施与域名生态全面复用 **topee.top**。

- **前端开发规范 (Frontend Standards)**:
  - **PWA 与设备适配 (PWA, Mobile & Tablet Responsive)**:
    - 系统以 **PWA (Progressive Web App)** 架构驱动，内置 Web App Manifest 与 Service Worker (`vite-plugin-pwa`)，支持“添加到主屏幕 (A2HS)”独立应用体验。
    - **手机与平板全覆盖**: 移动端触控优先采用 `tdesign-mobile-vue`；基于 Tailwind CSS 断点（`sm:`, `md:`, `lg:`）实现手机和平板（iPad）自适应响应式布局（平板端优先展示多栏/网格并列排版）。
  - **端侧数据缓存分级策略 (Client-side Data Caching Strategy)**:
    - **强缓存 (CacheFirst / App Shell)**: 静态资源、离线 HTML 壳、字体、图标。
    - **基础字典与上下文 (StaleWhileRevalidate / Pinia + LocalStorage)**: 课程类型与技能字典 (`course_types`)、教师定级字典、当前账号身份、名下学生档案列表与最后选中的 `activeProfileId`。
    - **脱敏业务快照 (NetworkFirst with Offline Fallback / IndexedDB)**: 教师列表履历脱敏数据、当周已排 7 色日历视图快照（支持弱网/离线查看课表）。
    - **强制在线与零离线缓存 (NetworkOnly - 强一致性)**: 所有财务与资金流单据（购课单支付、退款单、转账单、周结单）；抢位与排班落盘接口（`SELECT ... FOR UPDATE`）严禁离线操作，离线状态下置灰阻断并 Toast 提示“离线模式不可用”。
  - **全站中英文双语规范 (i18n Standards)**:
    - 采用 **`vue-i18n`**（Composition API 模式），覆盖中文简体 (`zh-CN`) 与英文 (`en-US`)。
    - **对齐 `@topeetop/auth-core` 官方范式**：遵循“后端传标准 Code 与英文 Fallback，前端按 Code 翻译双语”。
    - **`dream-core` 语言中立铁律**：严禁在 `dream-core` 中硬编码中文字符串。
      - 入参校验 Schema（`*.types.ts`）的错误信息统一使用**标准英文**（面向用户的表单校验由前端表单组件 rules 借助 `vue-i18n` 拦截作为第一道防线）。
      - 业务异常必须显式传入大写业务错误码 `ApiError(message, status, code)`，`message` 统一使用**标准英文**用于日志排障与安全回退。
      - DTO 组装严禁中文兜底（统一使用英文如 `'Unknown Course'` 或为 `null` 由前端展示层 i18n 渲染）。
    - **前端错误码统一拦截**：前端请求统一封装自动提取 `error.code || error.errorCode`，优先通过 `i18n.global.te('errors.' + code)` 动态翻译并 Toast，未定义则安全回退至后端英文 message。
    - 国际化范围：顶部与侧边导航、表单字段与校验错误提示、系统弹窗、通用状态标签（7色日历状态、单据状态）、错误码文本（如 `NICKNAME_ALREADY_EXISTS`、`CLASS_FULL`）。
    - 语言切换与持久化：支持在设置/顶部栏即时无刷新切换，持久化存入 `localStorage.getItem('dream_locale')`，默认根据 `navigator.language` 智能回退。
  - **样式驱动**: 必须且仅允许使用 **Tailwind CSS** 处理组件样式。
  - **UI 组件库搭配**: 移动端界面（家长端约课、个人档案、课表）统一采用 **`tdesign-mobile-vue`**；管理看板与财务报表（管理员后台、班长工作台排课网格、周结单看板）搭配 **`tdesign-vue-next`**。
  - **严禁手写 CSS**: **严禁在前端代码中编写任何形式的手写 CSS（包括 `<style>` 块或外部 `.css` 文件）**，确保样式高度原子化、易维护与系统级一致。
  - **安全渲染**: 严禁在页面渲染中无防护使用 `v-html`，防止 XSS 攻击注入。

- **后端分层与 Mapper 隔离模型 (Backend Architecture)**:
  - 严格执行 `Controller -> Service -> Mapper (Data Access)` 三层架构。
  - **Mapper 绝对隔离**: **所有 SQL 查询（SELECT/INSERT/UPDATE/DELETE）必须且只能写在 `dream-core` 的 `*Mapper` 文件中**。严禁在 Service 或 Controller 中直接编写 SQL 语句。
  - **一表一 Mapper**: 单表的写操作（Create, Update, Delete）必须且只能归属于对应的表 Mapper。
  - **BaseMapper 与 DI 约束**: 所有 Mapper 必须继承 `BaseMapper`，构造函数必须支持注入 `DatabaseService` (`constructor(db?: DatabaseService)`)。单测必须使用 DI 传入 `mockDb` 进行白盒测试，严禁模块级劫持连接。
  - **Service 职责**: 负责业务编排、跨表事务（`PoolClient` 传递）、纵深防越权（IDOR）校验及跨 Mapper 调用。
  - **Controller 职责**: 仅负责 HTTP 参数校验与结果分发，严禁直接越级调用 Mapper。

---

## 2. 数据库与迁移 (Database & Migration)

- **数据库接入与连接池底线 (DatabaseService Integration)**:
  - **零自建连接池**: 严禁在 `dream-core` 或各业务应用中手写 `new Pool(...)`、连接事件监听或重写连接池生命周期逻辑。
  - **必须复用 shared-core**: 数据库连接池、SSL 自适应、事务管理 (`executeTx`) 与查询执行必须且只能委托使用 `@topeetop/shared-core` 的 `DatabaseService`。参考 `/Users/shanzao/ravll-workspace/packages/shared-core/README.md`。
- **Schema 强制前缀**：所有 SQL 查询必须显式声明 `dream.` 前缀（核心教务实体与业务单据统一收敛于 `dream` 单 Schema）。
- **主键规范 (Primary Keys)**：
  - **通用主键**: 所有表主键必须使用 `@topeetop/shared-core` 提供的 `generateShortUuid()` 生成 **12 位** 短 ID (`VARCHAR(12)`)。
  - **严禁使用**: 严禁使用数据库自增 ID (`SERIAL` / `BIGSERIAL`) 或标准 36 位 UUID 作为业务主键。
- **学生昵称规范**: 注册学生档案时强制遵循 `英文名+姓首字母+年龄`（如 `AliceZ12`, `BobZ10`），用于多孩识别与跨家长转让精确匹配。
- **归属权与 IDOR 防御**: 查询/更新家长与学生关联数据时，必须物理包含 `account_id` 或 `student_profile_id` 过滤条件。
- **软删除规范**: 核心业务表统一采用 `deleted_at TIMESTAMP WITH TIME ZONE` 软删除，并配合 Partial Index 加速查询。
- **迁移记录**: 本地 DDL 变更必须即时写入 `db-schema/migration_vxxx.sql`，保证脚本幂等（`IF NOT EXISTS`）。
- **连接凭据**: 本地执行 psql 前，通过 `database-ops` 技能从 `tmp/local_env.dev` 获取 `DB_URL`。

---

## 3. 业务架构、批处理与配置规范 (Business Architecture, Worker & Config)

- **账号与档案解耦 (Account vs. Profile) 与 topee-auth 对接**：
  - **账号体系归属**: 统一由 `@topeetop/auth-core`（即 topee-auth）承载登录、注册、找回密码与 Token 刷新，业务库严禁重复自建账号与密码表。
  - **获取登录态与基本信息**:
    - 前端携带 `Authorization: Bearer <access_token>` 调用 `GET /api/auth/v1/user` 获取当前登录账号信息：
      - **账号唯一 ID (`user.id`)**: 对应教务系统中的自然人操作主体 `account_id`；
      - **用户头像 (`user.avatar`)**: 自然人账号头像，用于顶部导航栏及个人中心展示；
      - **用户昵称 (`user.username`)**: 自然人账号昵称，用于操作者显示（注：区别于名下孩子的 `student_profile.nickname`）；
      - **通知 Email (`user.email`)**: 唯一官方通知邮箱，用于接收排课、请假代课、转账及周结单等全量系统通知邮件；
      - **角色列表 (`roles: [{ name }]`)**: 动态挂载的角色标签（`admin`, `monitor`, `teacher`, `user`），用于驱动顶部工作台切换器权限。
    - **Token 轮换与拦截**: 前端全局拦截器监听 `401 Unauthorized`，使用本地存储的 `refresh_token` 请求 `POST /api/auth/v1/token?grant_type=refresh_token` 无感换取新令牌；失败则跳转登录页。
  - **学生档案解耦**: 学生档案代表实际上课与课时消耗实体（1个家长账号可挂载多个学生档案，支持二胎/多孩共管）。
- **工作台物理隔离 (Workspace Isolation)**：
  - 前端顶部常驻工作台切换器（管理员后台、班长工作台、家长工作台、教师课表），导航与主题物理隔离，防止跨角色误操作。
  - 家长工作台常驻多孩全局档案切换器（Profile Switcher），联动刷新底层单据与课表。
- **资金持有人锁定与财课分离铁律**：
  - TS 课次的“资金持有方”永久锁定最初收款的班长或平台，直至周度转账单归集，不随排课、代课或转让变更。
  - 课程转让时，原购课单与费用归属方保持原家长不变，仅变更实际排课上课学生档案。
- **后台批处理任务 (`dream-worker`)**：
  - 每日凌晨 02:00 定时跑批将正常完课 TS 自动流转为结课待结算；周末自动跑批生成教师周课酬单与平台工具费单。
  - 严禁在 HTTP 请求线程中同步执行重计算、批量单据跑批或批量邮件派发，必须交由 `dream-worker` 异步调度。
- **配置管理 (Config Management)**：
  - **Schema 校验**: 必须使用 `zod` 定义配置 Schema，实现 **Fail-Fast** 启动校验。
  - **访问控制**: 业务代码严禁直接访问 `process.env`，必须通过 `getConfig()` 获取已校验配置。
  - **生产安全**: 核心敏感字段（DB_URL, Keys）使用加密变量（带 `_CIPHER` 后缀）加载并动态解密。
  - **报错脱敏**: 配置校验失败时，严禁在日志中输出敏感字段的原始值。

---

## 4. 构建、部署与源码保护 (Build, Deploy & Protection)

- **版本联动升级 (Versioning)**:
  - 核心共享库（如 `@topeetop/shared-core`, `@topeetop/env-secure-conf` 等）版本升级后，必须同步升级依赖方项目的 `package.json`。
- **代码混淆与压缩 (Obfuscation)**:
  - 后端生产构建必须经过 `esbuild --minify` 和 `javascript-obfuscator` 处理。
  - 混淆参数规范：开启 `compact: true`, `stringArray: true`, `stringArrayRotate: true`。严禁打包进 `@topeetop/*` 等外部依赖。
- **构建安全与镜像精简 (Zero-Install Pattern)**:
  - 生产镜像基于 `node:20-alpine`，严禁在镜像内执行 `npm install`。
  - 采用“CI 侧组装，容器内只读复制”模式，镜像仅包含混淆后的 `dist/`、生产 `node_modules/` 与静态资源，严禁包含 `docs/`, `tests/`, `.env` 或源码。
- **版权声明 (Copyright Headers)**:
  - 所有 `.ts`, `.js`, `.vue` 文件顶部必须包含：
    `/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */`
- **私有库认证**:
  - 构建第一步必须配置 Google Artifact Registry 认证：
    `npx google-artifactregistry-auth`
- **部署目录**:
  - 所有 Docker/GCP/SCF 配置文件统一位于 `deploy/{service-name}/` 目录下。

---

## 5. 开发工作流与端口规范 (Development Workflow)

- **Docs First**：修改核心逻辑或业务状态机前，必须先更新 `docs/` 下的设计文档，获批后再动手。
- **Architecture Self-Audit**：完成代码开发后，**必须**主动对照工程标准与 PRD 规则进行自检。
- **分支策略**：涉及重大重构或中大型功能开发时，**必须**提醒用户创建新分支（如 `feat/...` 或 `refactor/...`），严禁直接在 `main` 分支进行大规模提交。
- **Git 规范**：使用 Conventional Commits（`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`）。严禁在未经确认的情况下执行 `git add`, `commit`, `push` 或 `tag`。
- **依赖同步**: 修改 `package.json` 后必须调用 `dependency-sync` 技能。
- **资源释放 (Resource Cleanup)**：AI 启动本地后端或前端服务进行验证完成后，**必须立即主动杀死进程并释放端口**（如 `lsof -ti :PORT | xargs kill -9`），严禁在 turn 结束时保持端口占用。
- **本地开发端口规范 (Local Port Conventions)**:
  - `5173`：`dream-frontend` (Vite 开发服务)。
  - `8070`：`dream-backend` (教务业务核心后端，分配 8070 避免与 8060 冲突)。
  - `8072`：`dream-worker` (独立批处理与任务调度服务)。

---

## 6. 本地 Skills & 快捷指令 (Local Skills & Shortcuts)

以下指令已通过标准目录（`.agents/skills/`）安装在 `workspace` 作用域，可自动识别或显式激活：
- **db / psql**：激活 `database-ops`，从 `tmp/local_env.dev` 获取 DB_URL。
- **deploy**：激活 `deployment-ops`，执行本地组装、容器验证或云端部署。
- **auth**：激活 `npm-auth-handler`，自动刷新 GCP 私有仓库认证。
- **copyright**：激活 `copyright-guard`，对全项目源码进行版权头审计与补全。
- **prd / write-prd**：激活 `write-prd`，按照标准化流程撰写功能与产品需求规格说明书。

---

## 7. 全局 Skills 映射 (Global References)

以下指令跨项目通用：
- **brainstorm**：触发 `brainstorm-master` 进行创意与需求收敛。
- **design / tdd**：触发 `technical-design-doc-creator` 技能进行符合工程规范的高合规技术方案设计。
- **prototype**：触发 `prototype` 技能，快速生成纯独立单文件即抛型 HTML 交互原型。
- **implement**：触发 `subagent-driven-development` 进行多子代理隔离 TDD 代码与单测实现。**[禁用约束] 本项目物理禁用 `implement-master`，由 `subagent-driven-development` 全面替代**（严禁删除或修改全局 `implement-master` 技能文件，确保其他工程正常复用）。
- **fix / debug**：触发 `bug-hunter` 进行侦探式深度排障。
- **test**：触发 `test-fixer` 运行并自动修复单元测试。
- **sync**：触发 `dependency-sync` 同步 package.json 依赖。
- **gitag / commit**：触发 `git-master` 执行规范化提交与自动打标签。

---

## 8. 工程规范索引 (Engineering Conventions)

项目所有代码实现与评审必须严格遵守以下规范体系：

| 领域 | 规范文档 | 核心关注点 |
| :--- | :--- | :--- |
| **顶层准则** | **[协作准则 (Rules)](./docs/conventions/rule.md)** | 架构哲学、防呆防误触、财课分离、测试件隔离 |
| **架构设计** | **[模块定位规范](./docs/conventions/module_positioning.md)** | Monorepo 边界、依赖红线、Worker 批处理边界 |
| **后端开发** | **[后端编码规范](./docs/conventions/backend_coding_conventions.md)** | Controller-Service-Mapper 三层架构、依赖注入 (DI)、Fail-Fast 配置 |
| **数据库** | **[数据库设计规范](./docs/conventions/database_design_conventions.md)** | 12位短 ID、单 Schema (`dream`) 集中承载、软删除、索引规约 |
| **API 交互** | **[REST API 规范](./docs/conventions/rest_api_conventions.md)** | 标准响应格式、Zod 强校验、ApiError 处理、严格 IDOR 纵深防御 |
| **前端开发** | **[UI 架构与视觉标准](./docs/conventions/tech_ui_architecture_standard.md)** | 工作台物理隔离、TDesign 选型、100% Tailwind CSS、严禁手写 CSS |
| **日历视觉** | **[7 色日历规范](./docs/conventions/tech_calendar_7color_standard.md)** | 固定位🟠、临时课🟡、被代课🔵、代上课🟣、不可约⚪、空闲🟢、已请假🔴 |
| **财务分账** | **[单据与分账核算](./docs/conventions/finance_settlement_conventions.md)** | 资金持有人锁定、小班课自负盈亏与班长预留盈余、双周结单 |
| **运维部署** | **[运维与部署规范](./docs/conventions/ops_conventions.md)** | Cloud Build 零安装、Docker 精简镜像、Git 提交规范、端口隔离 |
| **消息通知** | **[三级分发规约](./docs/conventions/notification_conventions.md)** | 站内信 + 家长 Email 兜底超时升级与紧急并发派发 |
| **遥测与异步** | **[遥测与异步中转](./docs/conventions/telemetry_and_task_relay_conventions.md)** | 云原生 stdout 结构化日志、W3C 链路追踪透传、TaskRelay 异步任务生命周期 |
| **文件存储** | **[文件上传规范](./docs/conventions/file_upload_conventions.md)** | 教师多媒体资料预签名直传、S3/R2 路径归档 |
