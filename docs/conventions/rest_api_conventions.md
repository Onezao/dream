/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# REST API 开发与交互规范 (REST API Conventions)

本文档规定了 Dream 后端 API 的设计标准，涵盖请求校验、标准响应、异常处理及安全防越权机制。

---

## 1. 响应格式规范 (Response Format)

所有 API 响应保持统一结构，便于前端拦截器统一处理。

### 1.1 成功响应 (Success)
- **HTTP 状态码**: `200 OK` 或 `201 Created`。
- **Body 结构**: 统一包裹在 `data` 字段中：
  ```json
  {
    "data": {
      "id": "1234567890ab",
      "nickname": "AliceZ12"
    }
  }
  ```
- **分页列表响应**:
  ```json
  {
    "data": [
      { "id": "1234567890ab", "status": "scheduled" }
    ],
    "meta": {
      "total": 36,
      "page": 1,
      "pageSize": 20
    }
  }
  ```

### 1.2 错误响应 (Error)
- **HTTP 状态码**: 4xx / 5xx。
- **Body 结构**:
  ```json
  {
    "error": "TS cannot be cancelled within 3 hours",
    "code": "TS_LOCKDOWN_VIOLATION",
    "timestamp": "2026-11-03T12:00:00Z"
  }
  ```

---

## 2. 请求数据校验 (Validation)

系统强制使用 **Fail-Fast** 模式进行请求校验。

- **推荐集成**: `zod` + `fastify-type-provider-zod`。
- **规范**: 路由必须显式声明 `schema`，实现 TypeScript 静态类型推导与运行时入参拦截：
  ```typescript
  app.post('/api/dream/v1/orders/purchase', {
    schema: {
      body: z.object({
        studentProfileId: z.string().length(12),
        teacherId: z.string().length(12),
        lessonCount: z.number().int().positive(),
        totalPoints: z.number().int().positive(),
        hasExtraFee: z.boolean().default(false),
        forceSubmit: z.boolean().default(false) // 防呆金额强提醒确认后强行落盘入参
      })
    }
  }, controller.createPurchaseOrder.bind(controller));
  ```

### 2.1 防呆强提醒与强制提交交互契约 (Force Submit Pattern)
- 购课录单时若实填金额与系统根据公式计算的标准总积分不一致，且 `forceSubmit !== true`：
  - 后端直接抛出 `400 Bad Request`，包含错误码 `PRICE_CALCULATION_MISMATCH` 与对比数据：
    ```json
    {
      "error": "Input points do not match standard pricing formula",
      "code": "PRICE_CALCULATION_MISMATCH",
      "data": {
        "expectedPoints": 360,
        "providedPoints": 320,
        "formula": "10 lessons × (standard 32 + tool 2 + extra 10)"
      }
    }
    ```
  - 前端据此弹出“强提醒确认弹窗”，用户点击“确认强制提交”后，携带 `forceSubmit: true` 重新发起请求，后端放行落盘。

---

## 3. 身份验证与纵深防越权 (Auth & IDOR Defense)

### 3.1 身份认证 (Authentication)
- 统一使用 JWT。
- 路由层挂载 `preHandler: JwtAuthHook`（来自 `@topeetop/shared-core`），解析后的账号与角色信息注入 `request.user`。

### 3.2 纵深防越权 (IDOR Defense)
- **绝对底线**：永远不要相信前端传递的归属权 ID。
- **实现规则**：
  - 从 `request.user.id` 获取当前登录账号的真实 `accountId`。
  - Service 层查询和更新学生档案、购课单、留言板时，必须传入 `accountId` 并在 SQL 中作为物理过滤条件。
  - **严禁**：`updateStudentProfile(profileId, data)`。
  - **必须**：`updateStudentProfile(accountId, profileId, data)`，SQL 强制 `WHERE id = profileId AND account_id = accountId`。

### 3.3 Header 上下文穿透与档案归属校验 (`X-Profile-Id`)
针对家长端多孩“全局档案切换器（Profile Switcher）”，规范如下：
- **请求头规范**：前端在进行与具体学生档案关联的操作（如查课表、约临时课、查看留言板）时，请求头统一携带 `X-Profile-Id: <12位学生档案ID>`。
- **中间件防越权强校验**：
  - 后端中间件检测到 `X-Profile-Id` 时，**必须物理校验该档案是否属于当前登录账号**：
    `SELECT 1 FROM dream.student_profiles WHERE id = :profileId AND account_id = :accountId AND deleted_at IS NULL;`
  - 若档案不属于当前登录账号，立即抛出 `ApiError('Forbidden: Profile does not belong to your account', 403, 'PROFILE_ACCESS_DENIED')`，杜绝横向越权。
  - 校验通过后，注入至 `request.currentProfileId` 供后续 Controller/Service 使用。

---

## 4. 异常处理哲学 (Error Handling)

- **统一异常类**：系统强制使用 `@topeetop/shared-core` 中定义的 `ApiError` 抛出业务异常。
- **状态码对应原则**：
  - `400`：Zod 参数校验不通过，或业务状态机校验失败（如排期时间冲突、购课防呆未确认等）。
  - `401`：未登录或 Token 失效。
  - `403`：权限不足或越权访问（如家长尝试查看“仅内部教学可见”的留言）。
  - `404`：目标档案、单据或时段不存在。
  - `409`：并发排期冲突（如该空闲时段已被其他学生抢先预约）。
  - `500`：服务器内部错误。

### 4.1 全栈双语与错误码交互契约 (i18n & ErrorCode Contract)
对齐 `@topeetop/auth-core` 官方规范，系统贯彻**“后端传标准 Code 与英文 Fallback，前端按 Code 翻译双语”**：
1. **标准错误响应结构**：
   ```json
   {
     "error": "Class is already full",
     "code": "CLASS_FULL",
     "timestamp": "2026-11-06T12:00:00Z"
   }
   ```
   - `code`：机器可读的全局大写业务错误码，作为前端多语言包翻译的唯一 Key。
   - `error`：人类可读的标准英文诊断信息，供日志审计或前端未配置对应词条时的安全回退展示。
2. **两道防线校验机制**：
   - **第一道防线（前端 UI 表单即时交互）**：所有页面表单组件（TDesign Form）在客户端直接绑定基于 `vue-i18n` 的规则，输入不合规时本地即时标红提示当前语言，绝不发起无效网络请求。
   - **第二道防线（后端 Zod 强校验防御底线）**：绕过前端或直接请求接口时，触发 Zod 校验拦截，返回 `400 Bad Request` 与 `VALIDATION_ERROR`，前端拦截器统一转换并呈现本地化提示。
