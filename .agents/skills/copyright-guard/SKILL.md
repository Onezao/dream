---
name: copyright-guard
description: 自动化检查并为 Dream 项目中的所有源代码文件（TS, JS, Vue）补全标准版权声明头。
---

# Copyright Guard Skill

## Instructions
当你创建新文件、修改现有文件或执行“合规性审计”时，必须遵循以下步骤：

1. **版权头检查与补全**：
   - 检查文件第一行是否包含：`/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */`
   - 如果缺失或不准确，必须立即补全。

2. **强制范围**：
   - 重点覆盖 `dream-frontend/src/`、`dream-backend/src/`、`dream-worker/src/`、`dream-core/src/` 目录下的所有 `.ts`, `.js`, `.vue` 文件。
   - 业务逻辑文件（Services, Controllers, Mappers）是重中之重。

3. **排除范围 (Exclusions)**：
   - 严禁修改 `node_modules/`, `dist/`, `.git/`, `.venv/`。
   - 忽略编译产物、图标、图片等非源码资源。
   - 排除 `docs/` 中的 Markdown 需求与规范文档。

4. **审计与合规**：
   - 当用户要求“检查项目合规性”时，扫描全项目各应用的 `src/` 目录并报告缺失情况。
   - 对于外部库源码（非自研），严禁随意替换其原有版权信息。

## Available Resources
- `GEMINI.md`: 包含项目基础声明标准。
