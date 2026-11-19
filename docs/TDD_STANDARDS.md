/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# Dream 技术设计文档编写与技术选型规范 (TDD Standards)

本文档是 Dream 项目编写 `docs/tdd/*.md` 技术设计文档（TDD / Tech Spec）的唯一架构与选型基线，配合全局技能 `technical-design-doc-creator` 共同约束所有模块的技术方案设计。

---

## 1. 归档规范与设计原则

- **存放路径**：所有模块技术设计文档统一归档于 `docs/tdd/m{模块}_{slug}.md`（例如 `docs/tdd/m0a_auth_and_roles.md`）。
- **前置铁律 (Docs First)**：必须先有已评审的对应 `docs/prd/m*.md`，再编写 TDD；严禁脱离 PRD 自行发明业务规则。
- **可执行契约**：TDD 必须给出明确的 **C-S-M 分层职责、Mermaid 时序图、Zod 入参契约、显式 `dream.` 前缀 DDL、风险矩阵、生产监控/回滚预案及末章自检表**，使下游 `subagent-driven-development` 可直接按文编码。

---

## 2. 全栈官方技术选型基线（严禁私自替换）

| 领域 | 唯一官方选型 / 实现方式 | 强制约束与红线 |
|---|---|---|
| **Web 框架与路由校验** | `fastify` + `fastify-type-provider-zod` + `zod` | 请求/响应 Schema 必须在接口层 Fail-Fast 校验；严禁引入 Express |
| **数据库与连接池** | PostgreSQL + `@topeetop/shared-core` (`DatabaseService`, `executeTx`) | 严禁手写 `new Pool(...)`；所有 SQL 必须收敛于 `dream-core` `*Mapper`（继承 `BaseMapper`，支持 DI 注入 `DatabaseService`） |
| **Schema 与主键规约** | 单 Schema `dream.` + `generateShortUuid()` (`VARCHAR(12)`) + `deleted_at` | 所有 SQL 必须显式写 `dream.` 前缀；严禁使用自增 `SERIAL` 或 36 位 UUID |
| **服务端缓存** | **无定时器整点分钟内存缓存**（`minuteBucket = Math.floor(now() / 60_000)` + single-flight 锁） | 适用于管理员/班长/老师目录、价位字典、系统运营参数等小体量高频读数据；每分钟 `:00` 秒多节点同步过期，**严禁使用 `setInterval`/`setTimeout`**（保证 Serverless 安全） |
| **端侧 PWA 缓存** | `vite-plugin-pwa` 四级缓存体系（见 [DESIGN.md](../DESIGN.md#5-pwa-与端侧四级数据缓存策略-pwa--caching-hierarchy)） | L1 `CacheStorage`（壳/静态资源）；L2 `LocalStorage + Pinia`（身份/字典）；L3 `IndexedDB`（`dream_pwa_l3_db` 脱敏只读快照）；L4 `NetworkOnly`（支付/清退/转账/抢位**绝对禁止离线缓存**） |
| **静态配置与密钥** | `@topeetop/env-secure-conf` + `zod` (`env.config.ts`) | 启动时强校验环境变量；严禁在代码或注释中明文写入密钥 |
| **动态运营配置** | `dream.system_configs` 键值表 + 整点分钟缓存 + `dream.audit_logs` | 仅收录已拍板的高频参数（见 [SYSTEM_CONFIG_PARAMETERS_CANDIDATES.md](./SYSTEM_CONFIG_PARAMETERS_CANDIDATES.md)）；变更即时对新操作/新单据生效，**严禁追溯修改已生成单据或已排课格** |
| **异步与定时任务** | `@topeetop/task-relay-client` + `dream-worker` | 严禁在 `dream-backend` 中使用裸定时器或 `node-cron`；异步投递走 `task-relay-client`，周期性跑批统一归口 `dream-worker`（必须幂等可重入） |
| **认证与鉴权** | `@topeetop/auth-core` + `@topeetop/shared-core` (`JwtAuthHook`) | 仅复用 `auth-core` 自然人认证与 JWKS 验签；**严禁使用 `auth-core` 角色体系**，业务身份由本地 `admin_accounts`/`monitor_profiles`/`teacher_profiles`/`student_profiles` 解析 |
| **文件与媒体存储** | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | 端侧按规范压缩后拿预签名直传 S3/R2，数据库仅存相对 `key` |
| **双语 (i18n) 与错误码** | 后端 `dream-core` 英文 `ApiError` + 大写 `errorCode`；前端 `vue-i18n` (`zh-CN`/`en-US`) | `dream-core` 严禁硬编码中文；前端按 `errors.<CODE>` 翻译；语言偏好存 `LocalStorage(dream_locale)` 与 `dream.user_preferences`（外教默认 `en-US`，家长/班长默认 `zh-CN`） |
| **遥测与日志** | `@topeetop/telemetry-core`（stdout JSON + `trace_id`） | 日志禁止明文输出 `password`/`token`/`secret`/`authorization`/`cookie` |
| **前端 UI 与样式** | Vue 3 + Pinia + Vue Router + TDesign + **100% Tailwind CSS** | 严禁手写 `<style>` 块或外部 CSS 样式表；工作台按 `effectiveRoles` 路由隔离 |

---

## 3. 安全设计强制检查清单 (Security Checklist)

凡涉及接口、数据访问或鉴权的 TDD，必须显式说明以下防线：

1. **IDOR（越权访问）物理隔离**：所有用户归属资源（如学员档案、购课单、个人偏好）的查询与修改，**`account_id` 必须取自 JWT 验签载荷**（`request.user.id`），严禁信任前端请求体或 Header 传入的 `accountId` / `roles`；Header `X-Profile-Id` 必须经 `StudentProfileMapper` 归属核验。
2. **高危操作二次验活（策略 B）**：针对周转账确认（M5A）、课次清退（M2B）、班长/老师离职交接（M1B）、账号注销（M0A）等高危操作，必须在后端追加实时校验账号未被封禁（`verifyActiveAccount`）。
3. **并发与防重放**：排课抢位、核销课次、转账归集等强一致性操作必须使用 `executeTx` 事务 + 行级排他锁（`SELECT ... FOR UPDATE`）；前端 Token 刷新必须实现 `isRefreshing` + `failedQueue` 单通道互斥队列。
4. **测试后门严控**：任何模拟测试 Header（如 `LEGACY_TEST_MOCK_TOKENS`）仅允许在 `NODE_ENV === 'test'` 下存在，生产与预发环境物理禁用。

---

## 4. 编写 TDD 必读关联文档地图

| 文档 | 路径 | 在 TDD 中承担的角色 |
|---|---|---|
| **工程与编码规范** | [CODING_STANDARDS.md](./CODING_STANDARDS.md) | Monorepo 边界、C-S-M 分层、REST 契约、Zod 与构建混淆规范 |
| **业务规则与分账规约** | [BUSINESS_RULES.md](./BUSINESS_RULES.md) | 资金持有人锁定、TS 状态机、尾差算法、续费与结算核心边界 |
| **UI 视觉与 PWA 规范** | [DESIGN.md](../DESIGN.md) | 端侧四级缓存、Tailwind CSS、7 色日历 Token、i18n 错误码拦截 |
| **全局统一术语表** | [GLOSSARY.md](./GLOSSARY.md) | 标准实体名、表/字段英文语义基准与禁用词汇 |
| **页面路由与导航拓扑** | [PAGE_ROUTING_AND_NAVIGATION_TOPOLOGY.md](./PAGE_ROUTING_AND_NAVIGATION_TOPOLOGY.md) | 前端双轨制路由与 API 镜像对称路径参考 |
| **动态运营参数候选表** | [SYSTEM_CONFIG_PARAMETERS_CANDIDATES.md](./SYSTEM_CONFIG_PARAMETERS_CANDIDATES.md) | 动态配置参数 Key、类型、默认值与生效边界 |
| **认证底座接入指南** | `packages/docs/auth_integration_guide.md` | `@topeetop/auth-core` Fastify 插件挂载、JWKS 与错误码字典 |
