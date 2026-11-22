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
| **端侧 PWA 缓存** | `vite-plugin-pwa` 四级缓存体系（见 [DESIGN.md](../DESIGN.md#5-pwa-与端侧四级数据缓存策略-pwa--caching-hierarchy)） | L1 `CacheStorage`（壳/静态资源）；L2 `LocalStorage + Pinia`（身份/字典）；L3 `IndexedDB`（`dream_pwa_l3_db` 脱敏只读快照 + **不可变流水 90 天/2000 条 Keyset 游标增量快照**，支持离线排序筛选）；L4 `NetworkOnly`（支付/清退/转账/抢位提交及在途可变单据**绝对禁止离线缓存与离线写入**） |
| **静态配置与密钥** | `@topeetop/env-secure-conf` + `zod` (`env.config.ts`) | 启动时强校验环境变量；严禁在代码或注释中明文写入密钥 |
| **动态运营配置** | `dream.system_configs` 键值表 + 整点分钟缓存 + `dream.audit_logs` | 仅收录已拍板的高频参数（见 [SYSTEM_CONFIG_PARAMETERS_CANDIDATES.md](./SYSTEM_CONFIG_PARAMETERS_CANDIDATES.md)）；变更即时对新操作/新单据生效，**严禁追溯修改已生成单据或已排课格** |
| **异步与定时任务** | **优先 `@topeetop/task-relay-client`（TaskRelay 服务）** + `dream-worker`（固定 Cron 批处理） | 严禁在 `dream-backend` 中使用裸定时器或 `node-cron`；**所有异步投递与 31 天内精确单次定时任务优先使用 TaskRelay**；仅全校周期性 Cron 扫表归口 `dream-worker`（详见 §2.2） |
| **通知与实时推送** | `@topeetop/notification-core`（`NotificationManager` + `SseHub` / `DbPollerManager`） | 严禁自建 WebSocket 或手写 SSE 轮询骨架；邮件经 `NotificationManager`（配置 `relay` 走 TaskRelay），浏览器实时推送统一挂载 `createNotificationRouter` SSE 总线（详见 §2.3） |
| **认证与鉴权** | `@topeetop/auth-core` + `@topeetop/shared-core` (`JwtAuthHook`) | 仅复用 `auth-core` 自然人认证与 JWKS 验签；**严禁使用 `auth-core` 角色体系**，业务身份由本地 `admin_accounts`/`monitor_profiles`/`teacher_profiles`/`student_profiles` 解析 |
| **文件与媒体存储** | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`（遵循 `packages/docs/s3-upload-guide.md`） | 浏览器端 S3 预签名 `PUT` 直传；**图片默认在浏览器端转为 WebP 后直传，不限制原图大小**；**PDF 或其他格式必须限制文件大小**；DB 仅存相对 `key`（详见 §2.4） |
| **双语 (i18n) 与错误码** | 后端 `dream-core` 英文 `ApiError` + 大写 `errorCode`；前端 `vue-i18n` (`zh-CN`/`en-US`) | `dream-core` 严禁硬编码中文；前端按 `errors.<CODE>` 翻译；语言偏好存 `LocalStorage(dream_locale)` 与 `dream.user_preferences`（外教默认 `en-US`，家长/班长默认 `zh-CN`） |
| **遥测与日志** | `@topeetop/telemetry-core`（stdout JSON + `trace_id`） | 日志禁止明文输出 `password`/`token`/`secret`/`authorization`/`cookie` |
| **前端 UI 与样式** | Vue 3 + Pinia + Vue Router + TDesign + **100% Tailwind CSS** | 严禁手写 `<style>` 块或外部 CSS 样式表；工作台按 `effectiveRoles` 路由隔离 |

---

## 2.1 列表排序与搜索实现选型基线（客户端 vs 服务端）

编写各模块 TDD 时，**禁止一刀切全部走服务端或全部走客户端**，必须按“数据体量上限 + 是否不可变 Append-Only + 是否属于 L4 `NetworkOnly` 强实时写操作/在途资金域”四档分流设计：

| 实现模式 | 适用条件与缓存策略 | 强制适用列表 | 技术约束 |
|---|---|---|---|
| **A. 端侧全量 + 客户端排序/搜索** | 权限范围内总条数有界（通常 $\le 500$ 条，JSON $< 100\text{KB}$），需高频切排序、1–2 字母前缀过滤或首字母索引；可配合服务端整点分钟缓存或端侧 L2/L3 缓存 | **M1A** 自家孩子、所辖/全校学员、试课学员；**M1B** 老师/班长列表；**M1C** 小班列表；**M1E** 课件库 | 前端在 Pinia `computed` 内完成 0ms 过滤与排序；若未来全校在读突破 1000 人阈值，再降级切换为服务端检索 |
| **B. 周期切片 + 端侧过滤（混合）** | 按自然周/时间窗口切片拉取后单屏行数有限（几十行），但需保证首屏基准顺序与多条件即时过滤 | **M5B** 老师周课酬单看板 | 服务端按周返回并排好 `非常规标红 → 待打款 → 已打款` 基准序；前端在内存中 0ms 完成姓名搜索与“仅看非常规”过滤 |
| **C. 服务端分页 + SQL 排序/搜索** | 高频状态变更的在途业务单据/消息、需要 `SELECT ... FOR UPDATE` 并发防线的实时域，以及模式 D 超出端侧 90 天/2000 条窗口的冷历史补查 | **M2A** 购课单列表；**M5A** 周转账单与异常回退 TS；**M4** 站内通知（每页 20 条）；**超窗口冷历史回退查** | 必须由 `dream-core` `*Mapper` 通过索引化 SQL `WHERE` + `ORDER BY` + `LIMIT/OFFSET`（或游标）实现；前端搜索输入需做 300ms 防抖 |
| **D. 不可变流水游标增量同步 + 端侧排序/筛选** | 生成后永久不变（D1 纯 Append-Only）或仅极低频撤回/进入不可变终态后不变（D2）的**已脱敏只读流水**；依托 L3 `IndexedDB` Keyset 游标增量拉取后支持 0ms 本地筛选排序与**离线只读浏览** | **D1（`(created_at, id)` 游标）**：**M2B** 课次清退记录、**M3B**【经办记录】、全实体【状态流转历史】与【档案/小班/字典变动日志】；<br>**D2（`(updated_at, id)` 增量覆写）**：**M3B**《出勤异常记录》、**M3B** 老师【授课历史】与已入终态归档单据快照 | 仅缓存当前账号有权的近期窗口（默认 **90 天 / 2,000 条**），遵守 §2.1a 六项强制规范；**新增清退/确认收款/打款等写操作仍严格归 L4 `NetworkOnly` 离线禁用** |

---

## 2.1a PWA 端侧增量缓存与离线只读协议规范 (Pattern D)

所有采用模式 D 的模块 TDD 必须在接口契约、IndexedDB 存储设计与组件销毁中显式落实以下 **6 项工程规范**：

### 1. 数据分类与 L4 写操作零污染红线
- **D1 纯追加不可变流水**（一经落盘永不改写，如 M2B 课次清退记录、M3B 经办记录、状态流转历史、档案/小班变动日志）：采用 **`(created_at, id)`** 严格追加增量游标，本地 `upsert` 只增不改；
- **D2 低频撤回 / 终态快照**（极少数场景会改态或补备注，如 M3B《出勤异常记录》销假撤销、M3B 授课历史补录备注、已达终态的 M2A/M5A/M5B 单据）：必须采用 **`(updated_at, id)`** 增量覆写（服务端按 `updated_at` 推进游标下发最新全量脱敏快照行，本地按主键 `id` 覆盖更新）；
- **写操作严守 L4 隔离**：可离线只读浏览 M2B 历史清退记录，绝不意味着允许离线提交【新增清退】——一切资金、排课与审单写入动作断网时必须置灰阻断（Toast 提示离线不可用）。

### 2. 服务端 Keyset 复合游标契约（兼容 `VARCHAR(12)` · 禁客户端时钟）
- 由于全库禁用 `SERIAL` 自增主键而使用 12 位短 ID（`VARCHAR(12)`），且客户端系统时钟存在偏移风险，**严禁使用 `Date.now()` 或单字段 `id > lastId` 分页**；
- 统一在 `dream-core` `*Mapper` 实现复合 Keyset 元组查询（要求对应表建有 `(created_at, id)` 或 `(updated_at, id)` 联合索引）：
  ```sql
  SELECT ... FROM dream.<audit_or_ledger_table>
  WHERE <account_or_scope_filter>
    AND (created_at, id) > ($1::timestamptz, $2::varchar(12))
  ORDER BY created_at ASC, id ASC
  LIMIT $3; -- limit + 1 判断 hasMore
  ```
- **统一响应 Zod 结构**：返回 `{ items, nextCursor: { ts, id } | null, hasMore, serverTime }`。若 `hasMore === true`，前端按帧循环追平直到 `hasMore === false` 并记录 `lastSyncAt = serverTime`。

### 3. 有界冷启动与滑动淘汰（防移动浏览器配额溢出）
- **冷启动截断**：本地尚无游标首次同步时，后端按 **`windowDays = 90`（最多倒推截断 `maxItems = 2000` 条）** 下发起始窗口数据并锚定初始游标，严禁一次拉全库数万条历史日志；
- **本地容量淘汰**：写入 `dream_pwa_l3_db` 时在同一 IndexedDB 事务内清理超出 **`90 天` 或超出 `2,000 条`** 的最旧记录，保持端侧存储轻量稳定；
- **超窗口在线回退**：当在线用户在筛选器切至 `全部` 或查询 90 天前的冷历史时，自动穿透调用模式 C 服务端 SQL 分页检索；离线时仅展示本地已缓存窗口并明确提示范围。

### 4. 多账号 / 多角色分区与登出清空隔离
- `dream_pwa_l3_db` 中模式 D 的记录必须以 **`[accountId, roleScope, storeKey]`** 作为逻辑分区前缀（并维护游标元数据表），杜绝兼职用户切换工作台或跨号登录时发生本地缓存串权；
- 发生【退出登录】或收到鉴权失效（`401/403` 被封禁/停用）时，必须同步执行清理函数彻底清空当前账号在 `dream_pwa_l3_db` 中的全部模式 D 快照与游标；【清理缓存】仅清 L3 IndexedDB 快照且保留登录凭证。

### 5. 服务端 DTO 层响应前脱敏与权限裁剪（IDOR 防线）
- 增量同步接口必须从已验签 JWT 读取 `request.user.id` 校验角色范围（例如班长仅能拉取本人经办记录与本人托管清退记录；管理员拉取全校），**严禁把全校记录拉到前端后再按角色隐藏**；
- PII 敏感字段（手机号、Email 等）与内部敏感字段（如家长不可见的班长强制提交原因、老师不可见的积分与内部单价）**必须在服务端 DTO 返回前完成裁剪与脱敏**，绝不将未脱敏明文落盘至 IndexedDB。

### 6. 前端离线只读交互与同步时效提示
- 页面加载遵循 **“0ms 渲染本地 L3 快照 + 在线静默增量追平”**，本地筛选、关键字匹配与多列排序全部在内存/IndexedDB 索引中即时完成；
- 当处于离线态（`!navigator.onLine` 或增量请求网络失败降级）时，列表顶部必须展示醒目轻量状态条：**`离线只读 · 已同步至 YYYY-MM-DD HH:mm（支持筛选与排序缓存数据）`**。

---

## 2.2 异步任务与定时调度选型基线（优先 TaskRelay 服务）

在设计异步操作或延迟/定时触发方案时，**优先使用自托管 TaskRelay 服务（`@topeetop/task-relay-client`）**，避免为了单据级定时触发而高频轮询数据库：

1. **优先使用 TaskRelay 的场景（异步解耦 + 31 天内精确单次延迟任务）**：
   - **全部异步投递**：邮件发送（续费账单、临期催办、代课变动、周结发薪通知、应急调度等）、外部 Webhook 回调；
   - **单据/课次级精确定时触发（`scheduleTime` / `delaySeconds` $\le 31$ 天）**：例如 `AUTO_RENEWAL` 续费单生成时直接预埋“开课前 48h 催办”与“开课前 24h 超时作废释放 `HOLD`”任务；老师请假时预埋“原定下课时间未处理自动退回待排期”任务（若提前付款/处理，可调用 `deleteTask` 撤销，并在回调接口做状态幂等守卫）。
2. **归口 `dream-worker` 的场景（仅全校级固定 Cron 周期扫表）**：
   - 每日 02:00 自动结课、每周一 03:00/03:30 周课酬单与周转账单预生成、周一 08:00/08:30 转账催办与固定位续费扫描、超 30 天试课归档及历史覆盖/通知清理等无特定单据触发源的批处理；批处理产出的下游发信动作仍通过 TaskRelay 异步投递。
3. **TaskRelay 接入强制协议规范**：
   - **Body 编码**：`httpRequest.body`（v2.4+）必须进行 **Base64 编码**，单任务 Payload 上限 **200 KB**；
   - **幂等与追踪**：必须携带 **`idempotencyKey`** 防重放，并在 `httpRequest.headers` 透传 **`x-trace-id`**；
   - **队列安全**：队列需通过 `saveQueue` 配置 **`allowed_domains`**（SSRF 白名单）与重试上限；
   - **回调生命周期**：同步完成返回 `200 OK`；长时异步任务返回 `202 Accepted` 并必须在 **30 分钟内**调用 `completeTask` 结案（超时将被回收标记 `EXHAUSTED`）。

---

## 2.3 通知投递与浏览器实时推送选型基线（Notification + SSE）

全项目邮件投递与浏览器端内实时推送统一使用 **`@topeetop/notification-core`**，严禁自建 WebSocket 服务或裸写前端轮询定时器：

1. **邮件与外部通知**：在应用 Composition Root 通过 `createNotificationManager(config, db)` 注入 `NotificationManager` 实例，并启用 `relay` 配置（`baseUrl`、`psk`、`enabled: true`）自动委托 TaskRelay 异步投递，禁止在请求链路内同步阻塞等待第三方邮件网关。
2. **浏览器实时推送（SSE）**：
   - 需要向浏览器实时推送信标红点、新待办或课表变动提醒时，统一使用 `DbPollerManager` + `SseHub` + `createNotificationRouter({ sseHub, authMiddleware })` 挂载至 Fastify（路径 `/api/notification/v1`）；
   - `DbPollerManager` 复用 `@topeetop/shared-core` 的 `db.executeQuery.bind(db)`，默认 `pollIntervalMs: 5000`，严禁额外新建数据库连接池；
   - 必须传入已校验 JWT 的 `authMiddleware` 防止未授权订阅或跨账号事件泄露。

---

## 2.4 文件与媒体直传选型基线（S3 Presigned PUT + WebP 免限）

全项目文件上传统一遵循 `packages/docs/s3-upload-guide.md` 采用**浏览器端 S3 预签名 `PUT` 直传**（不经业务后端中转二进制流），并按文件类型执行差异化前置处理：

1. **图片上传（不限制原图大小 · 浏览器端统一转 WebP）**：
   - 头像、老师风采相册、二维码、付款/退款/转账凭证截图等所有图片，**浏览器端不对用户选择的原图大小做拦截限制**；
   - 选择图片后，由前端在浏览器内通过 Canvas 完成等比例缩放与压缩，统一导出为 **`image/webp`** Blob 后再向后端申请预签名 URL 并 `PUT` 直传（后端 `PutObjectCommand` 的 `ContentType` 锁定为 `image/webp`，有效期推荐 3–8 分钟）；数据库仅保存相对 `key`。
2. **PDF 及其他非图片格式（严格限制大小）**：
   - PDF 凭证、介绍视频等无法在浏览器端转 WebP 的非图片文件，**必须在浏览器选档阶段与预签名申请接口双端强校验文件大小上限**（例如凭证 PDF $\le 10\text{MB}$、试讲视频按 M1B 规格上限）及 `Content-Type` 白名单，超限立即阻断提示。
3. **敏感图片与文档私有访问隔离（严禁公开域名直出）**：
   - **公开宣传素材**（老师风采相册、试讲视频、课件样图、公开头像）可配置公开 CDN 域名；
   - **敏感图片与文档**（付款/转账/退款凭证截图与 PDF、微信收款/联系二维码、证件或内部审计附件等）**严禁存入公开桶或通过公开域名匿名访问**；必须存入私有 S3 桶/私有前缀，仅在后端校验登录态（`JwtAuthHook`）及资源归属/角色权限通过后，动态签发短时效 `GetObject` 预签名 URL（推荐 60–300 秒）或经鉴权代理返回。

---

## 3. 安全设计强制检查清单 (Security Checklist)

凡涉及接口、数据访问或鉴权的 TDD，必须显式说明以下防线：

1. **IDOR（越权访问）物理隔离**：所有用户归属资源（如学员档案、购课单、个人偏好）的查询与修改，**`account_id` 必须取自 JWT 验签载荷**（`request.user.id`），严禁信任前端请求体或 Header 传入的 `accountId` / `roles`；Header `X-Profile-Id` 必须经 `StudentProfileMapper` 归属核验。
2. **高危操作二次验活（策略 B）**：针对周转账确认（M5A）、课次清退（M2B）、班长/老师离职交接（M1B）、账号注销（M0A）等高危操作，必须在后端追加实时校验账号未被封禁（`verifyActiveAccount`）。
3. **并发与防重放**：排课抢位、核销课次、转账归集等强一致性操作必须使用 `executeTx` 事务 + 行级排他锁（`SELECT ... FOR UPDATE`）；前端 Token 刷新必须实现 `isRefreshing` + `failedQueue` 单通道互斥队列。
4. **测试后门严控**：任何模拟测试 Header（如 `LEGACY_TEST_MOCK_TOKENS`）仅允许在 `NODE_ENV === 'test'` 下存在，生产与预发环境物理禁用。
5. **敏感信息 API 响应与端侧双端脱敏**：Email（如 `a***@example.com`）、手机号（如 `138****1234`）、证件号等 PII 个人敏感信息，**不仅界面展示需脱敏，后端 HTTP 响应 API 必须在 DTO/Serializer 层直接脱敏返回**（严禁靠前端截断掩码而 API 明文吐出全量敏感字段）；仅账号本人明确触发“查看/核验”且权限闭环时方可按最小必要原则返回。
6. **敏感文件鉴权访问（禁止公开域名）**：凭证截图、PDF 文档、私域微信二维码等敏感文件必须存放在私有存储桶并绑定登录态 + 权限校验后签发短时效预签名读取链接，禁止挂在公开 CDN 域名下匿名访问。

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
