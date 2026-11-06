# Dream (教务排班与分账管理系统)

> 教务排班与分账管理系统 (Dream) 是一套专注于少儿与成人英语培训场景的高并发教务排课、7 色日历调度、财课分离与多角色分账归集系统。

---

## 一、 系统架构与 Monorepo 划分

本项目采用现代 Monorepo 工程结构进行代码组织：

```
dream/
├── dream-frontend/             # 前端统一 Web 应用 (Vue 3 + Vite + Tailwind CSS + TDesign)
├── dream-backend/              # 核心业务 HTTP API 服务 (Fastify Node.js)
├── dream-worker/               # 后台独立批处理服务 (02:00 自动结课、周末周结单、邮件兜底)
├── dream-core/                 # 共享领域与数据核心库 (@topeetop/dream-core)
│   ├── src/db/                 # 统一数据访问层 (一表一 Mapper 唯一真相源)
│   ├── src/modules/            # 5 大业务模块领域服务 (TS 状态机、分账计算器)
│   └── src/types/              # 实体与领域 DTO 契约
├── db-schema/                  # PostgreSQL 结构定义与版本化迁移脚本 (migration_vxxx.sql)
└── docs/                       # 需求文档与工程规范体系 (Conventions)
```

---

## 二、 核心技术栈

- **Frontend**：Vue 3, Pinia, Vue Router, Vite, **TDesign Mobile (`tdesign-mobile-vue`) / TDesign Web (`tdesign-vue-next`)**, **Tailwind CSS**（100% Tailwind，严禁任何手写 CSS）。
- **Backend**：**Fastify** Node.js, **TypeScript**（严格模式，禁用 `any`）。
- **Database**：**PostgreSQL**（统一单 Schema `dream`，利用事务与 `SELECT FOR UPDATE` 原生行级锁实现并发防超卖）。
- **Validation**：**Zod**（Fail-Fast 启动及路由入参强校验）。
- **Testing**：**Jest**（单元与集成测试）, **Playwright**（E2E 测试）。
- **Object Storage**：**Cloudflare R2**（海外）/ **腾讯云 COS**（国内）客户端预签名直传。
- **Build / Infra**：tsup, esbuild, Docker (Zero-Install Pattern), Google Cloud Build, Artifact Registry。基础设施全面复用 **topee.top**。

---

## 三、 五大核心业务模块

1. **模块一：教学教务档案中心 (Master Data & Profile)**
   - 账号（Account）与档案（Profile）分离架构，支持 1 个家长账号挂载多孩档案（`AliceZ12` 命名规约）；四重工作台（管理员/班长/家长/教师）物理隔离与多孩全局切换器。
2. **模块二：订单与课时资产管理 (Order & Asset)**
   - 购课出资 1:1 转换积分按单裂变待排期 TS；固定位 4 倍数弱提醒；防呆校验强提醒公式与 `force_submit: true` 强行落盘；12.5% 请假配额向下取整算法；垫底退款。
3. **模块三：智能排班与日程管控 (Scheduling & Dispatch)**
   - 7 色日历视图渲染（🟠固定位、🟡临时课、🔵被代课、🟣代上课、⚪不可约、🟢空闲、🔴已请假）；代课双视角；财课分离课程转让（同家庭直转/跨家庭精准匹配）；`SELECT FOR UPDATE` 行级排他锁防超卖。
4. **模块四：中央财务结算与归集 (Financial Settlement & Clearing)**
   - 次日凌晨 02:00 定时跑批自动结课；异常未上课回退补生 TS 机制；班长周转账单（小班课自负盈亏与自动预留盈余）；双周度单据（教师课酬单去班长化只出节数不出金额，平台工具费单无状态报表）。
5. **模块五：家校互动与消息中心 (CRM & Notification)**
   - 双级隐私简易留言板（🔓师生公开 vs 🔒仅内部教学可见）；三级消息通知分发（站内信、未读超时补发 Email、紧急通知并发派发）。

---

## 四、 本地开发端口规范

- `5173`：`dream-frontend` (Vite 开发服务)
- `8070`：`dream-backend` (教务业务核心后端 API)
- `8072`：`dream-worker` (后台批处理与定时任务)

---

## 五、 工程规范与设计文档索引

- [全局开发指引与红线 (GEMINI.md)](./GEMINI.md)
- [UI 视觉与设计系统 (DESIGN.md)](./DESIGN.md)
- [工程与编码规范 (docs/CODING_STANDARDS.md)](./docs/CODING_STANDARDS.md)
- [核心业务规则与财务分账规约 (docs/BUSINESS_RULES.md)](./docs/BUSINESS_RULES.md)
- [需求规格说明书 (Prd-v5.md)](./docs/Prd-v5.md)

---

*(c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential.*
