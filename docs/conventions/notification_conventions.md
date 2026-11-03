/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# 消息通知分发规约 (Notification Conventions)

本文档规定了 Dream 系统中三级消息通知的分发层级、触达渠道及超时兜底机制。

---

## 1. 三级消息分发矩阵

| 通知等级 | 触发业务场景 | 分发渠道与策略 | 接收对象 |
| :--- | :--- | :--- | :--- |
| **一级：常规通知** | 1. 课表生成<br>2. 周课酬节数单生成<br>3. 学生留言板新公开回复 | **仅站内信** | 教师、家长 |
| **二级：必达通知** | 1. 购课单确认生成待排期 TS<br>2. 新排课成功<br>3. 24h 之外常规请假/同师挪位 | **站内信 + 超时兜底 Email**：<br>先发站内信，若超出未读超时阈值（默认 30 分钟），由 `dream-worker` 自动向家长账号补发 Email。 | 家长账号、教师 |
| **三级：紧急通知** | 1. 24h 之内改期/挪位<br>2. 课程转让成功（学生变更）<br>3. 小班课整班停课请假<br>4. 教师紧急请假与安排临时代课<br>5. 中途退款单生成 | **站内信与 Email 并发即时派发**：<br>无需等待，立即通过 Email 网关与站内信同时推送。 | 授课教师、代课教师、转出家长、受让家长、小班全班家长 |

---

## 2. 简易留言板双权限隐私控制

学生档案下挂载的简易留言板直接与通知联动：
- 🔓 **【师生公开】模式**：
  - 留言产生后，触发一级常规通知推送给家长与关联教师。
  - 家长、正课教师、代课教师、班长、管理员全员可见。
- 🔒 **【仅内部教学可见】模式**：
  - **对家长/学生端完全隐藏屏蔽**，严禁向家长账号发送任何形式的站内信或邮件提醒。
  - 仅向教师、代课教师、班长、管理员可见与派发内部通知。

---

## 3. 技术实现与架构规约 (@topeetop/notification-core)

统一采用 `@topeetop/notification-core` 作为通知底层管理系统，严格遵循依赖注入 (DI) 与任务委托规范：

### 3.1 统一管理层与依赖注入 (Manager & DI)
在服务装配层（如 `loaders/`）通过工厂函数集中构建 `NotificationManager` 单例并注入业务服务：
```typescript
import { createNotificationManager, NotificationConfig } from '@topeetop/notification-core';

const notificationConfig: NotificationConfig = {
  sms: {
    provider: 'aliyun',
    accessKeyId: config.sms.accessKeyId,
    accessKeySecret: config.sms.accessKeySecret,
    signName: config.sms.signName,
    templateCode: config.sms.templateCode,
  },
  email: {
    provider: 'brevo', // 或 'smtp'
    apiKey: config.email.apiKey,
    from: config.email.senderEmail,
  },
  relay: {
    // 异步任务中转委托，保障大批量并发邮件不卡主业务线程
    baseUrl: config.taskRelay.endpoint,
    psk: config.taskRelay.token,
    enabled: true,
  },
};

const notificationManager = createNotificationManager(notificationConfig, db);
```

### 3.2 邮件与短信标准接口
- **发送邮件**：
  ```typescript
  await notificationManager.sendEmail(receiverEmail, subject, htmlContent, plainTextContent);
  ```
- **发送短信验证码**：
  ```typescript
  await notificationManager.sendSmsVerificationCode(phone, code, expireMinutes);
  ```
- **特定业务短信模版**：
  ```typescript
  await notificationManager.sendSmsTemplate(phone, templateId, templateParams);
  ```

### 3.3 实时通知总线 (SSE Integration)
系统内置服务器发送事件 (SSE) 实时通道，前端通过 `/api/notification/v1` 长连接实时接收站内信提醒：
- 采用 `DbPollerManager` 与 `SseHub` 定期拉取活跃通知并广播给指定用户。
- 站内信产生后在 5 秒内经由 SSE 流式推送到前端工作台通知铃铛，实现无刷新即时感知。

### 3.4 邮件任务归档与重试机制
- 所有二级和三级邮件派发任务统一落盘记录于 `dream.notice_logs` 表，记录发送渠道、接收人、状态（`PENDING`, `SENT`, `FAILED`）与关联业务实体 ID。
- 邮件模版采用响应式 HTML 模版，支持大陆主流邮箱（QQ 邮箱、网易 163 邮箱）与国际常用邮箱客户端。
