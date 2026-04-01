# 项目框架缺失项清单

> 纯项目框架视角，不涉及具体业务功能。  
> 生成日期：2026-04-01  
> 最后更新：2026-04-01

### 完成进度：P0 7/7 ✅ │ P1 0/5 │ P2 0/10

---

## 基础设施前置：Redis ✅ 已完成

P0 中的限流（0-1）、Token 吊销（0-4）、未来的缓存策略（2-10）及 WebSocket 多实例广播均需要共享存储。  
引入 Redis 作为基础设施层，避免每个需求单独拼凑方案。

- **变更**：`docker-compose.yml` 新增 Redis 7 服务；新增 `ioredis` 依赖；`server/utils/redis.ts` 封装单例客户端
- **环境变量**：`REDIS_URL`（默认 `redis://redis:6379`）

---

## P0 — 安全 + 可部署

不补齐则生产环境裸奔，属于上线前硬性要求。

### 0-1 Rate Limiting（接口频率限制） `rate-limiter-flexible` + Redis ✅ 已完成

- **现状**：所有接口无任何频率限制
- **风险**：登录暴力破解零成本，API 被刷无感知
- **方案**：`rate-limiter-flexible` + Redis 后端，分层策略：
  - 全局 API：100 次/分钟/IP
  - 认证类：10 次/分钟/IP
  - 登录接口：5 次/5分钟/IP（失败计数）
  - 上传类：10 次/小时/User
- **优势**：支持滑动窗口/令牌桶多算法，多实例共享，生产验证充分
- **涉及**：`server/middleware/rate-limit.ts` 新增

### 0-2 安全响应头 `nuxt-security` ✅ 已完成

- **现状**：完全缺失
- **风险**：点击劫持、MIME 嗅探、XSS 反射等浏览器侧攻击
- **方案**：`nuxt-security` 模块，声明式配置全套安全头：
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security`（HTTPS 环境）
  - `Content-Security-Policy`（基础策略）
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
- **涉及**：`nuxt.config.ts` 新增模块 + security 配置块

### 0-3 CORS 收紧 `nuxt-security` corsHandler ✅ 已完成

- **现状**：`routeRules` 中 `/api/**` 配置 `cors: true`，等于接受所有 origin
- **风险**：任意站点可跨域调用 API
- **方案**：移除原有 `cors: true`，由 `nuxt-security` corsHandler 统一管理，白名单模式通过 `ALLOWED_ORIGINS` 环境变量控制
- **涉及**：`nuxt.config.ts` routeRules 清理 + security.corsHandler 配置

### 0-4 Token 吊销机制 — 双令牌 + Redis Blocklist ✅ 已完成

- **现状**：登出仅前端丢弃 token，服务端不做任何处理
- **风险**：token 泄漏后在过期前始终有效
- **方案**：短 accessToken（15min）+ 长 refreshToken（7d）双令牌模式
  - 登录返回 accessToken + refreshToken
  - accessToken 过期后前端调 `POST /api/auth/refresh` 续期
  - 登出/改密时将 refreshToken 加入 Redis blocklist（TTL = 剩余有效期）
  - auth 中间件增加 blocklist 检查
- **涉及**：`server/utils/jwt.ts` 改造、`server/middleware/auth.ts` 改造、`server/api/auth/refresh.post.ts` 新增、前端 `stores/auth.ts` + `composables/useAuthFetch.ts` 适配

### 0-5 密码安全体系 `bcryptjs` ✅ 已完成

- **现状**：所有用户共用一个 `AUTH_DEMO_PASSWORD` 环境变量明文密码
- **风险**：任何人知道密码即可登录任何账号
- **方案**：
  - `doc_users` 表增加 `password_hash` 字段
  - 使用 `bcryptjs`（纯 JS，无需编译原生模块，Docker 友好）存储和校验
  - 提供修改密码接口 `PUT /api/auth/password`
  - 改密时吊销该用户所有 refreshToken
- **涉及**：数据库补丁、`server/api/auth/login.post.ts` 改造、新增改密接口

### 0-6 结构化日志 `pino` ✅ 已完成

- **现状**：全部使用 `console.log / console.error`
- **风险**：生产环境无法收集、检索、告警；出问题只能 SSH 上去翻终端
- **方案**：`pino` + `pino-pretty`（dev），Nitro 原生态
  - `server/utils/logger.ts` 封装工厂函数，支持 child logger 按模块分类
  - JSON 格式输出，可对接 ELK / Loki / CloudWatch
  - 替换所有现有 `console.log/error` 调用
- **涉及**：`server/utils/logger.ts` 新增、全部 server/ 文件内 console 替换

---

## P1 — 可协作 + 可维护

不补齐则多人协作混乱、长期维护成本剧增。

### 1-1 CI/CD 流水线

- **现状**：无 `.github/workflows/`
- **影响**：构建、测试、部署全靠手动
- **方案**：至少覆盖：
  - PR 触发：lint + type-check + unit test
  - merge 到 main：build + deploy
- **涉及**：`.github/workflows/` 新增

### 1-2 Git Hooks（husky + lint-staged）

- **现状**：无
- **影响**：脏代码可以直接提交，lint 规则形同虚设
- **方案**：`husky` pre-commit 触发 `lint-staged`（lint + format 暂存文件）
- **涉及**：`package.json`、`.husky/`

### 1-3 Prisma Schema 对齐

- **现状**：schema.prisma 仅 2 个 model，业务表全走 `$queryRaw`
- **影响**：丧失类型安全、关系查询、迁移管理能力
- **方案**：将 `doc_users`、`sys_roles`、`sys_permissions`、`sys_role_permissions`、`sys_user_roles`、`doc_feishu_users` 等表补入 schema，`introspect` 后校准
- **涉及**：`prisma/schema.prisma`、逐步替换 raw SQL

### 1-4 测试补齐

- **现状**：5 个 schema 单测，无 API / 组件 / E2E 测试
- **影响**：改一处不知道破了多少处
- **方案**：
  - API 集成测试：核心接口（login、RBAC CRUD）
  - 组件测试：通用组件（DataTable、FileUploader 等）
  - E2E：登录流程至少跑通
- **涉及**：`tests/` 目录扩展

### 1-5 统一错误码枚举

- **现状**：`fail()` 的 code 字段随处随起，无统一定义
- **影响**：前端无法精准匹配错误做差异化处理
- **方案**：建立 `server/constants/error-codes.ts`，所有 `fail()` 引用常量
- **涉及**：`server/utils/response.ts`、所有 API handler

---

## P2 — 体验 + 规范

不影响核心功能，但影响专业度和用户体验。

### 2-1 i18n 接线

- **现状**：语言包写好了，模板中大量硬编码中文
- **影响**：切换语言无效果
- **方案**：逐页/逐组件替换为 `$t()` / `t()` 调用
- **涉及**：所有 pages / components / layouts

### 2-2 组件级错误边界

- **现状**：仅全局 `error.vue`
- **影响**：单个组件崩溃导致整页白屏
- **方案**：关键区域包裹 `NuxtErrorBoundary`，提供 fallback UI
- **涉及**：页面级 layout、数据展示区域

### 2-3 XSS 清洗

- **现状**：diff 渲染等处直接 `v-html`，无过滤
- **影响**：若内容来自用户输入，可注入恶意脚本
- **方案**：引入 `DOMPurify`，所有 `v-html` 绑定前过一遍 sanitize
- **涉及**：`VersionCompareViewer.vue`、`DocPreview.vue` 等使用 `v-html` 的组件

### 2-4 SEO 基础

- **现状**：零 `useHead` / `useSeoMeta` 调用
- **影响**：所有页面无 title / description / OG 标签
- **方案**：每个页面 `useHead` 设置基础 meta
- **涉及**：所有 pages

### 2-5 健康检查深度

- **现状**：`/api/health` 仅返回时间戳，不探测 DB
- **影响**：K8s readiness probe 无法反映真实服务状态
- **方案**：加入 DB ping 检查，返回各依赖状态
- **涉及**：`server/api/health.get.ts`

### 2-6 请求重试与离线兜底

- **现状**：`useAuthFetch` 无 retry，弱网直接失败
- **影响**：移动端 / 弱网环境体验差
- **方案**：核心请求加重试策略（指数退避），离线时 toast 提示
- **涉及**：`composables/useAuthFetch.ts`

### 2-7 Bundle 分析

- **现状**：无 analyzer 配置
- **影响**：不知道打包体积瓶颈在哪
- **方案**：配置 `rollup-plugin-visualizer` 或 `nuxt-build-cache`
- **涉及**：`nuxt.config.ts`

### 2-8 独立 404 页

- **现状**：靠 `error.vue` 兜底
- **影响**：404 体验不可单独定制
- **方案**：新增 `pages/[...slug].vue` catch-all 路由
- **涉及**：`pages/`

### 2-9 暗黑模式 FOUC 修复

- **现状**：SSR 渲染时可能出现主题闪烁
- **影响**：首屏亮白一闪再变暗
- **方案**：`useHead` 注入 inline script 在 `<head>` 阶段提前设置 `.dark` 类名
- **涉及**：`app.vue` 或 `plugins/`

### 2-10 缓存策略

- **现状**：静态资源无长缓存头，接口无服务端缓存
- **影响**：重复请求浪费带宽，页面加载慢
- **方案**：静态资源配 immutable 缓存头；高频读接口加 `defineCachedEventHandler`
- **涉及**：`nuxt.config.ts` routeRules、部分 API handler

---

## 速览表

| 编号 | 优先级 | 项目 | 技术选型 | 预估复杂度 |
|------|--------|------|----------|-----------|
| 基础 | P0 | Redis 基础设施 | `ioredis` + Docker Redis 7 | 低 |
| 0-1 | P0 | Rate Limiting | `rate-limiter-flexible` + Redis | 中 |
| 0-2 | P0 | 安全响应头 | `nuxt-security` | 低 |
| 0-3 | P0 | CORS 收紧 | `nuxt-security` corsHandler | 低 |
| 0-4 | P0 | Token 吊销机制 | 双令牌 + Redis blocklist | 高 |
| 0-5 | P0 | 密码安全体系 | `bcryptjs` | 中 |
| 0-6 | P0 | 结构化日志 | `pino` + `pino-pretty` | 中 |
| 1-1 | P1 | CI/CD 流水线 | GitHub Actions | 中 |
| 1-2 | P1 | Git Hooks | `husky` + `lint-staged` | 低 |
| 1-3 | P1 | Prisma Schema 对齐 | `prisma db pull` + 补全 | 高 |
| 1-4 | P1 | 测试补齐 | Vitest + Playwright | 高 |
| 1-5 | P1 | 统一错误码枚举 | `server/constants/error-codes.ts` | 低 |
| 2-1 | P2 | i18n 接线 | — | 高 |
| 2-2 | P2 | 组件级错误边界 | `NuxtErrorBoundary` | 低 |
| 2-3 | P2 | XSS 清洗 | `DOMPurify` | 低 |
| 2-4 | P2 | SEO 基础 | `useHead` / `useSeoMeta` | 低 |
| 2-5 | P2 | 健康检查深度 | DB + Redis ping | 低 |
| 2-6 | P2 | 请求重试与离线兜底 | 指数退避 retry | 中 |
| 2-7 | P2 | Bundle 分析 | `rollup-plugin-visualizer` | 低 |
| 2-8 | P2 | 独立 404 页 | `pages/[...slug].vue` | 低 |
| 2-9 | P2 | 暗黑模式 FOUC 修复 | `useHead` inline script | 低 |
| 2-10 | P2 | 缓存策略 | Redis + `defineCachedEventHandler` | 中 |

---

## P0 实施顺序（按依赖关系排列） — 全部完成 ✅

```
1. ✅ docker-compose + Redis + ioredis 客户端封装
2. ✅ pino 日志体系
3. ✅ nuxt-security 安全头 + CORS
4. ✅ rate-limiter-flexible 限流中间件
5. ✅ bcryptjs 密码安全体系
6. ✅ Token 双令牌改造
```

### 部署注意事项

- 执行数据库补丁：`docs/patch-002-password-hash.sql`
- 新增环境变量：`REDIS_URL`、`JWT_REFRESH_EXPIRES_IN`、`ALLOWED_ORIGINS`
- `JWT_EXPIRES_IN` 默认值已从 `8h` 改为 `15m`（accessToken 短有效期）
