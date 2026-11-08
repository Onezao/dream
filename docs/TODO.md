/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# 待办与待决事项 (TODO & Open Questions)

本文档集中记录各 PRD 中尚未拍板的产品决策与后续交付项。事项关闭后，同步回写对应 PRD，并将本表状态更新为“已完成”。

维护格式：每条事项必须有唯一 ID、来源 PRD、负责人、状态与备注；状态使用“未开始 / 进行中 / 已完成 / 已取消”。

---

## M0 工作台与主页全域基座

来源：[m0_workspace_and_home.md](./prd/m0_workspace_and_home.md)

| ID | 待办事项 | 影响 | 负责人 | 状态 | 备注 |
|---|---|---|---|---|---|
| M0-T1 | 法律文本由谁提供与审核、预计何时定稿 | 用户服务协议、隐私政策上线 | 待定 | 未开始 | 本期不记录用户同意的版本号 |
| M0-T2 | 多角色兼任家长时的角色映射口径（`roles` 是否包含 `user`） | 工作台切换器与家长档案切换器的可见性 | 待定 | ✅ 已完成 | 2026-11-08 架构决议：Dream 彻底解耦 `auth-core` 角色体系，仅依赖 `auth-core` 认证身份。Dream 本地通过 `teachers`/`monitors`/`student_profiles` 进行业务鉴权，兼任多角色通过本地业务数据天然支持 |
| M0-T3 | 试点班级/用户范围、样本量与 KR 基线 | KR 验收与试点复盘 | 待定 | 未开始 | 当前 KR 目标值为提议值，无历史基线 |
| M0-T4 | 账号头像上传与回写 `auth-core` 闭环 | 用户头像统一、S3直传安全 | 待定 | 未开始 | 2026-11-08 讨论确定：Dream 后端提供 S3 预签名直传，前端上传获取 `publicUrl` 后，调用 `PUT /api/auth/v1/user` 回写 `avatar`，确保全生态头像单一可信源 |
| M0-T5 | Dream 语言偏好体系与持久化方案设计 | 教师/家长多语言首屏零闪烁、跨端同步 | 待定 | 未开始 | 2026-11-08 讨论确定：语言偏好收敛于 Dream 本地。前端 LocalStorage `dream_locale` 离线极速渲染，后端新增 `dream.user_preferences` 表存储；外教默认 `en-US`，家长/班长默认 `zh-CN` |

### M0 后续交付项

| ID | 事项 | 负责人 | 状态 | 备注 |
|---|---|---|---|---|
| M0-D1 | 将 M0 补入 [system_modules_overview.md](./system_modules_overview.md) 的模块总览 | 待定 | ✅ 已完成 | 2026-11-06 已补入总览、架构图、Monorepo 映射与落地现状 |
| M0-D2 | 产出 M0 交互原型（`prototype/`） | 待定 | ✅ 已完成 | 2026-11-07 已产出 `prototype/m0_workspace_home.html`，覆盖四角色主页、工作台切换、个人中心、法律合规与 ClassIn 扫码 |
| M0-D3 | 编写 M0 技术方案 | 待定 | 未开始 | 包含工作台路由隔离、待办计数、账号偏好存储、ClassIn 唤醒 |

---

## M4 三级消息通知分发网络

来源：[m4_notification.md](./prd/m4_notification.md)

### M4 技术方案与架构设计事项

| ID | 待办事项 | 影响 | 负责人 | 状态 | 备注 |
|---|---|---|---|---|---|
| M4-T1 | M4 通知后端落地架构（方案 C：业务在 Dream，通信在 Topee）具体技术方案设计 | 站内信数据模型、中英双语与 4 周表格聚合、120 字就地直读、30 分钟未读兜底与外部邮件通信服务集成 | 待定 | 未开始 | 2026-11-08 讨论确定采用方案 C：`dream.notifications` 表与业务 CRUD、已读核销、双语组装及 Worker 扫描由 Dream 自闭环；纯邮件传输管道与指数退避重试委托 `topee-notification` / `task-relay` 服务；后续择期编写专项技术设计规范 (TDD) |

---

## 其他模块

暂无。新增事项时按上方格式追加，并注明来源 PRD。
