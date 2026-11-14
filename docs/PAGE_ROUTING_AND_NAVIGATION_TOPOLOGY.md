/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# 全站页面路由、原型链接与导航拓扑全景字典 (Page Routing, Prototype Deep Linking & Navigation Topology)

| 元数据项 | 说明 / 内容 |
|---|---|
| **文档代号** | `PAGE_ROUTING_AND_NAVIGATION_TOPOLOGY` |
| **所属层级** | 系统顶层工程与产品导航规约字典 |
| **文档状态** | 现行基准 (Active Benchmark) |
| **关联核心文档** | [system_modules_overview.md](./system_modules_overview.md) ｜ [m0_workspace_and_home.md](./prd/m0_workspace_and_home.md) ｜ [CODING_STANDARDS.md](./CODING_STANDARDS.md) |
| **创建与更新日期** | 2026-11-11 (确立全站 4 主 Tab 架构、原型纯净/带参规则、抽屉复用与公私场域锁定铁律) |

---

## 1. 架构原则与设计规约 (Architecture Principles)

本拓扑字典统领 Dream 系统的页面路由编排（Vue 3 / Vue Router）、单文件交互原型（`prototype/*.html`）以及前后端协同导航流。严格遵循以下五大核心工程红线：

1. **“双轨制路由策略 (Dual-Track Routing Strategy)”**：
   - **差异巨大页面：强制实行【角色前缀物理隔离路由】**：
     - 首页、业务中心/教务中心、个人治理等在 UI 版式、操作权限与后端数据模型上 100% 毫无共同点的页面，必须采用独立的角色路由前缀（如 `/parent/home`, `/monitor/home`, `/teacher/home`, `/admin/home`，以及 `/monitor/ops`, `/parent/services`）；
     - **根路径智能分流**：用户访问根路径 `/` 或登录成功后，Vue Router 守卫仅根据当前登录账号的最高主角色直接 302 重定向到对应场域首页（如 `/monitor/home`），严禁共用单个巨型 `/home`；
   - **结构高度一致页面：保持【通用资产路由 + 实体参数】**：
     - 视觉表现、核心算法与数据模型全站统一的时间资产与单据页面，保持通用路径（如 `/calendar`, `/notifications`, `/orders/:orderId`, `/refunds/:refundId`, `/courseware/:cwId/preview`），避免重复造轮子。
2. **前端路由与后端 API 1:1 镜像对称铁律**：
   - 前端在特定角色路由下发起的数据请求，必须且只能映射到后端对应角色前缀的 API 接入层：
     - 前端 `/parent/*` $\longleftrightarrow$ 后端 `/api/dream/v1/parent/*` (挂载 `requireRole('parent')`)
     - 前端 `/monitor/*` $\longleftrightarrow$ 后端 `/api/dream/v1/monitor/*` (挂载 `requireRole('monitor')`)
     - 前端 `/teacher/*` $\longleftrightarrow$ 后端 `/api/dream/v1/teacher/*` (挂载 `requireRole('teacher')`)
     - 前端 `/admin/*` $\longleftrightarrow$ 后端 `/api/dream/v1/admin/*` (挂载 `requireRole('admin')`)
3. **“底部 4 个主 Tab”极简移动端骨架 (4-Tab Bottom Navigation System)**：
   - 全系统（移动端/PWA）根据用户最高角色自适应映射为 4 个主 Tab，**主 Tab 之间切换不显示返回箭头**：
     - **Tab 1 首页**：`/parent/home` ｜ `/monitor/home` ｜ `/teacher/home` ｜ `/admin/home`
     - **Tab 2 课表**：全员统一为核心看板 `/calendar`
     - **Tab 3 业务中枢**：班长为教务中心 `/monitor/ops` ｜ 家长为服务中心 `/parent/services` ｜ 老师为教学资源 `/teacher/resources` ｜ 管理员为 `/admin/ops`
     - **Tab 4 个人/治理**：`/parent/me` ｜ `/monitor/me` ｜ `/teacher/me` ｜ 管理员为治理配置 `/admin/settings`
4. **“场域穿透与底栏锁定”隔离铁律 (AC-M0-28)**：
   - 班长在 Tab 3【教务中心】穿透查阅某个学员课表时，路由显式声明为 **`/monitor/ops/students/:studentId/calendar`**，**底栏必须 100% 锁定高亮在 Tab 3 (`ops`)**，绝对严禁跳切到 Tab 2（防止公私数据串扰）；
   - 管理员在 Tab 4 查阅学员课表时，路由为 **`/admin/students/:studentId/calendar`**，底栏锁定在 Tab 4；
5. **“抽屉优先（Drawer First），严禁滥建独立路由”与原型双轨 URL**：
   - 【课程详情/请假/挪位/转让/代课/打卡】、【老师公开画像】、【学员档案学情卡】，100% 采用**挂载在宿主页面上的底部半屏抽屉 (Bottom Sheet Drawer)**，通过 Query 参数（如 `?drawer=lesson&id=...`）或事件呼出，严禁跳出独立大页面破坏日历时间上下文；
   - **原型纯净 URL**：`prototype/index.html` 目录中仅收录无参纯净 URL，内置完备的默认 Mock 数据与快捷切换器，开箱即用；
   - **原型跨页带参深度链接 (Deep Link)**：页面之间互相跳转时，携带标准驼峰实体参数（如 `?studentId=stu_alice&teacherId=tea_david`），模拟真实的生产级链路与排课成果微闪烁反馈（`?booked=1`）。

---

## 2. 字段定义标准说明 (Field Definitions)

本字典包含 10 个标准工程维度，供前端开发、测试用例编写与产品交互对齐直接使用：

| 字段名称 | 英文标识 | 约束与定义说明 |
| :--- | :--- | :--- |
| **模块分组** | `module` | 归属业务子模块（M0~M5） |
| **页面名称** | `page_name` | 业务功能全称与定位 |
| **原型文件 URL (纯净)** | `prototype_url` | 纯静态单文件 HTML 相对路径，开箱即用默认数据 |
| **原型跨页带参示例** | `deep_link_example` | 跨页面跳转、回跳闪烁或定向评审时推荐携带的 Query 参数 |
| **真实前端路由 URL** | `route_path` | 生产环境 Vue Router 的标准化路由路径 |
| **实体参数** | `params` | 路由动态路径参数 (`:id`) 或 Query 参数 (`?id=`)，标明必填/可选 |
| **页面形态** | `presentation_form` | **`Page`** (全屏独立页) ｜ **`Drawer`** (底部滑出半屏抽屉) ｜ **`Modal`** (模态弹窗) |
| **归属底栏 Tab** | `active_tab` | `Tab 1: home` ｜ `Tab 2: calendar` ｜ `Tab 3: ops` ｜ `Tab 4: me` ｜ `none` (二级隐藏底栏) |
| **访问角色权限** | `allowed_roles` | `admin` (管理员) ｜ `monitor` (班长) ｜ `parent` (家长) ｜ `teacher` (老师) |
| **上一步入口与返回兜底** | `from_and_fallback` | 上一步可能触发源 (From)，以及移动端 `<` 返回按钮的兜底回退路径 (Fallback) |

---

## 3. 全模块页面拓扑与路由全景字典

### 模块 0：工作台与全局底座 (Workspace & Nav)

| 页面名称 | 原型文件 URL (纯净) | 原型跨页带参示例 (Deep Link) | 真实前端路由 URL (双轨制) | 实体参数 | 页面形态 | 归属底栏 Tab | 角色权限 | 上一步入口 (From) | 返回兜底 (Fallback) |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **原型导航目录** | `prototype/index.html` | — | `/dev/index` | 无 | Page | `none` | 开发/全员 | 浏览器直接访问 | 无 |
| **根路由智能分流** | — | — | **`/`** | 无 | Redirect | `none` | 全角色 | 登录成功后拦截 | 根据最高角色 302 重定向到各自首页 |
| **家长工作台首页** | `prototype/m0_workspace_home.html` | `?role=parent` | **`/parent/home`** | 无 | Page | `Tab 1: home` | `parent` | 登录落地 / 底栏 Tab 1 | 无 (顶层 Tab) |
| **班长工作台首页** | `prototype/m0_workspace_home.html` | `?role=monitor` | **`/monitor/home`** | 无 | Page | `Tab 1: home` | `monitor` | 登录落地 / 底栏 Tab 1 | 无 (顶层 Tab) |
| **老师工作台首页** | `prototype/m0_workspace_home.html` | `?role=teacher` | **`/teacher/home`** | 无 | Page | `Tab 1: home` | `teacher` | 登录落地 / 底栏 Tab 1 | 无 (顶层 Tab) |
| **管理员治理首页** | `prototype/m0_workspace_home.html` | `?role=admin` | **`/admin/home`** | 无 | Page | `Tab 1: home` | `admin` | 登录落地 / 底栏 Tab 1 | 无 (顶层 Tab) |
| **班长教务中心 (Ops)** | `prototype/m0_workspace_home.html` | `?role=monitor&tab=ops` | **`/monitor/ops`** | 无 | Page | `Tab 3: ops` | `monitor`, `admin` | 底部导航 Tab 3 | 无 (顶层 Tab) |
| **家长服务中心 (Services)** | `prototype/m0_workspace_home.html` | `?role=parent&tab=services` | **`/parent/services`** | 无 | Page | `Tab 3: ops` | `parent` | 底部导航 Tab 3 | 无 (顶层 Tab) |
| **老师教学资源 (Resources)** | `prototype/m0_workspace_home.html` | `?role=teacher&tab=resources` | **`/teacher/resources`** | 无 | Page | `Tab 3: ops` | `teacher` | 底部导航 Tab 3 | 无 (顶层 Tab) |
| **私域个人中心 (家长/老师/班长)**| `prototype/m0_workspace_home.html` | `?role=parent&tab=me` | **`/parent/me`** ｜ **`/monitor/me`** ｜ **`/teacher/me`** | 无 | Page | `Tab 4: me` | 各自角色 | 底部导航 Tab 4 | 无 (顶层 Tab) |
| **管理与系统治理 (管理员)** | `prototype/m0_workspace_home.html` | `?role=admin&tab=settings` | **`/admin/settings`** | 无 | Page | `Tab 4: me` | `admin` | 底部导航 Tab 4 | 无 (顶层 Tab) |

---

### 模块 1：基础档案、小班与课件 (Profiles, Classes & Courseware)

| 页面名称 | 原型文件 URL (纯净) | 原型跨页带参示例 (Deep Link) | 真实前端路由 URL (双轨制) | 实体参数 | 页面形态 | 归属底栏 Tab | 角色权限 | 上一步入口 (From) | 返回兜底 (Fallback) |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **学员档案中心 (公共页)** | `prototype/m1a_student_profile.html` | `?studentId=stu_alice` | `/students/:studentId` | `studentId` (必填) | Page | `none` (隐藏底栏) | 全角色 | ① 班长教务中心学员卡<br>② 家长工作台多孩卡片 | `/monitor/ops` 或 `/parent/home` |
| **↳ 班长端学员档案学情抽屉** | `prototype/m1a_student_profile.html` | 宿主内唤起 (或 `?drawer=profile&id=stu_alice`) | 宿主内唤起 (或 `?drawer=profile`) | `studentId` (必填) | **Drawer** | 保持宿主 Tab | `monitor`, `admin` | 班长教务中心 Tab 3 列表中轻触学员卡片 | 原地关闭抽屉 |
| **老师管理与排课监控** | `prototype/m1b_teacher_monitor.html` | `?teacherId=tea_david` | **`/monitor/teachers/:teacherId/monitor`** | `teacherId` (必填) | Page | `Tab 3: ops` | `monitor`, `admin` | 班长 Tab 3 所辖老师列表卡片 | `/monitor/ops` |
| **老师公开画像 (家长)** | `prototype/m1b_teacher_parent.html` | `?teacherId=tea_david&role=parent` | 宿主内唤起 (或 `/teachers/:teacherId`) | `teacherId` (必填) | **Drawer / Page** | 保持宿主 Tab | `parent`, `admin` | ① 课表课格详情抽屉【查看老师】<br>② 选老师推荐卡 | 原地关闭抽屉 |
| **小班课小班管理中心** | `prototype/m1c_classes.html` | `?classId=cls_ket1` | **`/monitor/classes/:classId`** | `classId` (必填) | Page | `Tab 3: ops` | `monitor`, `admin` | 班长 Tab 3【小班列表】点击 | `/monitor/ops` |
| **学员学习留言板** | `prototype/m1d_profile_messages.html` | `?studentId=stu_alice&role=parent` | `/students/:studentId/messages` | `studentId` (必填) | Page / Drawer | 保持宿主 Tab | 全角色 | ① 学员档案详情页<br>② 课表课格抽屉【教室留言】 | 上级档案页或课表 |
| **机构公共课件库图谱** | `prototype/m1e_courseware.html` | `?tab=public_catalog` | `/courseware` | 无 | Page | `Tab 3: ops` | `admin`, `teacher` | 底部导航 / 教学管理 | `/monitor/ops` |
| **学员专属已配课件库** | `prototype/m1e_courseware.html` | `?studentId=stu_alice` | `/students/:studentId/courseware` | `studentId` (必填) | Page | `none` (隐藏底栏) | 全角色 | ① 学员档案【在学课件】<br>② 课表课格抽屉【当堂课件】 | `/students/:studentId` |
| **课件样章大屏预览** | `prototype/m1e_courseware.html` | `?cwId=cw_od2&preview=1` | `/courseware/:cwId/preview` | `cwId` (必填) | Modal / Page | `none` | 全角色 | 课件图谱或学员课件列表点击 | `router.back()` |

---

### 模块 2：订单、购课与退费 (Orders & Refunds)

| 页面名称 | 原型文件 URL (纯净) | 原型跨页带参示例 (Deep Link) | 真实前端路由 URL (双轨制) | 实体参数 | 页面形态 | 归属底栏 Tab | 角色权限 | 上一步入口 (From) | 返回兜底 (Fallback) |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **购课单录单工作台** | `prototype/m2a_course_orders.html` | `?studentId=stu_alice` | **`/monitor/orders/create`** | Query `?studentId=` (可选) | Page | `Tab 3: ops` | `monitor`, `admin` | ① Tab 3 顶部 4 大单据【购课录单】<br>② 学员档案卡【去购课】 | `/monitor/ops` |
| **购课单详情与 TS 课次** | `prototype/m2a_course_orders.html` | `?orderId=ord_202611_01` | `/orders/:orderId` | `orderId` (必填) | Page | `none` (隐藏底栏) | `admin`, `monitor`, `parent` | ① 订单列表<br>② 购课成功通知<br>③ 资产抽屉 | `/monitor/ops` 或 `/parent/services` |
| **1v1 退款核算与发起** | `prototype/m2b_refund_orders.html` | `?orderId=ord_202611_01` | **`/monitor/refunds/create`** | Query `?orderId=` (必填) | Page | `Tab 3: ops` | `monitor`, `admin` | ① 购课单详情【申请退款】<br>② Tab 3 顶部单据入口 | `/orders/:orderId` |
| **退款单详情与冲退对账** | `prototype/m2b_refund_orders.html` | `?refundId=ref_202611_01` | `/refunds/:refundId` | `refundId` (必填) | Page | `none` (隐藏底栏) | `admin`, `monitor`, `parent` | ① 退款单审批列表<br>② 退费到账通知 | `/monitor/ops` 或 `/parent/services` |

---

### 模块 3：7色智能日历、排课、考勤与转让 (Calendar & Scheduling)

| 页面名称 | 原型文件 URL (纯净) | 原型跨页带参示例 (Deep Link) | 真实前端路由 URL (双轨制) | 实体参数 | 页面形态 | 归属底栏 Tab | 角色权限 | 上一步入口 (From) | 返回兜底 (Fallback) |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **7色周度日历看板与全场景动作中枢** | `prototype/m3a_calendar_grid.html` | `?role=parent&studentId=stu_alice`<br>`?role=monitor&teacherId=tea_david`<br>`?booked=1&day=Tue&time=18:30` | **`/calendar`** | Query `?studentId=` 或 `?teacherId=` | **Core Page (核心通用看板)** | **`Tab 2: calendar`** | 全角色自适应 | **底部主导航 Tab 2** | 无 (顶层 Tab) |
| **↳ 班长穿透查阅学员课表** | `prototype/m3a_calendar_grid.html` | `?studentId=stu_alice&role=monitor&from=ops` | **`/monitor/ops/students/:studentId/calendar`** | `studentId` (必填) | Page | **`Tab 3: ops` (铁律锁定)** | `monitor` | 班长 Tab 3 所辖学员卡 `[ 📅 查看课表 ]` | `/monitor/ops` |
| **↳ 管理员穿透查阅学员课表** | `prototype/m3a_calendar_grid.html` | `?studentId=stu_alice&role=admin&from=settings` | **`/admin/students/:studentId/calendar`** | `studentId` (必填) | Page | **`Tab 4: me` (铁律锁定)** | `admin` | 管理员 Tab 4 学员列表 `[ 📅 查看课表 ]` | `/admin/settings` |
| **↳ 课表动作抽屉 (请假/挪位/转让/代课/打卡/进教室)** | 内嵌于 `m3a_calendar_grid.html` | 宿主内唤起 (或 `?drawer=lesson&id=lsn_01`) | 宿主内唤起 (或 `?drawer=lesson`) | `lessonId` (必填) | **Drawer (抽屉)** | 保持当前 Tab | 全角色 | 轻触日历中已有排课单元格 (🟠/🟡/🔵/🟩) | 原地关闭抽屉 |
| **↳ 空闲预约单抽屉 (临时约课 30/60m)** | 内嵌于 `m3a_calendar_grid.html` | 宿主内唤起 (或 `?drawer=book&day=Tue&time=19:00`) | 宿主内唤起 (或 `?drawer=book`) | `teacherId`, `time` | **Drawer (抽屉)** | 保持当前 Tab | `parent`, `monitor` | 轻触日历中绿色空闲格 (🟢 约) | 原地关闭抽屉 |
| **↳ 老师切换与负荷抽屉** | 内嵌于 `m3a_calendar_grid.html` | 宿主内唤起 (或 `?drawer=teachers`) | 宿主内唤起 (或 `?drawer=teachers`) | 无 | **Drawer (抽屉)** | 保持当前 Tab | `monitor`, `admin` | 点击日历吸顶老师状态卡 | 原地关闭抽屉 |
| **沉浸式专用批量排课工作台** | `prototype/m3d_scheduling_workbench.html` | `?teacherId=tea_david&studentId=stu_alice&mode=batch_fixed` | **`/monitor/schedule/workbench`** | Query `?teacherId=&mode=` | Page | `none` (隐藏底栏) | `monitor`, `admin` | ① M3A 课表顶栏 `[+ 批量固定位排课]`<br>② 学员档案 `[立即排课]` | `/calendar` (带 `?booked=1` 闪烁) |
| **代课与考勤调度台账** | `prototype/m3b_attendance_substitution.html` | `?tab=substitutions` | **`/monitor/attendance/substitutions`** | 无 | Page | `Tab 3: ops` | `monitor`, `admin` | ① 班长工作台待代课卡<br>② 代课告警通知 | `/monitor/ops` |
| **课程转让大池 (公开集市)** | `prototype/m3c_course_transfer.html` | `?tab=market` | **`/parent/transfers/market`** | 无 | Page | `none` (隐藏底栏) | `parent` | 家长个人中心【捡漏课次/转让集市】 | `/parent/services` |
| **转让明细流水 (审计台账)** | `prototype/m3c_course_transfer.html` | `?tab=history&studentId=stu_alice` | **`/parent/transfers/history`** | Query `?studentId=` (可选) | Page | `none` (隐藏底栏) | `parent`, `admin` | ① M3A 课表顶栏资产卡【转让记录】<br>② 个人中心二级入口 | `/calendar` 或 `/parent/services` |

---

### 模块 4：三级消息通知分发网络 (Notification Network)

| 页面名称 | 原型文件 URL (纯净) | 原型跨页带参示例 (Deep Link) | 真实前端路由 URL (双轨制) | 实体参数 | 页面形态 | 归属底栏 Tab | 角色权限 | 上一步入口 (From) | 返回兜底 (Fallback) |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **统一消息中心 (单列表页)** | `prototype/m4_notification.html` | `?filter=unread`<br>`?category=schedule` | **`/notifications`** (PRD 铁律锁死) | 无 | Page | `none` (隐藏底栏) | 全角色 | ① 各工作台顶栏通知铃铛 🔔<br>② 手机 Push/邮件链接直达 | 浏览历史 `router.back()` 或对应首页 |

---

### 模块 5：资金归集与周度财务分账 (Finance & Settlement)

| 页面名称 | 原型文件 URL (纯净) | 原型跨页带参示例 (Deep Link) | 真实前端路由 URL (双轨制) | 实体参数 | 页面形态 | 归属底栏 Tab | 角色权限 | 上一步入口 (From) | 返回兜底 (Fallback) |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **单向转账单归集看板** | `prototype/m5a_transfer_collection.html` | `?weekNumber=46` | **`/finance/transfers`** | 无 | Page | `Tab 3: ops` | `monitor`, `admin` | ① 班长/管理员 Tab 3 顶部 4 大单据<br>② 财务结课待办 | `/monitor/ops` |
| **老师周课酬与工具费报表** | `prototype/m5b_weekly_settlement.html` | `?weekNumber=46` | **`/finance/settlements/weekly`** | 无 | Page | `Tab 3: ops` | `monitor`, `admin` | ① 班长/管理员 Tab 3 顶部 4 大单据<br>② 结算日提醒 | `/monitor/ops` |
| **单张课酬单明细详情** | `prototype/m5b_weekly_settlement.html` | `?settlementId=stl_202646_david` | **`/finance/settlements/:settlementId`** | `settlementId` (必填) | Page | `none` (隐藏底栏) | `admin`, `teacher` | ① 周结算报表列表点击<br>② 老师首页【本周课酬卡】 | `/finance/settlements/weekly` 或 `/teacher/home` |

---

## 4. 前后端开发实现参考代码片段

### 4.1 原型页面参数读取与优雅降级标准代码 (Prototype Vanilla JS)
```javascript
// 在原型 HTML 页面的 script 初始化中采用以下标准化写法：
const urlParams = new URLSearchParams(window.location.search);

// 1. 角色读取 (默认降级为 monitor)
const activeRole = urlParams.get('role') || 'monitor';

// 2. 实体 ID 读取 (默认降级为代表性 Mock ID)
const activeStudentId = urlParams.get('studentId') || 'stu_alice';
const activeTeacherId = urlParams.get('teacherId') || 'tea_david';

// 3. 跨页操作结果闪烁反馈
const isBookedFlash = urlParams.get('booked') === '1';
if (isBookedFlash) {
  const flashDay = urlParams.get('day') || 'Tue';
  const flashTime = urlParams.get('time') || '18:30';
  triggerSuccessFlash(flashDay, flashTime);
}
```

### 4.2 前端 Vue Router 路由配置定义参考 (Vue 3 / Vue Router 4 双轨制实现)
```typescript
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

export const routes: RouteRecordRaw[] = [
  // 1. 根路径智能 302 重定向
  {
    path: '/',
    redirect: () => {
      const auth = useAuthStore();
      if (auth.hasRole('admin')) return '/admin/home';
      if (auth.hasRole('monitor')) return '/monitor/home';
      if (auth.hasRole('teacher')) return '/teacher/home';
      return '/parent/home';
    }
  },

  // 2. 差异巨大页面：角色专属物理隔离路由 (与后端 API 1:1 镜像对应)
  // 家长场域
  {
    path: '/parent/home',
    name: 'ParentHome',
    component: () => import('@/views/parent/ParentHomeView.vue'),
    meta: { activeTab: 'home', roles: ['parent'], title: '家长首页' }
  },
  {
    path: '/parent/services',
    name: 'ParentServices',
    component: () => import('@/views/parent/ParentServicesView.vue'),
    meta: { activeTab: 'ops', roles: ['parent'], title: '服务中心' }
  },
  {
    path: '/parent/me',
    name: 'ParentMe',
    component: () => import('@/views/parent/ParentProfileView.vue'),
    meta: { activeTab: 'me', roles: ['parent'], title: '个人中心' }
  },

  // 班长场域
  {
    path: '/monitor/home',
    name: 'MonitorHome',
    component: () => import('@/views/monitor/MonitorHomeView.vue'),
    meta: { activeTab: 'home', roles: ['monitor'], title: '班长工作台' }
  },
  {
    path: '/monitor/ops',
    name: 'MonitorOps',
    component: () => import('@/views/monitor/MonitorOpsView.vue'),
    meta: { activeTab: 'ops', roles: ['monitor'], title: '教务中心' }
  },
  {
    path: '/monitor/me',
    name: 'MonitorMe',
    component: () => import('@/views/monitor/MonitorProfileView.vue'),
    meta: { activeTab: 'me', roles: ['monitor'], title: '个人中心' }
  },

  // 3. 结构高度一致页面：全员通用资产路由
  {
    path: '/calendar',
    name: 'Calendar',
    component: () => import('@/views/CalendarView.vue'),
    meta: { activeTab: 'calendar', title: '7色智能周课表' }
  },
  {
    path: '/notifications',
    name: 'Notifications',
    component: () => import('@/views/NotificationCenterView.vue'),
    meta: { activeTab: 'none', title: '消息中心' }
  },

  // 4. AC-M0-28 铁律：公私隔离与底栏锁定路由
  {
    path: '/monitor/ops/students/:studentId/calendar',
    name: 'MonitorOpsStudentCalendar',
    component: () => import('@/views/CalendarView.vue'),
    meta: { activeTab: 'ops', roles: ['monitor'], title: '学员专属课表 (教务穿透)' }
  },
  {
    path: '/admin/students/:studentId/calendar',
    name: 'AdminStudentCalendar',
    component: () => import('@/views/CalendarView.vue'),
    meta: { activeTab: 'me', roles: ['admin'], title: '学员专属课表 (监管穿透)' }
  }
];
```
