# DocFlow 技术栈

> 本文档记录项目当前使用的所有技术栈。**新增或升级依赖时请同步更新本文档**，保持与 `package.json` 一致。
>
> 最后更新：2026-04-18

---

## 一、核心框架

| 层 | 技术 | 版本 | 备注 |
|---|---|---|---|
| 全栈框架 | Nuxt 3 | ^3.21 | SSR + 文件路由 + 自动导入 |
| 服务端运行时 | Nitro | 内置 | 基于 H3，含实验性 WebSocket |
| 前端视图 | Vue 3 | ^3.5 | Composition API `<script setup>` |
| 语言 | TypeScript | ^5.9 | 严格模式 |

## 二、前端

| 类别 | 技术 | 版本 | 说明 |
|---|---|---|---|
| UI 库 | Element Plus | ^2.13 | 通过 `@element-plus/nuxt` 自动注册 |
| 状态管理 | Pinia | ^3.0 | 通过 `@pinia/nuxt` 集成，三个 store：app / auth / ws |
| 国际化 | `@nuxtjs/i18n` | ^10.2 | zh-CN / en-US |
| 样式 | SCSS（Sass ^1.98） | — | 主题变量 `--df-*` + 暗色模式（View Transition API） |
| 路由 | Nuxt 文件路由 | 内置 | `pages/` 目录；全局守卫 `middleware/auth.global.ts` |
| 工具 | DOMPurify ^3.3 | — | XSS 防护 |
| 工具 | NProgress ^0.2 | — | 页面切换进度条 |
| 工具 | markdown-it ^14.1 | — | MD 渲染 |

## 三、后端（Nitro）

| 类别 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 路由 | Nitro 文件路由 | 内置 | `server/api/**/*.{get,post,put,delete}.ts` |
| ORM | Prisma | ^6.19 | MySQL provider；简单 CRUD 走模型方法，复杂查询走 `$queryRaw` |
| 参数校验 | Zod | ^4.3 | 所有接口 body/query 必校验；前端类型从 schema 推导 |
| 认证 | jose | ^6.2 | JWT 双令牌（accessToken 15m + refreshToken 7d），Redis blocklist |
| 密码 | bcryptjs | ^3.0 | 密码哈希 |
| 限流 | rate-limiter-flexible | ^10.0 | IP + 账号维度 |
| 日志 | pino + pino-pretty | ^10.3 / ^13.1 | 结构化日志 |
| 安全 | nuxt-security | ^2.5 | HTTP 安全头 + CSP |
| 实时 | Nitro WebSocket | 实验性 | 客户端 `useWs()`，自动重连 + 30s 心跳 |

## 四、数据层

| 类别 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 数据库 | MySQL | 8.0 | 34 张表（`doc_*` 业务 + `sys_*` RBAC） |
| ID 生成 | 自研 Snowflake | — | `server/utils/snowflake.ts`，53-bit 安全用于 JS Number |
| 缓存 | Redis | 7 | 用 ioredis ^5.10 |
| 迁移策略 | 手写 SQL 补丁 | — | **不使用 Prisma migration**，`docs/patch-NNN-*.sql` 四地同步（doc.sql / rbac.sql / doc_seed.sql / schema.prisma） |

## 五、文件处理

| 用途 | 库 | 版本 |
|---|---|---|
| PDF 解析 | pdf-parse | ^2.4 |
| Word 解析 | mammoth | ^1.12 |
| Excel 解析 | xlsx | ^0.18 |
| 文本 diff | diff | ^8.0 |

## 六、第三方集成

| 集成 | 场景 |
|---|---|
| 飞书（Lark） | OAuth 登录 / 通讯录同步（cron `0 2 * * *`）/ 机器人消息推送 |

## 七、测试

| 类别 | 技术 | 版本 |
|---|---|---|
| 测试框架 | Vitest | ^4.1 |
| 组件测试 | `@vue/test-utils` | ^2.4 |
| Nuxt 测试工具 | `@nuxt/test-utils` | ^4.0 |
| DOM 模拟 | happy-dom | ^20.8 |
| Pinia 测试 | `@pinia/testing` | ^1.0 |

**目录约定**：
- `tests/unit/` — 单元（schema、工具）
- `tests/api/` — API 集成
- `tests/components/` — 组件
- `tests/e2e/` — E2E
- 单元/API/组件文件 `*.test.ts`，E2E `*.spec.ts`

**覆盖范围**：`server/schemas/`、`server/api/`、`composables/`、`utils/`、`stores/`

## 八、工程化

| 类别 | 工具 | 版本 | 说明 |
|---|---|---|---|
| Lint | ESLint 9（`@nuxt/eslint`） | ^9.39 / ^1.15 | Flat config |
| Git Hook | husky | ^9.1 | pre-commit |
| 暂存检查 | lint-staged | ^16.4 | 对 `*.{js,ts,vue,mjs}` 自动 `eslint --fix` |
| 构建分析 | rollup-plugin-visualizer | ^7.0 | `ANALYZE=true npm run build` 产出 `stats.html` |
| 容器 | docker-compose | — | 提供本地 MySQL 8.0 + Redis 7 |
| 格式化 | Vue (Official) 插件 | — | **tab 缩进，不使用 Prettier** |

## 九、架构约定

### 项目形态
- **前后端同仓**（非 microservice），Nuxt 同进程 SSR
- **目标**：开发完成后抽离为 `nuxt-fullstack-starter` 模板仓库；通用能力与业务解耦

### 认证与权限
- JWT 双令牌 + `docflow_auth_flag` cookie（SSR 阶段判登录）
- 敏感数据存 localStorage
- RBAC：角色 → 权限映射，前端 `useAuth().can()` / `v-auth` 指令，服务端 `requirePermission(event, 'code')`

### API 约定
- 统一响应：`{ success, code, message, data }`
- 错误码集中定义：`server/constants/error-codes.ts`
- 前端 HTTP 封装：`useAuthFetch()`，自动携带 token / 401 刷新 / 5xx 重试
- 前端类型**从 Zod schema 推导**（`z.infer`），禁止重复定义

### 数据约定
- 时间字段：后端统一毫秒时间戳，前端 `utils/format.ts` 的 `formatTime()` 渲染
- 文件大小：`formatBytes()` 渲染
- 消息提示：仅用 `composables/useNotify.ts`，优先用后端 `message` 字段

### 埋点
- 操作日志 `detail_json.desc` 预渲染，列表直接展示
- 一业务事件一条日志，系统自动事件 `actor_user_id=0` + 溯源字段

## 十、公共基础设施

> 通用能力已抽象，抽离模板时可直接复用。

- **认证**：`composables/useAuth` / `useAuthFetch`、`stores/auth`
- **权限**：`v-auth` 指令、`requirePermission()`
- **实时**：`useWs` / `stores/ws`、WebSocket badge 推送
- **通知**：`useNotify`（msgSuccess/msgError/msgConfirm/msgErrorDetail/msgAlert）
- **页面骨架**：`ListPageShell` + `FilterBar` + `DataTable` + `EmptyState` + `BulkActionBar`
- **列表页编排**：`useListPage<T, Q>()` — 分页/加载/筛选/Race condition 保护；页面只需传 `fetchFn` + `buildQuery`，可选 `resetFilters` / `immediate` / `defaultPageSize` / `onError`
- **表单**：`Modal` / `DetailDrawer`
- **选择器**：`MemberSelectorModal`（飞书风格）、`RemoteSelect`（远程搜索+滚动分页泛型）
- **编辑器辅助**：`DocPreview`、`VersionCompareViewer`、`VersionSidebar`、`CommentThread`、`ApprovalChain`、`ApprovalDrawer`
- **文件类**：`FileUploader` / `UploadModal` / `FileMetaHeader`
- **Loading**：`usePageLoading()` 全屏遮罩、`DataTable :loading`、`Modal :confirm-loading`

## 十一、环境变量

主要变量（详见 `.env.example`）：

| 变量 | 用途 |
|---|---|
| `DATABASE_URL` | MySQL 连接串 |
| `REDIS_URL` | Redis 连接串 |
| `JWT_SECRET` | JWT 签名密钥 |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书应用凭证 |

---

## 更新须知

新增/升级/移除依赖时：

1. 同步更新本文档对应表格的**版本号**
2. 新增类别时在对应章节加行；新增大类别在末尾加章节
3. 更新顶部"最后更新"日期
4. 若涉及架构约定变更（响应格式、鉴权方式、时间约定等），同步更新 `CLAUDE.md`
