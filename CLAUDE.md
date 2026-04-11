# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

DocFlow 是一个基于 **Nuxt 3 + Nitro + Prisma** 的全栈文档管理平台，前后端同仓。前端使用 Vue 3 Composition API + Element Plus，后端使用 Nitro (H3) + MySQL + Redis。项目开发完成后会抽离为 `nuxt-fullstack-starter` 模板仓库，因此通用功能必须与业务解耦。

## 常用命令

```bash
# 开发
npm run dev                          # 启动开发服务器 (SSR)
docker compose up -d db redis        # 仅启动 MySQL + Redis
npm run prisma:generate              # 生成 Prisma Client

# 构建
npm run build                        # 生产构建
ANALYZE=true npm run build           # 生成 bundle 分析报告 (stats.html)

# 测试
npm test                             # 运行所有测试
npm run test:unit                    # 仅单元测试 (tests/unit/)
npm run test:watch                   # 监听模式
npm run test:coverage                # 覆盖率报告

# 代码检查
npm run lint                         # ESLint 检查
npm run lint:fix                     # 自动修复
```

pre-commit hook (husky + lint-staged) 会对暂存的 `*.{js,ts,vue,mjs}` 文件自动执行 `eslint --fix`。

## 架构

### 前后端分层

```
api/           → 前端 API 调用封装 (对接 server/api/)
composables/   → Vue 3 组合式函数 (useAuth, useAuthFetch, useNotify, useWs 等)
stores/        → Pinia 状态管理 (app, auth, ws 三个 store)
pages/         → 文件路由 (Nuxt file-based routing)
layouts/       → 布局: default (主布局), auth (登录页), prototype
components/    → Vue 组件
plugins/       → Nuxt 插件 (按数字编号加载顺序: 01-nprogress → 04-locale)
middleware/    → 路由守卫 (auth.global.ts)
i18n/          → 国际化翻译文件 (zh-CN, en-US)

server/
├── api/       → HTTP 路由处理 (Nitro event handlers, 文件名约定: login.post.ts)
├── middleware/ → 服务端中间件 (JWT 校验, 注入 event.context.user)
├── schemas/   → Zod 校验 schema
├── utils/     → 服务端工具 (prisma, redis, jwt, password, logger 等)
├── constants/ → 错误码枚举
├── tasks/     → 后台定时任务 (飞书通讯录同步)
└── types/     → 服务端类型定义
```

### 认证与权限 (RBAC)

- **双令牌 JWT**: accessToken (15m) + refreshToken (7d)，刷新令牌存 Redis blocklist
- **SSR 桥接**: `docflow_auth_flag` cookie 用于 SSR 阶段判断登录状态，敏感数据存 localStorage
- **权限模型**: 角色(Role) → 权限(Permission) 映射，前端通过 `useAuth()` 的 `can()` / `hasRole()` 判断
- **v-auth 指令**: 模板中 `v-auth="'doc:create'"` 控制元素显示
- **服务端**: `requirePermission(event, 'code')` 校验接口权限
- **鉴权白名单**: 默认所有 `/api/**` 需要 JWT。当前白名单: `/api/auth/login`、`/api/auth/logout`、`/api/auth/refresh`、`/api/auth/captcha`、`/api/auth/feishu/*`、`/api/health`。新增公开接口必须在 `server/middleware/auth.ts` 中逐个添加路径，**禁止用 `startsWith` 通配**

### 新增接口流程

```
SQL 补丁 → server/api/ Handler → 鉴权白名单(可选) → types/ 类型 → 页面 useAuthFetch() → 更新 docs/api-auth-design.md
```

- `ok(data, msg?)` / `fail(event, status, code, msg)` / `requirePermission(event, perm)` 为 Nitro 自动导入，无需 import
- `event.context.user` 由鉴权中间件自动注入（含 `id`、`name`、`email`）
- 所有新增接口**必须同步更新** `docs/api-auth-design.md`（接口总览表 + 详细说明）

### API 约定

- 统一响应格式: `{ success, code, message, data }`
- 请求体校验: `readValidatedBody(event, schema.parse)` / `getValidatedQuery(event, schema.parse)` + Zod schema
- 前端 HTTP: `useAuthFetch()` 包装 `$fetch`，自动携带 token、401 自动刷新、5xx 重试
- **前端类型从 Zod schema 推导**: `import type { LoginBody } from '~/server/schemas/auth'`，禁止在 `api/*.ts` 中重复定义请求参数类型

### 实时通信

- WebSocket 基于 Nitro 实验性 websocket 功能
- 客户端 `useWs()` 管理连接，自动重连 + 30s 心跳
- 用于推送徽标数量、通知更新

### 样式体系

- Element Plus SCSS 主题，变量覆盖在 `assets/styles/element-overrides.scss`
- 暗色模式通过 View Transition API 切换，样式在 `assets/styles/dark.scss`
- 全局样式加载顺序: `main.scss` → `components.scss` → `dark.scss`
- **全局公共组件样式统一放在 `components.scss`**，不要在组件 `<style>` 中重复写。不要在组件中留 `<!-- 样式已抽取至 ... -->` 之类的注释
- 弹窗/抽屉全局样式选择器使用双类名提高权重（如 `.el-dialog.df-modal`）
- 常用 class: 表格 `.df-data-table`、弹窗 `.df-modal`、抽屉 `.df-detail-drawer`

#### CSS 变量速查

| 变量 | 默认值 | 用途 |
|---|---|---|
| `--df-primary` | #2563eb | 主色 |
| `--df-primary-soft` | #eff6ff | 主色浅底 |
| `--df-primary-hover` | #1d4ed8 | 主色悬停 |
| `--df-border` | #e2e8f0 | 通用边框色 |
| `--df-panel` | #ffffff | 面板/卡片背景 |
| `--df-surface` | #f8fafc | 次级背景 |
| `--df-bg` | #f1f5f9 | 页面背景 |
| `--df-text` | #1e293b | 正文色 |
| `--df-subtext` | #64748b | 辅助文字色 |

## 开发约定

### 代码格式

- 项目使用 **tab 缩进**
- 格式化工具使用 **Vue (Official)**，不使用 Prettier

### 数据库变更

- 数据库补丁以 SQL 文件交付（放在 `docs/` 目录），**不使用 Prisma migration**
- 执行完 SQL 后同步更新 `prisma/schema.prisma` 保持模型一致
- 初始化 SQL: `docs/doc.sql`（建表）、`docs/doc_seed.sql`（种子数据）

### 类型与常量

- 类型（type/interface）、常量、枚举**必须独立成文件**，不要内联在页面或 handler 中
- 前端类型放 `types/` 目录（`api.ts`、`rbac.ts`、`ws.ts`、`integration.ts` 等）
- 服务端类型放 `server/types/`
- 服务端错误码集中定义在 `server/constants/error-codes.ts`

### 时间字段

- **后端**: 所有时间字段统一返回**毫秒时间戳**
- **前端**: 统一使用 `utils/format.ts` 的 `formatTime(value, format?)` 格式化显示

### 消息提示

- 统一使用 `composables/useNotify.ts` 的 `useNotify()`，不直接使用 `ElMessage` / `ElMessageBox` / `ElNotification`
- 接口调用后的提示**优先使用后端返回的 `message` 字段**，前端文案作为兜底: `msgSuccess(res.message || '操作成功')`

### Loading 状态

- 页面初始数据加载使用 `usePageLoading()` 全屏遮罩
- 表格区域用 DataTable 的 `:loading` prop
- 弹窗确认用 Modal 的 `:confirm-loading` prop
- 删除/撤销按钮用行级 id 追踪（如 `deletingId === row.id`）
- 子组件通过 `defineExpose({ refresh, loading })` 暴露刷新方法，**不使用 `:key` 递增重挂载**

### 滚动条

- 需要滚动的区域**优先使用 `<el-scrollbar>`**，不使用原生 `overflow-y: auto`

### 布局

- 后台管理系统，**不做移动端适配**
- `.pf-app` 设置 `min-width: 768px`，低于此宽度出现横向滚动条
- 侧栏在视口 < 1024px 时自动折叠

### 测试

- 框架: Vitest + @vue/test-utils + @nuxt/test-utils + @pinia/testing + happy-dom
- 目录: `tests/unit/`（单元）、`tests/api/`（API 集成）、`tests/components/`（组件）、`tests/e2e/`（E2E）
- 命名: 单元/API/组件 `*.test.ts`，E2E `*.spec.ts`
- Schema 测试在 `tests/unit/schemas/` 覆盖正常值、边界值、非法值
- 覆盖率范围: `server/schemas/`, `server/api/`, `composables/`, `utils/`, `stores/`

### TS 注意事项

- Nitro route 中可能报全局 Buffer 的 TS 错误，优先使用 string 方式生成 token，避免依赖 Buffer

## 环境配置

复制 `.env.example` 为 `.env`，主要变量: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `FEISHU_APP_ID/SECRET`。`docker-compose.yml` 提供 MySQL 8.0 + Redis 7 本地环境。

## ESLint 规则说明

- `vue/html-indent`: off (项目使用 tab 缩进)
- `vue/multi-word-component-names`: off
- `@typescript-eslint/no-explicit-any`: warn
- `no-console`: warn (允许 warn/error)
- `vue/no-v-html`: off (项目统一使用 DOMPurify 消毒)
