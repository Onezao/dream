# Dream (教务排班与分账管理系统) Project Guidelines (Local)

> **[MANDATORY] 强制合规指令**:
>
> 1. 在执行任何代码实现、数据库变更、视觉调整或架构重构前，**必须**阅读并严格遵循项目核心规范文档：
>    - **[UI 视觉与设计系统 (DESIGN.md)](./DESIGN.md)**
>    - **[工程与编码规范 (docs/CODING_STANDARDS.md)](./docs/CODING_STANDARDS.md)**
>    - **[核心业务规则与财务分账规约 (docs/BUSINESS_RULES.md)](./docs/BUSINESS_RULES.md)**
>    - **[业务规格基准 (docs/Prd-v5.md)](./docs/Prd-v5.md)**
> 2. 任务完成后，**必须**主动对照规范文档进行“架构审计自检”，确保 100% 符合工程标准、财务合规与架构红线。

---

## 1. 核心工程哲学与绝对红线 (Non-negotiable Rules)

- **物理隔离优先 (Workspace & Profile Isolation)**：
  - 管理员后台、班长工作台、家长工作台、教师课表四大角色工作台在导航、主题与功能上实施物理隔离，杜绝跨角色兼职误操作。
  - 家长端常驻多孩“全局档案切换器 (Profile Switcher)”，数据按学生档案联动下钻隔离。
- **Mapper 绝对隔离模型 (Data Access Isolation)**：
  - **所有 SQL 查询（SELECT/INSERT/UPDATE/DELETE）必须且只能写在 `dream-core` 的 `*Mapper` 文件中**。严禁在 Service 或 Controller 中编写任何 SQL。
  - **一表一 Mapper**：单表的写操作（Create, Update, Delete）必须且只能归属于对应的表 Mapper。
  - **BaseMapper 与依赖注入 (DI)**：所有 Mapper 必须继承 `BaseMapper`，构造函数统一支持注入 `DatabaseService` (`constructor(db?: DatabaseService)`)。单测必须使用 DI 传入 `mockDb` 进行白盒测试，严禁模块级劫持连接。
- **底层基建复用与零自建连接池**：
  - 严禁在各应用中手写 `new Pool(...)`、连接监听或自建连接池。必须且只能通过 `@topeetop/shared-core` 的 `DatabaseService` 接入数据库与管理事务 (`executeTx`)。
- **单 Schema 与 12 位短 ID 规范**：
  - 核心教务实体与业务单据统一收敛于 PostgreSQL 单 Schema `dream`（所有 SQL 必须显式声明 `dream.` 前缀）。
  - 主键必须使用 `@topeetop/shared-core` 的 `generateShortUuid()` 生成 **12 位短 ID** (`VARCHAR(12)`)，严禁使用自增 ID (`SERIAL`) 或 36 位 UUID。
- **资金持有人锁定与财课分离铁律**：
  - TS 课次资金持有方永久锁定最初收款的班长或平台，直至周度转账单归集，不随排课、代课或转让转移。
  - 发生课程转让时，原购课单与费用归属方保持原家长不变，仅变更实际排课学生档案。
- **严禁手写 CSS**：
  - 前端 100% 由 **Tailwind CSS** 处理样式，严禁在前端代码中编写任何手写 CSS（包括 `<style>` 块或外部 `.css` 文件）。
- **`dream-core` 语言中立铁律**：
  - 严禁在 `dream-core` 中硬编码中文字符串。入参校验 Schema 与业务异常 `ApiError` 统一使用标准英文信息与大写错误码（如 `PRICE_CALCULATION_MISMATCH`），由前端结合 `vue-i18n` 统一拦截翻译。

---

## 2. 项目架构、技术栈与端口规范

- **Monorepo 结构**：
  - `dream-frontend`：前端统一 Web 应用 (PWA / Vue 3 / Pinia / TDesign / Tailwind CSS)。
  - `dream-backend`：教务排班与分账 HTTP API 服务 (Fastify Node.js)。
  - `dream-worker`：独立后台批处理与异步任务服务 (自动结课、周结单跑批、超时兜底邮件)。
  - `dream-core`：领域与数据共享核心库 (`@topeetop/dream-core`)，收敛全量 Mapper、领域 Services、状态机与分账计算公式。
  - `db-schema`：PostgreSQL 结构定义与版本化迁移脚本 (`migration_vxxx.sql`)。
  - **跨包引用准则**：严禁使用 `../../packages/...` 跨包引用源码。必须统一使用 `@topeetop/` 作用域标准包名。

- **本地开发端口规范 (Local Port Conventions)**:
  - `5173`：`dream-frontend` (Vite 开发服务)。
  - `8070`：`dream-backend` (教务核心后端，分配 8070 避免端口冲突)。
  - `8072`：`dream-worker` (独立后台批处理与调度服务)。
  - **资源释放 (Resource Cleanup)**：本地服务验证完成后，**必须立即主动杀死进程并释放端口**（如 `lsof -ti :PORT | xargs kill -9`），严禁在 turn 结束时保持端口占用。

---

## 3. 开发工作流与构建规范

- **Docs First**：修改核心逻辑、业务状态机或数据结构前，必须先更新设计文档与规范，获批后再动手。
- **Architecture Self-Audit**：完成代码开发后，**必须**主动对照三份核心规范文档进行自检。
- **分支策略**：涉及重大重构或中大型功能开发时，**必须**提醒用户创建新分支（如 `feat/...` 或 `refactor/...`），严禁直接在 `main` 分支进行大规模提交。
- **Git 规范**：使用 Conventional Commits（`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`）。严禁在未经确认的情况下执行 `git add`, `commit`, `push` 或 `tag`。
- **依赖同步**: 修改 `package.json` 后必须调用 `dependency-sync` 技能。
- **构建安全与代码保护**:
  - 后端生产构建必须经过 `esbuild --minify` 和 `javascript-obfuscator` 混淆处理。
  - 生产镜像基于 `node:20-alpine` 实行“CI 侧组装，容器内只读复制”的零安装模式（Zero-Install Pattern），严禁在镜像内执行 `npm install`。
  - 构建第一步必须配置私有库认证：`npx google-artifactregistry-auth`。
  - 所有 `.ts`, `.js`, `.vue` 文件顶部必须包含标准版权声明头：
    `/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */`

---

## 4. 本地 Skills & 快捷指令 (Local Skills & Shortcuts)

以下指令已通过标准目录（`.agents/skills/`）安装在 `workspace` 作用域，可自动识别或显式激活：
- **db / psql**：激活 `database-ops`，从 `tmp/local_env.dev` 获取 DB_URL 并执行数据库操作。
- **deploy**：激活 `deployment-ops`，执行本地组装、容器验证或云端部署。
- **auth**：激活 `npm-auth-handler`，自动刷新 GCP 私有仓库认证。
- **copyright**：激活 `copyright-guard`，对全项目源码进行版权头审计与补全。
- **prd / write-prd**：激活 `write-prd`，按照标准化流程撰写功能与产品需求规格说明书。

---

## 5. 全局 Skills 映射 (Global References)

以下指令跨项目通用：
- **brainstorm**：触发 `brainstorm-master` 进行创意与需求收敛。
- **design / tdd**：触发 `technical-design-doc-creator` 技能进行符合工程规范的高合规技术方案设计。
- **prototype**：触发 `prototype` 技能，快速生成纯独立单文件即抛型 HTML 交互原型。
- **implement**：触发 `subagent-driven-development` 进行多子代理隔离 TDD 代码与单测实现。**[禁用约束] 本项目物理禁用 `implement-master`，由 `subagent-driven-development` 全面替代**（严禁删除或修改全局 `implement-master` 技能文件，确保其他工程正常复用）。
- **fix / debug**：触发 `bug-hunter` 进行侦探式深度排障。
- **test**：触发 `test-fixer` 运行并自动修复单元测试。
- **sync**：触发 `dependency-sync` 同步 package.json 依赖。
- **gitag / commit**：触发 `git-master` 执行规范化提交与自动打标签。
- **manual / user-guide**：触发 `user-guide-creator` 技能，按照终端用户视角与标准化界面引导排版，快速编写系统功能操作使用手册与图文指南。

---

## 6. 工程与业务规范权威索引 (Canonical Specifications)

项目所有代码实现、接口契约、日历视觉与财务结算必须严格遵守以下三大权威规范：

| 领域 | 权威规范文档 | 核心关注点与管辖范围 |
| :--- | :--- | :--- |
| **视觉与交互** | **[UI 视觉与设计系统 (DESIGN.md)](./DESIGN.md)** | 工作台物理隔离、7 色日历 Design Tokens（浅底+深字+语义边框，代课双视角）、单屏 7 列 Excel 冻结网格、100% Tailwind CSS、PWA 4 级缓存策略、全站中英双语 (`vue-i18n`) |
| **架构与编码** | **[工程与编码规范 (docs/CODING_STANDARDS.md)](./docs/CODING_STANDARDS.md)** | Monorepo 边界与依赖红线、Controller-Service-Mapper 三层架构与 DI 规范、PostgreSQL 单 Schema `dream` 与 12 位短 ID、REST API 契约与两道防线 Zod 校验、ApiError 英文诊断 + ErrorCode 双语拦截、S3 预签名直传、云原生 stdout 遥测与 TaskRelay 异步任务生命周期、生产构建混淆与 Docker 零安装 |
| **业务与财务** | **[核心业务规则与财务分账规约 (docs/BUSINESS_RULES.md)](./docs/BUSINESS_RULES.md)** | 资金持有人锁定、财课分离与转让、账号与档案解耦、五大核心单据体系、尾差吸收算法、12.5% 请假配额与 3h 阶梯时间熔断矩阵、小班自负盈亏公式与班长预留盈余、固定位到期提前 7 天续费预排与预占 HOLD、异常未上课回退补生、双周结单、`dream-worker` 后台批处理调度边界、三级通知矩阵与留言板双权限 |
