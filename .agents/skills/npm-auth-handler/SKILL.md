---
name: npm-auth-handler
description: 专门处理 @topeetop/* 系列私有包安装失败（401/403 权限错误）的自动化修复与认证维护。
---

# NPM Auth Troubleshooting Skill

## Overview
专门用于处理 `@topeetop/*` 系列私有包在 Google Artifact Registry 中的权限错误。

## Authentication Flow (推荐方案)
遵循 [运维与部署规范](../../docs/conventions/ops_conventions.md)，优先使用 **Service Account Key** 进行持久化认证：

1. **环境准备**：
   确保执行环境已加载凭据路径（GCP 密钥）：
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="~/Documents/ravll9-aff11159d2b6.json"
   ```

2. **执行认证刷新**：
   运行以下命令，工具将自动更新 `.npmrc` 配置，支持本地开发及 CloudBuild 构建：
   ```bash
   npx google-artifactregistry-auth
   ```

## CloudBuild 构建中的应用
在构建流水线中，必须首先执行认证步骤：
```yaml
steps:
  - name: node:20
    args:
      - -c
      - |
        echo "@topeetop:registry=https://asia-northeast1-npm.pkg.dev/$PROJECT_ID/topee-npm-repo/" > .npmrc
        npx google-artifactregistry-auth --repo-config=.npmrc --credential-config=.npmrc
```

## Troubleshooting
如果在 `npm install` 期间出现 `401 Unauthorized`：
1. 检查 `GOOGLE_APPLICATION_CREDENTIALS` 环境变量是否指向正确的物理文件。
2. 执行 `gcloud auth login` (如果是在本地环境且无 Key)。
3. 检查 `.npmrc` 中是否包含正确的仓库地址及凭据映射。

## Available Resources
- `docs/conventions/ops_conventions.md`: 包含私有库认证标准。
- `ravll9-aff11159d2b6.json`: 项目指定的访问凭据。
