/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# UI 架构与视觉开发标准 (UI Architecture Standards)

本文档规定了 Dream 前端 Web 应用（`dream-frontend`）的 UI 架构、组件选型与视觉规范。

---

## 1. 核心架构：工作台物理隔离与档案切换

### 1.1 多角色“工作台物理隔离” (Workspace Switcher)
针对“一个自然人拥有多重身份”（例如管理员兼任部分老师的班长，同时又是给自己孩子约课的家长）的业务现状，系统实施严格的**工作台物理隔离**：
- **常驻切换器**：页面顶部常驻【工作台视图切换器】，可无缝在以下四套工作台切换：
  - **管理员后台**：以**黑金**为主色调，专注于全局排期调配、财务总账与平台工具费核算。
  - **班长工作台**：以**深靛蓝**为主色调，专注于所辖教师团队、负责小班、线下收款录单与周度上交平台转账。
  - **家长工作台**：以**清新浅色**为主色调，专注于多孩档案管理、剩余课次预约、同师挪位与课程转让。
  - **教师课表**：以**极简中性色**为主色调，专注于 7 色个人排期、留言板互动与代课交接。
- **物理菜单与路由隔离**：四套视图采用截然不同的导航菜单与状态存储，严防跨角色误操作。

### 1.2 多孩家庭“全局档案切换器” (Profile Switcher)
- 在【家长工作台】顶部常驻档案切换下拉框（如 `当前查看：大宝 AliceZ12 ▼`）。
- 切换后，页面下方关联的**课表、购课单、待排期 TS 列表、简易留言板**联动响应刷新。

---

## 2. UI 组件库搭配策略

- **移动端优先场景 (`tdesign-mobile-vue`)**：
  - 家长端约课日历、学生个人档案、手机端快速留言与临时课预约，统一采用 **`tdesign-mobile-vue`** 标准组件，保证移动端触摸与滑动体验。
- **管理与复杂报表场景 (`tdesign-vue-next`)**：
  - 管理员与班长工作台排班网格、跨教师/学生的分账对账看板、双周结算导出表，搭配 **`tdesign-vue-next`** 桌面级组件。

---

## 3. 样式开发规范 (100% Tailwind CSS)

- **严禁手写 CSS**：
  - **严禁在前端代码中编写任何手写 CSS（包括 `.vue` 文件中的 `<style>` 块或外部 `.css` 文件）**。
  - 所有间距、色彩、阴影、对齐、过渡动画必须 100% 使用 Tailwind CSS 原子类。
- **安全渲染红线**：
  - 严禁在页面无防护使用 `v-html`，防止 XSS 攻击注入。
- **弹窗与遮罩层级 (Z-Index)**：
  - 全局顶部工作台切换条：`z-30`
  - 底部移动端导航栏：`z-40`
  - 抽屉与遮罩 Modal：`z-50`
  - 消息 Toast / 告警提示：`z-[100]`

---

## 4. PWA 与设备适配规范 (Mobile & Tablet Responsive)

系统以 **PWA (Progressive Web App)** 为标准交付形态，兼顾手机端触摸敏捷性与平板端大屏生产力：
- **Web App Manifest & Service Worker**：
  - 集成 `vite-plugin-pwa`，配置独立应用模式（`display: standalone`）、启动图标（192x192, 512x512）与应用背景色。
  - 支持手机与平板端浏览器“添加到主屏幕 (Add to Home Screen)”。
- **全响应式断点规范 (Tailwind Breakpoints)**：
  - **手机端 (`< 768px`)**：默认视口，单列流式排版，底部常驻移动导航栏，抽屉式浮层交互。
  - **平板端 (`md: >= 768px`)**：自适应切换为双列/卡片网格布局，课表支持按周多列平铺，侧边栏折叠收起。
  - **桌面端 (`lg: >= 1024px`)**：全功能管理工作台、固定左侧侧边栏、复杂对账看板完整展开。

---

## 5. 端侧数据缓存分级策略 (Client-side Caching Hierarchy)

为保障弱网可用与高一致性，浏览器端数据实施四级缓存架构：

| 缓存级别 | 适用数据对象 | 缓存介质与策略 | 失效与更新机制 |
| :--- | :--- | :--- | :--- |
| **L1: 强缓存 (App Shell)** | 静态资源、HTML 离线壳、Web Fonts、图标 | CacheStorage (`CacheFirst`) | 随应用发版更新（hash 指纹驱动） |
| **L2: 静态字典与会话上下文** | 课程类型字典 (`course_types`)、教师定级标准、当前账号信息、名下学生档案、`activeProfileId` | LocalStorage + Pinia (`StaleWhileRevalidate`) | 24小时 TTL，或在用户切换档案/修改偏好时主动广播失效 |
| **L3: 业务只读快照** | 教师公开脱敏列表、当周 7 色已排课表快照 | IndexedDB (`NetworkFirst with Cache Fallback`) | 优先网络拉取，弱网/断网自动降级读取本地缓存并标记“离线只读” |
| **L4: 绝对零离线 (强制在线)** | 购课单支付、退款单、向平台转账单、排班并发抢位 (`SELECT FOR UPDATE`) | **严禁缓存 (NetworkOnly)** | 断网状态下操作按钮强制置灰禁用，Toast 提示“离线模式不可用” |

---

## 6. 全站中英文双语规范 (i18n Standards)

- **核心架构**：基于 `vue-i18n` (Composition API 驱动)，提供 `zh-CN` 与 `en-US` 语言包。
- **覆盖深度**：
  - 页面导航、工作台标题、角色标签。
  - 表单 Label、Placeholder、校验错误提示。
  - 7 色日历状态枚举（如：`固定位 / Fixed Slot`、`被代课 / Substituted`）。
  - 后端 API 业务错误码（如 `NICKNAME_ALREADY_EXISTS`、`CLASS_FULL` 国际化文案映射）。
- **错误码统一拦截与自动翻译（对齐 Topee-Auth 范式）**：
  - 前端统一请求封装在捕获非 2xx 响应时，优先提取 `error.code || error.errorCode`：
    ```typescript
    const code = error.code || error.errorCode;
    const key = `errors.${code}`;
    let message = error.error || error.message || t('common.failed');
    if (code && i18n.global.te(key)) {
      message = i18n.global.t(key);
    }
    // 抛出经过多语言翻译的 Error 供 UI 组件 Toast 呈现
    throw new Error(message);
    ```
  - 语言包中集中以 `errors.<CODE>` 维护（如 `errors.CLASS_FULL`、`errors.ALREADY_ENROLLED`），确保无论后端抛出何种已知业务错误，界面均呈现当前语言。
- **表单输入校验第一道防线**：
  - 所有表单交互组件必须在客户端绑定基于 `i18n` 的响应式 rules（如 `t('form.rules.required')`），在用户触发提交前即时完成本地化校验与标红，避免向后端发送无效请求导致粗暴回退。
- **无刷新切换与持久化**：
  - 顶部导航栏提供全局语言切换下拉框。
  - 语言首选项持久化存入 `localStorage.getItem('dream_locale')`，初次访问自动匹配 `navigator.language`。
