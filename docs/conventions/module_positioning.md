/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# 模块定位与职责规范 (Module Positioning & Responsibilities)

本文档定义了 Dream Monorepo 中各子应用与模块的边界与职责划分，防止职责蔓延与循环依赖。

---

## 1. 业务应用 (Applications)

### 1.1 `dream-frontend` (统一多工作台 Web 前端)
- **定位**: 纯静态的前端交互外壳（基于 Vue 3 + Pinia + Vite + Tailwind CSS）。
- **职责**:
  - 提供多角色“工作台物理隔离”视图切换（管理员后台黑金、班长工作台深靛蓝、家长工作台浅色、教师课表）。
  - 提供家长端多孩“全局档案切换器”（Profile Switcher）。
  - 实现 7 色日历视图渲染（含代课双视角：原师🔵蓝色被代课 vs 代课师🟣紫色代上课）。
  - 手机端组件采用 `tdesign-mobile-vue`，管理看板与对账报表采用 `tdesign-vue-next`。
- **禁止**:
  - 严禁包含敏感 API Key。
  - 严禁直连数据库，必须通过 `dream-backend` API 交互。
  - **严禁编写任何手写 CSS（包括 `<style>` 块或外部 `.css`）**。

### 1.2 `dream-backend` (教务与分账主业务后端)
- **定位**: 业务编排与 API 服务核心（Fastify Node.js）。
- **职责**:
  - 提供符合 REST 规范的 API（路由、入参 Zod 校验、ApiError 处理）。
  - 严格执行 `Controller -> Service -> Mapper` 三层架构。
  - 承担 IDOR 纵深防越权校验与多角色权限校验。
  - 负责购课单裂变 TS、排期校验、同师挪位、转账归集等复杂事务控制。
- **禁止**:
  - 严禁在 Service/Controller 中直接编写 SQL（所有 SQL 必须在 `*Mapper` 中）。
  - 严禁在 HTTP 线程中执行耗时过长的阻塞任务（如大批量报表生成或邮件群发，应由 `dream-worker` 承担）。

### 1.3 `dream-worker` (独立后台批处理与异步任务服务)
- **定位**: 独立后台调度与异步执行器。
- **职责**:
  - **每日凌晨 02:00 自动结课跑批**：将前一日营业期（06:00-00:00）内正常完课的 `已排期` TS 自动流转为 `已结课(待结算)`。
  - **周末周结单跑批**：自动汇总并生成【教师课酬单】（每师一单、只出节数不出金额）与全局【平台工具费单】。
  - **三级通知调度**：站内信未读超时自动兜底补发 Email，以及紧急通知（24h 改期、转课、整班停课）的并发邮件派发。
- **禁止**:
  - 严禁暴露外部公网 HTTP 业务端点（仅限健康检查与内部任务触发）。
  - 严禁绕过数据 Mapper 进行无校验写入。

### 1.4 `dream-core` (领域与数据共享核心库)
- **定位**: 整个系统的业务领域逻辑与数据访问唯一核心库（`@topeetop/dream-core`）。
- **职责**:
  - **唯一 Mapper 真相源**：项目所有表的 `*Mapper.ts` 集中且唯一收敛于此，实现“一表一 Mapper”物理归口。
  - **核心领域服务**：封装 5 大模块的领域 Service（排课时段校验、购课裂变 TS、转让状态机、周结单归集）。
  - **纯业务计算器**：12.5% 请假配额算法（向下取整）、小班课自负盈亏与预留盈余公式、退款违约金按比例拆分。
  - **类型与 DTO 契约**：定义业务实体、状态机枚举及跨层 DTO。
  - 供 `dream-backend`（HTTP 接入层）与 `dream-worker`（批处理调度层）共同依赖。
- **禁止**:
  - 严禁依赖上层 HTTP 框架（Fastify）或具体的 Cron 定时器（保持为纯净的领域与数据访问库）。
  - 严禁包含任何前端 UI 逻辑。

### 1.5 `db-schema` (数据库唯一真相源)
- **定位**: 数据库 DDL 与迁移脚本版本化仓库。
- **职责**:
  - 管理单 Schema `dream` 下的 DDL 结构及初始种子数据。
  - 管理幂等的版本化迁移脚本 (`migration_vxxx.sql`)。
- **禁止**:
  - 严禁在各业务应用中随意执行未经版本化的生产建表或改表 SQL。

---

## 2. 共享生态与依赖红线 (Dependency Rules)

### 2.1 跨包引用准则 (Cross-Package Imports)
1. **严禁深层相对路径**：严禁在代码中使用类似 `import ... from '../../packages/...'`。
2. **强制统一 @topeetop 作用域**：所有内部共享与外部公共能力必须通过 `@topeetop/` 作用域包名引入：
   - `@topeetop/dream-core`：本项目专属的领域服务、Mappers 数据访问与分账计算核心库。
   - `@topeetop/shared-core`：12位短 ID 生成器 (`generateShortUuid`)、JwtAuthHook、ApiError 等。
   - `@topeetop/security-core`：敏感数据加解密、防篡改签名。
   - `@topeetop/auth-core`：JWT 鉴权核心。
   - `@topeetop/notification-client`：站内信与邮件分发客户端。
   - `@topeetop/env-secure-conf`：配置动态解密与 Schema 注入。
3. **禁止循环依赖**：A 依赖 B 则 B 严禁依赖 A。
4. **单向依赖红线**：底层 Shared 库严禁依赖上层业务应用。
