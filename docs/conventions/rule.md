/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# Dream 协作准则 (Rules)

本文档是 Dream (教务排班与分账管理系统) 项目的顶层协作指南。具体技术细节请参阅对应的 **[工程规范 (Conventions)](#工程规范索引)**，业务详细规格以 [Prd-v5.md](../Prd-v5.md) 为唯一基准。

---

## 1. 核心工程哲学 (Philosophy)

- **物理隔离优先 (Physical Workspace Isolation)**：
  - 前端管理员、班长、家长、教师四大角色工作台导航、主题色和页面逻辑实施物理隔离，严禁多角色兼职身份下的交叉误操作。
  - 多孩家庭在家长工作台顶部实施全局档案切换器（Profile Switcher），实现数据下钻隔离。
- **资金持有人锁定铁律 (Funds Holder Lock)**：
  - TS 最小课次无论后续发生何种代课、同师挪位或跨家长转让，TS 的资金持有方（收款方）永久锁定初始收款班长或平台，直至周末转账归集。
- **财课分离与转让追踪 (Finance & Schedule Decoupling)**：
  - 课程发生同家庭直转或跨家庭转让时，原购课单与原付款家长的资金归属完全不变，排课层将 TS 实际授课学生档案直接变更并即时生效于接收方课表。
- **纵深防御 (Defense in Depth)**：
  - 在 Service 层鉴权的基础上，SQL 层强制物理包含 `account_id` 或 `student_profile_id` 过滤是防御 IDOR（越权）的不可逾越红线。
- **异常未上课回退补生兜底 (Safe Rollback with Compensation)**：
  - 针对教师实际未上课但次日凌晨已被系统自动结课的异常 TS，允许班长/管理员修改为“已取消”，记录严格审计日志，并由系统在原单下自动补生 1 节全新“待排期 TS”，课酬统计物理剔除。
- **底层基建复用原则 (Shared Infrastructure Reuse)**：
  - 严禁在业务项目中重复造轮子（如手写 `new Pool(...)` 自建数据库连接池、自建连接生命周期逻辑）。
  - 数据库必须且只能通过 `@topeetop/shared-core` 的 `DatabaseService` 接入，Mapper 层全面推行构造函数注入 (DI)，单测严禁使用全局 monkey patch 劫持连接文件。参考 `/Users/shanzao/ravll-workspace/packages/shared-core/README.md`。

---

## 2. 核心业务规约与红线 (Business Rules)

### 2.1 账号与档案解耦 (Account vs. Profile)
- **账号 (Account)**：代表自然人操作主体，使用唯一的 **Email** 注册登录，承载多角色权限标签 `[管理员, 班长, 教师, 家长]`。
- **学生档案 (Student Profile)**：代表实际上课与课时消耗实体。1 个家长账号可创建并挂载 N 个学生档案。
- **命名规范**：学生档案昵称强制遵循 `英文名+姓首字母+年龄`（如 `AliceZ12`, `BobZ10`），用于多孩识别与跨家长转让精准校验。

### 2.2 12.5% 请假配额与时限红线
- 周期内允许直接请假上限为周期总课时的 **12.5%**（向下取整）。
- **固定位**：不可退回待排期；$\ge$ 24h 仅可同师挪位；3h ~ 24h 仅可转让；< 3h 熔断锁死。
- **临时课**：$\ge$ 24h 且未超配额可直接请假退回待排期；3h ~ 24h 或超配额强制同师改期或转让；< 3h 锁死。

### 2.3 小班课自负盈亏与班长预留盈余
- 小班课由小班班长负责招生运营，自负盈亏。
- 周度转账上交平台时，系统自动预留扣除班长自留盈余积分，班长仅上交 `教师单节课酬 + 工具费 (Max × 6积分) + 平台盈余抽佣`。

---

## 3. 测试与辅助文件管理 (Workflow)

- **环境配置文件保护**：严禁修改或删除 `tmp/local_env.dev` 文件，该文件由本地或容器环境维护。
- **测试辅助文件管理 (Artifacts)**：
  - Playwright 自动化执行生成的截图或追踪文件统一存放在 `tmp/` 目录。
  - 临时验证脚本统一存放在 `scripts/` 目录。
- **资源释放 (Resource Cleanup)**：AI 启动本地后端或前端服务完成验证后，**必须立即主动杀死进程并释放端口**（`5173`, `8070`, `8072`）。

---

## 4. 工程规范索引 (Index)

| 规范领域 | 文档链接 | 核心关注点 |
| :--- | :--- | :--- |
| **模块定位** | [模块定位规范](./module_positioning.md) | Monorepo 边界、服务拆分、依赖红线 |
| **后端开发** | [后端编码规范](./backend_coding_conventions.md) | Controller-Service-Mapper 三层架构、DI、Fail-Fast |
| **数据库设计** | [数据库设计规范](./database_design_conventions.md) | 12位短 ID、单 Schema (`dream`)、软删除、索引规约 |
| **API 交互** | [REST API 规范](./rest_api_conventions.md) | 标准响应、Zod 强校验、ApiError、IDOR 防御 |
| **前端开发** | [UI 架构与视觉标准](./tech_ui_architecture_standard.md) | 工作台物理隔离、TDesign 选型、100% Tailwind CSS、零手写 CSS |
| **日历视觉** | [7 色日历规范](./tech_calendar_7color_standard.md) | 固定位🟠、临时课🟡、被代课🔵、代上课🟣、不可约⚪、空闲🟢、已请假🔴 |
| **财务分账** | [财务单据与分账核算](./finance_settlement_conventions.md) | 五大单据体系、资金持有人锁定、小班自负盈亏与预留盈余、双周结单 |
| **文件存储** | [文件上传与存储规范](./file_upload_conventions.md) | 教师多媒体资料预签名直传、S3/R2 路径归档 |
| **消息通知** | [三级通知分发规约](./notification_conventions.md) | 站内信 + 家长 Email 兜底超时升级与紧急并发派发 |
| **遥测与异步** | [遥测与异步中转规范](./telemetry_and_task_relay_conventions.md) | 云原生 stdout 结构化日志、W3C 链路追踪透传、TaskRelay 异步任务生命周期 |
| **运维部署** | [运维与部署规范](./ops_conventions.md) | 本地端口、Cloud Build 零安装、Docker 精简镜像、topee.top 生态 |

---
*(c) 2024-2026 Topee Architecture Documentation.*
