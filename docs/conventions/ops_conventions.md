/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# 运维与部署规范 (Operations & Deployment Conventions)

本文档定义了 Dream 项目的持续集成（CI）、容器化构建（Docker）与生产环境治理规范。全面复用 **topee.top** 基础设施。

---

## 1. 运行环境与网络端口规范

### 1.1 多环境架构
- **本地开发环境 (Dev)**：
  - 前端：Vite Dev Server。
  - 后端：Fastify + `tsx` / `nodemon`。
  - 凭据从 `tmp/local_env.dev` 注入。
- **生产环境 (Production)**：
  - **海外主域**：`topee.top`（托管于 GCP Cloud Run，镜像构建自 Google Artifact Registry）。
  - **国内加速**：`engtop.top`（网关加速与 COS/PostgreSQL 托管）。
  - **配置安全**：通过环境变量密文与 Secret Manager 动态解密加载。

### 1.2 本地开发端口分配 (Local Port Conventions)
为了避免与已有项目（如 TopeeRead 占用的 8060）冲突，Dream 统一规定如下：
- **`5173`**：`dream-frontend` (Vite 开发服务)。
- **`8070`**：`dream-backend` (教务业务核心后端 API)。
- **`8072`**：`dream-worker` (独立后台批处理与定时任务)。

---

## 2. 构建规范 (CloudBuild & Dockerfile)

### 2.1 零安装原则 (Zero-Install Pattern)
采用“**CI 侧组装，容器内零安装**”哲学：
1. **CI 阶段（CloudBuild）**：
   - 注入 GCP 认证 (`npx google-artifactregistry-auth`) 并拉取 `@topeetop/*` 私有依赖。
   - 编译前端并构建后端混淆产物（`esbuild --minify` + `javascript-obfuscator`）。
   - 执行 `npm install --omit=dev` 精简依赖。
2. **Dockerfile 阶段**：
   - 基础镜像：统一采用精简安全的 `node:20-alpine`。
   - 镜像内部**严禁运行 `npm install`**。
   - 仅通过 `COPY` 指令将预组装好的 `dist/`、生产 `node_modules/` 与必要资源复制进镜像。

---

## 3. Git 提交与版本发布

- **Conventional Commits**：强制使用 `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`。
- **发布打标 (Tagging)**：生产发布必须在主干测试通过后打语义化 Tag（如 `v1.0.0`），由 `git-master` 辅助执行。
- **资源清理铁律**：本地启动端口调试后，必须立即主动杀掉进程释放端口。
