/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# Dream 设计系统与 UI 架构规范 (Design System & UI Architecture)

本文档是 Dream（教务排班与分账管理系统）前端应用（`dream-frontend`）与交互原型（`prototype/`）的**视觉与交互唯一真相源（Single Source of Truth）**。整合了多角色工作台物理隔离、设计令牌（Design Tokens）、7 色智能日历规范、组件库选型、PWA 端侧缓存及全站中英双语（i18n）标准。

---

## 1. 核心交互架构：工作台物理隔离与多孩档案切换

### 1.1 多角色“工作台物理隔离” (Workspace Switcher)
针对“一个自然人拥有多重身份”（例如管理员兼任部分老师的班长，同时又是给自己孩子约课的家长）的业务现状，系统实施严格的**工作台物理隔离**：
- **常驻切换器**：页面顶部常驻【工作台视图切换器】，由登录态 `user.roles`（`admin`, `monitor`, `teacher`, `user`）驱动权限，可无缝在以下四套工作台切换：
  - **管理员后台 (`admin`)**：以**黑金 / 深石板色 (`bg-slate-900` + `text-amber-400`)** 为主色调，专注于全局排期调配、教师定级发薪、财务总账与平台工具费核算。
  - **班长工作台 (`monitor`)**：以**深靛蓝 (`bg-indigo-950` / `bg-indigo-600`)** 为主色调，专注于所辖教师团队、负责小班、线下收款录单、代课调配与周度上交平台转账。
  - **家长工作台 (`user`)**：以**清新浅色 (`bg-slate-50` + `text-indigo-600` / `text-sky-600`)** 为主色调，专注于多孩档案管理、剩余课次预约、连约抢位、同师挪位与课程转让。
  - **教师课表 (`teacher`)**：以**极简中性色 (`bg-white` / `bg-slate-100` + `text-slate-800`)** 为主色调，专注于 7 色个人排期查阅、学生留言板互动与代课交接。
- **物理菜单与路由隔离**：四套视图采用截然不同的导航菜单与状态存储，严防多角色兼职身份下的跨角色误操作。

### 1.2 多孩家庭“全局档案切换器” (Profile Switcher)
- 在【家长工作台】顶部常驻学生档案切换组件（如 `当前查看：大宝 AliceZ12 ▼`），支持单账号下挂载最多 10 个孩子档案。
- 切换选中的 `activeProfileId` 后，通过请求头 `X-Profile-Id` 穿透，页面下方关联的**课表、购课单、待排期 TS 列表、简易留言板**即时联动刷新。

---

## 2. 设计令牌体系 (Design Tokens)

### 2.1 字体与排版阶梯 (Typography - 对齐微信 WeUI 纯血标准)
移动端视觉排版**严格对齐微信 App 官方规范 (WeUI Standards)**，以数亿中文移动端用户最熟悉的字号尺度为唯一基准，彻底消除“字小、费眼、iOS输入自动缩放”问题：

- **字体栈 (Font Stack)**：
  - 无衬线主字体：`font-sans`（系统原生无衬线优先：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Inter", "Segoe UI", Roboto, sans-serif`），保障中英文混排清晰度与零外部字体加载阻塞。
  - 等宽数字与编码字体：`font-mono`（用于 12 位短 ID、订单编号、时间网格 `09:00`、积分金额核算对齐及学生昵称编码 `AliceZ12`）。
- **微信 WeUI 5 级字号与字重规范 (Typography Hierarchy)**：
  - **L1 页面大标题 (Large Title)**：**`22px` (`text-[22px]` / `text-2xl`)**，`font-bold tracking-tight text-slate-900`（对齐微信大标题/钱包余额）。
  - **L2 核心主标题 / 列表项名称 / 输入框 / 主按钮 (Title / Body / Input / Action)**：**`17px` (`text-[17px]`)**：
    - 输入框 (Input) 统一 `text-[17px]`，高度统一 `h-12` (48px) ~ `h-[52px]`。彻底根除 iOS Safari 自动强制缩放，输入大字清晰扎实。
    - 列表主项名称、卡片主标题、弹窗确认大按钮统一使用 `text-[17px]` (`font-semibold` 或 `font-bold`)（对齐微信好友名、设置项主文字、绿色大按钮）。
  - **L3 次级正文 / 内容摘要 (Content / Subtitle)**：**`15px` (`text-[15px]`) ~ `16px` (`text-base`)**，`font-medium text-slate-800`（如课表主要名称、卡片重要信息描述，对齐微信聊天列表最新消息预览）。
  - **L4 辅助说明 / 次要属性 (Caption / Footnote)**：**`14px` (`text-sm`)**，`font-medium text-slate-500`（如真实姓名、档案 ID、表单输入提示、选课偏好标签，对齐微信右侧灰色说明 `#888888`。**严禁在常规页面将辅助说明降级至 12px**）。
  - **L5 时间戳 / 标签 / 徽标 (Metadata / Tag / Badge)**：**`12px` (`text-xs`) ~ `13px` (`text-[13px]`)**，`font-medium text-slate-400`（对齐微信聊天右上角时间“19:45”、红点徽标。**12px 为常规页面物理绝对下限，严禁出现 11px 及以下极限小字**）。
  - **单屏 7 列周度日历微卡片 (全系统唯一业务特例)**：`text-[11px]` (`font-bold leading-tight`)，仅在单屏 7 列高密度日历缩写微卡片内保留，适配单列 45px 极窄视口。

### 2.2 基础色彩系统 (Color Palette)
- **背景层 (Surfaces)**：
  - 页面底层背景：`bg-slate-50` 或 `bg-slate-100`
  - 卡片/容器表面：`bg-white` 搭配精细边框 `border border-slate-200/80` 与轻阴影 `shadow-sm`
- **主品牌与操作色 (Primary Actions)**：
  - 主操作按钮：`bg-indigo-600 hover:bg-indigo-700 text-white`
  - 次要操作按钮：`bg-slate-100 hover:bg-slate-200 text-slate-700`
- **语义反馈色 (Semantic Feedback)**：
  - 成功/到账/可约：`emerald` (`text-emerald-700 bg-emerald-50 border-emerald-200`)
  - 警示/待确认/强提醒：`amber` (`text-amber-800 bg-amber-50 border-amber-300`)
  - 危险/熔断/冲退/异常：`rose` (`text-rose-700 bg-rose-50 border-rose-200`)

### 2.3 间距、圆角与层级 (Spacing, Radius & Z-Index)
- **圆角标准**：卡片容器统一 `rounded-xl` (12px) 或 `rounded-2xl` (16px)；按钮与输入框 `rounded-lg` (8px)；日历单元格微卡片 `rounded-md` (6px)。
- **弹窗与遮罩层级 (Z-Index)**：
  - 日历表格首列时间冻结 (`freeze-col`)：`z-20`
  - 全局顶部工作台切换条 / 日历表头冻结 (`freeze-header`)：`z-30`
  - 日历左上角交叉冻结格 (`freeze-corner`) / 底部移动端导航栏：`z-40`
  - 抽屉面板 (`Bottom Sheet`) 与遮罩 Modal：`z-50`
  - 消息 Toast / 强提醒告警弹窗：`z-[100]`

---

## 3. 日历 7 色视觉规范与代课调度规约 (7-Color Calendar Standard)

### 3.1 营业时间窗与日历网格基座
- **营业时段**：每日 **06:00 - 00:00**（早晚均有高频排课需求）。
- **基础网格单元**：每个时间网格为 **30 分钟**，全天共 **36 个**基础日历网格。
- **班型占用标准**：
  - **1v1（一对一）**：标准授课 25 分钟，占用 **1 个日历网格（30 分钟）**（内含 5 分钟课间休息缓冲）。
  - **小班课（1vN）**：标准授课 50 分钟，连续占用 **2 个日历网格（1 小时）**。

### 3.2 7 色日历状态渲染矩阵与代课双视角 (Design Tokens)
日历系统对网格实施严格的 7 色状态渲染，特别对**代课场景实施双视角差异化染色**。为兼顾单屏 7 列高密度排课的可读性，单元格采用**“呼吸感浅色底 + 语义边框 + 深色高对比文本”**微卡片设计（同时保留高饱和度状态徽标色）：

| 颜色标识 | `colorCode` 枚举 | 状态名称 (中/英) | 单元格微卡片样式 (Tailwind Tokens) | 徽标强调色 (Badge) | 单元格缩写/角标规则 | 适用视角与核心业务说明 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 🟠 **橙色** | `ORANGE` | **固定位 / Fixed Slot** | `bg-amber-50 border-amber-300 text-amber-900` *(正式)*<br>`bg-amber-50/70 border-amber-400 border-dashed text-amber-800` *(续费预占 HOLD)* | `bg-amber-500 text-white` | 学生昵称前3~4字（如 `Alic`）<br>• 转让加注【转】<br>• 续费预占加注【预】 | **全端通用**：四周一轮买 4 排 4 的固定位正课（最高锁位优先级）。到期前 72h 自动生成续费单并虚线预占（`HOLD`）。 |
| 🟡 **黄色** | `YELLOW` | **临时课 / Temp Lesson** | `bg-yellow-50 border-yellow-300 text-yellow-900` | `bg-yellow-400 text-gray-900` | 学生昵称前3~4字（如 `BobZ`）<br>• 转让加注【转】 | **全端通用**：家长提前 1-7 天自主抢位预约的临时正课（支持单次连约 1~4 节）。 |
| 🔵 **蓝色** | `BLUE` | **被代课 / Substituted** | `bg-blue-50 border-blue-300 text-blue-900` | `bg-blue-500 text-white` | 学生昵称前3~4字 + 蓝色代课指示点 | **仅在【原被代课老师、班长、家长/学生】视图显示**：提示本节课由代课老师上，不计原老师课酬。点击可弹窗查看代课老师信息。 |
| 🟣 **紫色** | `PURPLE` | **代上课 / Substituting** | `bg-purple-50 border-purple-300 text-purple-900` | `bg-purple-600 text-white` | 学生昵称前3~4字 + 紫色代课指示点 | **仅在【代课老师】视图显示**：提示替同事代课并计入本人周课酬，点击可直接查看学生档案留言板掌握交接进度。 |
| ⚪ **灰色** | `GRAY` | **不可约 / Unavailable** | `bg-slate-100 border-slate-200 text-slate-400` | `bg-gray-200 text-gray-500` | 居中显示单字 **“休”** | **全端通用**：教师未开放授课的日常休息时段或已过期不可操作时段。 |
| 🟢 **绿色** | `GREEN` | **空闲可约 / Available** | `bg-emerald-50/80 border-emerald-200 text-emerald-700 hover:bg-emerald-100` | `bg-emerald-500 text-white` | 居中显示单字 **“约”** | **全端通用**：教师常规开放授课且未被占用的空闲时段，家长点击可唤起预约/连约抽屉。 |
| 🔴 **红色** | `RED` | **已请假 / On Leave** | `bg-rose-50 border-rose-200 text-rose-700` | `bg-rose-500 text-white` | 居中显示单字 **“假”** | **全端通用**：教师主动标记临时闭麦请假或小班课整班停课的时段。 |

### 3.3 后端 DTO 预计算与前端“哑组件化” (`colorCode` 预下发)
为了杜绝前端在桌面端和移动端重复编写复杂的代课双视角与角色逻辑判断，系统实施**后端预计算色值策略**：
- **接口下发规范**：日历查询接口（如 `GET /api/dream/v1/schedule/timeslots`）在返回 TS 列表时，Service 层根据当前登录身份（Token 中的 `account_id` 与角色）与 TS 关联关系，直接在 DTO 中注入预计算字段：
  ```json
  {
    "id": "ts_1234567890",
    "lessonDate": "2026-11-10",
    "timeSlot": "09:00-09:30",
    "status": "scheduled",
    "colorCode": "BLUE",
    "isHold": false,
    "isTransferred": false,
    "actualStudentNickname": "AliceZ12",
    "shortLabel": "Alic"
  }
  ```
- **全端哑组件化**：前端组件仅需根据 `colorCode`、`isHold`、`isTransferred` 映射 Tailwind 样式类与角标，不持有复杂的代课视角推断逻辑，确保多端 100% 一致。

### 3.4 周度 Excel 冻结网格与连约交互规范 (Weekly Excel Grid & Multi-Slot UX)
- **单屏 7 列周度 Excel 冻结看板**：
  - 移动端与桌面端统一采用高信息密度的周度 7 列（周一至周日）网格布局；
  - 左侧第一列（36 个半小时时间轴 `06:00` ~ `23:30`）实施横向滚动粘性冻结（`sticky left-0 z-20`），顶部星期表头实施纵向滚动粘性冻结（`sticky top-0 z-30`）；
  - 支持顶栏【上一周】、【本周】、【下一周】无缝切换（前后各 12 周范围）。
- **底部抽屉面板 (`Bottom Sheet` / `t-popup`)**：
  - 点击 🟢【约】单元格时，底部滑出预约抽屉，支持选择 **【单约 1 节 (30m)】、【连约 2 节 (1h)】、【连约 3 节 (1.5h)】、【连约 4 节 (2h)】**；若后续连续网格已被占用或剩余 TS 资产不足，对应连约按钮自动置灰并提示原因。
  - 点击 🔵【被代课】或 🟣【代上课】单元格时，底部滑出代课详情与学生留言交接抽屉。

---

## 4. UI 组件库搭配与 100% Tailwind 铁律

### 4.1 组件库选型搭配
- **移动端触控优先场景 (`tdesign-mobile-vue`)**：
  - 家长端约课日历、学生个人档案、手机端快速留言与临时课预约抽屉，统一采用 **`tdesign-mobile-vue`** 标准组件，保障单手触控与滑动体验。
- **管理看板与复杂财务报表场景 (`tdesign-vue-next`)**：
  - 管理员后台与班长工作台的排班批量调配、跨教师/学生的分账对账看板、双周结算导出表格，搭配 **`tdesign-vue-next`** 桌面级组件。

### 4.2 样式开发红线 (Zero Custom CSS)
- **100% Tailwind CSS**：所有间距、色彩、阴影、对齐、响应式断点与过渡动画必须 100% 使用 Tailwind CSS 原子类。
- **严禁手写 CSS**：**严禁在前端业务代码中编写任何形式的手写 CSS（包括 `.vue` 文件中的 `<style>` 块或外部自定义 `.css` 文件）**，确保样式高度原子化、易维护与系统级一致。
- **安全渲染红线**：严禁在页面渲染中无防护使用 `v-html`，防止 XSS 攻击注入。

### 4.3 响应式断点规范 (Mobile & Tablet Responsive)
- **手机端 (`< 768px`, 默认视口)**：单列流式容器，底部常驻移动导航栏，操作面板统一采用底部抽屉（Bottom Sheet）。
- **平板端 (`md: >= 768px`, iPad 适配)**：自适应切换为双栏或卡片网格并列布局（`grid-cols-2`），侧边导航可折叠。
- **桌面端 (`lg: >= 1024px`)**：固定左侧导航栏 + 宽屏多列数据看板与右侧详情抽屉。

---

## 5. PWA 与端侧四级数据缓存策略 (PWA & Caching Hierarchy)

系统以 **PWA (Progressive Web App)** 为标准交付形态（集成 `vite-plugin-pwa`，支持“添加到主屏幕 A2HS”独立窗口运行），端侧实施四级数据缓存架构：

| 缓存级别 | 适用数据对象 | 缓存介质与策略 | 失效与更新机制 |
| :--- | :--- | :--- | :--- |
| **L1: 强缓存 (App Shell)** | 静态资源、HTML 离线壳、字体、图标 | CacheStorage (`CacheFirst`) | 随应用发版更新（hash 指纹驱动） |
| **L2: 静态字典与会话上下文** | 课程类型字典 (`course_types`)、教师定级字典 (`teacher_levels`)、当前账号身份、名下学生档案列表、`activeProfileId` | LocalStorage + Pinia (`StaleWhileRevalidate`) | 24 小时 TTL，或在用户切换档案/修改偏好时主动广播失效 |
| **L3: 业务只读快照** | 教师公开脱敏履历列表、当周 7 色已排课表视图快照 | IndexedDB (`NetworkFirst with Cache Fallback`) | 优先网络拉取，弱网/断网自动降级读取本地缓存并标记“离线只读” |
| **L4: 绝对零离线 (强制在线)** | 购课单支付确认、退款单、向平台转账单、排班并发抢位 (`SELECT ... FOR UPDATE`) | **严禁缓存 (`NetworkOnly`)** | 断网状态下操作按钮强制置灰阻断，Toast 提示“离线模式不可用” |

---

## 6. 全站中英文双语规范 (i18n Standards)

- **核心架构**：基于 `vue-i18n`（Composition API 模式），完整覆盖中文简体 (`zh-CN`) 与英文 (`en-US`)。
- **覆盖范围**：顶部与侧边导航、工作台标题、角色标签、表单 Label / Placeholder / 校验提示、7 色日历状态文案、单据状态枚举及全部后端业务错误码。
- **错误码统一拦截与自动翻译（对齐 `@topeetop/auth-core` 范式）**：
  - 遵循**“后端传标准 Code 与英文 Fallback，前端按 Code 翻译双语”**。
  - 前端统一请求封装（`src/utils/apiError.ts`）在捕获非 2xx 响应时，优先提取 `error.code || error.errorCode`：
    ```typescript
    const code = data?.code || data?.errorCode;
    if (code && i18n.global.te(`errors.${code}`)) {
      return i18n.global.t(`errors.${code}`);
    }
    return data?.error || data?.message || 'Request failed';
    ```
  - 语言包中集中以 `errors.<CODE>` 维护双语词条（如 `errors.CLASS_FULL`、`errors.ALREADY_ENROLLED`、`errors.NICKNAME_ALREADY_EXISTS`）。
- **表单输入校验第一道防线**：
  - 所有表单组件必须在客户端绑定基于 `vue-i18n` 的响应式校验规则，在用户触发提交前即时完成本地化校验与标红，避免向后端发送无效请求。
- **无刷新切换与持久化**：
  - 顶部栏提供全局语言即时切换器，首选项持久化存入 `localStorage.getItem('dream_locale')`，初次访问自动根据 `navigator.language` 智能匹配。
