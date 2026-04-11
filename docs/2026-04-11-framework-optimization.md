# 2026-04-11 框架质量优化记录

> 基于代码审查发现的问题，按优先级（P0→P2）逐项修复。所有改动仅涉及框架层，不涉及业务功能，前端接口协议无变化。

## 改动总览

| 优先级 | 类别 | 改动 | 涉及文件 |
|--------|------|------|----------|
| P0 | 安全 | 验证码 token 加密 | `server/utils/captcha.ts`、`tests/unit/utils/captcha.test.ts` |
| P0 | 安全 | 角色创建竞态条件修复 | `server/api/rbac/roles/index.post.ts`、`server/utils/db-errors.ts`、`tests/unit/utils/role-create-race.test.ts` |
| P1 | 架构 | auth store 解除 WebSocket 耦合 | `stores/auth.ts` |
| P1 | 质量 | 核心组件补充 TypeScript 类型 | `components/DataTable.vue`、`Modal.vue`、`PageTitle.vue`、`Pagination.vue`、`admin/RoleManager.vue` |
| P2 | 质量 | store 死代码清理 | `stores/app.ts` |
| P2 | 契约 | 内联 schema 集中管理 | `server/schemas/auth.ts`、`server/api/auth/password.put.ts`、`server/api/auth/refresh.post.ts` |
| P2 | 样式 | CSS 设计令牌补齐 | `assets/styles/main.scss` |
| P2 | 架构 | composable 模式整理 | `composables/useSanitize.ts`、`CaptchaDialog.vue`、`DocPreview.vue`、`VersionCompareViewer.vue`、`pages/docs/file/[id].vue` |
| P2 | 样式 | components.scss 按功能拆分 | `assets/styles/components.scss`、`assets/styles/components/` 下 8 个文件 |

---

## P0 — 安全修复

### 1. 验证码 token 加密（`8b1c6fe`）

**问题**：验证码 token 格式为 `timestamp.明文坐标.hmac`，答案坐标以 base64 明文存在 token 中。攻击者解析 token 即可获取所有点击目标的 x/y 坐标，验证码形同虚设。

**修复**：将 HMAC 签名方案替换为 AES-256-GCM 加密。整个 payload（时间戳 + 坐标）加密为不透明的 base64url 字符串，密钥从 JWT_SECRET 派生。

**改动**：
- `server/utils/captcha.ts` — 新增 `deriveKey()`、`encrypt()`、`decrypt()` 函数，替换原 `hmacSign()`；`generateCaptcha()` 和 `verifyCaptcha()` 对应改造
- `tests/unit/utils/captcha.test.ts` — 新增 7 个测试用例（结构校验、明文泄露检测、篡改检测、边界情况）

**影响范围**：前端零改动，`CaptchaDialog.vue` 和 `login.post.ts` 的接口协议不变。

### 2. 角色创建竞态条件修复（`d6b73ac`）

**问题**：`roles/index.post.ts` 使用 check-then-insert 模式（先 SELECT COUNT 检查 code 唯一性，再 INSERT）。两个并发请求可以同时通过检查，导致重复 code。

**修复**：移除 SELECT 检查，直接 INSERT，用 try-catch 捕获数据库唯一约束错误（`uk_code_deleted`）。

**改动**：
- `server/api/rbac/roles/index.post.ts` — 删除 check-then-insert，改为 INSERT + `isDuplicateKeyError()` 捕获
- `server/utils/db-errors.ts` — 新增工具函数，支持 Prisma P2002 和 MySQL ER_DUP_ENTRY 两种错误格式
- `tests/unit/utils/role-create-race.test.ts` — 新增 6 个测试用例

---

## P1 — 架构 + 质量

### 3. auth store 解除 WebSocket 耦合（`2b06994`）

**问题**：`stores/auth.ts` 的 `clearSession()` 直接调用 `wsDisconnect()`，依赖 Nuxt 自动导入。auth store 不应该知道 WebSocket 的存在。

**修复**：移除 `clearSession()` 中的 `wsDisconnect()` 调用。`plugins/02-ws.client.ts` 已经 watch `authStore.token` 变化，token 清空时自动触发断连，行为完全一致。

### 4. 核心组件补充 TypeScript 类型（`662a010`、`103eb53`）

**问题**：DataTable、Modal、PageTitle、Pagination 四个核心组件的 `defineProps` 和 `defineEmits` 完全没有类型定义，props 全部推断为 `any`。

**修复**：
- `<script setup>` 改为 `<script setup lang="ts">`
- `defineProps` 改为 `interface + withDefaults` 形式
- `defineEmits` 添加类型签名
- 函数参数和 ref 添加类型标注
- DataTable 导出 `TableColumn` / `EnumItem` 接口供外部使用
- 修复随之暴露的类型错误（`rowKey` 返回类型、`col.prop` 可能为 undefined、Pagination 参数缺类型）

---

## P2 — 契约 + 样式 + 代码清理

### 5. store 死代码清理（`d159e97`）

**改动**：移除 `stores/app.ts` 中未使用的 `workspaceReady` 状态、`latestPingAt` 状态和 `markPinged()` 方法。经 grep 确认无外部引用。

### 6. 内联 schema 集中管理（`883949c`）

**问题**：`changePasswordSchema` 和 `refreshSchema` 内联在 API handler 中，违背了 schema 集中管理的项目约定。

**修复**：两个 schema 移到 `server/schemas/auth.ts`，导出类型 `ChangePasswordBody` 和 `RefreshBody`。handler 改为 import 引用。

### 7. CSS 设计令牌补齐（`b9fc979`）

**问题**：`main.scss` 的设计令牌缺少过渡时长、z-index 层级、边框宽度，代码中裸写 `0.2s ease`、`12px` 等值。

**补充**：
- `--df-transition-fast/base/slow`（0.15s / 0.2s / 0.35s）
- `--df-z-dropdown/sticky/modal/popover/tooltip/overlay`（1000-3000）
- `--df-border-width`（1px）

### 8. composable 模式整理（`c6bdd77`）

**问题**：`useSanitize()` 返回 `{ sanitize }` 对象，但 `sanitize` 是一个无状态的工具函数，不需要 composable 包装。

**修复**：改为直接导出 `sanitize()` 函数，4 处调用侧移除 `const { sanitize } = useSanitize()` 解构（Nuxt auto-import 自动导入）。

### 9. components.scss 按功能拆分（`393cddf`）

**问题**：`components.scss` 达 2500+ 行，包含表格、弹窗、上传、版本、预览、审批、评论等全部组件样式。

**修复**：拆分为 `assets/styles/components/` 下 8 个独立文件，`components.scss` 改为 `@forward` 汇总入口：

| 文件 | 内容 | 行数 |
|------|------|------|
| `_data-table.scss` | 表格 + 工具栏 + 搜索 | 112 |
| `_modals.scss` | 弹窗 + 抽屉 | 97 |
| `_file-upload.scss` | 文件上传组件 | 340 |
| `_version.scss` | 版本侧栏 + 对比器 + Diff | 435 |
| `_doc-preview.scss` | 文档预览 + 文件信息 | 590 |
| `_approval.scss` | 审批链节点 | 268 |
| `_comments.scss` | 评论线程 + 动画 | 413 |
| `_approval-drawer.scss` | 审批抽屉内容 | 260 |

---

## 未做的项（原因）

| 事项 | 原因 |
|------|------|
| i18n 接入实际组件 | PRD 未定稿，页面都是 mock 数据 |
| Prisma schema 补齐业务表 | PRD 未定稿，数据模型未确定 |
| 补充 API 集成测试 | PRD 未定稿，接口会变动 |
| 组件 a11y 基础属性 | P3 优先级最低，等页面成型后补 |
| Vue SFC 大块 style 抽取 | 评估后确认是组件私有 scoped 样式，抽到全局会破坏封装 |

---

## 测试验证

所有改动完成后全量测试通过：**7 个测试文件，77 个测试用例，全部 PASS**。
