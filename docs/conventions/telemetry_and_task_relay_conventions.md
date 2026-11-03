/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# 遥测追踪与异步任务中转规范 (Telemetry & Task Relay Conventions)

本文档规定了 Dream 系统中统一云原生结构化日志（`@topeetop/telemetry-core`）与异步/定时任务调度（`@topeetop/task-relay-client`）的技术规约与实现标准。

---

## 1. 统一云原生遥测系统 (`@topeetop/telemetry-core`)

### 1.1 核心设计理念
- **云原生结构化日志**：完全抛弃通过 HTTP 同步/异步网络推送日志的方式，统一向 `stdout` 输出结构化 JSON。由云容器运行时（Google Cloud Run 或腾讯云 SCF）内生捕获并自动投递至 BigQuery 或 CLS，达到 **0 网络阻塞、0 额外延迟与极小依赖占用**。
- **全链路追踪 (Trace Propagation)**：基于 W3C Trace Context 规范，通过 32 位 Hex `trace_id` 串联 HTTP 请求、数据库事务、异步任务与第三方 API 调用。
- **显式依赖注入 (DI)**：必须通过构造函数将 `TelemetryService` 实例注入到业务领域 Service，严禁滥用全局单例。

### 1.2 标准日志字段规范
每个输出至 Stdout 的 JSON 日志对象必须包含以下核心标准字段：

| 字段名 | 类型 | 说明 | 示例 |
| :--- | :--- | :--- | :--- |
| `event_id` | `String` | 16 位全局唯一短 ID，标识单次埋点事件 | `jK9s8L2n7P1w5M4x` |
| `trace_id` | `String` | 32 位 Hex ID (128-bit)，对齐 W3C Trace Context | `6a821feceefd2b4119d851209f93648e` |
| `timestamp` | `ISO8601` | 事件发生时间 (严格对齐 UTC) | `2026-03-27T10:00:00Z` |
| `severity` | `Enum` | 严重级别：`DEFAULT`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` | `INFO` |
| `event_name` | `String` | 结构化业务事件名称 | `TIMESLOT_LOCKED`, `SETTLEMENT_BATCH_DONE` |
| `source` | `String` | 产生日志的服务标识（如 `dream-backend`, `dream-worker`） | `dream-backend` |
| `properties` | `Object` | 结构化业务上下文负载（自动触发 PII 脱敏过滤） | `{ "slotId": "ts_abc", "teacherId": "t_01" }` |

### 1.3 请求链路透传规约 (Context Propagation)
在 HTTP 入口（Fastify Hook）与 Worker 异步任务起点，必须通过 `telemetryContext` 进行上下文绑定：
```typescript
import { telemetryContext } from '@topeetop/telemetry-core';

// 1. 在 Fastify preHandler 钩子中初始化链路上下文
fastify.addHook('preHandler', async (request, reply) => {
  const traceId = (request.headers['x-trace-id'] as string) || generateTraceId();
  reply.header('x-trace-id', traceId);
  telemetryContext.enterWith({ traceId });
});

// 2. 跨服务或向 TaskRelay 发起派发请求时，必须在 Header 透传
const headers = {
  'x-trace-id': telemetryContext.getTraceId(),
};
```

### 1.4 PII 敏感隐私信息脱敏保护
日志输出底层内置强规则脱敏，以下关键字段在写入日志前必须自动转换为 `***`：
`password`, `token`, `secret`, `authorization`, `cookie`, `credential`, `email`, `phone`。

---

## 2. 异步任务中转与定时调度规范 (`@topeetop/task-relay-client`)

### 2.1 适用业务场景
主业务 HTTP 线程严禁同步执行阻塞性重计算与网络 IO，以下场景必须委托给 TaskRelay：
1. **多用户批量邮件/短信并发派发**（小班停课、课程转让即时通知）。
2. **延迟状态校验**（如 30 分钟后检查站内信是否已读并决定是否补发兜底 Email）。
3. **周度/月度财务账单对账计算**（转账单归集、平台工具费汇总）。

### 2.2 核心调用准则
```typescript
import { TaskRelayClient } from '@topeetop/task-relay-client';

const relayClient = new TaskRelayClient(
  config.taskRelay.endpoint,
  config.taskRelay.token
);

// 1. 任务载荷强制 Base64 编码 (保障多云环境传输无损)
const payload = { noticeId: 'not_123', template: 'URGENT_CLASS_CANCEL' };
const bodyBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');

// 2. 创建异步任务
await relayClient.createTask({
  parent: 'queues/dream-notifications',
  task: {
    // 幂等去重 Key，防止相同事件重复触发
    idempotencyKey: `notice-${noticeId}`,
    // 延迟派发支持：指定延迟秒数 (delaySeconds) 或绝对执行时间 (scheduleTime，最长 31 天)
    delaySeconds: 1800, // 30分钟后执行
    httpRequest: {
      url: `${config.workerUrl}/jobs/dispatch-notice`,
      httpMethod: 'POST',
      headers: {
        'x-trace-id': telemetryContext.getTraceId(),
      },
      body: bodyBase64,
    },
    errorProfile: {
      codePath: 'code',
      mapping: {
        'EMAIL_GATEWAY_THROTTLED': 'RATE_LIMIT',
      },
    },
  },
});
```

### 2.3 目标 Worker HTTP 响应码生命周期标准
TaskRelay 依靠 Worker 返回的 HTTP 状态码管理任务状态机，Worker 必须严格遵守以下响应规范：

| 状态码 | 模式名称 | TaskRelay 动作 | Worker 处理要求 |
| :--- | :--- | :--- | :--- |
| **`200 OK`** | **同步完结** | 任务立即归档为 `SUCCESS` | 处理已完全收尾，无需后续动作 |
| **`202 Accepted`** | **异步挂起** | 状态设为 `PENDING_CALLBACK`，暂停主动重试 | 耗时任务立即返回 202 避免 HTTP 超时；**必须在 30 分钟内**调用 `completeTask(taskId, status, result)` 结案，超时将触发僵尸任务自动熔断回收 |
| **`4xx / 5xx`** | **执行失败** | 自动触发指数退避重试 (`min_backoff * 2 ^ attempt`) | 目标端无需手动回滚，准备接收下一次重试派发 |

### 2.4 SSRF 域名白名单管理
所有队列在初始化或部署时，必须调用 `saveQueue` 显式声明该队列允许派发的目标域名白名单（`allowed_domains`），严禁向未报备的私有内网或未知公网 IP 发送流量。
