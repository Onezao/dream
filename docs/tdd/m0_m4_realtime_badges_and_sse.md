/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# 技术设计文档 (TDD) — M0/M4 专项：站内未读数与多模块金刚位红点准实时触达方案

| 元数据项 | 说明 / 内容 |
|---|---|
| **技术负责人 (Tech Lead)** | @Dream-Architecture |
| **关联需求 / PRD** | [m0_workspace_and_home.md](../prd/m0_workspace_and_home.md) / [m4_notification.md](../prd/m4_notification.md) / [m0a_auth_and_account.md](../prd/m0a_auth_and_account.md) |
| **关联 TDD** | [m0a_auth_and_roles.md](./m0a_auth_and_roles.md) |
| **文档状态** | 专题基线已定稿 (Approved Baseline · 准实时触达专项) |
| **适用工程规范** | [GEMINI.md](../../GEMINI.md) / [TDD_STANDARDS.md](../TDD_STANDARDS.md) / [CODING_STANDARDS.md](../CODING_STANDARDS.md) / [DESIGN.md](../../DESIGN.md) |
| **创建与更新日期** | 2026-11-24 |

---

## 1. 背景与上下文 (Context)

Dream 工作台包含两类核心的端内准实时状态指示需求，数据横跨 [M0 工作台基座](../prd/m0_workspace_and_home.md)、[M4 消息通知底座](../prd/m4_notification.md) 及五大垂直业务模块（`M2A` / `M2B` / `M3A` / `M3B` / `M5A` / `M5B`）：

1. **全站顶栏 🔔 未读计数与首页代表通知卡**：
   - 顶栏铃铛角标（`1~99` / `99+`，`0` 隐藏）汇聚当前登录账号下**全部业务视角**的未读站内提醒（`AC-M0-23`、`M4 §4.2`）；
   - 家长/兼职首页【自家信息流 · 通知卡】严格仅过滤 `接收业务视角 = 家长` 的最紧急 1 条未读，已读后自动补位下一条或整卡收起（`AC-M0-04`）；
   - 老师首页【近期课表变动通知条】严格仅过滤 `接收业务视角 = 老师` 的近期课表变动未读提醒，最多 1 条（`AC-M0-03`）。
2. **首页 & Tab 3 金刚位 `7px` 待办小红点**：
   - 仅强待办/审单类金刚位入口在有待处理事项时亮起 `7px` 小红点（无数字），且**首页与 Tab 3 同名入口必须 100% 同步**（`AC-M0-02`、`AC-M0-07`、`AC-M0-08d`）；
   - 数据来自多个垂直模块（`M2A` 购课续费、`M2B` 退款、`M3A/M3B` 今日调度与异常考勤、`M5A` 周转账与异常回退、`M5B` 周课酬发薪），且存在权限隔离（`周转审核` 与 `课酬发薪` 红点仅对唯一「永久主管理员」点亮）及跨组 `<3h` 紧急驰援连带消红（`L-4`：`≤ 1 分钟`同步消卡消红）。

本专项文档作为 M0 与 M4 正式 TDD 的**准实时触达与聚合基线**，锁定 `@topeetop/notification-core` SSE 信道接入方式、60 秒短连接重连自愈机制、TaskRelay `<3h` 时间跨阈唤醒以及 `home-badges` 聚合读模型。

---

## 2. 问题陈述与动因 (Problem Statement & Motivation)

### 2.1 正在解决的核心痛点
- **多模块红点与未读数口径易漂移**：若前端依赖 SSE 事件增量做 `+1 / -1` 局部推算，一旦发生并发抢单（如跨班长 `<3h` 紧急驰援已被他人接手）、断网切后台休眠、或管理员被撤销降级，前端计数极易出现“幽灵红点”或首页与 Tab 3 不一致。
- **`@topeetop/notification-core` 与 Dream 架构存在必须显式适配的源码约束**：
  1. `notification-core` 内置 `NotificationMapper` 固定读写 `notification.messages`（整数自增主键 `id`，`DbPollerManager` 仅对纯数字 `sinceId` `/^\d+$/` 补发历史消息），无法直接承担 `dream.*` 12 位短 ID 业务主表存储职责；
  2. `NotificationManager.createMessage` 禁止全局广播（`userId === "global"` 抛出 `400`）；
  3. `createNotificationFastifyPlugin` 的 `POST /ticket` 硬编码取 `request.user.role || "user"` 作为 `audience`，而 Dream 禁用 `auth-core` 单角色字段、改由本地 `effectiveRoles` 数组聚合多身份；若发信与建连 `audience` 不匹配，`DbPollerManager._broadcastToSessions` 会静默丢弃事件；
  4. `DbPollerManager` 限制单用户最多 `3` 条并发 SSE 连接；`NotificationClient` 在切后台（`CLOSED_VISIBILITY`）或空闲 **3 分钟**（`CLOSED_IDLE`）后主动断连休眠，恢复时自动回调 `onSyncRequired`。
- **服务端网关超时与时间自然跨阈盲区**：生产环境后端 HTTP 流支持 `60–90s` 保持，且 `<3h` 紧急待办可能由“纯时间推移（无任何数据库写入）”触发升级，需在不引入前端裸轮询定时器的前提下闭环。

### 2.2 为什么必须现在解决？
- 统一在 M0/M4 编码前锁定“信令总线 vs 业务存储”边界，可避免下游 M2/M3/M5 各自发明轮询或私建多表冗余快照，直接对齐 `TDD_STANDARDS.md §2.3` 与 `CODING_STANDARDS.md`。

### 2.3 不解决的代价 (Impact of NOT Solving)
- 直接将业务正文写入 `notification.messages` 或用 `audience` 传多角色，会导致线上消息静默丢失、PII 泄露及与 M4 90/180 天留存规则冲突；
- 无 `scope` 裁剪与 `EXISTS` 局部索引，多端每 60 秒重连同步将对业务库产生不必要的全表扫描压力。

---

## 3. 范围边界 (Scope)

### ✅ 本期锁定范围 (In Scope)
1. 启用 `@topeetop/notification-core` SSE（`DbPollerManager` + `SseHub` + `createNotificationFastifyPlugin`）作为**轻量变更信令总线**，单连接保持 **`60s`** 并在断开后由客户端 `3s` 自动重连 + `onSyncRequired` 对齐；
2. 明确基础设施边界：**不在 `db-schema` 初始化 `notification` 与 `tauth` schema**，直接复用基础设施既有 `notification.messages` 作为短生命周期信令队列（`dream-worker` 每日 `cleanup(7)` 清理）；
3. 设计统一聚合只读接口 `GET /api/dream/v1/me/home-badges`（角色物理分流 + `?scope=notifications|all` 域裁剪 + 一表一 Mapper 部分索引 `EXISTS` 并发直查）；
4. 锁定 `<3h` 跨班长紧急驰援广播策略及 TaskRelay `T - 3h` 时间跨阈定时唤醒机制；
5. 锁定前端 `@topeetop/notification-client` 全局单例、`BroadcastChannel` 多 Tab 同步与静默重连 UI 规范。

### ❌ 本期明确不做 (Out of Scope · 留待 M4/M0 完整 TDD 讨论)
- 不展开 `dream.notifications` 业务表完整 DDL、防重标识去重算法、双语视角正文模板与 90/180 天归档清理脚本；
- 不展开 M4 关键触发邮件（TaskRelay 异步投递）的 HTML 模板与渠道重试配置；
- 不展开各业务模块（M2A/M2B/M3A/M3B/M5A/M5B）的完整业务表结构与状态流转细节（仅约定各 Mapper 暴露标准布尔探针接口）。

---

## 4. 技术方案与系统架构 (Technical Solution)

### 4.1 总体结论：「轻量信令 + 60s 短周期重连自愈 + 权威快照按需聚合」

启用 `@topeetop/notification-core` 的 SSE 通道，将其严格定位为**纯触发刷新用的变更信令总线 (Invalidation Signal Bus)**：
- **不通过 SSE 推送业务详情，也不在前端基于事件做 `+1/-1` 累加**；
- **收到信令、60s 周期重连、切回前台唤醒、或本端操作完成后**，前端统一向 `GET /api/dream/v1/me/home-badges` 拉取权威聚合状态，彻底保证顶栏 🔔、首页代表卡与 Tab 3 金刚位红点 100% 一致。

### 4.2 核心架构时序流向图 (Mermaid Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Actor as 操作端 / 批处理 / TaskRelay
    participant BizSvc as 业务 Service (M2/M3/M4/M5)
    participant DreamDB as PostgreSQL (dream.*)
    participant Outbox as notification.messages (既有基础设施表)
    participant Poller as DbPollerManager (5s) + SseHub (60s)
    actor Client as 在线端 (NotificationClient 单例 + badgeStore)
    participant BadgeAPI as GET /api/dream/v1/me/home-badges

    Note over Actor,DreamDB: 1. 业务写入与信令解耦（零幽灵通知）
    Actor->>BizSvc: 提交业务操作（发通知 / 标记已读 / 请假 / 代课 / 审单 / 回退）
    BizSvc->>DreamDB: BEGIN TX -> 写业务单据与 dream.notifications -> COMMIT TX
    opt 若产生 >3h 待代课且 <= 31 天
        BizSvc->>Actor: 预埋 TaskRelay T-3h 定时回调（提前指派则 deleteTask 撤销）
    end
    BizSvc-->>Actor: 本端返回成功（前端乐观更新 + 刷新 home-badges）
    BizSvc->>Outbox: 事务提交后写入轻量信令 (userId=目标账号, audience='user', eventType='BADGE_SYNC')

    Note over Outbox,Client: 2. 跨端准实时触达（≤ 5s）与 60s 周期自愈重连
    Poller->>Outbox: 每 5000ms 轮询一次（仅当存在活跃 SSE 连接时运行）
    Poller-->>Client: SSE 推送 { type: 'BADGE_SYNC', payload: { domains: ['notifications' | 'ops_badges'] } }
    Note over Poller,Client: 连接保持 ~60s 后平稳关闭，Client 退避 3s 自动重连并触发 onSyncRequired

    Note over Client,BadgeAPI: 3. 角色与信号域裁剪聚合拉取
    alt 收到 BADGE_SYNC OR 60s重连/切回唤醒 (onSyncRequired)
        Client->>BadgeAPI: 300~500ms 防抖合并请求 (?scope=notifications 或 all)
        BadgeAPI->>DreamDB: 纯家长/老师仅查 dream.notifications (1表); 班长/管理员按 scope 并发 EXISTS
        BadgeAPI-->>Client: 返回铃铛数 + 首页代表卡 + opsBadges 布尔集
        Client->>Client: 更新 Pinia badgeStore & BroadcastChannel 同步同源 Tab
    end
```

### 4.3 分层职责与关键设计

#### 1. 表现层 (`dream-frontend` · `@topeetop/notification-client` + `badgeStore`)
- **全局单例与防污染配置**：
  - 安装 `@topeetop/notification-client`，仅在登录态确立且获取 `/me/context` 后于顶层 App Shell 初始化 **1 个 `NotificationClient` 实例**（防突破单账号 3 条连接上限）；
  - 显式配置 **`autoSyncPointer: false`**（本方案靠 `onSyncRequired` 拉取权威快照，不依赖 `sinceId` 补发）与 **`visibilityReconnectDelay: 500`**（防快速切页频繁建连抖动）；
  - 登出或收到 `401/403` 时立即调用 `destroy()`，并同步清理 `localStorage` 中的 `sse-last-event-id` / `topeetop-notification-last-id`，杜绝跨账号残留污染。
- **多 Tab 协同**：同源多 Tab 通过 `BroadcastChannel('dream_badge_sync')` 同步 `badgeStore` 更新与本端已读/审单动作，避免同浏览器多窗口占满服务端连接槽。
- **`60s` 断开重连、异常分流与静默容错**：
  - 服务端保持单条 SSE 连接约 **`50~60s`（含随机抖动）** 后柔和关闭，`NotificationClient` 自动进入 `RECONNECTING`，`3s` 后获取新 Ticket 重连并在 `onopen` 自动回调 `onSyncRequired`，拉取 `GET /api/dream/v1/me/home-badges?scope=all`——天然填平重连 `3s` 间隙可能漏掉的 `DbPollerManager` 扫描窗口。
  - **`getTicketFn` 异常分流（规避源码永久休眠坑）**：`NotificationClient._connectFlow` 捕获到 `getTicketFn` 抛出的任何异常都会调用 `forceSleep("AUTH_EXPIRED")` 并停止自动重连；因此 `getTicketFn` 必须经由统一 `httpClient`（继承 M0A 的 `isRefreshing` + `failedQueue` 无感续期），仅在真实 `401/403` 鉴权失效时执行休眠登出，对瞬时 `5xx`/网络超时在应用层受控退避重启 `start()`，避免在线端“假死”。
  - **UI 静默规则**：正常 `60s` 周期重连态（`retryCount < 2`）不在界面闪烁断线提示；仅连续重试失败且 `navigator.onLine` 异常时做弱状态提示，且界面严禁出现“SSE”、“5 秒推送”等技术词汇（严守 `AC-M0-20`）。
- **本端 0ms 乐观响应、乱序防护与 PWA L4 约束**：
  - 在消息中心展开已读 / `[ 标为未读 ]`（`AC-4-03` / `AC-4-07` 要求 `200ms` 内反馈）或完成业务审单时，立即乐观更新 `badgeStore`，并在接口成功后触发防抖合并（`300~500ms`）后的 `badgeStore.refresh()` 与服务端校准；
  - **`reqSeq` 单调序号防乱序覆盖**：`badgeStore` 为每次 `home-badges` 请求分配单调递增序号 `reqSeq`（并辅以 `AbortController` 取消在途旧请求），丢弃早于最新序号返回的慢响应，彻底杜绝 `60s` 重连慢请求把刚标记已读的红点覆盖回旧值；
  - **多孩首页筛选联动（`AC-M0-04(6)`）**：`parentUrgentCard` 携带 `studentProfileId`；若家长首页正处于单孩筛选态（如选中“大宝”），全局 `home-badges` 仅同步顶栏 🔔 未读数，若 `studentProfileId` 不匹配当前选中孩子则触发对应单孩卡片按需刷新，不以全家庭代表卡错覆单孩视图；
  - **PWA 缓存分级**：`GET /api/dream/v1/me/home-badges` 与 `/api/notification/v1/*` 严格归属 **L4 `NetworkOnly`**，严禁被 Service Worker 缓存。

#### 2. 网关与 SSE 信令层 (`dream-backend` · `@topeetop/notification-core`)
- **插件挂载与导出核对**：`dream-backend` 引入 `@topeetop/notification-core`，在 Composition Root 初始化 `DbPollerManager`（复用 `@topeetop/shared-core` `db.executeQuery.bind(db)`，`pollIntervalMs: 5000`）与 `SseHub`，并注册 **`createNotificationFastifyPlugin`**（注意源码导出名为 `createNotificationFastifyPlugin` 而非 `createNotificationRouter`）至 `/api/notification/v1`。
- **路由级鉴权隔离 & `SECRET_MASTER_KEY` 强校验（源码必踩坑修复）**：
  - `createNotificationFastifyPlugin` 内部不自带鉴权中间件，且浏览器 `EventSource` 无法携带 `Authorization` Header，因此**严禁对整个 `/api/notification/v1` 前缀统配 Bearer 鉴权**：
    - **`POST /api/notification/v1/ticket`**：单独挂载 JWT 鉴权 `preHandler`（`authenticateAndResolveProfile`），并固定将 `request.user` 规范化为 `{ userId: accountId, role: 'user' }`（不传递 Dream 多角色数组）；
    - **`GET /api/notification/v1/events`**：不走 Bearer 鉴权，放行由 `SseHub` 校验查询参数 `?ticket=`（10s 短效 HS256 票据）。
  - `security-core` 的 `generateSseTicket` 硬依赖 `process.env.SECRET_MASTER_KEY`（缺失直接抛 `CONFIG_MISSING`），须在 [env.config.ts](../../dream-backend/src/config/env.config.ts) 中于非测试环境启用 SSE 时对该配置执行启动期 Fail-Fast 强校验。
  - **关于 `uaHash` 设备指纹说明**：`createNotificationFastifyPlugin` 默认签发 Ticket 时未传入 `uaHash`（`SseHub` 仅在 Ticket 携带 `uaHash` 时校验）；默认复用短效 `10s` 单用 Ticket 即可满足安全需求，若需强绑定 UA 指纹，后续可对 `POST /ticket` 做薄封装显式传入 `uaHash`。
- **统一 `audience: 'user'` 与全站唯一 SSE 事件注册表**：
  - 所有 `notificationManager.createMessage(...)` 写入统一传 **`audience: 'user'`**，确保兼职账号（如三合一管理员）单条长连接同时接收全部业务域信令；
  - 全站仅挂载 1 套 `SseHub` 与 1 个前端 `NotificationClient`，统一收敛所有 SSE 事件类型：
    | `eventType` | 归属模块 | `payload` 结构（零 PII） | 前端消费动作 |
    |---|---|---|---|
    | `BADGE_SYNC` | M0 / M4 / M2 / M3 / M5 | `{ domains: ('notifications' \| 'ops_badges')[], triggerAt: string }` | 防抖拉取 `GET /me/home-badges`（仅含 `notifications` 时传 `?scope=notifications`） |
    | `ROLE_CONTEXT_INVALIDATED` | M0A（[m0a_auth_and_roles.md](./m0a_auth_and_roles.md)） | `{ reason: 'ADMIN_REVOKED' \| 'ROLE_CHANGED', triggerAt: string }` | 立即重拉 `/api/dream/v1/me/context` 降级工作台并刷新 `home-badges` |
- **`50~60s` 服务端主动柔和收口（含随机抖动防惊群）**：
  - `SseHub` 内部设置 `socket.setTimeout(0)` 且每 `15s` 发送心跳，自身不会在 `60s` 主动断开；为避免依赖网关 `60–90s` 硬超时强杀导致监控产生大量 `504 / RST` 脏错误日志，同时防止发布或整点后全员同时重连引发惊群效应：
  - 在 `dream-backend` 对 `GET /api/notification/v1/events` 设置响应头 `X-Accel-Buffering: no` 与 `Cache-Control: no-cache, no-transform`，并挂载请求级收口计时（**`50_000 + Math.floor(Math.random() * 10_000)` ms**，即 `50~60s` 随机抖动后平稳调用 `reply.raw.end()`，且在 `request.raw.on('close')` 中立即 `clearTimeout`）。
- **基础设施表零新建 & 定期清理**：
  - 复用共享数据库中既有的 `notification.messages`（`db-schema` 不新建 `notification` 或 `tauth` schema）；
  - `dream-worker` 每日定时调用 `notificationManager.cleanup(7)` 物理清理 7 天前的过期信令行。

#### 3. 领域聚合层 (`dream-core` · `HomeBadgeService`) — 如何高效聚合且不每 60s 盲扫多表
遵循 [CODING_STANDARDS.md §2.1](../CODING_STANDARDS.md)「一表一 Mapper」与「禁止 Service/Controller 写 SQL」铁律，采用 **角色分流 + `scope` 信号域裁剪 + 部分索引 `EXISTS` 并发直查**：

1. **两级裁剪（90%+ 用户只查 1 张表）**：
   - **角色物理分流**：纯家长与纯老师（占全平台 90%+ 账号）无任何教务金刚位红点，`HomeBadgeService` 仅调用 `NotificationMapper` 查 `dream.notifications` 1 张表，**100% 跳过 M2/M3/M5**；
   - **`?scope=notifications | all` 增量域裁剪**：当 SSE 信令仅包含 `domains: ['notifications']` 时，前端请求 `?scope=notifications`，连班长与管理员也仅查 `dream.notifications` 1 张表；仅首屏、含 `ops_badges` 信令或 `60s` 重连/唤醒对齐时拉取 `?scope=all`；
   - **管理员特权短路**：普通在任管理员（`isPermanentPrimary === false`）在 `Promise.all` 中直接短路跳过 `TransferOrderMapper` 审单探针与 `WeeklySettlementMapper` 发薪探针，恒返回 `false`（`AC-M0-02`）。

2. **代码示例（拟议契约，严守 `BaseMapper` 规范）**：
```typescript
// dream-core/src/db/CourseOrderMapper.ts（拟议示例，继承 BaseMapper，一表一 Mapper）
export class CourseOrderMapper extends BaseMapper<CourseOrderRow> {
  protected readonly tableName = 'course_orders';

  async hasPendingBadge(monitorProfileId?: string): Promise<boolean> {
    const sql = monitorProfileId
      ? `SELECT EXISTS (
           SELECT 1 FROM ${this.fullTableName}
           WHERE deleted_at IS NULL
             AND monitor_profile_id = $1
             AND status IN ('PENDING_PAYMENT', 'PROOF_UPLOADED', 'PENDING_ADJUSTMENT')
           LIMIT 1
         ) AS has_pending`
      : `SELECT EXISTS (
           SELECT 1 FROM ${this.fullTableName}
           WHERE deleted_at IS NULL
             AND status IN ('PENDING_PAYMENT', 'PROOF_UPLOADED', 'PENDING_ADJUSTMENT')
           LIMIT 1
         ) AS has_pending`;
    const row = await this.executeQuerySingle<{ has_pending: boolean }>(
      sql,
      monitorProfileId ? [monitorProfileId] : []
    );
    return Boolean(row?.has_pending);
  }
}
```

```typescript
// dream-core/src/modules/m0/HomeBadgeService.ts（拟议编排逻辑 · 支持 DIP 可选端口分期演进）
export interface OpsBadgeProbePorts {
  dispatch?: { hasPendingDispatchBadge(monitorProfileId?: string): Promise<boolean> };
  courseOrders?: { hasPendingBadge(monitorProfileId?: string): Promise<boolean> };
  refundOrders?: { hasPendingBadge(monitorProfileId?: string): Promise<boolean> };
  transfers?: {
    hasPendingMonitorBadge(monitorProfileId: string): Promise<boolean>;
    hasPendingAdminAuditBadge(): Promise<boolean>;
    hasAbnormalRollbackBadge(): Promise<boolean>;
  };
  weeklySettlements?: { hasPendingPayoutBadge(): Promise<boolean> };
}

export class HomeBadgeService {
  // 通过构造函数 DI 注入 NotificationMapper 及可选的各业务模块探针端口（未上线模块默认返回 false）

  async getHomeBadges(
    identity: RoleResolutionSnapshot,
    scope: 'notifications' | 'all' = 'all'
  ): Promise<HomeBadgesDto> {
    const noticePromise = this.notificationMapper.getUnreadBadgeSummary(
      identity.accountId,
      identity.effectiveRoles
    );

    const isOpsUser =
      identity.effectiveRoles.includes('monitor') ||
      identity.effectiveRoles.includes('admin');

    if (scope === 'notifications' || !isOpsUser) {
      return { ...(await noticePromise), opsBadges: null, serverTime: new Date().toISOString() };
    }

    const isAdmin = identity.effectiveRoles.includes('admin');
    const isMasterAdmin = Boolean(identity.adminAccount?.isPermanentPrimary);
    const monitorId = identity.monitorProfile?.id;
    const scopeMonitorId = isAdmin ? undefined : monitorId;

    const [
      notices,
      dailyDispatch,
      courseOrders,
      refundOrders,
      monitorTransferSubmit,
      adminTransferAudit,
      weeklySettlements,
      abnormalRollback,
    ] = await Promise.all([
      noticePromise,
      this.probes.dispatch?.hasPendingDispatchBadge(scopeMonitorId) ?? Promise.resolve(false), // 含全校 <3h 紧急驰援
      this.probes.courseOrders?.hasPendingBadge(scopeMonitorId) ?? Promise.resolve(false),
      this.probes.refundOrders?.hasPendingBadge(scopeMonitorId) ?? Promise.resolve(false),
      // 严守 AC-M0-02 / AC-M0-07：三合一普通管理员绝不因兼任班长而在管理员工作台点亮「审核转账/周转审核」
      !isAdmin && monitorId
        ? (this.probes.transfers?.hasPendingMonitorBadge(monitorId) ?? Promise.resolve(false))
        : Promise.resolve(false),
      isAdmin && isMasterAdmin
        ? (this.probes.transfers?.hasPendingAdminAuditBadge() ?? Promise.resolve(false))
        : Promise.resolve(false),
      isAdmin && isMasterAdmin
        ? (this.probes.weeklySettlements?.hasPendingPayoutBadge() ?? Promise.resolve(false))
        : Promise.resolve(false),
      isAdmin
        ? (this.probes.transfers?.hasAbnormalRollbackBadge() ?? Promise.resolve(false))
        : Promise.resolve(false),
    ]);

    return {
      ...notices,
      opsBadges: {
        dailyDispatch,
        courseOrders,
        refundOrders,
        monitorTransferSubmit,
        adminTransferAudit,
        weeklySettlements,
        abnormalRollback,
      },
      serverTime: new Date().toISOString(),
    };
  }
}
```

3. **为什么不做独立的 `account_badge_snapshots` 投影表？**
   - 若维护冗余投影表，M2/M3/M5 与 `dream-worker` 的所有写事务都必须强耦合重算目标账号布尔值（例如从 2 条待办处理掉 1 条时仍需回查 `EXISTS` 才能判定是否置 `false`），多班长处理 `<3h` 时易产生锁争用，且时间自然跨过 `3h` 门槛时无写操作会导致快照过期；
   - 按校级规模（~180 学员 / ~10–20 名班长与管理员）叠加 `NotificationClient` 切后台断连与 3 分钟空闲自动休眠，高峰期全校触发多表 `EXISTS` 的真实请求频率不足 **`1 QPS`**，单次耗时 `< 5ms`，兼顾简单性（KISS）与多实例强一致性；同时通过 `OpsBadgeProbePorts` 可选注入，支持 M0 + M4 先行独立交付与白盒单测。

#### 4. 跨模块信令投递与 `<3h` 时间跨阈唤醒策略
> **事务后异步投递铁律（防脏读与幽灵信令）**：
> - 所有 `BADGE_SYNC` 写入 `notification.messages` **必须严格位于业务 `executeTx` `COMMIT` 成功之后**（禁止在事务内同步写外部信令表，否则事务未提交前客户端即收到推送拉回旧数据，或事务回滚引发幽灵信令）；
> - 信令写入定位为 **Best-Effort 非阻塞**：写入失败仅记录结构化 `WARN` 日志（带 `trace_id`），**严禁反向导致已提交的主业务接口报错**（客户端在 60s 重连或切回前台时自愈对齐）；
> - 涉及多账号广播（如全校在任班长/管理员）时，统一使用 `Promise.allSettled` 并发写入（去重 `accountId`），严禁串行 `for await` 阻塞事件循环。

| 场景 | 触发源 | 信令投递与唤醒机制 | 时效与一致性保障 |
|---|---|---|---|
| **A. 定向单据/通知变更** | M4 新建/已读/未读回退；M2A/M2B/M5A/M5B 单据流转；M0A 管理员撤销 | 主事务 `COMMIT` 后，向明确关联的 `accountId` 异步写入 `BADGE_SYNC`（指定 `domains`） | 在线端 **`≤ 5 秒`**刷新；目标离线则下次打开或切回自动对齐 |
| **B. `<3h` 紧急驰援产生或被他组接手核销** (`AC-M0-07` `L-4`) | `<3h` 老师请假/考勤异常发生，或任一班长/管理员抢先核销完毕 | 从 `IdentityContextService`（0–60s 整点分钟缓存）获取全校在任 `monitor` 与 `admin` 的去重 `accountId` 列表（几十人规模），经 `Promise.allSettled` 并发写 `BADGE_SYNC`（`domains: ['ops_badges']`） | 其他在线班长端 **`≤ 5 秒`**自动消卡消红（远优于 `≤ 1 分钟` PRD 指标） |
| **C. 无写操作的时间自然跨阈**（如请假课次从 `3h05m` 自然进入 `2h59m`） | 纯时钟推移，无用户操作 | 老师请假落盘时若距开课 `> 3h` 且 `<= 31 天`，向 **TaskRelay** 预埋 `T - 3h` 单次定时回调（带 `idempotencyKey`；若提前指派代课则 `deleteTask` 撤销）；到期核验仍未代课则向在任班长/管理员并发写 `BADGE_SYNC` | 消灭时间盲区，且**零前端轮询定时器**（严守 `TDD_STANDARDS.md §2.3`） |

### 4.4 核心 API 契约设计 (API Contracts)

| 接口端点 (Endpoint) | HTTP 方法 | 权限守卫 | 功能描述 | 请求 Schema (Zod) | 响应数据格式 |
|---|---|---|---|---|---|
| `/api/dream/v1/me/home-badges` | `GET` | `authenticateAndResolveProfile` | 聚合顶栏未读数、首页代表通知卡与金刚位红点布尔集（PWA L4 `NetworkOnly`） | `HomeBadgesQuerySchema` (`?scope=notifications\|all`) | `200 OK ({ data: HomeBadgesDto })` |
| `/api/notification/v1/ticket` | `POST` | 路由级 `authenticateAndResolveProfile`（仅本路由鉴权并注入 `role: 'user'`） | 签发 `10s` 短效 SSE 建连 Ticket（强依赖 `SECRET_MASTER_KEY`） | `{ since?: string }` | `200 OK ({ data: { ticket } })` |
| `/api/notification/v1/events` | `GET` | `SseHub` (`verifySseTicket`；不走 Bearer Header，默认不强制 `uaHash`) | 建立 `50~60s`（随机抖动）SSE 信令流并主动柔和收口 | Query `?ticket=...` | `text/event-stream` (`BADGE_SYNC` / `ROLE_CONTEXT_INVALIDATED`) |
| `/api/dream/v1/internal/callbacks/dispatch-escalate` | `POST` | TaskRelay 内部签名 / PSK 校验 | 接收 `T - 3h` 定时回调，核验课次仍待代课后并发广播 `BADGE_SYNC` | `DispatchEscalateCallbackSchema` | `200 OK` |

```typescript
// dream-core 入参校验与响应 DTO 契约 (100% 语言中立)
import { z } from 'zod';

export const HomeBadgesQuerySchema = z.object({
  scope: z.enum(['notifications', 'all']).default('all'),
});

export interface HomeBadgesDto {
  notificationBell: {
    unreadTotal: number; // 0 => hide, 1..99 => exact, >99 => '99+'
  };
  homeNotices: {
    parentUrgentCard: {
      id: string; // 12-char Short UUID
      studentProfileId: string | null; // Used by multi-child Home Feed filter (AC-M0-04)
      tagCode: string; // Controlled tag from GLOSSARY §4.1
      titleZh: string;
      titleEn: string;
      summaryZh: string;
      summaryEn: string;
      severity: 'urgent' | 'warning' | 'normal';
      urgentCount: number;
      createdAt: string;
    } | null;
    teacherScheduleNotice: {
      id: string;
      tagCode: string;
      titleEn: string;
      titleZh: string;
      severity: 'urgent' | 'warning' | 'normal';
      unreadCount: number;
      createdAt: string;
    } | null;
  };
  opsBadges: {
    dailyDispatch: boolean;
    courseOrders: boolean;
    refundOrders: boolean;
    monitorTransferSubmit: boolean; // Monitor workspace only (!isAdmin)
    adminTransferAudit: boolean; // Permanent Master Admin only (isAdmin && isMasterAdmin)
    weeklySettlements: boolean; // Permanent Master Admin only (isAdmin && isMasterAdmin)
    abnormalRollback: boolean; // Admin workspace (isAdmin)
  } | null; // null when scope === 'notifications' or pure parent/teacher
  serverTime: string; // ISO-8601 UTC timestamp
}
```

### 4.5 数据库索引规约 (Partial Index Conventions)

- **基础设施表**：复用既有 `notification.messages`，**不在 `db-schema` 中新增 `notification` 或 `tauth` schema DDL**。
- **Dream 业务表部分索引要求（随各自模块迁移脚本落地）**：
  - `dream.notifications`：`(account_id, read_at, urgency_rank, created_at DESC) WHERE deleted_at IS NULL AND read_at IS NULL`；
  - `dream.course_orders` / `dream.refund_orders` / `dream.transfer_orders` / `dream.weekly_settlements` / `dream.timeslots`：各自针对**待办状态子集**建立 `WHERE deleted_at IS NULL AND status IN (...)` 部分索引，确保 `EXISTS (... LIMIT 1)` 恒走极小局部索引。

---

## 5. 风险评估与规避措施 (Risks & Mitigation)

| 风险描述 | 影响级别 | 发生概率 | 规避与缓解手段 |
|---|---|---|---|
| **60s 网关硬超时产生大量 `504` 错误日志及发版后重连惊群** | 中 | 高 | 服务端在 `GET /events` 外层于 `50~60s`（带 10s 随机抖动）主动柔和 `res.end()` 并清理计时器，网关记 `200 OK`，打散重连波峰；客户端 `3s` 自动重连并触发 `onSyncRequired` 填平断连间隙 |
| **路由鉴权误伤 `GET /events` 或 `audience` 不匹配导致推送信令丢失** | 高 | 中 | 仅对 `POST /ticket` 挂 Bearer 鉴权并固定注入 `role: 'user'`，对 `GET /events` 放行走 Ticket 校验；所有 `createMessage` 硬编码 `audience: 'user'`；启动期强校验 `SECRET_MASTER_KEY` |
| **`getTicketFn` 遇瞬时网络抖动被 `NotificationClient` 误判 `AUTH_EXPIRED` 永久休眠** | 中 | 中 | `getTicketFn` 复用 `httpClient`（含 M0A `isRefreshing` + `failedQueue`），区分真 `401/403` 与瞬时 `5xx`/网络超时，非鉴权错误由应用层退避重启 `start()` |
| **并发请求乱序覆盖红点（`60s` 慢请求覆写本端刚标记已读的新态）** | 中 | 中 | `badgeStore` 使用单调递增 `reqSeq` + `AbortController` 取消在途旧请求，丢弃乱序过期响应 |
| **同一自然人打开多个浏览器 Tab 超过每用户 3 条 SSE 上限被拒连** | 中 | 中 | `NotificationClient` 在 App Shell 单例运行，显式设 `autoSyncPointer: false` 与 `visibilityReconnectDelay: 500`，辅以 `BroadcastChannel` 同源状态共享，登出时清理 `localStorage` 残留指针 |
| **请假课次在 `T - 3h` 定时回调前已被提前指派代课，到期仍误发全校通知** | 低 | 中 | 指派代课成功时调用 `taskRelayClient.deleteTask` 撤销预埋任务；同时回调接口必须先查询 DB 核实课次仍处于“待代课”才并发广播 `BADGE_SYNC`（双保险幂等） |

---

## 6. 实施与交付计划 (Implementation Plan)

本方案将在 M0 首页工作台与 M4 消息底座实施阶段分步接入：

| 阶段 | 模块 | 交付内容 |
|---|---|---|
| **Phase 1: SSE 底座接入** | `dream-backend` + `dream-worker` | 安装 `@topeetop/notification-core`，挂载 `/api/notification/v1`（`POST /ticket` 单独鉴权 + `role: 'user'`、`SECRET_MASTER_KEY` 强校验、`GET /events` `50~60s` 抖动柔和收口 + `X-Accel-Buffering: no`）；`dream-worker` 增加每日 `cleanup(7)` 任务 |
| **Phase 2: 聚合接口与探针** | `dream-core` + `dream-backend` | 落地 `HomeBadgeService`（含 `OpsBadgeProbePorts` 可选注入与 `adminTransferAudit`/`monitorTransferSubmit` 显式拆分）、`GET /api/dream/v1/me/home-badges` 及各模块 Mapper 的 `hasPending*` 探针与部分索引 |
| **Phase 3: 跨模块信令与唤醒** | `dream-core` + `dream-backend` | 在 M4/M2/M3/M5 主事务 `COMMIT` 后接入非阻塞 `BADGE_SYNC` 并发投递；M3B 请假落盘接入 TaskRelay `T - 3h` 预埋与撤销 |
| **Phase 4: 客户端集成** | `dream-frontend` | 安装 `@topeetop/notification-client`，实现全局单例（`autoSyncPointer: false`、`visibilityReconnectDelay: 500`、登出清残留）、`getTicketFn` 瞬断自愈、`badgeStore` 乐观更新 + `reqSeq` 防乱序 + 防抖合并、多孩筛选联动、多 Tab `BroadcastChannel` 与静默重连状态处理 |

---

## 7. 生产防线：安全、监控与回滚预案 (Production Readiness)

### 7.1 安全与合规设计（对齐 `TDD_STANDARDS.md §3`）
1. **IDOR 隔离**：`GET /me/home-badges` 与 `POST /api/notification/v1/ticket` 严格从已验签 JWT 提取 `accountId`；`opsBadges` 严格依据服务端解析的 `effectiveRoles` 与 `isPermanentPrimary` 生成，普通管理员（即便兼任班长）绝不点亮 `adminTransferAudit` 与 `weeklySettlements` 红点。
2. **SSE 零敏感信息载荷与票据防线**：`notification.messages` 信令体禁止携带学员姓名、金额、订单号等任何 PII/财务信息，仅传域刷新标记；`SseHub` 强制校验 10s 短效 HS256 Ticket（`SECRET_MASTER_KEY` 启动强校验；默认不强依赖 `uaHash`，可按需封装扩展）。
3. **内部回调安全**：TaskRelay `T - 3h` 回调接口校验专用内部签名/PSK，且严格遵循幂等重放安全。

### 7.2 监控、告警与可观测性
- **核心指标**：`GET /api/dream/v1/me/home-badges` P99 延迟（目标 `< 50ms`，`> 200ms` 告警）、5xx 错误率（`> 1%` 告警）；`POST /api/notification/v1/ticket` 失败率；`DbPollerManager` 活跃连接数与轮询异常日志。
- **全链路追踪**：经 `@topeetop/telemetry-core` 向 `stdout` 输出结构化 JSON 并透传 `trace_id`。

### 7.3 回滚与应急预案
- **触发红线**：SSE 连接导致数据库连接池饱和、`home-badges` P99 `> 500ms` 或前端陷入高频重连风暴。
- **回滚步骤**：
  1. 通过配置开关或版本回滚关闭 SSE 信令推送，前端降级为仅在“页面切换 / 切回前台 `visibilitychange`”时拉取 `GET /api/dream/v1/me/home-badges`（保持无报错可用）；
  2. `notification.messages` 为纯信令队列，暂停写入或清理数据对 `dream.*` 业务账务与 M4 历史通知零影响。

---

## 8. 本地架构规范对齐自检表 (Local Compliance Checklist)

| 本地规范领域 | 审计红线与标准（`TDD_STANDARDS.md` & `CODING_STANDARDS.md`） | 本方案对位情况 | 判定 |
|---|---|---|---|
| **分层架构与 Mapper 隔离** | 严格执行 C-S-M，一表一 Mapper，SQL 100% 收敛于 `dream-core` `*Mapper` 并 DI 注入 `DatabaseService` | `HomeBadgeService` 通过 `OpsBadgeProbePorts` DI 并发调用各表专属 Mapper 的 `EXISTS` 探针，零跨表大杂烩 SQL，支持分期上线 | **通过** |
| **实体 ID 与 Schema 规约** | 业务表统一 `dream.` 单 Schema + `VARCHAR(12)` 短 ID | Dream 业务表严守 `dream.` + 12 位短 ID；`notification.messages` 仅复用既有基础设施信令表，`db-schema` 不初始化 `notification`/`tauth` | **通过** |
| **服务端缓存与 Serverless 安全** | 不自建裸轮询/连接池 | `DbPollerManager` 复用 `db.executeQuery.bind(db)`，仅在存在活跃 SSE 连接时运行；`GET /events` 请求级 `50~60s` 抖动柔和收口兼容 60–90s 请求超时 | **通过** |
| **端侧 PWA 缓存分级** | L4 `NetworkOnly` 强实时域严禁离线缓存 | `GET /me/home-badges` 与 `/api/notification/v1/*` 明确归属 L4 `NetworkOnly`；登出清理 `localStorage` 残留 SSE 指针 | **通过** |
| **通知与实时推送选型** | 严禁自建 WebSocket 或前端裸轮询定时器，统一使用 `@topeetop/notification-core` | 全量复用 `DbPollerManager` + `SseHub` + `createNotificationFastifyPlugin` 与 `@topeetop/notification-client`（含 M0A `ROLE_CONTEXT_INVALIDATED` 统一注册表） | **通过** |
| **异步与定时调度选型** | 31 天内单次延迟任务优先使用 TaskRelay | `<3h` 时间跨阈升级使用 TaskRelay `T - 3h` 定时回调（带 `idempotencyKey` 与撤销），无定时扫表 | **通过** |
| **安全与脱敏** | IDOR 隔离、接口 DTO 脱敏、UI 去技术词 | `home-badges` 仅服务端鉴权聚合且拆清 `adminTransferAudit`/`monitorTransferSubmit`；SSE 载荷零 PII；前端静默重连且严禁露出“SSE”等技术名词 | **通过** |
| **语言中立与遥测** | `dream-core` 零硬编码中文，`@topeetop/telemetry-core` stdout JSON | Zod Schema 报错与 DTO 字段保持英文中立，全链路透传 `trace_id` | **通过** |
