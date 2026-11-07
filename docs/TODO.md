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
| M0-T2 | 多角色兼任家长时的角色映射口径（`roles` 是否包含 `user`） | 工作台切换器与家长档案切换器的可见性 | 待定 | 未开始 | 当前按 `roles` 包含 `user` 处理 |
| M0-T3 | 试点班级/用户范围、样本量与 KR 基线 | KR 验收与试点复盘 | 待定 | 未开始 | 当前 KR 目标值为提议值，无历史基线 |

### M0 后续交付项

| ID | 事项 | 负责人 | 状态 | 备注 |
|---|---|---|---|---|
| M0-D1 | 将 M0 补入 [system_modules_overview.md](./system_modules_overview.md) 的模块总览 | 待定 | ✅ 已完成 | 2026-11-06 已补入总览、架构图、Monorepo 映射与落地现状 |
| M0-D2 | 产出 M0 交互原型（`prototype/`） | 待定 | ✅ 已完成 | 2026-11-07 已产出 `prototype/m0_workspace_home.html`，覆盖四角色主页、工作台切换、个人中心、法律合规与 ClassIn 扫码 |
| M0-D3 | 编写 M0 技术方案 | 待定 | 未开始 | 包含工作台路由隔离、待办计数、账号偏好存储、ClassIn 唤醒 |

---

## 其他模块

暂无。新增事项时按上方格式追加，并注明来源 PRD。
