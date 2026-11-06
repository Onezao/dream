---
name: deployment-ops
description: 用于 Dream 项目中各应用（dream-frontend, dream-backend, dream-worker）的多环境构建、部署及健康检查自动化。
---

# Deployment Operations Skill

## Instructions

执行构建、容器化或部署任务时，必须严格遵循 [工程与编码规范](../../docs/CODING_STANDARDS.md#8-生产构建容器化与运维部署规范) 并参考 `deploy/<app-name>/cloudbuild.yaml`。

### 1. 环境感知 (Environment Awareness)
- **多环境架构**：区分 Dev、国内生产 (engtop.top) 与 海外生产 (topee.top)。
- **基础设施复用**：基础设施与域名生态全面复用 **topee.top**。
- **配置注入**：在本地模拟或 Cloud Run 部署时，必须确认环境变量已通过 Secret Manager 或 `.env.dev` 正确加载。

### 2. 构建与 Docker 规范
- **Dockerfile 标准**：强制采用“CI 侧组装，容器内零安装（Zero-Install Pattern）”。
  - 基础镜像：使用 `node:20-alpine`，最小化攻击面。
  - 镜像内容：剥离源码与开发依赖，仅包含混淆后的 `dist`、生产 `node_modules` 与静态资源。
- **发布标准**：生产环境镜像必须经过混淆（`esbuild --minify` + `javascript-obfuscator`）且开启 `NODE_ENV=production`。

### 3. 本地验证 (Pre-flight Check)
- **逻辑同步**：构建镜像前检查 `cloudbuild.yaml` 确保构建步骤逻辑与最新规范一致。
- **健康检查**：容器启动后，必须调用定义的 Path（如 `GET /` 或 `GET /health`）验证服务存活及 DB 连通性。
- **资源释放**：本地调试服务验证完毕后，必须立即主动杀掉进程释放本地端口（`5173`, `8070`, `8072`）。

### 4. 自动化提交
- 仅在本地健康检查通过且用户授权后，方可执行：
  ```bash
  gcloud builds submit --config deploy/<app-name>/cloudbuild.yaml .
  ```

## 重要约束
- **严禁**将包含 Token 的 `.npmrc` 提交至仓库。
- **严格打标**：发布生产环境必须使用语义化版本 Tag（如 `v1.0.0`），由 `git-master` 辅助执行。

## Available Resources
- `docs/CODING_STANDARDS.md`: 核心运维设计标准与镜像构建规范。
- `deploy/`: 包含各应用的 `Dockerfile` 和 `cloudbuild.yaml`。
