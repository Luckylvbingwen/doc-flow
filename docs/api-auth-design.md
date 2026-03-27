# DocFlow API 接口文档

> **约定：所有新增接口设计完成后必须同步更新本文档。**

## 1. 通用约定

### 1.1 请求头

- Content-Type: application/json
- Authorization: Bearer \<token\>（需要鉴权的接口）

### 1.2 通用响应结构

成功：

```json
{
  "success": true,
  "code": "OK",
  "message": "操作成功",
  "data": {}
}
```

失败：

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "错误描述"
}
```

### 1.3 鉴权机制

- 全局中间件 `server/middleware/auth.ts` 对 `/api/**` 路由统一拦截。
- 白名单路由（不需要 token）：`/api/auth/login`、`/api/auth/logout`、`/api/auth/captcha`、`/api/auth/feishu/**`、`/api/health`。
- RBAC 权限校验通过 `requirePermission()` 在具体 handler 中执行。

### 1.4 通用错误码

| code | HTTP | 说明 |
| --- | --- | --- |
| AUTH_TOKEN_MISSING | 401 | 未携带 Authorization 头 |
| AUTH_TOKEN_INVALID | 401 | Token 无效或已过期 |
| PERMISSION_DENIED | 403 | 无对应权限 |

---

## 2. 接口总览

### 系统

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | /api/health | 否 | 健康检查 |

### 认证 (auth)

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | /api/auth/login | 否 | 账密登录 |
| POST | /api/auth/logout | 否 | 退出登录 |
| GET | /api/auth/me | 是 | 获取当前用户信息 |
| GET | /api/auth/captcha | 否 | 获取点选验证码 |
| GET | /api/auth/feishu/auth-url | 否 | 获取飞书 OAuth 授权地址 |
| POST | /api/auth/feishu/callback | 否 | 飞书 OAuth 回调登录 |

### RBAC 权限管理

| 方法 | 路径 | 鉴权 | 权限码 | 说明 |
| --- | --- | --- | --- | --- |
| GET | /api/rbac/permissions | 是 | permission:read | 权限列表 |
| GET | /api/rbac/users | 是 | role:assign | 可分配角色的用户列表 |
| GET | /api/rbac/roles | 是 | role:read | 角色列表（分页） |
| POST | /api/rbac/roles | 是 | role:create | 创建角色 |
| GET | /api/rbac/roles/:id | 是 | role:read | 角色详情（含权限） |
| PUT | /api/rbac/roles/:id | 是 | role:update | 更新角色 |
| DELETE | /api/rbac/roles/:id | 是 | role:delete | 删除角色（软删除） |
| PUT | /api/rbac/roles/:id/permissions | 是 | role:update | 设置角色权限（全量替换） |
| GET | /api/rbac/user-roles | 是 | role:read | 用户-角色关联列表 |
| POST | /api/rbac/user-roles/assign | 是 | role:assign | 为用户分配角色 |
| POST | /api/rbac/user-roles/revoke | 是 | role:assign | 撤销用户角色 |

### 飞书集成 (integrations/feishu)

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | /api/integrations/feishu/users | 是 | 飞书用户列表（本地表） |
| POST | /api/integrations/feishu/notify | 是 | 发送飞书消息 |
| POST | /api/integrations/feishu/sync-contacts | 是 | 同步飞书通讯录 |

### 版本比较

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | /api/version/compare | 是 | 文档版本比较 |

### 定时任务

| 任务名 | cron | 说明 |
| --- | --- | --- |
| feishu:sync-contacts | 0 2 * * *（每天凌晨 2:00） | 自动同步飞书通讯录 |

---

## 3. 接口详情

### 3.1 GET /api/health

健康检查。

**响应：**
```json
{ "ok": true, "service": "docflow", "time": "2026-03-27T..." }
```

---

### 3.2 POST /api/auth/login

账密登录，支持点选验证码。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| account | string | 是 | 邮箱或飞书 open_id |
| password | string | 是 | 密码（演示环境统一密码） |
| captchaToken | string | 条件 | 验证码 token |
| captchaClicks | ClickPoint[] | 条件 | 点选坐标数组 |

**成功响应 data：**
```json
{
  "token": "jwt-string",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "user": { "id": 1, "name": "管理员", "email": "admin@docflow.local", "feishuOpenId": "", "avatar": "" }
}
```

**错误码：** AUTH_INVALID_PARAMS, CAPTCHA_INVALID, AUTH_INVALID_CREDENTIALS, AUTH_INTERNAL_ERROR

---

### 3.3 POST /api/auth/logout

退出登录（无状态，幂等）。

**Body：** 无（或空对象）

**成功响应 data：** null

---

### 3.4 GET /api/auth/me

获取当前登录用户信息，含角色与权限码。

**成功响应 data：**
```json
{
  "id": 1,
  "name": "管理员",
  "email": "admin@docflow.local",
  "avatar": "",
  "roles": ["admin"],
  "permissions": ["role:read", "role:create", ...]
}
```

**错误码：** AUTH_REQUIRED, AUTH_TOKEN_MISSING, AUTH_TOKEN_INVALID

---

### 3.5 GET /api/auth/captcha

获取点选验证码图片（SVG）。

**成功响应 data：**
```json
{
  "svg": "<svg>...</svg>",
  "token": "captcha-session-token",
  "prompt": "请依次点击: A, B, C",
  "width": 300,
  "height": 200
}
```

---

### 3.6 GET /api/auth/feishu/auth-url

获取飞书 OAuth 授权跳转地址。

**Query：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| redirectUri | string | 是 | 回调地址 |

**成功响应 data：**
```json
{ "authUrl": "https://open.feishu.cn/...", "state": "random-state" }
```

**错误码：** FEISHU_NOT_CONFIGURED, PARAM_MISSING

---

### 3.7 POST /api/auth/feishu/callback

飞书 OAuth 回调，用授权码换取用户信息并签发 JWT。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| code | string | 是 | 飞书授权码 |
| state | string | 是 | 状态校验 |

**成功响应 data：** 同 login 接口

**错误码：** PARAM_MISSING, STATE_EXPIRED, FEISHU_USER_EMPTY, FEISHU_LOGIN_ERROR

---

### 3.8 GET /api/rbac/permissions

获取全部权限列表。**权限：** permission:read

**成功响应 data：**
```json
[{ "id": 1, "code": "role:read", "name": "查看角色", "module": "rbac", "description": "", "sortOrder": 1 }]
```

---

### 3.9 GET /api/rbac/users

获取可分配角色的用户列表（下拉选择用）。**权限：** role:assign

**Query：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| keyword | string | 否 | 模糊搜索 |

**成功响应 data：**
```json
[{ "id": 1, "name": "管理员", "email": "admin@docflow.local" }]
```

---

### 3.10 GET /api/rbac/roles

角色列表（分页，含权限数和用户数）。**权限：** role:read

**Query：**

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 20 | 每页条数（≤100） |
| keyword | string | 否 | | 模糊搜索 |

**成功响应 data：**
```json
{
  "list": [{ "id": 1, "code": "admin", "name": "管理员", "description": "", "isSystem": 1, "status": 1, "permissionCount": 10, "userCount": 2, "createdAt": "" }],
  "total": 5,
  "page": 1,
  "pageSize": 20
}
```

---

### 3.11 POST /api/rbac/roles

创建角色。**权限：** role:create

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| code | string | 是 | 角色编码（字母数字下划线） |
| name | string | 是 | 角色名称 |
| description | string | 否 | 描述 |
| status | number | 否 | 1=启用, 0=禁用 |

**错误码：** INVALID_PARAMS, INVALID_CODE, ROLE_CODE_EXISTS

---

### 3.12 GET /api/rbac/roles/:id

角色详情（含已分配权限列表）。**权限：** role:read

**成功响应 data：**
```json
{
  "id": 1, "code": "admin", "name": "管理员", "description": "", "isSystem": 1, "status": 1, "createdAt": "",
  "permissions": [{ "id": 1, "code": "role:read", "name": "查看角色", "module": "rbac", "description": "", "sortOrder": 1 }]
}
```

**错误码：** INVALID_PARAMS, ROLE_NOT_FOUND

---

### 3.13 PUT /api/rbac/roles/:id

更新角色基本信息（系统内置角色不可修改）。**权限：** role:update

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 角色名称 |
| description | string | 否 | 描述 |
| status | number | 否 | 状态 |

**错误码：** INVALID_PARAMS, ROLE_NOT_FOUND, SYSTEM_ROLE_PROTECTED

---

### 3.14 DELETE /api/rbac/roles/:id

软删除角色（系统内置角色不可删除）。**权限：** role:delete

**错误码：** INVALID_PARAMS, ROLE_NOT_FOUND, SYSTEM_ROLE_PROTECTED

---

### 3.15 PUT /api/rbac/roles/:id/permissions

设置角色权限（全量替换）。**权限：** role:update

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| permissionIds | number[] | 是 | 权限 ID 列表 |

**错误码：** INVALID_PARAMS, ROLE_NOT_FOUND

---

### 3.16 GET /api/rbac/user-roles

用户-角色关联列表（分页）。**权限：** role:read

**Query：**

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 20 | 每页条数（≤100） |
| keyword | string | 否 | | 模糊搜索用户 |
| roleId | number | 否 | | 按角色筛选 |

**成功响应 data：**
```json
{
  "list": [{ "id": 1, "userId": 1, "userName": "管理员", "userEmail": "", "roleId": 1, "roleCode": "admin", "roleName": "管理员", "createdAt": "" }],
  "total": 10,
  "page": 1,
  "pageSize": 20
}
```

---

### 3.17 POST /api/rbac/user-roles/assign

为用户分配角色。**权限：** role:assign

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | number | 是 | 用户 ID |
| roleId | number | 是 | 角色 ID |

**错误码：** INVALID_PARAMS, USER_NOT_FOUND, ROLE_NOT_FOUND, ALREADY_ASSIGNED

---

### 3.18 POST /api/rbac/user-roles/revoke

撤销用户角色。**权限：** role:assign

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | number | 是 | 用户 ID |
| roleId | number | 是 | 角色 ID |

**错误码：** INVALID_PARAMS, NOT_FOUND

---

### 3.19 GET /api/integrations/feishu/users

获取已同步的飞书用户列表（从 doc_feishu_users 表查询）。

**Query：**

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| status | string | 否 | normal | normal / hidden / all |
| keyword | string | 否 | | 模糊搜索昵称/邮箱 |

**成功响应 data：**
```json
[{
  "id": 1, "username": "zhangsan", "nickname": "张三",
  "email": "", "mobile": "", "avatar": "",
  "status": "normal",
  "feishuOpenId": "", "feishuUnionId": "", "feishuUserId": "",
  "linkedUserId": null, "linkedUserName": null
}]
```

---

### 3.20 POST /api/integrations/feishu/notify

发送飞书消息给指定用户。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| openId | string | 是 | 接收者 open_id |
| msgType | string | 否 | text（默认）或 card |
| text | string | 条件 | msgType=text 时必填 |
| card | object | 条件 | msgType=card 时必填 |

**成功响应 data：** `{ "sent": true }`

**错误码：** PARAM_MISSING, FEISHU_SEND_ERROR

---

### 3.21 POST /api/integrations/feishu/sync-contacts

同步飞书组织架构通讯录到 doc_feishu_users 表。同时由定时任务 `feishu:sync-contacts` 每天凌晨 2:00 自动调用。

**Body：** 无

**成功响应 data：**
```json
{ "total": 150, "departments": 12, "created": 5, "updated": 140, "hidden": 2 }
```

**错误码：** FEISHU_SYNC_ERROR

---

### 3.22 POST /api/version/compare

文档版本内容比较。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| fromVersion | number | 是 | 起始版本号 |
| toVersion | number | 是 | 目标版本号 |

**响应：**
```json
{ "ok": true, "fromVersion": 1, "toVersion": 2, "summary": "..." }
```

---

## 4. 数据与安全说明

1. 登录用户来源：doc_users（status=1 且 deleted_at IS NULL）。
2. 当前密码策略：演示环境统一密码（AUTH_DEMO_PASSWORD）。
3. Token 策略：JWT 签名，默认 8h 过期。
4. logout 为无状态接口，幂等可重复调用。

## 5. 后续演进建议

1. 将统一密码替换为用户维度密码哈希（bcrypt/argon2）。
2. 引入 JWT 刷新机制（refresh token）。
3. logout 增加服务端 token 拉黑。
4. 补充登录审计写入 doc_operation_logs。
5. 统一认证失败限流策略（IP + 账号维度）。
