# DocFlow 认证模块接口设计（账密版）

## 1. 目标与范围

当前阶段先提供本地账密登录能力，不接入飞书 OAuth/SSO。

本设计文档用于：

- 统一认证接口命名与响应结构。
- 明确错误码规范，减少前后端联调歧义。
- 为后续新增认证接口（登出、刷新、当前用户）提供扩展基线。

## 2. 接口总览

### 2.1 已实现

1. POST /api/auth/login
2. POST /api/auth/logout

### 2.2 预留（后续可补充）

1. POST /api/auth/refresh
2. GET /api/auth/me

## 3. 通用约定

### 3.1 请求头

- Content-Type: application/json

### 3.2 通用响应结构

成功：

```json
{
  "success": true,
  "code": "OK",
  "message": "登录成功",
  "data": {}
}
```

失败：

```json
{
  "success": false,
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "账号或密码错误"
}
```

### 3.3 错误码规范

| code | HTTP | 说明 |
| --- | --- | --- |
| AUTH_INVALID_PARAMS | 400 | 参数缺失或格式不正确 |
| AUTH_INVALID_CREDENTIALS | 401 | 账号或密码错误 |
| AUTH_INTERNAL_ERROR | 500 | 服务内部错误 |

## 4. 详细接口设计

## 4.1 POST /api/auth/login

### 入参

```json
{
  "account": "admin@docflow.local",
  "password": "Docflow@123"
}
```

字段说明：

- account: string，必填。当前支持邮箱（doc_users.email）或飞书 open_id（doc_users.feishu_open_id）。
- password: string，必填。当前为演示环境统一密码，由 AUTH_DEMO_PASSWORD 控制。

### 出参（成功）

```json
{
  "success": true,
  "code": "OK",
  "message": "登录成功",
  "data": {
    "token": "base64-string",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "user": {
      "id": 10001,
      "name": "系统管理员",
      "email": "admin@docflow.local",
      "feishuOpenId": "fs_open_admin"
    }
  }
}
```

字段说明：

- token: 演示 token（当前未做服务端持久化）。
- tokenType: 固定 Bearer。
- expiresIn: 过期秒数，当前 86400。
- user: 登录用户基础信息。

### 失败示例

参数错误：

```json
{
  "success": false,
  "code": "AUTH_INVALID_PARAMS",
  "message": "账号和密码不能为空"
}
```

账号或密码错误：

```json
{
  "success": false,
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "账号或密码错误"
}
```

服务异常：

```json
{
  "success": false,
  "code": "AUTH_INTERNAL_ERROR",
  "message": "登录服务暂不可用，请稍后重试"
}
```

## 4.2 POST /api/auth/logout

### 入参

```json
{
  "token": "optional-token"
}
```

字段说明：

- token: string，可选。当前版本仅用于兼容前端传参，服务端不做持久化校验。

### 出参（成功）

```json
{
  "success": true,
  "code": "OK",
  "message": "退出登录成功"
}
```

### 行为说明

1. 后端返回成功结果，前端清理本地会话（token/user/expiresAt）。
2. 前端跳转到登录页，完成登录-退出闭环。

## 5. 数据与安全说明

1. 当前登录用户来源：doc_users（status=1 且 deleted_at IS NULL）。
2. 当前密码策略：演示密码（AUTH_DEMO_PASSWORD）。
3. 当前 token 策略：仅前端本地存储，适合本地联调，不适合生产。
4. 当前 logout 为无状态接口，幂等可重复调用。

## 6. 后续演进建议

1. 将统一密码替换为用户维度密码哈希（bcrypt/argon2）。
2. 引入服务端会话或 JWT 签名与刷新机制。
3. 新增接口鉴权中间件（校验 Authorization: Bearer）。
4. logout 接口增加服务端 token 拉黑或会话失效逻辑。
5. 补充登录审计写入 doc_operation_logs（action=auth.login/auth.logout）。
6. 统一认证失败限流策略（IP + 账号维度）。

## 7. 文件落点

- 接口实现：server/api/auth/login.post.ts
- 接口实现：server/api/auth/logout.post.ts
- 页面实现：pages/login.vue
- 前端会话状态：stores/auth.ts
- 顶部退出交互：layouts/prototype.vue
- 运行时配置：nuxt.config.ts（authDemoPassword）
