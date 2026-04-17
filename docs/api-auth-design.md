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
- 白名单路由（不需要 token）：`/api/auth/login`、`/api/auth/logout`、`/api/auth/refresh`、`/api/auth/captcha`、`/api/auth/feishu/auth-url`、`/api/auth/feishu/callback`、`/api/health`。
- RBAC 权限校验通过 `requirePermission()` 在具体 handler 中执行。
- 组操作权限通过 `requireGroupPermission()` 校验（组负责人或对应 scope 的管理角色）。

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
| POST | /api/auth/refresh | 否 | 刷新访问令牌 |
| PUT | /api/auth/password | 是 | 修改密码 |
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

### 文档组管理 (groups)

| 方法 | 路径 | 鉴权 | 权限/条件 | 说明 |
| --- | --- | --- | --- | --- |
| GET | /api/groups/tree | 是 | 登录即可 | 获取完整文档组树（三分类） |
| GET | /api/groups/:id | 是 | 登录即可 | 组详情 |
| POST | /api/groups | 是 | 按 scope 校验 | 创建组 |
| PUT | /api/groups/:id | 是 | 组负责人或 scope 管理角色 | 编辑组 |
| DELETE | /api/groups/:id | 是 | 组负责人或 scope 管理角色 | 删除组（含文件/子组时拒绝） |

### 组成员管理 (group-members)

| 方法 | 路径 | 鉴权 | 权限/条件 | 说明 |
| --- | --- | --- | --- | --- |
| GET | /api/groups/:id/members | 是 | 登录即可 | 组成员列表 |
| POST | /api/groups/:id/members | 是 | 组管理权限 | 批量添加成员 |
| PUT | /api/groups/:id/members/:memberId | 是 | 组管理权限 | 修改成员权限 |
| DELETE | /api/groups/:id/members/:memberId | 是 | 组管理权限 | 移除成员（软删除） |
| GET | /api/users/tree | 是 | 登录即可 | 部门 + 部门下用户树（成员选择器数据源） |

> 组管理权限：组负责人、对应 scope 的管理角色（company_admin / dept_head / pl_head）或组内管理员（role=1 的成员）。

### 产品线管理 (product-lines)

| 方法 | 路径 | 鉴权 | 权限码 | 说明 |
| --- | --- | --- | --- | --- |
| GET | /api/product-lines | 是 | 登录即可 | 产品线列表 |
| POST | /api/product-lines | 是 | super_admin | 创建产品线 |
| PUT | /api/product-lines/:id | 是 | super_admin | 编辑产品线 |
| DELETE | /api/product-lines/:id | 是 | super_admin | 删除产品线（含组时拒绝） |

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
  "token": "access-jwt-string",
  "refreshToken": "refresh-jwt-string",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshExpiresIn": 604800,
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

### 3.22 POST /api/auth/refresh

刷新访问令牌。客户端在 accessToken 过期前用 refreshToken 换取新的 accessToken。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| refreshToken | string | 是 | 刷新令牌 |

**成功响应 data：**
```json
{ "token": "new-access-jwt", "tokenType": "Bearer", "expiresIn": 900 }
```

**错误码：** AUTH_TOKEN_INVALID（refreshToken 无效或已被吊销）

---

### 3.23 PUT /api/auth/password

修改当前用户密码。成功后吊销该用户所有 refreshToken。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| oldPassword | string | 是 | 原密码 |
| newPassword | string | 是 | 新密码（≥8位） |

**成功响应 data：** null

**错误码：** INVALID_PARAMS, AUTH_INVALID_CREDENTIALS（原密码错误）

---

### 3.24 POST /api/version/compare

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

### 3.25 GET /api/groups/tree

获取完整文档组树结构（公司层 / 按部门 / 按产品线三个分类）。

**成功响应 data：** `NavTreeCategory[]`，详见设计文档 `docs/superpowers/specs/2026-04-16-group-crud-tree-design.md` §2.1。

---

### 3.26 GET /api/groups/:id

获取组详情。

**成功响应 data：**
```json
{
  "id": 40001, "name": "公司文档中心", "description": "企业级公共文档目录",
  "scopeType": 1, "scopeRefId": null, "parentId": null,
  "ownerUserId": 10002, "ownerName": "文档负责人",
  "approvalEnabled": 1, "fileSizeLimitMb": 100,
  "allowedFileTypes": null, "fileNameRegex": null,
  "status": 1, "fileCount": 5,
  "createdBy": 10001, "createdAt": 1713254400000, "updatedAt": 1713254400000
}
```

**错误码：** INVALID_PARAMS, GROUP_NOT_FOUND

---

### 3.27 POST /api/groups

创建组。创建者自动成为组负责人并加入成员表（管理员角色）。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 组名称（1-150 字符） |
| description | string | 否 | 描述（≤500 字符） |
| scopeType | number | 是 | 1=公司层 2=部门 3=产品线 |
| scopeRefId | number | 条件 | scopeType=2/3 时必填 |
| parentId | number | 否 | 父组 ID（创建子组时传入） |

**权限：** 公司层需 super_admin/company_admin；部门需 dept_head；产品线需 pl_head/super_admin；子组需组负责人。

**错误码：** INVALID_PARAMS, PERMISSION_DENIED, GROUP_NAME_EXISTS, PARENT_GROUP_NOT_FOUND

---

### 3.28 PUT /api/groups/:id

编辑组信息。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 否 | 新名称 |
| description | string | 否 | 新描述 |

**权限：** 组负责人或对应 scope 管理角色。

**错误码：** INVALID_PARAMS, GROUP_NOT_FOUND, PERMISSION_DENIED, GROUP_NAME_EXISTS

---

### 3.29 DELETE /api/groups/:id

删除组（软删除）。含文件或子组时拒绝。

**权限：** 组负责人或对应 scope 管理角色。

**错误码：** GROUP_NOT_FOUND, PERMISSION_DENIED, GROUP_HAS_DOCUMENTS, GROUP_HAS_CHILDREN

---

### 3.34 GET /api/groups/:id/members

获取组成员列表，按「组负责人→管理员→加入时间」排序。

**成功响应 data：** `GroupMember[]`

```json
[{
  "id": 60001, "userId": 10002, "name": "张三",
  "email": "zhang@example.com", "avatar": "https://...",
  "role": 1, "sourceType": 1, "immutableFlag": 1,
  "joinedAt": 1713254400000
}]
```

字段说明：
- `role`：1=管理员 / 2=可编辑 / 3=上传下载
- `sourceType`：1=手动添加 / 2=飞书同步 / 3=继承
- `immutableFlag`：1=不可修改/移除（组负责人或继承成员）

**错误码：** INVALID_PARAMS, GROUP_NOT_FOUND

---

### 3.35 POST /api/groups/:id/members

批量添加组成员。已存在的 userId 自动跳过，不报错。

**Body：**

```json
{
  "members": [
    { "userId": 10002, "role": 3 },
    { "userId": 10003, "role": 2 }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| members | array | 是 | 成员数组，长度 1-50 |
| members[].userId | number | 是 | 用户 ID |
| members[].role | number | 是 | 1/2/3，见角色含义 |

**成功响应 data：** `{ added: number, skipped: number }`

**权限：** 组管理权限（组负责人 / scope 管理角色 / 组内管理员）。

**错误码：** INVALID_PARAMS, GROUP_NOT_FOUND, PERMISSION_DENIED

---

### 3.36 PUT /api/groups/:id/members/:memberId

修改指定成员的权限。组负责人（immutable_flag=1）不可修改。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| role | number | 是 | 1=管理员 / 2=可编辑 / 3=上传下载 |

**权限：** 组管理权限。

**错误码：** INVALID_PARAMS, GROUP_NOT_FOUND, PERMISSION_DENIED, MEMBER_IMMUTABLE

---

### 3.37 DELETE /api/groups/:id/members/:memberId

移除组成员（软删除，设置 deleted_at）。

**规则：**
- `immutable_flag=1`（组负责人/继承成员）不可移除
- 不可移除自己

**权限：** 组管理权限。

**错误码：** INVALID_PARAMS, GROUP_NOT_FOUND, PERMISSION_DENIED, MEMBER_IMMUTABLE, MEMBER_SELF_REMOVE

---

### 3.38 GET /api/users/tree

返回部门列表 + 部门下用户，供成员选择器使用。数据来源为本地已同步的 `doc_departments` + `doc_feishu_users` + `doc_users`。同一用户可能属于多个部门，会在多个部门下重复出现。

**Query：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| groupId | number | 否 | 传入时返回数据中标记已是该组成员的用户（`joined: true`） |

**成功响应 data：**

```json
{
  "departments": [
    {
      "id": 1, "name": "技术部", "memberCount": 5,
      "members": [
        {
          "id": 10001, "name": "张三",
          "email": "zhang@example.com", "avatar": "https://...",
          "joined": false
        }
      ]
    }
  ]
}
```

---

### 3.39 GET /api/product-lines

产品线列表（含负责人名称）。

**成功响应 data：**
```json
[{
  "id": 30001, "name": "DocFlow产品线", "description": "企业文档管理系统产品线",
  "ownerUserId": 10002, "ownerName": "文档负责人", "status": 1,
  "groupCount": 1, "createdAt": 1713254400000
}]
```

---

### 3.40 POST /api/product-lines

创建产品线。创建者自动成为负责人。**权限：** super_admin。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 产品线名称 |
| description | string | 否 | 描述 |

**错误码：** INVALID_PARAMS, PERMISSION_DENIED, PRODUCT_LINE_NAME_EXISTS

---

### 3.41 PUT /api/product-lines/:id

编辑产品线。**权限：** super_admin。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 否 | 新名称 |
| description | string | 否 | 新描述 |

**错误码：** INVALID_PARAMS, PRODUCT_LINE_NOT_FOUND, PERMISSION_DENIED, PRODUCT_LINE_NAME_EXISTS

---

### 3.42 DELETE /api/product-lines/:id

删除产品线（软删除）。含组时拒绝。**权限：** super_admin。

**错误码：** PRODUCT_LINE_NOT_FOUND, PERMISSION_DENIED, PRODUCT_LINE_HAS_GROUPS

---

## 4. 数据与安全说明

1. 登录用户来源：doc_users（status=1 且 deleted_at IS NULL）。
2. 密码策略：用户维度 bcrypt 密码哈希（`password_hash` 字段）。
3. Token 策略：双令牌 JWT — accessToken（15m）+ refreshToken（7d），refreshToken 存 Redis 支持吊销。
4. logout 为无状态接口，幂等可重复调用。

## 5. 后续演进建议

1. 补充登录审计写入 doc_operation_logs。
2. 统一认证失败限流策略（IP + 账号维度）。
