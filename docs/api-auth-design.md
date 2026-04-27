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

### 组审批流配置 (approval-template)

| 方法 | 路径 | 鉴权 | 权限/条件 | 说明 |
| --- | --- | --- | --- | --- |
| GET | /api/groups/:id/approval-template | 是 | 组管理权限 | 读取组审批配置（模板不存在时兜底默认值） |
| PUT | /api/groups/:id/approval-template | 是 | 组管理权限 | 整包保存审批配置（开关 + 模式 + 审批人有序列表） |

> 组管理权限等同「组成员管理」：组负责人 / scope 管理角色 / 组内管理员（role=1）。

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

### 操作日志 (logs)

| 方法 | 路径 | 鉴权 | 权限 | 说明 |
| --- | --- | --- | --- | --- |
| GET | /api/logs | 是 | log:read | 操作日志列表（分页，支持按类型/关键词/日期范围筛选） |

### 通知中心 (notifications)

| 方法 | 路径 | 鉴权 | 权限/条件 | 说明 |
| --- | --- | --- | --- | --- |
| GET | /api/notifications | 是 | 仅读自己 | 通知列表（分页，支持分类/只看未读筛选） |
| GET | /api/notifications/unread-count | 是 | 仅读自己 | 未读数（总数 + 按分类） |
| PUT | /api/notifications/:id/read | 是 | 仅 owner | 标记单条已读 |
| PUT | /api/notifications/read-all | 是 | 仅当前用户 | 全部标为已读（可按 category） |

### 回收站 (recycle-bin)

| 方法 | 路径 | 鉴权 | 权限 | 说明 |
| --- | --- | --- | --- | --- |
| GET | /api/recycle-bin | 是 | recycle:read | 回收站列表（分页，支持组/删除人/时间范围/关键词筛选；按角色自动过滤数据范围） |
| GET | /api/recycle-bin/filter-groups | 是 | recycle:read | "按组筛选"下拉源（远程分页，只返回回收站里有数据的组） |
| POST | /api/recycle-bin/restore | 是 | recycle:restore | 批量恢复（1-50 条，原组被删的条目放入 failed 列表） |
| POST | /api/recycle-bin/purge | 是 | recycle:delete | 批量永久删除（软删 `deleted_at` 标记，不可恢复） |

### 审批中心 (approvals)

| 方法 | 路径 | 鉴权 | 权限/条件 | 说明 |
| --- | --- | --- | --- | --- |
| GET | /api/approvals | 是 | 仅操作自己相关 | 审批列表（按 tab 分三路：待我审批/我发起的/我已处理；分页，支持状态筛选） |
| POST | /api/approvals/:id/withdraw | 是 | 仅发起人 + reviewing | 撤回审批（status=5） |
| GET | /api/documents/:id/approvals | 是 | doc:read | 单文档审批历史（PRD §6.3.4 文件详情底部「审批记录」TAB；不分页） |

### 个人中心 (personal)

| 方法 | 路径 | 鉴权 | 权限/条件 | 说明 |
| --- | --- | --- | --- | --- |
| GET | /api/personal/documents | 是 | 仅操作自己相关 | 聚合列表（tab: all/mine/shared/favorite/handover；分页 + 状态/关键词筛选） |
| DELETE | /api/documents/:id/draft | 是 | 仅 owner + 草稿 | 删除草稿（软删 status=6 + 进回收站） |

### 收藏 / 置顶 (documents favorite & pin)

| 方法 | 路径 | 鉴权 | 权限/条件 | 说明 |
| --- | --- | --- | --- | --- |
| POST | /api/documents/:id/favorite | 是 | 登录即可（幂等） | 收藏文档，返回 `{ isFavorited: true }` |
| DELETE | /api/documents/:id/favorite | 是 | 登录即可（幂等） | 取消收藏，返回 `{ isFavorited: false }` |
| POST | /api/documents/:id/pin | 是 | 组管理员 / 上游管理员（requireMemberPermission） | 置顶文档，返回 `{ isPinned: true }` |
| DELETE | /api/documents/:id/pin | 是 | 同上 | 取消置顶，返回 `{ isPinned: false }` |

> 读端 `GET /api/documents` 与 `GET /api/documents/:id` 响应中已含 `isFavorited` / `isPinned` / `canPin` 字段供前端按钮显示。

### 文档级权限 (document permissions)

| 方法 | 路径 | 鉴权 | 权限/条件 | 说明 |
| --- | --- | --- | --- | --- |
| GET | /api/documents/:id/permissions | 是 | 组管理员（requireMemberPermission） | 弹窗初始数据：`{ groupMembers, customPerms }`（PRD §6.3.4 文档级权限设置弹窗） |
| PUT | /api/documents/:id/permissions | 是 | 同上 | 整包替换：body `{ perms: [{ userId, permission: 2|3 }, ...] }`，事务 diff + 操作日志 |

> 读端 `GET /api/documents` 与 `GET /api/documents/:id` 响应已含 `hasCustomPermissions`（行/详情级橙锁图标）与 `canManagePermissions`（按钮 / 菜单可见性）。
> permission 取值集对齐 `doc_group_members.role`：`1管理员 / 2可编辑 / 3上传下载 / 4可阅读`，文档级弹窗仅暴露 `[2, 3]`，分享 ACL 仅暴露 `[2, 4]`。

### 定时任务

| 任务名 | cron | 说明 |
| --- | --- | --- |
| feishu:sync-contacts | 0 2 * * *（每天凌晨 2:00） | 自动同步飞书通讯录 |
| approval:remind-timeout | 0 * * * *（每整点） | 审批超时催办扫描（M5 / M6 通知 + remind_count 状态机） |

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

### 3.39 GET /api/groups/:id/approval-template

读取组审批配置。模板不存在时兜底返回默认值（不写库）。

**成功响应 data：**

```json
{
  "approvalEnabled": 1,
  "mode": 1,
  "approvers": [
    { "userId": 10002, "name": "张三", "avatar": "https://...", "isOwner": true },
    { "userId": 10005, "name": "李四", "avatar": null, "isOwner": false }
  ]
}
```

字段说明：
- `approvalEnabled`：取自 `doc_groups.approval_enabled`（0/1）
- `mode`：1=依次审批 / 2=会签审批
- `approvers`：按 `order_no ASC` 返回，`isOwner` 表示是否当前组负责人

**错误码：** INVALID_PARAMS, GROUP_NOT_FOUND, PERMISSION_DENIED

---

### 3.40 PUT /api/groups/:id/approval-template

整包保存审批配置。服务端在一个事务内 upsert 模板、批量重建审批人 nodes、更新组总开关。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| approvalEnabled | number | 是 | 0 或 1 |
| mode | number | 是 | 1=依次 / 2=会签 |
| approverUserIds | number[] | 是 | 审批人 userId 数组（顺序即审批顺序，1..20，去重，`approvalEnabled=1` 时非空） |

**权限：** 组管理权限（组负责人 / scope 管理角色 / 组内管理员）。

**错误码：** INVALID_PARAMS, GROUP_NOT_FOUND, PERMISSION_DENIED, APPROVAL_APPROVERS_REQUIRED, APPROVAL_INVALID_APPROVER

---

### 3.41 GET /api/product-lines

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

### 3.42 POST /api/product-lines

创建产品线。创建者自动成为负责人。**权限：** super_admin。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 产品线名称 |
| description | string | 否 | 描述 |

**错误码：** INVALID_PARAMS, PERMISSION_DENIED, PRODUCT_LINE_NAME_EXISTS

---

### 3.43 PUT /api/product-lines/:id

编辑产品线。**权限：** super_admin。

**Body：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 否 | 新名称 |
| description | string | 否 | 新描述 |

**错误码：** INVALID_PARAMS, PRODUCT_LINE_NOT_FOUND, PERMISSION_DENIED, PRODUCT_LINE_NAME_EXISTS

---

### 3.44 DELETE /api/product-lines/:id

删除产品线（软删除）。含组时拒绝。**权限：** super_admin。

**错误码：** PRODUCT_LINE_NOT_FOUND, PERMISSION_DENIED, PRODUCT_LINE_HAS_GROUPS

---

### 3.45 GET /api/logs

操作日志列表。**权限：** `log:read`（super_admin / company_admin / dept_head / pl_head）。

**查询参数：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | 否 | 14 大类之一（`file_upload` / `file_edit` / `file_download` / `approval` / `file_publish` / `file_move` / `file_remove` / `permission` / `share` / `member` / `ownership` / `comment` / `org` / `favorite_pin`）；缺省=全部 |
| keyword | string | 否 | 模糊匹配操作人姓名 / 描述 / 所属组名，最长 100 字符 |
| startAt | string | 否 | 起始日期，格式 `YYYY-MM-DD`，含当天 |
| endAt | string | 否 | 结束日期，格式 `YYYY-MM-DD`，含当天 |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10，范围 1-100 |

**响应 data：** `PaginatedData<LogItem>`，`LogItem` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | number | 日志 ID |
| type | string | 14 大类（与 type 参数同枚举） |
| action | string | 具体 action，如 `doc.upload` |
| actorId | number | 操作人 ID；系统事件为 0 |
| actorName | string | 操作人姓名；系统事件显示「系统」 |
| description | string | 完整操作描述（取 `detail_json.desc`，兜底为 `action · target#id`） |
| groupName | string | 所属组名；无关联组显示 `-` |
| createdAt | number | 毫秒时间戳 |

**说明：**
- action → 14 类的聚合映射维护在 `server/constants/log-actions.ts` 的 `LOG_ACTION_TO_TYPE`
- 埋点纪律：一事件一日志；系统自动触发的副作用独立成条，`actor_user_id = 0`，`detail_json.triggeredBy` + `sourceLogId` 溯源因果（如审批通过后自动发布 = `approval.pass` + `doc.publish` 两条）

**错误码：** PERMISSION_DENIED, INVALID_PARAMS

---

### 3.46 GET /api/notifications

**路径**：`GET /api/notifications`
**鉴权**：JWT（不挂 `requirePermission`，仅通过 `event.context.user.id` 过滤，用户只能读自己的通知）

**Query**：
| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| category | number (1\|2\|3) | 否 | 1=审批通知 / 2=系统通知 / 3=成员变更；不传=全部 |
| onlyUnread | boolean | 否 | 默认 false；true 只返回未读 |
| page | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20，上限 50 |

**响应**（`ApiResponse<NotificationListResp>`）：
```json
{
  "success": true,
  "code": "OK",
  "message": "OK",
  "data": {
    "list": [
      {
        "id": "70001",
        "category": 1,
        "msgCode": "M1",
        "title": "王建国 提交了文件《xxx》的审批，请处理",
        "content": null,
        "bizType": "document",
        "bizId": "50001",
        "read": false,
        "readAt": null,
        "createdAt": 1713600000000
      }
    ],
    "total": 45,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 3.47 GET /api/notifications/unread-count

**路径**：`GET /api/notifications/unread-count`
**鉴权**：同上

**响应**：
```json
{
  "success": true,
  "code": "OK",
  "message": "OK",
  "data": {
    "total": 17,
    "byCategory": { "1": 5, "2": 8, "3": 4 }
  }
}
```

---

### 3.48 PUT /api/notifications/:id/read

**路径**：`PUT /api/notifications/:id/read`
**鉴权**：JWT，仅 owner（非 owner 返回 404）

**行为**：
- 已读幂等（已有 `read_at` 不覆盖）
- 操作后推 WS `'badge'` 消息更新未读数

**响应**：
```json
{ "success": true, "code": "OK", "message": "OK", "data": {} }
```

**错误码**：
- 400 `BAD_REQUEST` — ID 非纯数字
- 404 `NOT_FOUND` — 通知不存在或非本人拥有

---

### 3.49 PUT /api/notifications/read-all

**路径**：`PUT /api/notifications/read-all`
**鉴权**：JWT，仅影响当前用户

**Body**：
```json
{ "category": 1 }
```
- `category` 可选，不传=全部分类未读

**响应**：
```json
{
  "success": true,
  "code": "OK",
  "message": "OK",
  "data": { "updated": 5 }
}
```

---

### 3.50 GET /api/recycle-bin

**路径**：`GET /api/recycle-bin`
**鉴权**：JWT + `recycle:read`

**Query**：
- `keyword` 可选，文件名模糊匹配（≤100 字符）
- `groupId` 可选，按原仓库过滤（正整数）
- `deletedBy` 可选，按删除人 user.id 过滤
- `startAt` / `endAt` 可选，删除时间范围（`YYYY-MM-DD`，含当天；开始 ≤ 结束）
- `page` 默认 1，`pageSize` 默认 10，范围 [1, 100]

**数据范围（服务端自动按角色过滤）**：
- `super_admin` / `company_admin` → 全站
- `dept_head` → 本部门下的组（`sys_user_roles.scope_type=1` → `doc_groups.scope_type=2`）
- `pl_head` → 本产品线下的组（`sys_user_roles.scope_type=2` → `doc_groups.scope_type=3`）
- 其他用户 → 自己删除的 + 自己所在组里的

**响应**：
```json
{
  "success": true, "code": "OK", "message": "OK",
  "data": {
    "list": [
      {
        "id": 50005,
        "title": "[已删]研发规范过期版",
        "ext": "pdf",
        "groupId": 40002,
        "groupName": "研发规范组",
        "ownerUserId": 10003,
        "deletedByUserId": 10002,
        "deletedByName": "文档负责人",
        "deletedAt": 1744858800000,
        "fileSize": 512000,
        "versionCount": 1
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 10
  }
}
```

---

### 3.51 GET /api/recycle-bin/filter-groups

**路径**：`GET /api/recycle-bin/filter-groups`
**鉴权**：JWT + `recycle:read`

**Query**：
- `keyword` 可选，组名模糊匹配
- `page` 默认 1，`pageSize` 默认 20，范围 [1, 100]

**行为**：
- 仅返回回收站里"当前有数据"的组（`doc_documents.status=6` 且 `deleted_at_real IS NOT NULL`），避免空选项
- 数据范围过滤规则与 `GET /api/recycle-bin` 一致

**响应**：
```json
{
  "success": true, "code": "OK", "message": "OK",
  "data": {
    "list": [{ "id": 40002, "name": "研发规范组" }],
    "total": 3, "page": 1, "pageSize": 20
  }
}
```

---

### 3.52 POST /api/recycle-bin/restore

**路径**：`POST /api/recycle-bin/restore`
**鉴权**：JWT + `recycle:restore`

**Body**：
```json
{ "ids": [50005, 50006] }
```
- 1-50 个文档 id，去重由后端处理

**规则**：
- 仅对在数据范围内的 id 生效
- 恢复即：`status=4 已发布` / `deleted_at_real=NULL` / `deleted_by_user_id=NULL`
- 原组已被删除的条目 → 失败列表（`原组已被删除，无法恢复`）
- 每成功一条写一条 `recycle.restore` 操作日志

**响应**：
```json
{
  "success": true, "code": "OK",
  "message": "已恢复 2 项",
  "data": {
    "restoredCount": 2,
    "restoredIds": [50005, 50006],
    "failed": []
  }
}
```

**失败示例**：
```json
{
  "data": {
    "restoredCount": 1,
    "restoredIds": [50005],
    "failed": [
      { "id": 50099, "title": "-", "reason": "不存在或无权操作" }
    ]
  }
}
```

---

### 3.53 POST /api/recycle-bin/purge

**路径**：`POST /api/recycle-bin/purge`
**鉴权**：JWT + `recycle:delete`

**Body**：
```json
{ "ids": [50007] }
```

**规则**：
- "永久删除"实现为**全局软删**：`doc_documents.deleted_at` 和所有 `doc_document_versions.deleted_at` 同步标记为当前时间
- 其他关联表（annotations / comments / favorites / pins 等）不做级联，因应用层始终过滤 `doc.deleted_at IS NULL`
- 每成功一条写一条 `recycle.purge` 操作日志

**响应**：
```json
{
  "success": true, "code": "OK",
  "message": "已永久删除 1 项",
  "data": {
    "purgedCount": 1,
    "purgedIds": [50007],
    "failed": []
  }
}
```

---

### 3.54 GET /api/approvals

**路径**：`GET /api/approvals`
**鉴权**：JWT 登录即可；**不挂** `approval:read`，仅按 `event.context.user.id` 过滤

**Query**：
- `tab` 必填，`pending` / `submitted` / `handled`
- `status` 可选，2 审批中 / 3 已通过 / 4 已驳回 / 5 已撤回（pending tab 忽略此参数）
- `page` 默认 1，`pageSize` 默认 10，范围 [1, 100]

**三路 SQL**：
- `pending`：`doc_approval_instance_nodes.approver_user_id=self AND action_status=1 AND instance.status=2 AND instance.current_node_order=node.node_order`
- `submitted`：`doc_approval_instances.initiator_user_id=self`（叠加 status 筛选）
- `handled`：`doc_approval_instance_nodes.approver_user_id=self AND action_status IN (2,3)`（叠加 status 筛选）

**排序**：pending/submitted 按 `inst.created_at DESC`；handled 按 `node.action_at DESC`。

**「新增/迭代」徽章判定**：`SELECT COUNT(*) FROM doc_document_versions vc WHERE vc.document_id = inst.document_id AND vc.id < inst.biz_id AND vc.deleted_at IS NULL` = 0 → new；否则 iterate。

**响应**：
```json
{
  "success": true, "code": "OK", "message": "OK",
  "data": {
    "list": [
      {
        "id": 62001,
        "status": 2,
        "documentId": 50001,
        "title": "Alpha项目-技术方案",
        "ext": "pdf",
        "versionId": 51002,
        "versionNo": "v1.1",
        "changeType": "iterate",
        "groupId": 40004,
        "groupName": "Alpha项目组",
        "initiatorId": 10003,
        "initiatorName": "文档编辑",
        "submittedAt": 1744858800000,
        "handledAt": null,
        "currentApproverName": "审批人A",
        "allApproverNames": "审批人A,审批人B",
        "rejectReason": null,
        "remindCount": 0,
        "canWithdraw": false
      }
    ],
    "total": 1, "page": 1, "pageSize": 10
  }
}
```

---

### 3.55 POST /api/approvals/:id/withdraw

**路径**：`POST /api/approvals/:id/withdraw`
**鉴权**：JWT 登录即可（仅对自己发起的审批生效）

**规则**：
- 必须是 `inst.initiator_user_id = self`，否则 403 `APPROVAL_NOT_INITIATOR`
- 仅 `inst.status=2`（审批中）可撤回，其他状态返回 409 `APPROVAL_NOT_WITHDRAWABLE`
- 成功：`status=5`（已撤回）+ `finished_at=NOW()` + 写 `approval.withdraw` 操作日志

**响应**：
```json
{ "success": true, "code": "OK", "message": "已撤回审批", "data": { "id": 62001 } }
```

**错误码**：
- 400 `INVALID_PARAMS` — ID 非法
- 404 `APPROVAL_NOT_FOUND` — 审批实例不存在
- 403 `APPROVAL_NOT_INITIATOR` — 非发起人
- 409 `APPROVAL_NOT_WITHDRAWABLE` — 当前状态不可撤回

---

### 3.56 GET /api/personal/documents

**路径**：`GET /api/personal/documents`
**鉴权**：JWT 登录即可；不挂 `requirePermission`，均以 `event.context.user.id` 过滤

**Query**：
- `tab` 必填，`all` / `mine` / `shared` / `favorite` / `handover`
- `status` 可选 `1` 草稿 / `2` 编辑中 / `3` 审批中 / `4` 已发布（handover tab 忽略）
- `keyword` 可选，文件名模糊（≤100 字符）
- `page` 默认 1，`pageSize` 默认 10，范围 [1, 100]

**数据范围**（五路）：
- `mine`：`doc_documents.owner_user_id = self`
- `shared`：`doc_document_permissions.user_id = self AND d.owner <> self`（附带 `permissionLevel` 1 可编辑 / 2 可阅读）
- `favorite`：`doc_document_favorites.user_id = self`
- `all`：上述三路 UNION，按 id 去重，优先级 `mine > shared > favorite`（内存合并 + 分页）
- `handover`：**仅部门负责人**可访问（`doc_departments.owner_user_id = self` / `sys_user_roles.code=dept_head` / `doc_department_admins.user_id = self` 三者之一）。返回该负责人管辖部门下**已停用员工（`doc_users.status=0`）**名下的文档，按**员工分组**。非部门负责人 → 403 `HANDOVER_NOT_DEPT_HEAD`。

**「新增/迭代」判定**：由列表项 `changeType` 承担（同审批中心一致，此处沿用）。

**普通 tab 响应**：
```json
{
  "success": true, "code": "OK", "message": "OK",
  "data": {
    "list": [{
      "id": 50027, "title": "草稿-季度述职报告", "ext": "md",
      "status": 1, "groupId": null, "groupName": "-",
      "ownerUserId": 10001, "ownerName": "系统管理员",
      "versionNo": "-", "fileSize": 0, "updatedAt": 1744858800000,
      "source": "mine", "permissionLevel": null
    }],
    "total": 13, "page": 1, "pageSize": 10
  }
}
```

**handover 响应**：
```json
{
  "success": true, "code": "OK",
  "data": {
    "list": [{
      "userId": 10006, "userName": "普通成员", "avatarUrl": "...",
      "departmentId": 20002, "departmentName": "质量保障部",
      "leftAt": 1744858800000,
      "documents": [ /* PersonalDocItem[] */ ]
    }],
    "total": 1, "page": 1, "pageSize": 100
  }
}
```

---

### 3.57 DELETE /api/documents/:id/draft

**路径**：`DELETE /api/documents/:id/draft`
**鉴权**：JWT 登录即可

**规则**：
- 仅 `owner_user_id = self` 可删（否则 403 `DRAFT_NOT_OWNER`）
- 仅 `status=1`（草稿）可删（否则 409 `DRAFT_NOT_DELETABLE`）
- 软删：`status=6 / deleted_at_real=NOW() / deleted_by_user_id=self`
- 写 `doc.draft_delete` 操作日志

**响应**：
```json
{ "success": true, "code": "OK", "message": "已进入个人回收站，30天内可恢复", "data": { "id": 50027 } }
```

---

### 3.58 GET /api/admin/users

**路径**：`GET /api/admin/users`
**鉴权**：`admin:user_read`（仅 super_admin）

**Query 参数**：
- `keyword`：姓名 / 邮箱关键词
- `roles`：逗号分隔，支持 `super_admin` / `company_admin` / `pl_head` / `dept_head` / `none`（无任何系统角色）
- `status`：`all` / `active` / `deactivated`（默认 `all`）
- `page` / `pageSize`（默认 1 / 20，最大 100）

**返回**：每行多角色聚合 + 管理范围聚合，按"系统管理员→公司层→产品线→部门→无角色"权重排序。

```json
{
  "success": true, "code": "OK", "data": {
    "list": [{
      "id": 10001, "name": "系统管理员", "email": "admin@docflow.local",
      "avatarUrl": "https://...", "status": 1,
      "roles": [{ "code": "super_admin", "name": "系统管理员", "feishuSynced": false }],
      "scopes": {
        "companyAdmin": false,
        "productLines": [],
        "departments": []
      },
      "createdAt": 1744858800000, "deactivatedAt": null
    }],
    "total": 10, "page": 1, "pageSize": 20
  }
}
```

---

### 3.59 PUT /api/admin/users/:id/roles

**路径**：`PUT /api/admin/users/:id/roles`
**鉴权**：`admin:role_assign`（仅 super_admin）

**Body**：
```json
{ "companyAdmin": true, "plHead": false }
```

**规则**：
- 目标用户是 super_admin → 403 `ADMIN_SUPER_ADMIN_PROTECTED`（系统预设受保护）
- 取消 `plHead` 时若用户仍是任何产品线的 `owner_user_id` → 409 `ADMIN_PL_HEAD_HAS_OWNERSHIP`
- 不处理 `dept_head`（飞书同步只读）
- 事务内 INSERT / DELETE `sys_user_roles`；`company_admin` 全局 scope，`pl_head` 授予时 `scope_type=NULL`（候选身份），具体产品线归属由「创建/编辑产品线」入口建立
- 写 `admin.role_assign` 操作日志

**响应**：
```json
{ "success": true, "code": "OK", "message": "角色已更新",
  "data": { "changed": true, "changes": ["授予公司层管理员"] } }
```

---

### 3.60 POST /api/documents/:id/favorite

**鉴权**：登录即可（无专用权限码；任何员工可收藏自己能访问到的文档）

**规则**：
- 文档不存在 / `deleted_at` 或 `deleted_at_real` 任一非空 → 404 `DOCUMENT_NOT_FOUND`
- 幂等：已收藏 → 直接返回 ok，**不重写日志**；未收藏 → 新建 `doc_document_favorites` 行 + 写 `favorite.add` 操作日志

**响应**：
```json
{ "success": true, "code": "OK", "message": "已收藏", "data": { "isFavorited": true } }
```

---

### 3.61 DELETE /api/documents/:id/favorite

**鉴权**：登录即可

**规则**：
- 不强制校验文档是否存在（用户仍可清理自己历史的孤儿收藏记录）
- 幂等：已收藏 → 删除记录 + 写 `favorite.remove` 日志；未收藏 → 直接 ok

**响应**：
```json
{ "success": true, "code": "OK", "message": "已取消收藏", "data": { "isFavorited": false } }
```

---

### 3.62 POST /api/documents/:id/pin

**鉴权**：登录 + `requireMemberPermission`（组内 `role=1` 管理员、组负责人、或上游 `super_admin` / `company_admin` / `dept_head`（当组 scope=部门层）/ `pl_head`（当组 scope=产品线层））

**规则**：
- 文档不存在 / 已删除 → 404 `DOCUMENT_NOT_FOUND`
- 文档未归组（`group_id` 为空，个人草稿） → 409 `DOCUMENT_STATUS_INVALID`
- 幂等：已置顶 → 直接 ok；未置顶 → 新建 `doc_document_pins` 行（`pinned_by=self`、`group_id=doc.group_id`）+ 写 `pin.add` 日志

**响应**：
```json
{ "success": true, "code": "OK", "message": "已置顶", "data": { "isPinned": true } }
```

---

### 3.63 DELETE /api/documents/:id/pin

**鉴权**：同 3.62

**规则**：
- 幂等：已置顶 → 删除记录 + 写 `pin.remove` 日志；未置顶 → 直接 ok

**响应**：
```json
{ "success": true, "code": "OK", "message": "已取消置顶", "data": { "isPinned": false } }
```

---

### 3.64 GET /api/documents/:id/approvals

**路径**：`GET /api/documents/:id/approvals`

**鉴权**：登录 + `doc:read`（与文件详情页一致）

**用途**：PRD §6.3.4 文件详情底部「审批记录」TAB —— 以"文档"为中心列出该文档全部审批实例（含进行中），区别于 `/api/approvals` 的"以人为中心"。

**规则**：
- 文档不存在 / 已删除 → 404 `DOCUMENT_NOT_FOUND`
- 不分页：单文档审批量级一般 < 20 条，前端一次拿完
- 排序：`inst.created_at DESC, inst.id DESC`
- 字段集与 `/api/approvals` 列表项一致（`ApprovalItem`），区别：
  - `canWithdraw` 恒为 `false`（撤回入口在审批中心，详情页只读）
  - `currentApproverName` 仅当 `status=2`（审批中）时返回，其他状态为 `null`
  - `handledAt` 取 `inst.finished_at`（实例完结时间）

**响应**：
```json
{
  "success": true,
  "code": "OK",
  "data": [
    {
      "id": 50001,
      "status": 3,
      "documentId": 4001,
      "title": "产品需求文档.docx",
      "ext": "docx",
      "versionId": 6001,
      "versionNo": "v2.0",
      "changeType": "iterate",
      "groupId": 3001,
      "groupName": "产品组",
      "initiatorId": 10002,
      "initiatorName": "张三",
      "submittedAt": 1714123456000,
      "handledAt": 1714234567000,
      "currentApproverName": null,
      "allApproverNames": "李四,王五",
      "rejectReason": null,
      "remindCount": 0,
      "canWithdraw": false
    }
  ]
}
```

---

### 3.65 GET /api/documents/:id/permissions

**路径**：`GET /api/documents/:id/permissions`

**鉴权**：登录 + 组管理员（requireMemberPermission：组内 role=1 / 组负责人 / super_admin / company_admin / 当组在 dept_head/pl_head 的 scope）

**用途**：PRD §6.3.4 文档级权限设置弹窗的初始数据 — 组成员只读区 + 已自定义条目

**规则**：
- 文档不存在 / 已删除 → 404 `DOCUMENT_NOT_FOUND`
- 文档未归组（个人草稿态 `group_id=null`）→ 409 `DOC_PERMISSION_NOT_IN_GROUP`
- 组成员只读区按"组负责人 → role 升序 → 加入时间"排序
- 文档级权限区按 `created_at ASC` 排序

**响应**：
```json
{
  "success": true,
  "code": "OK",
  "data": {
    "groupMembers": [
      { "userId": 10002, "name": "张晓明", "avatar": null, "role": 1, "isOwner": true },
      { "userId": 10003, "name": "李婷婷", "avatar": null, "role": 3, "isOwner": false }
    ],
    "customPerms": [
      {
        "id": 7001,
        "userId": 10003,
        "name": "李婷婷",
        "avatar": null,
        "permission": 2,
        "grantedBy": 10002,
        "grantedByName": "张晓明",
        "grantedAt": 1714234567000
      }
    ]
  }
}
```

---

### 3.66 PUT /api/documents/:id/permissions

**路径**：`PUT /api/documents/:id/permissions`

**鉴权**：同 3.65（组管理员）

**用途**：弹窗"保存权限"按钮 — 草稿模式整包替换（PRD §6.3.4）

**Body**：
```json
{ "perms": [{ "userId": 10003, "permission": 2 }, { "userId": 10004, "permission": 3 }] }
```

**约束**（Zod `docPermissionPutSchema`）：
- `permission` ∈ `[2, 3]`（可编辑 / 上传下载，文档级弹窗专属取值；可阅读 4 仅分享 ACL 用）
- `userId` 不重复，最多 200 条

**业务规则**：
- 文档未归组 → 409 `DOC_PERMISSION_NOT_IN_GROUP`
- 目标 user 必须是该组的活跃成员 → 否则 400 `DOC_PERMISSION_NOT_GROUP_MEMBER`
- 不允许给组负责人设置文档级权限 → 400 `DOC_PERMISSION_TARGET_INVALID`

**事务流程**：
1. 拉当前未软删条目，与 body 比对：
   - 新条目 → INSERT
   - 已有 + permission 不同 → UPDATE
   - 已有但不在 body → 软删（`deleted_at = NOW`）
2. 一事件一日志：每条 diff 写一条 `permission.doc_update` 操作日志，4 种 desc 区分语义：
   - 新增：`为「张三」设置文档级权限「可编辑」`
   - 升级：`将「王五」的文档级权限从「上传下载」升级为「可编辑」`
   - 降级：`将「赵六」的文档级权限从「可编辑」降级为「上传下载」`
   - 移除：`移除「李四」的文档级权限`

**响应**：
```json
{
  "success": true,
  "code": "OK",
  "message": "文档权限已保存",
  "data": { "inserted": 1, "updated": 0, "removed": 0 }
}
```

---

## 4. 数据与安全说明

1. 登录用户来源：doc_users（status=1 且 deleted_at IS NULL）。
2. 密码策略：用户维度 bcrypt 密码哈希（`password_hash` 字段）。
3. Token 策略：双令牌 JWT — accessToken（15m）+ refreshToken（7d），refreshToken 存 Redis 支持吊销。
4. logout 为无状态接口，幂等可重复调用。

## 5. 后续演进建议

1. 补充登录审计写入 doc_operation_logs。
2. 统一认证失败限流策略（IP + 账号维度）。
