/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# Dream 设计系统与 UI 架构规范 (Design System & UI Architecture)

本文档是 Dream（教务排班与分账管理系统）前端应用（`dream-frontend`）与交互原型（`prototype/`）的**视觉与交互唯一真相源（Single Source of Truth）**。整合了多角色工作台物理隔离、设计令牌（Design Tokens）、7 色智能日历规范、组件库选型、PWA 端侧缓存及全站中英双语（i18n）标准。

---

## 1. 核心交互架构：公私分流与多孩日程聚合 (Interaction Architecture)

### 1.1 兼职角色自然聚合与公私物理分流 (Workspace Natural Aggregation)
针对“一个自然人拥有多重身份”（例如管理员兼任部分老师的班长，同时又是给自己孩子约课的家长）的业务现状，系统彻底抛弃生硬的顶部强制切换器，采用**“主页垂直分区聚合 + 底部最多 4 个 Tab 极简映射 + 金刚位按角色分行（单角色 4 个，双角色最多 8 个）”**模型：
- **免生硬切换与公私分流**：
  - **主页双焦点**：主页上方集中呈现公事/教务待办（深色/微徽标），下方集中呈现自家孩子即将上课日程（浅色/活力徽标）；
  - **金刚区严格限额**：单角色仅 1 行 4 个金刚位，双角色（如班长兼家长、三合一管理员）最多 2 行 8 个金刚位（第 1 行公事，第 2 行家庭）；
  - **导航物理隔离**：自家孩子排课收纳于 **Tab 2【学生课表】**；负责的 50+ 外部学员教务收纳于 **Tab 3【教务中心】**；管理员基础配置（班长列表、教师定级、字典参数）收纳于 **Tab 4【管理与设置】**，根绝跨角色误操作与资金混淆。
- **色彩与主题暗示**：
  - 管理与教务公事功能采用**黑金/深靛蓝 (`bg-slate-900` / `bg-indigo-950`)** 微背景与深色微徽标；
  - 家庭与孩子个人功能采用**清新浅色 (`bg-slate-50` + `text-indigo-600`)**，视觉上自然区分。

### 1.2 多孩家庭“时间流聚合与吸顶锚点定位” (Family Agenda & Anchor Tabs)
- **主页时间流聚合**：家长主页的【即将上课】卡片合并展现名下所有孩子的待上课程，卡片醒目标注孩子昵称（如 `[👧 Alice / 大宝]`），开课倒计时与 ClassIn 唤醒按钮一屏通览，无需下拉切换孩子。
- **Tab 2【学生课表】呼吸感日程卡片与吸顶锚点 Tab**：
  - 弃用手机竖屏默认展示的高密度 7 列周日历网格，默认采用带呼吸感的**日程卡片流 (Agenda Cards)**；
  - 页面顶部常驻**吸顶多孩锚点 Tab**（如：`[ 全部孩子 ]` `[ 👧 大宝 Alice (4节) ]` `[ 👦 二宝 Bob (2节) ]`）；
  - 点击某一孩子头像平滑滚动 (Smooth Scroll) 秒级定位至该孩子的排课列表，或即时过滤该孩子日程；
  - 右上角保留 `[📅切换为网格]` 抽屉，仅供需要宏观比对空闲时按需唤起。

---

## 2. 设计令牌体系 (Design Tokens)

### 2.1 字体与排版阶梯 (Typography - 4 级紧凑阶梯 18/16/14/12 + 日历特例 11)
为保障教务工具的高信息密度与精致紧凑视觉，系统采用 **4 级紧凑字号规范 + 1 级日历业务特例 (18 - 16 - 14 - 12 + 11)**，兼顾信息容量、成年家长易读性与 iOS Safari 安全防缩放底线：

- **字体栈 (Font Stack)**：
  - 无衬线主字体：`font-sans`（系统原生无衬线优先：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Inter", "Segoe UI", Roboto, sans-serif`），保障中英文混排清晰度与零外部字体加载阻塞。
  - 等宽数字与编码字体：`font-mono`（用于 12 位短 ID、订单编号、时间网格 `09:00`、积分金额核算对齐及学生昵称编码 `AliceZ12`）。
- **紧凑 4 级字号与字重规范 (Typography Hierarchy)**：
  - **L1 页面大标题 / 关键统计大数 (Page Title / KPI)**：**`18px` (`text-[18px]`)**，`font-bold tracking-tight text-slate-900`（如“晚上好，Amy”、“学生课表”、大盘统计关键数字等，小巧扎实，节约竖屏高度）。
  - **L2 核心主标题 / 输入框 / 主按钮 (Section Title / Input / Action)**：**`16px` (`text-[16px]` / `text-base`)**：
    - 输入框 (Input) 统一 `text-[16px]`，高度统一 `h-11` (44px) ~ `h-12` (48px)。踩准 iOS Safari 安全防缩放标准线，输入大字清晰规整。
    - 卡片核心主标题、弹窗主项名称、主要确认按钮统一使用 `text-[16px]` (`font-semibold` 或 `font-bold`)。
  - **L3 次级正文 / 课程名 / 内容摘要 (Body / Subtitle)**：**`14px` (`text-[14px]` / `text-sm`)**，`font-medium text-slate-800`（如课表主要名称 `少儿英语`、外教姓名、学情反馈评语正文，比 15px 更精悍耐读）。
  - **L4 辅助说明 / 标签 / 徽标 / 底栏 (Caption / Badge / Nav)**：**`12px` (`text-[12px]` / `text-xs`)**，`font-medium text-slate-500` 或 `text-slate-400`（如真实姓名、档案 12 位短 ID、时间戳、底栏导航文字、状态胶囊微徽标。**12px 为常规页面物理绝对下限，严禁出现 11px 及以下极限小字**）。
  - **单屏 7 列周度日历微卡片 (全系统唯一业务特例)**：`text-[11px]` (`font-bold leading-tight`)，仅在单屏 7 列高密度周度日历排期网格单元格微卡片内独占保留，专用于适配单列 45px 极窄视口。

### 2.2 基础色彩系统与四层收敛模型 (Color Palette & 4-Layer Hierarchy)

为避免页面配色花哨、确保真正的风险告警与 7 色日历具备雷达级辨识度，系统对除 7 色日历网格外的所有常规功能实施**“四层色彩收敛模型 (60-30-10 法则)”**：

1. **第一层：基座层 (Surfaces, 60% 基础骨架)**：
   - 页面底层背景：`bg-slate-50` 或 `bg-slate-100`
   - 卡片与容器表面：`bg-white` 搭配精细边框 `border border-slate-200/80` 与轻阴影 `shadow-sm`
   - 文字层次：微信 WeUI 标准阶梯（`text-slate-900` 主字 / `text-slate-500` 次字 / `text-slate-400` 辅助）
2. **第二层：统一功能主色层 (Primary Brand, 30% 统一单色系)**：
   - **统一收敛为主色调——纯家长紫蓝色 (Indigo `#4f46e5` / `#eef2ff`)**；
   - **金刚位图标容器 (King-Kong Quick Actions)**：全角色统一采用浅紫微底衬 `bg-indigo-50 text-indigo-700 border border-indigo-100`，彻底废除原本粉、绿、蓝、黄彩虹杂色，恢复工具级规整与呼吸感；
   - **主操作按钮 (Primary CTA)**：统一使用稳重高饱和度 `bg-indigo-600 hover:bg-indigo-700 text-white`（如 ClassIn 唤醒、主要提交）；
   - **次要操作按钮**：`bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200`；
   - **移动端底栏 (Bottom Nav)**：激活项统一高亮为 `text-indigo-600`，未激活统一为 `text-slate-400`；
   - **孩子通用昵称标签**：统一收敛为浅紫蓝徽标 `bg-indigo-50 text-indigo-700 border border-indigo-100`。
3. **第三层：语义告警与状态反馈层 (Semantic Feedback, 10% 严格受控)**：
   - 严禁将语义告警色滥用于常规图标；仅在真正需要用户警惕或决策时触发：
   - 🔴 **危险 / 熔断 / 异常 (Danger / Rose)**：`text-rose-700 bg-rose-50 border-rose-200`（仅用于：`<3h 阶梯时间熔断锁定`、外教 <24h 紧急请假、顶栏未读消息小红点、开课倒计时 `<3h`）；
   - 🟠 **警示 / 待办 / 待补 (Warning / Amber)**：`text-amber-800 bg-amber-50 border-amber-300`（仅用于：`72h 续费预占 HOLD 催续`、课后评语尚未提交补录、周转账单待确认）；
   - 🟢 **成功 / 充足 / 完成 (Success / Emerald)**：`text-emerald-700 bg-emerald-50 border-emerald-200`（仅用于：课后反馈已写、时间充足可免费挪位、转账审核已通过）。
4. **第四层：业务看板专属特例 (7-Color Calendar Grid)**：
   - 7 色 Design Tokens 仅限周度日历排班网格单元格微卡片独占（详见下文 3.2 节），全站其他区域禁止使用彩虹杂色，确保排课看板成为唯一的视觉焦点。

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
