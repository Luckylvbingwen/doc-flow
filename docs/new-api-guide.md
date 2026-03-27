# 新建接口开发指南

> 从数据库到页面调用的完整步骤，适用于 DocFlow 项目。

## 流程总览

```
SQL 建表/改表 → server/api/ 写 Handler → 鉴权白名单(可选) → types/ 定义类型 → 页面 useAuthFetch() 调用 → 更新接口文档
```

---

## 1. 数据库（如需新表/新字段）

在 `docs/` 下编写 SQL 补丁文件并手动执行，项目不使用 Prisma migration。

执行完 SQL 后同步更新 `prisma/schema.prisma` 保持模型一致。

## 2. 后端 API Handler

在 `server/api/` 下按 **Nuxt 文件路由约定** 创建文件：

- 文件名格式：`<name>.<method>.ts`，如 `index.get.ts`、`index.post.ts`、`[id].put.ts`
- 路径即路由，例：`server/api/rbac/roles/index.get.ts` → `GET /api/rbac/roles`

### Handler 模板

```ts
// server/api/xxx/index.get.ts
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
	// 1) 权限校验（如需要）
	const denied = await requirePermission(event, 'some:permission')
	if (denied) return denied

	// 2) 读取参数
	//    GET  → getQuery(event)
	//    POST → await readBody(event)
	const query = getQuery(event)

	// 3) 参数校验
	// if (!xxx) return fail(event, 400, 'INVALID_PARAMS', '参数不能为空')

	// 4) 数据库操作
	const rows = await prisma.$queryRaw`SELECT ...`

	// 5) 统一响应
	return ok(rows)
})
```

### 关键工具函数（自动导入，无需 import）

| 函数 | 来源 | 用途 |
|---|---|---|
| `ok(data, msg?)` | `server/utils/response.ts` | 返回成功响应 |
| `fail(event, status, code, msg)` | `server/utils/response.ts` | 返回失败响应 |
| `requirePermission(event, perm)` | `server/utils/permission.ts` | RBAC 权限校验 |

- `event.context.user` — 鉴权中间件自动注入的当前用户（含 `id`、`name`、`email`）

### 统一响应结构

所有接口统一返回：

```json
{ "success": true,  "code": "OK",           "message": "操作成功", "data": {} }
{ "success": false, "code": "INVALID_PARAMS", "message": "参数错误" }
```

## 3. 鉴权白名单（仅公开接口需要）

默认所有 `/api/**` 请求都需要 JWT 鉴权。如果新接口**无需登录即可访问**，需在 `server/middleware/auth.ts` 白名单中添加路径：

```ts
if (
	path === '/api/auth/login' ||
	path === '/api/your-new-public-endpoint' ||  // ← 新增
	// ...
) {
	return
}
```

> ⚠️ 禁止用 `startsWith` 通配，必须逐个添加。

## 4. 类型定义

类型**必须独立成文件**，不要内联在页面或 Handler 中。

| 位置 | 用途 |
|---|---|
| `types/` | 前端类型（`api.ts`、`rbac.ts`、`ws.ts`、`integration.ts`） |
| `server/types/` | 服务端类型（如 DB 行类型） |

统一响应类型已在 `types/api.ts` 定义：

- `ApiResponse<T>` — 成功响应
- `ApiError` — 失败响应
- `ApiResult<T>` — 成功 | 失败
- `PaginatedData<T>` — 分页数据
- `PaginatedResponse<T>` — 分页响应快捷类型

## 5. 前端调用

使用 `useAuthFetch()` 发起请求（自动带 token，401 自动跳登录页）：

```ts
import type { ApiResponse, PaginatedData } from '~/types/api'

// GET 请求
const res = await useAuthFetch<ApiResponse<SomeType>>('/api/xxx', {
	query: { page: 1, pageSize: 20 }
})

// POST 请求
const res = await useAuthFetch<ApiResponse<null>>('/api/xxx', {
	method: 'POST',
	body: { name: 'test' }
})
```

### 时间字段处理

- 后端所有时间字段统一返回**毫秒时间戳**
- 前端使用 `utils/format.ts` 的 `formatTime(value)` 格式化显示

## 6. 更新接口文档

所有新增接口**必须同步更新** `docs/api-auth-design.md`，包括：

- 接口总览表
- 详细参数 / 响应 / 错误码说明

---

## 快速检查清单

- [ ] SQL 已执行，`schema.prisma` 已同步
- [ ] `server/api/` 下 Handler 已创建，路由命名正确
- [ ] 参数校验完整，使用 `ok()` / `fail()` 统一响应
- [ ] 需要鉴权的接口已加 `requirePermission()`
- [ ] 公开接口已加入 `server/middleware/auth.ts` 白名单
- [ ] 前后端类型已在 `types/` 或 `server/types/` 中定义
- [ ] 页面使用 `useAuthFetch()` 调用
- [ ] `docs/api-auth-design.md` 已更新
