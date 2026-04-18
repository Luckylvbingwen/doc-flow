# 通知中心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地通知中心 A 阶段 —— 顶栏铃铛 Popover + 整页 `/notifications` + 4 个读/写 API + 写入侧 helper（`createNotification` + `NOTIFICATION_TEMPLATES` 24 模板表），为各业务模块后续按纪律接入通知打好地基。

**Architecture:** 复用 `doc_notifications` 表（不改 schema）。后端 4 个 API（2 读 + 2 写），`server/utils/notify.ts` 封装 INSERT + WS 推送，`server/constants/notification-templates.ts` 存 M1-M24 强类型模板。前端 3 个新组件（Bell/Popover/Card）+ 改造 `pages/notifications.vue` + `layouts/prototype.vue` 集成铃铛。WebSocket 复用现有 `'badge'` 消息类型（不新增 type），登录后 / WS 重连后两个对账点拉一次 `/unread-count`。

**Tech Stack:** Nuxt 3 / Nitro / Prisma / Zod / Element Plus / Vue 3 Composition API / WebSocket (crossws)

**Spec:** `docs/superpowers/specs/2026-04-18-notification-center-design.md`

**项目约定提醒：**
- 使用 **tab 缩进**（非空格）
- 消息提示统一用 `composables/useNotify.ts` 的 `msgSuccess/msgError`，不直接用 `ElMessage`
- 前端请求类型从 Zod schema 推导（`z.infer`），不另建
- 新增接口必须同步更新 `docs/api-auth-design.md`
- 全局组件样式统一放 `assets/styles/components/`（被 `components.scss` import），不写组件 `<style>`
- Prisma 模型方法里 BigInt 字段要 `BigInt()` 包裹
- `ok(data, msg?)` / `fail(event, status, code, msg)` 是 Nitro 自动导入，无需 import
- `event.context.user` 由鉴权中间件注入
- 通知 4 个接口**不**挂 `requirePermission`，仅以 `event.context.user.id` 过滤 `user_id`

---

### Task 1: 种子数据 — doc_seed.sql 追加 40-50 条覆盖 M1-M24

**Files:**
- Modify: `docs/doc_seed.sql`

- [ ] **Step 1: 确认用户 ID 和组/文件 ID**

Run: `grep -n "INSERT INTO doc_users\|INSERT INTO doc_groups\|INSERT INTO doc_documents" docs/doc_seed.sql | head -30`

确认种子里可用的 user_id、group_id、document_id 值。本计划假设下述 ID 真实存在（若不匹配，改为实际值）：
- 用户：`10001`（张晓明，系统管理员）、`10002`（刘思远，组负责人）、`10003`（王建国，普通成员）
- 文件：`20001`、`20002`、`20003`
- 组：`30001`、`30002`

- [ ] **Step 2: 在 `doc_seed.sql` 末尾追加通知种子数据**

在最后一个 `INSERT` 之后、文件结尾之前添加：

```sql
-- ---------------------------------------------------------
-- 6.8 站内通知样例（§6.8 / M1-M24 各 ≥1 条，约 45 条）
-- user_id: 10001=张晓明 / 10002=刘思远 / 10003=王建国
-- 时间分布：近 7 天；约 1/3 未读（read_at IS NULL）
-- ---------------------------------------------------------
INSERT INTO doc_notifications (id, user_id, category, msg_code, title, content, biz_type, biz_id, read_at, created_at) VALUES
-- ==== 审批类（M1-M7） ====
(90000001, 10002, 1, 'M1', '王建国 提交了文件《竞品分析-协同办公平台.md》的审批，请处理', NULL, 'document', 20001, NULL, NOW() - INTERVAL 20 MINUTE),
(90000002, 10002, 1, 'M2', '文件《数据库优化方案.md》的审批已流转到您（第 2/3 级），请处理', NULL, 'document', 20002, NULL, NOW() - INTERVAL 2 HOUR),
(90000003, 10003, 1, 'M3', '您提交的文件《API接口规范文档.md》已审批通过并发布', NULL, 'document', 20003, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY),
(90000004, 10003, 1, 'M4', '您提交的文件《旧版方案.md》被驳回，请补充后重新提交', '数据不完整，缺少性能对比数据', 'document', 20001, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY),
(90000005, 10002, 1, 'M5', '文件《性能测试报告-2026Q1.md》的审批已超时 48 小时，请尽快处理', NULL, 'document', 20002, NULL, NOW() - INTERVAL 6 HOUR),
(90000006, 10003, 1, 'M6', '文件《用户增长策略分析.md》的审批催办已达上限（3 次），您可撤回重新提交', NULL, 'document', 20003, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY),
(90000007, 10002, 1, 'M7', '王建国 已撤回文件《季度运营报告.md》的审批', NULL, 'document', 20001, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY),
-- ==== 系统类：文档生命周期（M8-M9） ====
(90000008, 10003, 2, 'M8', '文件《API接口规范文档.md》已发布新版本 v2.1', NULL, 'document', 20003, NULL, NOW() - INTERVAL 50 MINUTE),
(90000009, 10003, 2, 'M9', '管理员 张晓明 已将文件《旧版产品概述.md》从组《产品需求组》中移除，文档已退回您的个人中心', NULL, 'document', 20001, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY),
-- ==== 系统类：归属人转移（M10-M11） ====
(90000010, 10002, 2, 'M10', '张晓明 希望将文件《产品路线图Q2.md》的归属人转移给您，请处理', NULL, NULL, NULL, NULL, NOW() - INTERVAL 3 HOUR),
(90000011, 10001, 2, 'M11', '文件《产品路线图Q2.md》的归属人转移已被同意', NULL, NULL, NULL, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY),
-- ==== 系统类：跨组移动（M12-M13） ====
(90000012, 10002, 2, 'M12', '王建国 申请将文件《代理平台v5.0需求规格说明书.md》从组《产品需求组》移动到您负责的组《需求文档》', NULL, NULL, NULL, NULL, NOW() - INTERVAL 4 HOUR),
(90000013, 10003, 2, 'M13', '文件《代理平台v5.0需求规格说明书.md》的跨组移动申请已被同意', NULL, NULL, NULL, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY),
-- ==== 系统类：权限/分享（M14-M17） ====
(90000014, 10003, 2, 'M14', '赵丽华 申请阅读文件《竞品分析-协同办公平台.md》', NULL, NULL, NULL, NULL, NOW() - INTERVAL 5 HOUR),
(90000015, 10003, 2, 'M15', '赵丽华 申请文件《代理接入指南.md》的编辑权限', '需要补充技术细节', NULL, NULL, NULL, NOW() - INTERVAL 7 HOUR),
(90000016, 10001, 2, 'M16', '您对文件《代理接入指南.md》的编辑权限申请已被同意', NULL, NULL, NULL, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY),
(90000017, 10003, 2, 'M17', '王建国 向您分享了文件《竞品分析-协同办公平台.md》（可编辑）', NULL, 'document', 20001, NULL, NOW() - INTERVAL 30 MINUTE),
-- ==== 系统类：审批链变更（M24） ====
(90000018, 10002, 2, 'M24', '成员 赵丽华 已从组《运营组》的审批链中移除（离职），请检查审批配置', NULL, 'group_approval', 30001, NULL, NOW() - INTERVAL 12 HOUR),
-- ==== 成员变更类（M18-M23） ====
(90000019, 10003, 3, 'M18', '您已被添加为组《产品需求组》的成员（权限：可编辑）', NULL, 'group', 30001, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY),
(90000020, 10003, 3, 'M19', '您在组《技术架构组》的权限已从「可编辑」变更为「管理员」', NULL, NULL, NULL, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY),
(90000021, 10003, 3, 'M20', '您已被移出组《运营组》', NULL, NULL, NULL, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY),
(90000022, 10002, 3, 'M21', '您已被部门负责人 李婷婷 指派为部门管理员（产品部）', NULL, NULL, NULL, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY),
(90000023, 10003, 3, 'M22', '组《技术架构组》的负责人已由 刘思远 变更为 孙晓峰', NULL, 'group', 30002, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY),
(90000024, 10001, 3, 'M23', '员工 赵丽华 已离职，其负责的组《运营组》已交接给 张晓明，请确认', NULL, 'group', 30001, NULL, NOW() - INTERVAL 8 HOUR),
-- ==== 补充样本（让列表更丰满，让每个用户都有若干条） ====
(90000025, 10003, 1, 'M1', '李婷婷 提交了文件《季度 OKR.md》的审批，请处理', NULL, 'document', 20002, NULL, NOW() - INTERVAL 40 MINUTE),
(90000026, 10003, 1, 'M3', '您提交的文件《运营月报-2026-03.md》已审批通过并发布', NULL, 'document', 20003, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY),
(90000027, 10002, 1, 'M4', '您提交的文件《架构评审材料.md》被驳回，请补充后重新提交', '缺少容量规划章节', 'document', 20001, NULL, NOW() - INTERVAL 1 HOUR),
(90000028, 10001, 2, 'M8', '文件《公司制度手册 v3.md》已发布新版本 v3.2', NULL, 'document', 20002, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY),
(90000029, 10002, 2, 'M17', '张晓明 向您分享了文件《年度预算.md》（只读）', NULL, 'document', 20003, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY),
(90000030, 10001, 3, 'M18', '您已被添加为组《公司级文档》的成员（权限：管理员）', NULL, 'group', 30002, NOW() - INTERVAL 7 DAY, NOW() - INTERVAL 7 DAY),
(90000031, 10002, 3, 'M19', '您在组《产品需求组》的权限已从「可编辑」变更为「管理员」', NULL, NULL, NULL, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY),
(90000032, 10001, 3, 'M22', '组《运营组》的负责人已由 赵丽华 变更为 张晓明', NULL, 'group', 30001, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY),
(90000033, 10003, 2, 'M8', '文件《需求评审模板.md》已发布新版本 v1.5', NULL, 'document', 20001, NULL, NOW() - INTERVAL 10 MINUTE),
(90000034, 10003, 1, 'M5', '文件《接口文档.md》的审批已超时 24 小时，请尽快处理', NULL, 'document', 20003, NULL, NOW() - INTERVAL 3 HOUR),
(90000035, 10002, 2, 'M14', '王建国 申请阅读文件《薪酬体系.md》', NULL, NULL, NULL, NULL, NOW() - INTERVAL 9 HOUR),
(90000036, 10001, 2, 'M11', '文件《组织架构调整.md》的归属人转移已被拒绝', NULL, NULL, NULL, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY),
(90000037, 10002, 2, 'M13', '文件《跨组协作规范.md》的跨组移动申请已过期', NULL, NULL, NULL, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY),
(90000038, 10001, 2, 'M16', '您对文件《安全规范.md》的阅读权限申请已被拒绝', NULL, NULL, NULL, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY),
(90000039, 10002, 3, 'M20', '您已被移出组《临时协作组》', NULL, NULL, NULL, NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 4 DAY),
(90000040, 10001, 3, 'M21', '您的系统管理员身份已被撤销', NULL, NULL, NULL, NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 10 DAY),
(90000041, 10002, 3, 'M23', '员工 陈思远 已离职，其负责的组《客户支持组》已交接给 刘思远，请确认', NULL, 'group', 30002, NULL, NOW() - INTERVAL 2 HOUR),
(90000042, 10002, 1, 'M6', '文件《技术选型.md》的审批催办已达上限（3 次），您可撤回重新提交', NULL, 'document', 20001, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY),
(90000043, 10003, 1, 'M7', '张晓明 已撤回文件《产品 OKR.md》的审批', NULL, 'document', 20002, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY),
(90000044, 10001, 2, 'M9', '管理员 刘思远 已将文件《过期规范.md》从组《技术架构组》中移除，文档已退回您的个人中心', NULL, 'document', 20003, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY),
(90000045, 10002, 2, 'M24', '成员 王建国 已从组《产品需求组》的审批链中移除（调岗），请检查审批配置', NULL, 'group_approval', 30001, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY);
```

- [ ] **Step 3: 执行 SQL 验证**

Run（本地 MySQL 容器已启动）：
```bash
docker compose exec -T db mysql -u root -proot docflow < docs/doc_seed.sql
```

Expected：命令成功，无错误。验证：
```bash
docker compose exec -T db mysql -u root -proot docflow -e "SELECT user_id, COUNT(*), SUM(read_at IS NULL) AS unread FROM doc_notifications GROUP BY user_id;"
```
应看到 3 个用户各有若干条未读 + 已读，总数 ~45 条。

- [ ] **Step 4: 提交**

```bash
git add docs/doc_seed.sql
git commit -m "feat(notification): 种子数据追加 M1-M24 共 45 条样例"
```

---

### Task 2: Zod schema + 服务端类型 + 单元测试

**Files:**
- Create: `server/schemas/notification.ts`
- Create: `server/types/notification.ts`
- Create: `tests/unit/schemas/notification.test.ts`

- [ ] **Step 1: 编写 schema 单测**

```typescript
// tests/unit/schemas/notification.test.ts
import { describe, it, expect } from 'vitest'
import { notificationListQuerySchema, readAllBodySchema } from '~/server/schemas/notification'

describe('notificationListQuerySchema', () => {
	it('使用全部默认值', () => {
		const r = notificationListQuerySchema.safeParse({})
		expect(r.success).toBe(true)
		if (r.success) {
			expect(r.data.page).toBe(1)
			expect(r.data.pageSize).toBe(20)
			expect(r.data.onlyUnread).toBe(false)
			expect(r.data.category).toBeUndefined()
		}
	})

	it('接受合法 category=1', () => {
		const r = notificationListQuerySchema.safeParse({ category: '1' })
		expect(r.success).toBe(true)
		if (r.success) expect(r.data.category).toBe(1)
	})

	it('接受 category=2 和 category=3', () => {
		expect(notificationListQuerySchema.safeParse({ category: '2' }).success).toBe(true)
		expect(notificationListQuerySchema.safeParse({ category: '3' }).success).toBe(true)
	})

	it('拒绝非法 category=4', () => {
		const r = notificationListQuerySchema.safeParse({ category: '4' })
		expect(r.success).toBe(false)
	})

	it('拒绝 category=0', () => {
		const r = notificationListQuerySchema.safeParse({ category: '0' })
		expect(r.success).toBe(false)
	})

	it('onlyUnread 字符串 true/false 强制转换', () => {
		const a = notificationListQuerySchema.safeParse({ onlyUnread: 'true' })
		expect(a.success).toBe(true)
		if (a.success) expect(a.data.onlyUnread).toBe(true)

		const b = notificationListQuerySchema.safeParse({ onlyUnread: 'false' })
		expect(b.success).toBe(true)
		if (b.success) expect(b.data.onlyUnread).toBe(false)
	})

	it('pageSize 上限 50', () => {
		const ok = notificationListQuerySchema.safeParse({ pageSize: '50' })
		expect(ok.success).toBe(true)
		const bad = notificationListQuerySchema.safeParse({ pageSize: '51' })
		expect(bad.success).toBe(false)
	})

	it('pageSize 下限 1', () => {
		const bad = notificationListQuerySchema.safeParse({ pageSize: '0' })
		expect(bad.success).toBe(false)
	})

	it('page 下限 1', () => {
		const bad = notificationListQuerySchema.safeParse({ page: '0' })
		expect(bad.success).toBe(false)
	})
})

describe('readAllBodySchema', () => {
	it('不传 category 通过（全部分类）', () => {
		const r = readAllBodySchema.safeParse({})
		expect(r.success).toBe(true)
		if (r.success) expect(r.data.category).toBeUndefined()
	})

	it('合法 category=1/2/3 通过', () => {
		expect(readAllBodySchema.safeParse({ category: 1 }).success).toBe(true)
		expect(readAllBodySchema.safeParse({ category: 2 }).success).toBe(true)
		expect(readAllBodySchema.safeParse({ category: 3 }).success).toBe(true)
	})

	it('拒绝 category=4', () => {
		expect(readAllBodySchema.safeParse({ category: 4 }).success).toBe(false)
	})

	it('拒绝 category=0', () => {
		expect(readAllBodySchema.safeParse({ category: 0 }).success).toBe(false)
	})
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:unit -- tests/unit/schemas/notification.test.ts`
Expected: FAIL（schema 文件不存在）

- [ ] **Step 3: 创建 schema**

```typescript
// server/schemas/notification.ts
import { z } from 'zod'

/** GET /api/notifications 查询参数 */
export const notificationListQuerySchema = z.object({
	category: z.coerce.number().int().min(1).max(3).optional(),
	onlyUnread: z.coerce.boolean().default(false),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

/** PUT /api/notifications/read-all body */
export const readAllBodySchema = z.object({
	category: z.number().int().min(1).max(3).optional(),
})

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>
export type ReadAllBody = z.infer<typeof readAllBodySchema>
```

- [ ] **Step 4: 创建服务端类型**

```typescript
// server/types/notification.ts
/** 通知分类 */
export type NotificationCategory = 1 | 2 | 3

/** biz_type 允许值（A 阶段） */
export type NotificationBizType = 'document' | 'group' | 'group_approval'

/** DB 行（Prisma 模型方法返回） */
export interface NotificationRow {
	id: bigint
	user_id: bigint
	category: number
	msg_code: string | null
	title: string
	content: string | null
	biz_type: string | null
	biz_id: bigint | null
	read_at: Date | null
	created_at: Date
}

/** 前端展示条目（毫秒时间戳 + string ID） */
export interface NotificationItem {
	id: string
	category: NotificationCategory
	msgCode: string
	title: string
	content: string | null
	bizType: NotificationBizType | null
	bizId: string | null
	read: boolean
	readAt: number | null
	createdAt: number
}

/** 分页响应 */
export interface NotificationListResp {
	list: NotificationItem[]
	total: number
	page: number
	pageSize: number
}

/** 未读计数响应 */
export interface UnreadCountResp {
	total: number
	byCategory: { '1': number, '2': number, '3': number }
}

/** createNotification 入参（helper + 模板表共同依赖） */
export interface CreateNotificationOpts {
	userId: bigint | number
	category: NotificationCategory
	msgCode: string
	title: string
	content?: string
	bizType?: NotificationBizType
	bizId?: bigint | number
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test:unit -- tests/unit/schemas/notification.test.ts`
Expected: 14 个测试全部 PASS

- [ ] **Step 6: 提交**

```bash
git add server/schemas/notification.ts server/types/notification.ts tests/unit/schemas/notification.test.ts
git commit -m "feat(notification): Zod schema + 服务端类型 + 14 条单测"
```

---

### Task 3: M1-M24 模板表 — NOTIFICATION_TEMPLATES

**Files:**
- Create: `server/constants/notification-templates.ts`

此文件**仅声明**模板，不被任何业务模块调用（A 阶段契约），但提供强类型 `build()` 函数和 `triggerModule` 标签，供将来 `grep "triggerModule: 'xxx'"` 反向查询。

- [ ] **Step 1: 创建模板表文件**

```typescript
// server/constants/notification-templates.ts
/**
 * 通知消息模板表（M1-M24，对齐 PRD §6.8.2 消息纵览）
 *
 * 本表是"哪个模块触发哪些通知"的代码级单一事实源。
 * 每个模板含：
 *   - category     — 1 审批 / 2 系统 / 3 成员变更（对齐 doc_notifications.category）
 *   - msgCode      — 'M1' ... 'M24'
 *   - triggerModule — 归属业务模块（用于 grep 反查）
 *   - triggerPoint  — 触发时机人类可读描述
 *   - build(params) — 强类型函数，产出 createNotification 的入参
 *
 * 使用方式（将来的业务 handler）：
 *   import { createNotification } from '~/server/utils/notify'
 *   import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
 *   await createNotification(NOTIFICATION_TEMPLATES.M1.build({
 *     toUserId, submitter, fileName, fileId,
 *   }))
 *
 * 反向查询某模块应触发哪些 M 码：
 *   grep "triggerModule: 'approval-runtime'" server/constants/notification-templates.ts
 *
 * 进度追踪：docs/feature-gap-checklist.md 「通知触发点清单」章节
 */
import type { CreateNotificationOpts } from '~/server/types/notification'

export type TriggerModule =
	| 'approval-runtime'
	| 'document-lifecycle'
	| 'ownership-transfer'
	| 'cross-move'
	| 'permission-request'
	| 'share'
	| 'group-member'
	| 'role-assign'
	| 'group-owner'
	| 'hr-handover'
	| 'approval-chain-change'

export interface NotificationTemplate<P extends object> {
	category: 1 | 2 | 3
	msgCode: string
	triggerModule: TriggerModule
	triggerPoint: string
	build: (params: P & { toUserId: bigint | number }) => CreateNotificationOpts
}

type ToUser = { toUserId: bigint | number }

export const NOTIFICATION_TEMPLATES = {
	// ==================== 审批类 M1-M7 ====================
	M1: {
		category: 1,
		msgCode: 'M1',
		triggerModule: 'approval-runtime',
		triggerPoint: '文件提交审批（POST /api/approvals）— 通知当前应处理的审批人',
		build: (p: ToUser & { submitter: string, fileName: string, fileId: bigint | number }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M1',
			title: `${p.submitter} 提交了文件《${p.fileName}》的审批，请处理`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M2: {
		category: 1,
		msgCode: 'M2',
		triggerModule: 'approval-runtime',
		triggerPoint: '上一级审批人通过，流转到下一级 — 通知下一级审批人',
		build: (p: ToUser & { fileName: string, fileId: bigint | number, currentLevel: number, totalLevel: number }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M2',
			title: `文件《${p.fileName}》的审批已流转到您（第 ${p.currentLevel}/${p.totalLevel} 级），请处理`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M3: {
		category: 1,
		msgCode: 'M3',
		triggerModule: 'approval-runtime',
		triggerPoint: '最后一级审批通过 — 通知提交人',
		build: (p: ToUser & { fileName: string, fileId: bigint | number }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M3',
			title: `您提交的文件《${p.fileName}》已审批通过并发布`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M4: {
		category: 1,
		msgCode: 'M4',
		triggerModule: 'approval-runtime',
		triggerPoint: '任一级审批人驳回 — 通知提交人（reason 存 content）',
		build: (p: ToUser & { fileName: string, fileId: bigint | number, reason: string }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M4',
			title: `您提交的文件《${p.fileName}》被驳回，请补充后重新提交`,
			content: p.reason,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M5: {
		category: 1,
		msgCode: 'M5',
		triggerModule: 'approval-runtime',
		triggerPoint: '审批超过 24h 未处理 — 通知该步审批人',
		build: (p: ToUser & { fileName: string, fileId: bigint | number, overdueHours: number }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M5',
			title: `文件《${p.fileName}》的审批已超时 ${p.overdueHours} 小时，请尽快处理`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M6: {
		category: 1,
		msgCode: 'M6',
		triggerModule: 'approval-runtime',
		triggerPoint: '系统催办达上限 — 通知提交人',
		build: (p: ToUser & { fileName: string, fileId: bigint | number, maxTimes: number }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M6',
			title: `文件《${p.fileName}》的审批催办已达上限（${p.maxTimes} 次），您可撤回重新提交`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M7: {
		category: 1,
		msgCode: 'M7',
		triggerModule: 'approval-runtime',
		triggerPoint: '提交人撤回审批 — 通知已参与审批的所有审批人',
		build: (p: ToUser & { submitter: string, fileName: string, fileId: bigint | number }) => ({
			userId: p.toUserId,
			category: 1 as const,
			msgCode: 'M7',
			title: `${p.submitter} 已撤回文件《${p.fileName}》的审批`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},

	// ==================== 文档生命周期 M8-M9 ====================
	M8: {
		category: 2,
		msgCode: 'M8',
		triggerModule: 'document-lifecycle',
		triggerPoint: '审批通过后发布 — 通知归属人 + 可编辑成员 + 组管理员',
		build: (p: ToUser & { fileName: string, fileId: bigint | number, version: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M8',
			title: `文件《${p.fileName}》已发布新版本 ${p.version}`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},
	M9: {
		category: 2,
		msgCode: 'M9',
		triggerModule: 'document-lifecycle',
		triggerPoint: '管理员从组移除文档 — 通知文档归属人',
		build: (p: ToUser & { operator: string, fileName: string, fileId: bigint | number, groupName: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M9',
			title: `管理员 ${p.operator} 已将文件《${p.fileName}》从组《${p.groupName}》中移除，文档已退回您的个人中心`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},

	// ==================== 归属人转移 M10-M11 ====================
	M10: {
		category: 2,
		msgCode: 'M10',
		triggerModule: 'ownership-transfer',
		triggerPoint: '发起归属人转移 — 通知目标新归属人',
		build: (p: ToUser & { initiator: string, fileName: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M10',
			title: `${p.initiator} 希望将文件《${p.fileName}》的归属人转移给您，请处理`,
		}),
	},
	M11: {
		category: 2,
		msgCode: 'M11',
		triggerModule: 'ownership-transfer',
		triggerPoint: '转移同意/拒绝/过期 — 通知发起人（result: 已同意/已拒绝/已过期）',
		build: (p: ToUser & { fileName: string, result: '已同意' | '已拒绝' | '已过期' }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M11',
			title: `文件《${p.fileName}》的归属人转移${p.result}`,
		}),
	},

	// ==================== 跨组移动 M12-M13 ====================
	M12: {
		category: 2,
		msgCode: 'M12',
		triggerModule: 'cross-move',
		triggerPoint: '发起跨组移动 — 通知目标组负责人',
		build: (p: ToUser & { initiator: string, fileName: string, fromGroup: string, toGroup: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M12',
			title: `${p.initiator} 申请将文件《${p.fileName}》从组《${p.fromGroup}》移动到您负责的组《${p.toGroup}》`,
		}),
	},
	M13: {
		category: 2,
		msgCode: 'M13',
		triggerModule: 'cross-move',
		triggerPoint: '移动同意/拒绝/过期 — 通知发起人',
		build: (p: ToUser & { fileName: string, result: '已同意' | '已拒绝' | '已过期' }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M13',
			title: `文件《${p.fileName}》的跨组移动申请${p.result}`,
		}),
	},

	// ==================== 权限申请 M14-M16 ====================
	M14: {
		category: 2,
		msgCode: 'M14',
		triggerModule: 'permission-request',
		triggerPoint: '无权限用户申请阅读 — 通知文档归属人',
		build: (p: ToUser & { applicant: string, fileName: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M14',
			title: `${p.applicant} 申请阅读文件《${p.fileName}》`,
		}),
	},
	M15: {
		category: 2,
		msgCode: 'M15',
		triggerModule: 'permission-request',
		triggerPoint: '可阅读用户申请升级编辑 — 通知归属人（reason 存 content）',
		build: (p: ToUser & { applicant: string, fileName: string, reason: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M15',
			title: `${p.applicant} 申请文件《${p.fileName}》的编辑权限`,
			content: p.reason,
		}),
	},
	M16: {
		category: 2,
		msgCode: 'M16',
		triggerModule: 'permission-request',
		triggerPoint: '权限审批同意/拒绝 — 通知申请人',
		build: (p: ToUser & { fileName: string, permType: '阅读' | '编辑', result: '已同意' | '已拒绝' }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M16',
			title: `您对文件《${p.fileName}》的${p.permType}权限申请${p.result}`,
		}),
	},

	// ==================== 分享 M17 ====================
	M17: {
		category: 2,
		msgCode: 'M17',
		triggerModule: 'share',
		triggerPoint: '分享文档给指定用户 — 通知被分享人',
		build: (p: ToUser & { sharer: string, fileName: string, fileId: bigint | number, permLabel: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M17',
			title: `${p.sharer} 向您分享了文件《${p.fileName}》（${p.permLabel}）`,
			bizType: 'document' as const,
			bizId: p.fileId,
		}),
	},

	// ==================== 成员变更 M18-M23 ====================
	M18: {
		category: 3,
		msgCode: 'M18',
		triggerModule: 'group-member',
		triggerPoint: '被加入组 — 通知被添加的成员',
		build: (p: ToUser & { groupName: string, groupId: bigint | number, permLabel: string }) => ({
			userId: p.toUserId,
			category: 3 as const,
			msgCode: 'M18',
			title: `您已被添加为组《${p.groupName}》的成员（权限：${p.permLabel}）`,
			bizType: 'group' as const,
			bizId: p.groupId,
		}),
	},
	M19: {
		category: 3,
		msgCode: 'M19',
		triggerModule: 'group-member',
		triggerPoint: '组内权限调整 — 通知被变更成员',
		build: (p: ToUser & { groupName: string, oldLabel: string, newLabel: string }) => ({
			userId: p.toUserId,
			category: 3 as const,
			msgCode: 'M19',
			title: `您在组《${p.groupName}》的权限已从「${p.oldLabel}」变更为「${p.newLabel}」`,
		}),
	},
	M20: {
		category: 3,
		msgCode: 'M20',
		triggerModule: 'group-member',
		triggerPoint: '被移出组 — 通知被移出成员',
		build: (p: ToUser & { groupName: string }) => ({
			userId: p.toUserId,
			category: 3 as const,
			msgCode: 'M20',
			title: `您已被移出组《${p.groupName}》`,
		}),
	},
	M21: {
		category: 3,
		msgCode: 'M21',
		triggerModule: 'role-assign',
		triggerPoint: '管理员角色指派/撤销 — 通知被指派/撤销用户',
		build: (p: ToUser & { title: string }) => ({
			userId: p.toUserId,
			category: 3 as const,
			msgCode: 'M21',
			title: p.title,
		}),
	},
	M22: {
		category: 3,
		msgCode: 'M22',
		triggerModule: 'group-owner',
		triggerPoint: '组负责人变更 — 通知新负责人 + 组内成员',
		build: (p: ToUser & { groupName: string, groupId: bigint | number, oldOwner: string, newOwner: string }) => ({
			userId: p.toUserId,
			category: 3 as const,
			msgCode: 'M22',
			title: `组《${p.groupName}》的负责人已由 ${p.oldOwner} 变更为 ${p.newOwner}`,
			bizType: 'group' as const,
			bizId: p.groupId,
		}),
	},
	M23: {
		category: 3,
		msgCode: 'M23',
		triggerModule: 'hr-handover',
		triggerPoint: '员工离职触发交接 — 通知部门负责人',
		build: (p: ToUser & { leaver: string, groupName: string, groupId: bigint | number, successor: string }) => ({
			userId: p.toUserId,
			category: 3 as const,
			msgCode: 'M23',
			title: `员工 ${p.leaver} 已离职，其负责的组《${p.groupName}》已交接给 ${p.successor}，请确认`,
			bizType: 'group' as const,
			bizId: p.groupId,
		}),
	},

	// ==================== 审批链变更 M24 ====================
	M24: {
		category: 2,
		msgCode: 'M24',
		triggerModule: 'approval-chain-change',
		triggerPoint: '审批链成员因离职/调岗被移除 — 通知组负责人/管理员',
		build: (p: ToUser & { memberName: string, groupName: string, groupId: bigint | number, reason: string }) => ({
			userId: p.toUserId,
			category: 2 as const,
			msgCode: 'M24',
			title: `成员 ${p.memberName} 已从组《${p.groupName}》的审批链中移除（${p.reason}），请检查审批配置`,
			bizType: 'group_approval' as const,
			bizId: p.groupId,
		}),
	},
} as const
```

- [ ] **Step 2: TS 编译检查**

Run: `npx nuxi typecheck 2>&1 | head -30`
Expected: 无错误（`CreateNotificationOpts` 已在 Task 2 定义，import 即解析）。

- [ ] **Step 3: 提交**

```bash
git add server/constants/notification-templates.ts
git commit -m "feat(notification): M1-M24 模板表（NOTIFICATION_TEMPLATES）"
```

---

### Task 4: createNotification helper — server/utils/notify.ts

**Files:**
- Create: `server/utils/notify.ts`

- [ ] **Step 1: 创建 helper**

```typescript
// server/utils/notify.ts
/**
 * 通知写入工具
 *
 * ═══════════════════════════════════════════════════════════════
 * 通知开发纪律（所有业务模块触发通知时必读）：
 *   1. 统一走 createNotification(NOTIFICATION_TEMPLATES.Mx.build(...))
 *      不要绕过模板直接 INSERT doc_notifications
 *   2. 新增业务行为 → 对照 PRD §6.8.2 定位 M 码 → 用
 *      server/constants/notification-templates.ts 查模板
 *   3. M1-M24 的归属模块和触发点进度见 docs/feature-gap-checklist.md
 *      「通知触发点清单」章节，完成后打 ✅ 并写完成日期
 *   4. 新增 biz_type 时同步更新 types/notification.ts + 前端
 *      utils/notification-meta.ts 的 resolveRoute 映射
 *   5. createNotification 内部会推送一条 WS 'badge' 消息更新该用户的
 *      notifications 未读数；批量请用 createNotifications 单次事务+按
 *      用户分组推送，避免 N 次 COUNT + N 次推送
 * ═══════════════════════════════════════════════════════════════
 */
import { snowflakeId } from '~/server/utils/snowflake'
import type { WsServerMessage } from '~/types/ws'
import type { CreateNotificationOpts } from '~/server/types/notification'

/** 创建一条通知并推送 WS 'badge' 消息 */
export async function createNotification(opts: CreateNotificationOpts): Promise<void> {
	const userIdBI = BigInt(opts.userId)

	await prisma.doc_notifications.create({
		data: {
			id: snowflakeId(),
			user_id: userIdBI,
			category: opts.category,
			msg_code: opts.msgCode,
			title: opts.title,
			content: opts.content ?? null,
			biz_type: opts.bizType ?? null,
			biz_id: opts.bizId !== undefined ? BigInt(opts.bizId) : null,
		},
	})

	await pushBadgeToUser(userIdBI)
}

/**
 * 批量创建通知：单次事务，按 userId 分组只推送一次 badge
 * 适用于"组内所有成员""所有审批人"等多目标场景
 */
export async function createNotifications(list: CreateNotificationOpts[]): Promise<void> {
	if (list.length === 0) return

	const rows = list.map(opts => ({
		id: snowflakeId(),
		user_id: BigInt(opts.userId),
		category: opts.category,
		msg_code: opts.msgCode,
		title: opts.title,
		content: opts.content ?? null,
		biz_type: opts.bizType ?? null,
		biz_id: opts.bizId !== undefined ? BigInt(opts.bizId) : null,
	}))

	await prisma.doc_notifications.createMany({ data: rows })

	const uniqueUserIds = Array.from(new Set(rows.map(r => r.user_id)))
	await Promise.all(uniqueUserIds.map(uid => pushBadgeToUser(uid)))
}

/** 查询某用户未读数并推送 badge 消息 */
async function pushBadgeToUser(userId: bigint): Promise<void> {
	const unreadCount = await prisma.doc_notifications.count({
		where: { user_id: userId, read_at: null },
	})

	const msg: WsServerMessage = {
		type: 'badge',
		payload: { notifications: unreadCount },
	}
	wsSendToUser(Number(userId), msg)
}
```

注意：`prisma` / `wsSendToUser` 是 Nitro 自动导入（通过 `server/utils/*.ts` 全局注册），无需 import。`snowflakeId` 虽在同目录但以显式 import 更清楚。

- [ ] **Step 2: TS 编译**

Run: `npx nuxi typecheck 2>&1 | head -30`
Expected: 无新错误。

- [ ] **Step 3: 提交**

```bash
git add server/utils/notify.ts
git commit -m "feat(notification): createNotification helper + WS badge 推送"
```

---

### Task 5: GET /api/notifications + GET /api/notifications/unread-count

**Files:**
- Create: `server/api/notifications/index.get.ts`
- Create: `server/api/notifications/unread-count.get.ts`

- [ ] **Step 1: 创建列表接口**

```typescript
// server/api/notifications/index.get.ts
import { notificationListQuerySchema } from '~/server/schemas/notification'
import type { NotificationItem, NotificationListResp, NotificationCategory, NotificationBizType } from '~/server/types/notification'

export default defineEventHandler(async (event): Promise<NotificationListResp> => {
	const query = await getValidatedQuery(event, notificationListQuerySchema.parse)
	const userId = BigInt(event.context.user.id)

	const where: {
		user_id: bigint
		category?: number
		read_at?: null
	} = { user_id: userId }
	if (query.category !== undefined) where.category = query.category
	if (query.onlyUnread) where.read_at = null

	const [total, rows] = await Promise.all([
		prisma.doc_notifications.count({ where }),
		prisma.doc_notifications.findMany({
			where,
			orderBy: { created_at: 'desc' },
			skip: (query.page - 1) * query.pageSize,
			take: query.pageSize,
		}),
	])

	const list: NotificationItem[] = rows.map(r => ({
		id: r.id.toString(),
		category: r.category as NotificationCategory,
		msgCode: r.msg_code ?? '',
		title: r.title,
		content: r.content,
		bizType: r.biz_type as NotificationBizType | null,
		bizId: r.biz_id ? r.biz_id.toString() : null,
		read: r.read_at !== null,
		readAt: r.read_at ? r.read_at.getTime() : null,
		createdAt: r.created_at.getTime(),
	}))

	return ok({
		list,
		total,
		page: query.page,
		pageSize: query.pageSize,
	})
})
```

- [ ] **Step 2: 创建未读计数接口**

```typescript
// server/api/notifications/unread-count.get.ts
import type { UnreadCountResp } from '~/server/types/notification'

export default defineEventHandler(async (event): Promise<UnreadCountResp> => {
	const userId = BigInt(event.context.user.id)

	// 一次 GROUP BY category 拿全部分类未读数
	const rows = await prisma.$queryRaw<Array<{ category: number, cnt: bigint }>>`
		SELECT category, COUNT(*) AS cnt
		FROM doc_notifications
		WHERE user_id = ${userId} AND read_at IS NULL
		GROUP BY category
	`

	const byCategory: UnreadCountResp['byCategory'] = { '1': 0, '2': 0, '3': 0 }
	let total = 0
	for (const r of rows) {
		const c = String(r.category) as '1' | '2' | '3'
		const cnt = Number(r.cnt)
		byCategory[c] = cnt
		total += cnt
	}

	return ok({ total, byCategory })
})
```

- [ ] **Step 3: 手动冒烟**

启动 dev server（如未启动），用工具或浏览器测试。此处以 curl 为例（需提前在浏览器登录并复制 accessToken）：

```bash
# 取 token（浏览器控制台）
# localStorage.getItem('accessToken')
TOKEN="<替换为真实 accessToken>"

curl -s "http://localhost:3000/api/notifications?page=1&pageSize=5" -H "Authorization: Bearer $TOKEN" | jq
curl -s "http://localhost:3000/api/notifications?category=1&onlyUnread=true" -H "Authorization: Bearer $TOKEN" | jq
curl -s "http://localhost:3000/api/notifications/unread-count" -H "Authorization: Bearer $TOKEN" | jq
```

Expected:
- 第一个返回最多 5 条最新通知（按 created_at DESC）
- 第二个只返回 category=1 未读
- 第三个返回 `{ total: N, byCategory: { '1': .., '2': .., '3': .. } }`

- [ ] **Step 4: 提交**

```bash
git add server/api/notifications/index.get.ts server/api/notifications/unread-count.get.ts
git commit -m "feat(notification): GET 列表接口 + unread-count 接口"
```

---

### Task 6: PUT /api/notifications/:id/read + PUT /api/notifications/read-all

**Files:**
- Create: `server/api/notifications/[id]/read.put.ts`
- Create: `server/api/notifications/read-all.put.ts`
- Modify: `server/utils/notify.ts`（新增内部 `pushBadgeToUserExternal` 导出以便写接口复用，或保持现状由接口自己查 count 并 wsSendToUser）

方案：**不修改** notify.ts，读/写 API 内部直接查 count + wsSendToUser（避免把内部函数暴露）。

- [ ] **Step 1: 创建单条已读接口**

```typescript
// server/api/notifications/[id]/read.put.ts
import type { WsServerMessage } from '~/types/ws'

export default defineEventHandler(async (event) => {
	const idParam = getRouterParam(event, 'id')
	if (!idParam || !/^\d+$/.test(idParam)) {
		return fail(event, 400, 'BAD_REQUEST', '无效的通知 ID')
	}
	const id = BigInt(idParam)
	const userId = BigInt(event.context.user.id)

	const existing = await prisma.doc_notifications.findFirst({
		where: { id, user_id: userId },
		select: { id: true, read_at: true },
	})
	if (!existing) {
		return fail(event, 404, 'NOT_FOUND', '通知不存在')
	}

	// 已读幂等：已读不覆盖 read_at
	if (existing.read_at === null) {
		await prisma.doc_notifications.update({
			where: { id },
			data: { read_at: new Date() },
		})
	}

	// 推 WS badge
	const unread = await prisma.doc_notifications.count({
		where: { user_id: userId, read_at: null },
	})
	const msg: WsServerMessage = { type: 'badge', payload: { notifications: unread } }
	wsSendToUser(Number(userId), msg)

	return ok({})
})
```

- [ ] **Step 2: 创建全部已读接口**

```typescript
// server/api/notifications/read-all.put.ts
import { readAllBodySchema } from '~/server/schemas/notification'
import type { WsServerMessage } from '~/types/ws'

export default defineEventHandler(async (event) => {
	const body = await readValidatedBody(event, readAllBodySchema.parse)
	const userId = BigInt(event.context.user.id)

	const where: { user_id: bigint, read_at: null, category?: number } = {
		user_id: userId,
		read_at: null,
	}
	if (body.category !== undefined) where.category = body.category

	const result = await prisma.doc_notifications.updateMany({
		where,
		data: { read_at: new Date() },
	})

	// 推 WS badge
	const unread = await prisma.doc_notifications.count({
		where: { user_id: userId, read_at: null },
	})
	const msg: WsServerMessage = { type: 'badge', payload: { notifications: unread } }
	wsSendToUser(Number(userId), msg)

	return ok({ updated: result.count })
})
```

- [ ] **Step 3: 手动冒烟**

```bash
# 拿到一条未读通知 ID
TOKEN="<你的 token>"
curl -s "http://localhost:3000/api/notifications?onlyUnread=true&pageSize=1" -H "Authorization: Bearer $TOKEN" | jq '.data.list[0].id'

# 标记单条已读
ID="<上面拿到的 id>"
curl -s -X PUT "http://localhost:3000/api/notifications/$ID/read" -H "Authorization: Bearer $TOKEN" | jq

# 标记 category=1 全部已读
curl -s -X PUT "http://localhost:3000/api/notifications/read-all" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"category":1}' | jq

# 验证未读数下降
curl -s "http://localhost:3000/api/notifications/unread-count" -H "Authorization: Bearer $TOKEN" | jq
```

Expected: 已读接口返回 `{}`，read-all 返回 `{ updated: N }`，未读数对应减少。

- [ ] **Step 4: 提交**

```bash
git add "server/api/notifications/[id]/read.put.ts" server/api/notifications/read-all.put.ts
git commit -m "feat(notification): PUT 单条/全部已读接口 + WS badge 推送"
```

---

### Task 7: 前端类型 + API 封装 + notification-meta 工具 + 单测

**Files:**
- Create: `types/notification.ts`
- Create: `api/notifications.ts`
- Create: `utils/notification-meta.ts`
- Create: `tests/unit/utils/notification-meta.test.ts`

- [ ] **Step 1: 创建前端类型**

```typescript
// types/notification.ts
import type { NotificationListQuery, ReadAllBody } from '~/server/schemas/notification'
import type {
	NotificationCategory, NotificationBizType,
	NotificationItem, NotificationListResp, UnreadCountResp,
} from '~/server/types/notification'

export type {
	NotificationCategory, NotificationBizType,
	NotificationItem, NotificationListResp, UnreadCountResp,
	NotificationListQuery, ReadAllBody,
}
```

- [ ] **Step 2: 创建 API 封装**

```typescript
// api/notifications.ts
import type { NotificationListQuery, NotificationListResp, UnreadCountResp, ReadAllBody } from '~/types/notification'

export function fetchNotifications(query: NotificationListQuery = {}) {
	return useAuthFetch<NotificationListResp>('/api/notifications', {
		method: 'GET',
		query,
	})
}

export function fetchUnreadCount() {
	return useAuthFetch<UnreadCountResp>('/api/notifications/unread-count', {
		method: 'GET',
	})
}

export function markNotificationRead(id: string) {
	return useAuthFetch<Record<string, never>>(`/api/notifications/${id}/read`, {
		method: 'PUT',
	})
}

export function markAllRead(body: ReadAllBody = {}) {
	return useAuthFetch<{ updated: number }>('/api/notifications/read-all', {
		method: 'PUT',
		body,
	})
}
```

- [ ] **Step 3: 写 meta 工具单测**

```typescript
// tests/unit/utils/notification-meta.test.ts
import { describe, it, expect } from 'vitest'
import { resolveRoute, NOTIFICATION_META } from '~/utils/notification-meta'

describe('resolveRoute', () => {
	it('document 类型 → /docs/file/:id', () => {
		expect(resolveRoute('document', '12345')).toEqual({ path: '/docs/file/12345' })
	})

	it('group 类型 → /docs/repo/:id', () => {
		expect(resolveRoute('group', '67890')).toEqual({ path: '/docs/repo/67890' })
	})

	it('group_approval 类型 → /docs/repo/:id?openSettings=approval', () => {
		expect(resolveRoute('group_approval', '42')).toEqual({
			path: '/docs/repo/42',
			query: { openSettings: 'approval' },
		})
	})

	it('bizType 为 null → null（不跳转）', () => {
		expect(resolveRoute(null, '1')).toBeNull()
	})

	it('bizId 为 null → null（不跳转）', () => {
		expect(resolveRoute('document', null)).toBeNull()
	})

	it('未知 bizType → null', () => {
		expect(resolveRoute('unknown' as never, '1')).toBeNull()
	})
})

describe('NOTIFICATION_META', () => {
	it('覆盖 M1-M24 全部 24 个 msg_code', () => {
		for (let i = 1; i <= 24; i++) {
			expect(NOTIFICATION_META[`M${i}`], `M${i} missing`).toBeDefined()
		}
	})

	it('每项含 icon 和 color 字段', () => {
		for (const code of Object.keys(NOTIFICATION_META)) {
			const meta = NOTIFICATION_META[code]
			expect(meta.icon).toBeDefined()
			expect(['primary', 'success', 'warning', 'danger', 'info']).toContain(meta.color)
		}
	})
})
```

- [ ] **Step 4: 运行测试确认失败**

Run: `npm run test:unit -- tests/unit/utils/notification-meta.test.ts`
Expected: FAIL（文件不存在）

- [ ] **Step 5: 创建 meta 工具**

```typescript
// utils/notification-meta.ts
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import {
	AlarmClock, CircleCheck, CircleClose, Document, DocumentChecked,
	Lock, Promotion, Rank, RefreshLeft, Setting, Share, Switch, User, UserFilled, Warning,
} from '@element-plus/icons-vue'
import type { NotificationBizType } from '~/types/notification'

export type NotificationMetaColor = 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface NotificationMeta {
	icon: Component
	color: NotificationMetaColor
}

export const NOTIFICATION_META: Record<string, NotificationMeta> = {
	M1:  { icon: DocumentChecked, color: 'primary' },
	M2:  { icon: DocumentChecked, color: 'primary' },
	M3:  { icon: CircleCheck,     color: 'success' },
	M4:  { icon: CircleClose,     color: 'danger'  },
	M5:  { icon: AlarmClock,      color: 'warning' },
	M6:  { icon: Warning,         color: 'warning' },
	M7:  { icon: RefreshLeft,     color: 'info'    },
	M8:  { icon: Promotion,       color: 'success' },
	M9:  { icon: CircleClose,     color: 'danger'  },
	M10: { icon: User,            color: 'warning' },
	M11: { icon: User,            color: 'info'    },
	M12: { icon: Rank,            color: 'primary' },
	M13: { icon: Rank,            color: 'info'    },
	M14: { icon: Lock,            color: 'warning' },
	M15: { icon: Lock,            color: 'warning' },
	M16: { icon: CircleCheck,     color: 'success' },
	M17: { icon: Share,           color: 'primary' },
	M18: { icon: UserFilled,      color: 'success' },
	M19: { icon: UserFilled,      color: 'primary' },
	M20: { icon: UserFilled,      color: 'danger'  },
	M21: { icon: User,            color: 'primary' },
	M22: { icon: Switch,          color: 'primary' },
	M23: { icon: User,            color: 'warning' },
	M24: { icon: Setting,         color: 'warning' },
}

/** 未知 msg_code 的兜底 meta */
export const DEFAULT_META: NotificationMeta = { icon: Document, color: 'info' }

export function getNotificationMeta(msgCode: string): NotificationMeta {
	return NOTIFICATION_META[msgCode] ?? DEFAULT_META
}

/** 按 biz_type 解析跳转路由；不可跳则返回 null */
export function resolveRoute(bizType: NotificationBizType | null, bizId: string | null): RouteLocationRaw | null {
	if (!bizType || !bizId) return null
	switch (bizType) {
		case 'document':
			return { path: `/docs/file/${bizId}` }
		case 'group':
			return { path: `/docs/repo/${bizId}` }
		case 'group_approval':
			return { path: `/docs/repo/${bizId}`, query: { openSettings: 'approval' } }
		default:
			return null
	}
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm run test:unit -- tests/unit/utils/notification-meta.test.ts`
Expected: 8 个测试全部 PASS

- [ ] **Step 7: 提交**

```bash
git add types/notification.ts api/notifications.ts utils/notification-meta.ts tests/unit/utils/notification-meta.test.ts
git commit -m "feat(notification): 前端类型 + API 封装 + meta 工具（含 8 条单测）"
```

---

### Task 8: NotificationCard.vue — 单条卡片组件

**Files:**
- Create: `components/NotificationCard.vue`

- [ ] **Step 1: 创建组件**

```vue
<!-- components/NotificationCard.vue -->
<template>
	<article
		class="df-notification-card"
		:class="{
			'df-notification-card--unread': !item.read,
			'df-notification-card--clickable': clickable,
		}"
		@click="handleClick"
	>
		<div class="df-notification-card__icon" :data-color="meta.color">
			<el-icon :size="16">
				<component :is="meta.icon" />
			</el-icon>
		</div>
		<div class="df-notification-card__body">
			<div class="df-notification-card__title">{{ item.title }}</div>
			<div v-if="item.content" class="df-notification-card__content">{{ item.content }}</div>
			<div class="df-notification-card__time">{{ formattedTime }}</div>
		</div>
		<span v-if="!item.read" class="df-notification-card__dot" aria-label="未读" />
	</article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getNotificationMeta, resolveRoute } from '~/utils/notification-meta'
import { formatTime } from '~/utils/format'
import type { NotificationItem } from '~/types/notification'

const props = defineProps<{
	item: NotificationItem
}>()

const emit = defineEmits<{
	(e: 'click', item: NotificationItem): void
}>()

const meta = computed(() => getNotificationMeta(props.item.msgCode))

const clickable = computed(() => resolveRoute(props.item.bizType, props.item.bizId) !== null || !props.item.read)

const formattedTime = computed(() => formatTime(props.item.createdAt))

function handleClick() {
	emit('click', props.item)
}
</script>
```

- [ ] **Step 2: TS/Vue 编译确认**

Run: `npx nuxi typecheck 2>&1 | grep -i "notificationcard\|notification-card" | head -20`
Expected: 无错误输出（组件样式在 Task 12 添加，此时无样式不影响编译）。

- [ ] **Step 3: 提交**

```bash
git add components/NotificationCard.vue
git commit -m "feat(notification): NotificationCard 单条卡片组件"
```

---

### Task 9: NotificationPopover.vue — 下拉面板

**Files:**
- Create: `components/NotificationPopover.vue`

- [ ] **Step 1: 创建 Popover**

```vue
<!-- components/NotificationPopover.vue -->
<template>
	<div class="df-notification-popover">
		<header class="df-notification-popover__head">
			<el-segmented
				v-model="filterMode"
				:options="segmentOptions"
				size="small"
			/>
		</header>

		<div v-loading="loading" class="df-notification-popover__body">
			<el-scrollbar>
				<EmptyState v-if="!loading && list.length === 0" preset="no-notifications" />
				<NotificationCard
					v-for="item in list"
					:key="item.id"
					:item="item"
					@click="handleCardClick"
				/>
			</el-scrollbar>
		</div>

		<footer class="df-notification-popover__foot">
			<el-button
				type="primary"
				text
				:disabled="unreadTotal === 0 || markingAll"
				:loading="markingAll"
				@click="handleMarkAll"
			>
				全部标为已读
			</el-button>
			<el-button text @click="handleViewAll">
				查看全部
				<el-icon class="el-icon--right"><ArrowRight /></el-icon>
			</el-button>
		</footer>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { fetchNotifications, markNotificationRead, markAllRead } from '~/api/notifications'
import { resolveRoute } from '~/utils/notification-meta'
import { useWsStore } from '~/stores/ws'
import type { NotificationItem } from '~/types/notification'

const emit = defineEmits<{ (e: 'close'): void }>()

const wsStore = useWsStore()
const { msgSuccess, msgError } = useNotify()

const filterMode = ref<'unread' | 'all'>('unread')
const segmentOptions = computed(() => [
	{ label: `未读${wsStore.badges.notifications > 0 ? `(${wsStore.badges.notifications > 99 ? '99+' : wsStore.badges.notifications})` : ''}`, value: 'unread' },
	{ label: '全部', value: 'all' },
])

const list = ref<NotificationItem[]>([])
const loading = ref(false)
const markingAll = ref(false)
const unreadTotal = computed(() => wsStore.badges.notifications)

async function load() {
	loading.value = true
	try {
		const res = await fetchNotifications({
			onlyUnread: filterMode.value === 'unread',
			pageSize: 20,
			page: 1,
		})
		list.value = res.data.list
	} catch (e) {
		msgError((e as Error)?.message || '加载通知失败')
	} finally {
		loading.value = false
	}
}

watch(filterMode, load)

onMounted(load)

async function handleCardClick(item: NotificationItem) {
	// 标已读（幂等）
	if (!item.read) {
		try {
			await markNotificationRead(item.id)
			// 本地同步状态
			const row = list.value.find(x => x.id === item.id)
			if (row) {
				row.read = true
				row.readAt = Date.now()
			}
		} catch {
			// WS 会同步 badge；失败静默
		}
	}

	// 跳转
	const target = resolveRoute(item.bizType, item.bizId)
	if (target) {
		navigateTo(target)
	}

	// 关面板
	emit('close')
}

async function handleMarkAll() {
	if (unreadTotal.value === 0) return
	markingAll.value = true
	try {
		const res = await markAllRead({})
		msgSuccess(`已全部标为已读（${res.data.updated} 条）`)
		// 本地 badge 立即归零（WS 也会推一条 badge: 0 来覆盖，但给用户即时反馈）
		wsStore.badges.notifications = 0
		// 重新拉列表以反映已读态
		await load()
	} catch (e) {
		msgError((e as Error)?.message || '操作失败')
	} finally {
		markingAll.value = false
	}
}

function handleViewAll() {
	navigateTo('/notifications')
	emit('close')
}

defineExpose({ refresh: load })
</script>
```

- [ ] **Step 2: 新增 EmptyState 的 preset `no-notifications`**

Run: `grep -n "preset" components/EmptyState.vue 2>/dev/null | head -20`

若 `no-notifications` preset 不存在，则在 `components/EmptyState.vue` 的 preset 映射表里追加：

```typescript
// 在 presetMap（或同类配置）里新增
'no-notifications': {
	icon: 'bell',  // 或复用现有 no-logs 的 unDraw 插画
	title: '暂无通知',
	description: '您当前没有任何未读通知',
},
```

实际名称和字段按该文件已有结构适配。如果已存在类似 `no-logs` 的 preset，复刻一份改文字即可。

- [ ] **Step 3: 提交**

```bash
git add components/NotificationPopover.vue components/EmptyState.vue
git commit -m "feat(notification): NotificationPopover 下拉面板 + EmptyState no-notifications preset"
```

---

### Task 10: NotificationBell.vue + layouts 集成 + WS 对账 composable

**Files:**
- Create: `components/NotificationBell.vue`
- Create: `composables/useNotificationBadge.ts`
- Modify: `layouts/prototype.vue`

- [ ] **Step 1: 创建对账 composable**

```typescript
// composables/useNotificationBadge.ts
/**
 * 未读数对账（WS 断开重连时 + 登录完成时各拉一次）
 * 正常会话无定时轮询，仅靠 WS 推送更新 wsStore.badges.notifications
 */
import { fetchUnreadCount } from '~/api/notifications'

let reconciling = false

export async function reconcileNotificationBadge() {
	if (reconciling) return
	reconciling = true
	try {
		const wsStore = useWsStore()
		const res = await fetchUnreadCount()
		wsStore.badges.notifications = res.data.total
	} catch {
		// 静默；下次对账点会再次尝试
	} finally {
		reconciling = false
	}
}
```

- [ ] **Step 2: 创建铃铛组件**

```vue
<!-- components/NotificationBell.vue -->
<template>
	<el-popover
		v-model:visible="open"
		placement="bottom-end"
		:width="380"
		trigger="click"
		popper-class="df-notification-popper"
		:show-arrow="false"
	>
		<template #reference>
			<button
				class="df-notification-bell"
				type="button"
				:aria-label="`通知${displayCount ? `（${displayCount} 条未读）` : ''}`"
			>
				<el-icon :size="18">
					<Bell />
				</el-icon>
				<span
					v-if="wsStore.badges.notifications > 0"
					class="df-notification-bell__dot"
					:class="{ 'df-notification-bell__dot--wide': wsStore.badges.notifications >= 10 }"
				>
					{{ displayCount }}
				</span>
			</button>
		</template>

		<NotificationPopover v-if="open" @close="open = false" />
	</el-popover>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Bell } from '@element-plus/icons-vue'
import { useWsStore } from '~/stores/ws'
import { reconcileNotificationBadge } from '~/composables/useNotificationBadge'

const wsStore = useWsStore()
const open = ref(false)

const displayCount = computed(() => {
	const n = wsStore.badges.notifications
	if (n <= 0) return ''
	if (n > 99) return '99+'
	return String(n)
})

// 登录完成 / 组件挂载时拉一次对账（不依赖 WS 打开时机）
onMounted(() => {
	reconcileNotificationBadge()
})
</script>
```

- [ ] **Step 3: 修改 `useWs.ts` 在 WS `open` 事件里调对账**

Modify `composables/useWs.ts:75-80`（现 `ws.addEventListener('open', () => { ... })` 块）：

```typescript
ws.addEventListener('open', () => {
	wsStore.setConnected(true)
	reconnectAttempts = 0
	startPing()
	// 重连成功后对账未读数
	import('~/composables/useNotificationBadge').then(m => m.reconcileNotificationBadge())
})
```

（用动态 import 避免 useWs 强依赖通知模块 — 即使通知模块被移除也不影响 WS 基础能力。）

- [ ] **Step 4: 修改 `layouts/prototype.vue` 插入铃铛**

定位 `layouts/prototype.vue` 的 `.pf-header-actions` 内、暗黑切换按钮之后、`<!-- 语言切换注释块 -->` 之前，插入：

```vue
<ClientOnly>
	<NotificationBell v-if="authStore.isAuthenticated" />
</ClientOnly>
```

具体位置：找到 `<button class="pf-dark-toggle" ...>` 标签闭合后、`<!-- <button class="pf-locale-toggle" ...> -->` 之前。

- [ ] **Step 5: 手动冒烟**

启动 dev server（如未启动：`npm run dev`），登录后观察：
1. 顶栏铃铛出现，若有未读显示红角标
2. 点铃铛弹出 Popover，显示未读列表
3. 切换"未读/全部"，列表变化
4. 点卡片：有 biz 的跳转对应页面 + 关 Popover；无 biz 仅标已读
5. 点"全部标为已读"：toast + 角标归零 + 列表重新加载
6. 点"查看全部 →"：跳 `/notifications`（整页此刻仍是旧 mock，下 Task 改造）

- [ ] **Step 6: 提交**

```bash
git add components/NotificationBell.vue composables/useNotificationBadge.ts composables/useWs.ts layouts/prototype.vue
git commit -m "feat(notification): 顶栏铃铛 + Popover 集成 + WS 对账 composable"
```

---

### Task 11: pages/notifications.vue 改造 — 4 Tab + segment + 分页

**Files:**
- Modify: `pages/notifications.vue`（完全重写，删除现有 mock）
- Modify: `pages/docs/repo/[id].vue`（检测 `?openSettings=approval` 自动打开审批配置 Tab）

- [ ] **Step 1: 重写通知中心整页**

```vue
<!-- pages/notifications.vue -->
<template>
	<section class="pf-page-stack df-notifications-page">
		<PageTitle title="通知中心" subtitle="查看审批通知、系统通知、成员变更消息">
			<template #actions>
				<el-button
					type="primary"
					:disabled="currentTabUnread === 0 || markingAll"
					:loading="markingAll"
					@click="handleMarkAllCurrentTab"
				>
					<el-icon><Check /></el-icon>
					<span>{{ markAllLabel }}</span>
				</el-button>
			</template>
		</PageTitle>

		<div class="df-notifications-page__toolbar">
			<el-tabs v-model="tab" @tab-change="onTabChange">
				<el-tab-pane
					v-for="t in tabs"
					:key="t.value"
					:name="t.value"
				>
					<template #label>
						<span>{{ t.label }}</span>
						<el-badge
							v-if="unreadByTab(t.value) > 0"
							:value="unreadByTab(t.value) > 99 ? '99+' : unreadByTab(t.value)"
							:max="99"
							class="df-notif-tab-badge"
						/>
					</template>
				</el-tab-pane>
			</el-tabs>

			<el-segmented v-model="onlyUnread" :options="unreadOptions" size="small" />
		</div>

		<div v-loading="loading" class="df-notifications-page__list">
			<EmptyState v-if="!loading && list.length === 0" preset="no-notifications" />
			<NotificationCard
				v-for="item in list"
				:key="item.id"
				:item="item"
				@click="handleCardClick"
			/>
		</div>

		<Pagination
			v-if="total > 0"
			v-model:page="page"
			v-model:page-size="pageSize"
			:total="total"
			@change="load"
		/>
	</section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Check } from '@element-plus/icons-vue'
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markAllRead } from '~/api/notifications'
import { resolveRoute } from '~/utils/notification-meta'
import { useWsStore } from '~/stores/ws'
import type { NotificationItem, NotificationCategory } from '~/types/notification'

definePageMeta({
	layout: 'prototype',
	fixedLayout: true,
	auth: true,
})
useHead({ title: '通知中心 - DocFlow' })

type TabValue = 'all' | '1' | '2' | '3'

const tabs: Array<{ value: TabValue, label: string }> = [
	{ value: 'all', label: '全部' },
	{ value: '1', label: '审批通知' },
	{ value: '2', label: '系统通知' },
	{ value: '3', label: '成员变更' },
]

const tab = ref<TabValue>('all')
const onlyUnread = ref<boolean>(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const list = ref<NotificationItem[]>([])
const loading = ref(false)
const markingAll = ref(false)

const unreadOptions = [
	{ label: '全部', value: false },
	{ label: '只看未读', value: true },
]

const wsStore = useWsStore()
const { msgSuccess, msgError } = useNotify()

// 每 Tab 的未读数 —— 前端维持一份本地镜像（首次来自 /unread-count，后续由本地操作和 WS 推送维护）
const byCategory = ref<{ '1': number, '2': number, '3': number }>({ '1': 0, '2': 0, '3': 0 })

const currentTabUnread = computed(() => unreadByTab(tab.value))

const markAllLabel = computed(() => {
	if (tab.value === 'all') return '全部标为已读'
	const t = tabs.find(x => x.value === tab.value)
	return `${t?.label ?? ''} — 全部标为已读`
})

function unreadByTab(value: TabValue): number {
	if (value === 'all') return byCategory.value['1'] + byCategory.value['2'] + byCategory.value['3']
	return byCategory.value[value]
}

async function loadUnreadCount() {
	try {
		const res = await fetchUnreadCount()
		byCategory.value = res.data.byCategory
		wsStore.badges.notifications = res.data.total
	} catch { /* 静默 */ }
}

async function load() {
	loading.value = true
	try {
		const category: NotificationCategory | undefined = tab.value === 'all' ? undefined : (Number(tab.value) as NotificationCategory)
		const res = await fetchNotifications({
			category,
			onlyUnread: onlyUnread.value,
			page: page.value,
			pageSize: pageSize.value,
		})
		list.value = res.data.list
		total.value = res.data.total
	} catch (e) {
		msgError((e as Error)?.message || '加载通知失败')
	} finally {
		loading.value = false
	}
}

function onTabChange() {
	page.value = 1
	load()
}

watch(onlyUnread, () => {
	page.value = 1
	load()
})

onMounted(async () => {
	await loadUnreadCount()
	await load()
})

async function handleCardClick(item: NotificationItem) {
	if (!item.read) {
		try {
			await markNotificationRead(item.id)
			// 本地状态
			const row = list.value.find(x => x.id === item.id)
			if (row) {
				row.read = true
				row.readAt = Date.now()
			}
			// 本地未读数同步（category 为当前条的）
			const cat = String(item.category) as '1' | '2' | '3'
			if (byCategory.value[cat] > 0) byCategory.value[cat] -= 1
			wsStore.badges.notifications = Math.max(0, wsStore.badges.notifications - 1)
		} catch {
			// 静默；WS 会推
		}
	}

	const target = resolveRoute(item.bizType, item.bizId)
	if (target) navigateTo(target)
}

async function handleMarkAllCurrentTab() {
	markingAll.value = true
	try {
		const body = tab.value === 'all' ? {} : { category: Number(tab.value) as NotificationCategory }
		const res = await markAllRead(body)
		msgSuccess(`已全部标为已读（${res.data.updated} 条）`)
		// 本地未读数清零
		if (tab.value === 'all') {
			byCategory.value = { '1': 0, '2': 0, '3': 0 }
			wsStore.badges.notifications = 0
		} else {
			const cat = tab.value as '1' | '2' | '3'
			const before = byCategory.value[cat]
			byCategory.value[cat] = 0
			wsStore.badges.notifications = Math.max(0, wsStore.badges.notifications - before)
		}
		await load()
	} catch (e) {
		msgError((e as Error)?.message || '操作失败')
	} finally {
		markingAll.value = false
	}
}
</script>
```

- [ ] **Step 2: 修改 `pages/docs/repo/[id].vue` 支持 query 自动打开审批配置 Tab**

Run: `grep -n "GroupSettingsModal\|openSettings\|route.query" pages/docs/repo/\[id\].vue | head -10`

定位现有挂载 `GroupSettingsModal` 的位置（应该有一个 ref 或 `isGroupSettingsOpen` 类状态）。在 `onMounted` 或初始化逻辑中追加：

```typescript
// 按 query 自动打开组设置弹窗到指定 Tab（来自通知中心跳转）
onMounted(() => {
	const openSetting = route.query.openSettings
	if (openSetting === 'approval') {
		// 打开 GroupSettingsModal，默认 Tab = 'approval'（现有默认已是）
		// 假设已有 ref: settingsModalVisible / settingsDefaultTab
		settingsModalVisible.value = true
		settingsDefaultTab.value = 'approval'
		// 清理 query（避免刷新重复弹出）
		router.replace({ path: route.path, query: {} })
	}
})
```

实际代码要按 `pages/docs/repo/[id].vue` 现有的 modal state 和 router 拿法适配；若尚未挂载 GroupSettingsModal，请跳过此 Step 并在 `docs/feature-gap-checklist.md` 标注"query 自动打开审批配置 Tab 待 repo 页整合 GroupSettingsModal 时补"。

- [ ] **Step 3: 手动冒烟**

1. 登录后访问 `/notifications`，看到 4 个 Tab、Tab 头部角标、"未读/全部"切换、分页
2. 切 Tab 列表变化，角标数量随之更新
3. 点"只看未读"切换
4. 点卡片 → 已读 + 跳转（有 biz）
5. 点顶部"XX 全部标为已读"按钮：
   - 在"全部"Tab：全部分类已读
   - 在"审批通知"Tab：仅 category=1 已读
6. 从铃铛 Popover 底部"查看全部 →"进入 `/notifications`，体验流畅
7. 若有 `group_approval` 的通知（M24 种子），点卡片跳 `/docs/repo/30001?openSettings=approval`，看组设置弹窗是否自动打开审批配置 Tab（若 repo 页已挂载 GroupSettingsModal）

- [ ] **Step 4: 提交**

```bash
git add pages/notifications.vue "pages/docs/repo/[id].vue"
git commit -m "feat(notification): 整页 /notifications — 4 Tab + 只看未读 + 分页 + 跳转 query 自动开审批 Tab"
```

---

### Task 12: 样式 — _notification.scss + 暗黑模式

**Files:**
- Create: `assets/styles/components/_notification.scss`
- Modify: `assets/styles/components.scss`
- Modify: `assets/styles/dark.scss`

- [ ] **Step 1: 创建通知样式**

```scss
// assets/styles/components/_notification.scss

// ─── 顶栏铃铛 ─────────────────────────────────────
.df-notification-bell {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	padding: 0;
	border: 0;
	border-radius: 8px;
	background: transparent;
	color: var(--df-subtext);
	cursor: pointer;
	transition: background 0.15s, color 0.15s;

	&:hover {
		background: var(--df-surface);
		color: var(--df-text);
	}

	&__dot {
		position: absolute;
		top: 2px;
		right: 2px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 8px;
		background: var(--el-color-danger);
		color: #fff;
		font-size: 10px;
		font-weight: 600;
		line-height: 16px;
		text-align: center;
		box-shadow: 0 0 0 2px var(--df-panel);

		&--wide {
			min-width: 20px;
		}
	}
}

// ─── Popover ────────────────────────────────────
.df-notification-popper.el-popper {
	padding: 0 !important;
	border: 1px solid var(--df-border);
	box-shadow: 0 10px 32px rgba(15, 23, 42, 0.12);
}

.df-notification-popover {
	display: flex;
	flex-direction: column;
	width: 380px;
	height: 480px;

	&__head {
		padding: 12px 16px;
		border-bottom: 1px solid var(--df-border);
	}

	&__body {
		flex: 1;
		overflow: hidden;
	}

	&__foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		border-top: 1px solid var(--df-border);
		background: var(--df-surface);
	}
}

// ─── 卡片 ────────────────────────────────────────
.df-notification-card {
	display: flex;
	gap: 12px;
	align-items: flex-start;
	padding: 12px 16px;
	border-bottom: 1px solid var(--df-border);
	background: transparent;
	transition: background 0.15s;

	&:last-child {
		border-bottom: 0;
	}

	&--clickable {
		cursor: pointer;
	}

	&:hover {
		background: var(--df-surface);
	}

	&--unread {
		background: var(--df-primary-soft);

		&:hover {
			background: color-mix(in srgb, var(--df-primary-soft) 80%, #fff);
		}
	}

	&__icon {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;

		&[data-color="primary"]  { color: var(--el-color-primary); background: color-mix(in srgb, var(--el-color-primary) 14%, transparent); }
		&[data-color="success"]  { color: var(--el-color-success); background: color-mix(in srgb, var(--el-color-success) 14%, transparent); }
		&[data-color="warning"]  { color: var(--el-color-warning); background: color-mix(in srgb, var(--el-color-warning) 14%, transparent); }
		&[data-color="danger"]   { color: var(--el-color-danger);  background: color-mix(in srgb, var(--el-color-danger) 14%, transparent); }
		&[data-color="info"]     { color: var(--el-color-info);    background: color-mix(in srgb, var(--el-color-info) 14%, transparent); }
	}

	&__body {
		flex: 1;
		min-width: 0;
	}

	&__title {
		font-size: 13px;
		line-height: 1.5;
		color: var(--df-text);
		word-break: break-word;
	}

	&--unread &__title {
		font-weight: 500;
	}

	&__content {
		margin-top: 2px;
		font-size: 12px;
		line-height: 1.5;
		color: var(--df-subtext);
		word-break: break-word;
	}

	&__time {
		margin-top: 4px;
		font-size: 12px;
		color: var(--df-subtext);
	}

	&__dot {
		flex-shrink: 0;
		width: 8px;
		height: 8px;
		margin-top: 12px;
		border-radius: 50%;
		background: var(--el-color-primary);
	}
}

// ─── 整页 /notifications ──────────────────────────
.df-notifications-page {
	display: flex;
	flex-direction: column;
	height: 100%;

	&__toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0 12px 0;
		border-bottom: 1px solid var(--df-border);

		.el-tabs {
			flex: 1;
		}

		.el-tabs__header {
			margin: 0;
		}
	}

	&__list {
		flex: 1;
		overflow-y: auto;
		background: var(--df-panel);
		border: 1px solid var(--df-border);
		border-radius: 8px;
	}
}

.df-notif-tab-badge {
	margin-left: 6px;
	vertical-align: 2px;

	.el-badge__content {
		top: 2px;
		right: -4px;
	}
}
```

- [ ] **Step 2: 在 components.scss import**

Modify `assets/styles/components.scss`，在既有 import 列表末尾追加：

```scss
@use './components/notification';
```

（注意：SCSS `@use` 忽略下划线前缀和 `.scss` 后缀）

- [ ] **Step 3: 暗黑模式叠加**

Modify `assets/styles/dark.scss`，在文件末尾追加：

```scss
// ── 通知中心暗黑 ──
html.dark {
	.df-notification-bell {
		color: var(--df-subtext);

		&:hover {
			background: var(--df-surface);
			color: var(--df-text);
		}

		&__dot {
			box-shadow: 0 0 0 2px var(--df-panel);
		}
	}

	.df-notification-card {
		&--unread {
			background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);

			&:hover {
				background: color-mix(in srgb, var(--el-color-primary) 18%, transparent);
			}
		}
	}
}
```

- [ ] **Step 4: 手动冒烟**

1. 亮色模式：铃铛、角标、Popover、卡片、整页 Tab/列表 样式全部正常；未读态有浅底色和小红点
2. 切暗黑模式：Popover 和卡片背景切换无突兀；未读态浅底色保持可见但不刺眼；铃铛红点对比度足够

- [ ] **Step 5: 提交**

```bash
git add assets/styles/components/_notification.scss assets/styles/components.scss assets/styles/dark.scss
git commit -m "style(notification): 通知组件样式 + 暗黑模式适配"
```

---

### Task 13: 更新文档 — feature-gap-checklist 通知触发点清单 + api-auth-design + dev-progress

**Files:**
- Modify: `docs/feature-gap-checklist.md`
- Modify: `docs/api-auth-design.md`
- Modify: `docs/dev-progress.md`

- [ ] **Step 1: feature-gap-checklist — 移除已完成项 + 新增触发点清单**

`docs/feature-gap-checklist.md`：

**(a)** 2.3 通知中心节的 4 个 todo 全部改为已完成标记：

```markdown
### 2.3 通知中心 (`pages/notifications.vue`)

- [x] ~~分类 tab（审批通知 / 系统通知 / 成员变更）~~ ✅ 2026-04-18
- [x] ~~未读计数 badge~~ ✅ 2026-04-18
- [x] ~~全部标为已读~~ ✅ 2026-04-18
- [x] ~~已读/未读视觉状态区分~~ ✅ 2026-04-18
```

**(b)** 在"公共组件"表里移除 ActivityFilterBar 后面、合适位置新增已完成：

已完成功能表 "公共组件" 追加：
```markdown
| NotificationBell（顶栏铃铛 + 红角标 99+ + Popover 触发） | 2026-04-18 |
| NotificationPopover（下拉面板，未读/全部切换 + 底部全部已读/查看全部） | 2026-04-18 |
| NotificationCard（单条卡片，未读态底色 + 点击跳转） | 2026-04-18 |
```

**(c)** 在"工具 / 后端"已完成表追加：
```markdown
| 通知中心 A 阶段（4 接口 / createNotification helper / NOTIFICATION_TEMPLATES M1-M24 模板表） | 2026-04-18 |
```

**(d)** 新增章节（放在"六、数据层"之后、"已完成功能"之前）：

```markdown
## 七、通知触发点接入清单

> M1-M24 各消息归属模块和触发点。开发对应模块时对照此表接入
> `NOTIFICATION_TEMPLATES.Mx.build(...)`，接入后打 ✅ 并写完成日期。
> 权威源：`server/constants/notification-templates.ts`

| 消息 | 归属模块 | 触发点 | 状态 |
|---|---|---|---|
| M1 | approval-runtime | 文件提交审批 — 通知当前审批人 | ⏳ 待接入 |
| M2 | approval-runtime | 审批流转下一级 — 通知下一级 | ⏳ 待接入 |
| M3 | approval-runtime | 最后一级通过 — 通知提交人 | ⏳ 待接入 |
| M4 | approval-runtime | 任一级驳回 — 通知提交人 | ⏳ 待接入 |
| M5 | approval-runtime | 超时 24h 催办 — 通知该步审批人 | ⏳ 待接入 |
| M6 | approval-runtime | 催办达上限 — 通知提交人 | ⏳ 待接入 |
| M7 | approval-runtime | 提交人撤回 — 通知已参与审批人 | ⏳ 待接入 |
| M8 | document-lifecycle | 新版本发布 — 通知归属人+编辑成员+管理员 | ⏳ 待接入 |
| M9 | document-lifecycle | 管理员从组移除文件 — 通知归属人 | ⏳ 待接入 |
| M10 | ownership-transfer | 发起归属人转移 — 通知新归属人 | ⏳ 待接入 |
| M11 | ownership-transfer | 转移同意/拒绝/过期 — 通知发起人 | ⏳ 待接入 |
| M12 | cross-move | 发起跨组移动 — 通知目标组负责人 | ⏳ 待接入 |
| M13 | cross-move | 移动同意/拒绝/过期 — 通知发起人 | ⏳ 待接入 |
| M14 | permission-request | 阅读权限申请 — 通知归属人 | ⏳ 待接入 |
| M15 | permission-request | 编辑权限申请 — 通知归属人 | ⏳ 待接入 |
| M16 | permission-request | 权限审批结果 — 通知申请人 | ⏳ 待接入 |
| M17 | share | 分享文档 — 通知被分享人 | ⏳ 待接入 |
| M18 | group-member | 被加入组 — 通知被添加成员 | ⏳ 待接入（组成员管理已有 API，B 阶段可一并补） |
| M19 | group-member | 成员权限变更 — 通知被变更成员 | ⏳ 待接入（同上） |
| M20 | group-member | 被移出组 — 通知被移出成员 | ⏳ 待接入（同上） |
| M21 | role-assign | 管理员角色指派/撤销 | ⏳ 待接入 |
| M22 | group-owner | 组负责人变更 | ⏳ 待接入 |
| M23 | hr-handover | 员工离职交接 | ⏳ 待接入 |
| M24 | approval-chain-change | 审批链成员因离职/调岗移除 | ⏳ 待接入 |

**开发流程：** 做某业务模块前 → `grep "triggerModule: 'xxx'" server/constants/notification-templates.ts` 反查 M 码 → 依模板接入 → 本表打 ✅ + 日期。
```

- [ ] **Step 2: api-auth-design 追加 4 个接口**

Modify `docs/api-auth-design.md`，在"接口总览"表追加 4 行（编号按现有序号递增）：

```markdown
| §3.N   | GET /api/notifications | 通知列表（分页，自己的） | JWT | — |
| §3.N+1 | GET /api/notifications/unread-count | 未读数（总 + 按 category） | JWT | — |
| §3.N+2 | PUT /api/notifications/:id/read | 标记单条已读 | JWT | — |
| §3.N+3 | PUT /api/notifications/read-all | 批量已读（可按 category） | JWT | — |
```

> 编号 N 取 `docs/api-auth-design.md` 当前最大 §3.xx 编号 + 1，连续递增。

在"详细说明"节末尾追加 4 个编号对应的详情小节（参数/响应/示例），格式参照既有日志接口 `GET /api/logs` 的写法。每节包含：

- 路径与方法
- Query / Body 参数
- 响应示例
- 权限要求（"登录用户，仅能读/改自己的通知"）

- [ ] **Step 3: dev-progress 追加 2026-04-18 条目**

Modify `docs/dev-progress.md`，在"## 2026-04-17"节之后插入：

```markdown
## 2026-04-18

### feat: 通知中心 A 阶段
- **后端**
  - 新增 4 接口：`GET /api/notifications`（分页）、`GET /api/notifications/unread-count`、`PUT /api/notifications/:id/read`、`PUT /api/notifications/read-all`（可按 category）
  - 鉴权：接口不挂 `requirePermission`，仅以 `event.context.user.id` 过滤 `user_id`
  - 新增 `server/utils/notify.ts` — `createNotification` / `createNotifications` helper（INSERT + WS 推 `badge` 未读数）
  - 新增 `server/constants/notification-templates.ts` — M1-M24 强类型模板表，每项含 `triggerModule` / `triggerPoint` / `build(params)`
  - 新增 `server/schemas/notification.ts` — 列表 query + read-all body 校验
  - WebSocket 复用 `'badge'` 消息类型，不新增 type
- **前端**
  - 新增 `NotificationBell`（顶栏入口，红角标 99+）+ `NotificationPopover`（380×480，未读/全部 + 最近 20 条 + 底部两按钮）+ `NotificationCard`（单条卡片，复用于 Popover 和整页）
  - 重写 `pages/notifications.vue` — 4 Tab（全部/审批/系统/成员变更，带未读角标）+ 只看未读 segment + 分页
  - 新增 `composables/useNotificationBadge.ts` — 对账逻辑（登录时 + WS 重连时各拉一次 `/unread-count`）
  - `useWs.ts` `open` 事件里调对账
  - `layouts/prototype.vue` 顶栏插入铃铛
  - 新增 `utils/notification-meta.ts` — `NOTIFICATION_META[msgCode]` 映射图标+语义色；`resolveRoute` 按 biz_type/biz_id 返回跳转路由
  - 新增 `api/notifications.ts`、`types/notification.ts`
- **样式**
  - `assets/styles/components/_notification.scss`（被 `components.scss` import）
  - `assets/styles/dark.scss` 追加暗黑适配
- **数据**
  - `doc_seed.sql` 追加 45 条通知样例，覆盖 M1-M24 每种 ≥1 条
- **规格依据**：PRD §6.8（站内通知中心）、§1284（通知推送延迟 < 5s）
- **范围**：A 阶段 = 读端 + helper + 模板表；各业务模块触发点接入按 `feature-gap-checklist.md`「通知触发点接入清单」纪律后续补
- **双保险纪律**
  - 代码模板表（`NOTIFICATION_TEMPLATES`）确保业务模块调用契约一致
  - 文档清单表记录 M1-M24 各自归属模块与状态，防止遗漏
- **测试**：14 条 schema 单测 + 8 条 meta 工具单测
```

- [ ] **Step 4: 提交**

```bash
git add docs/feature-gap-checklist.md docs/api-auth-design.md docs/dev-progress.md
git commit -m "docs: 通知中心 A 阶段 — 接口文档 + 功能清单 + 通知触发点清单 + 进度"
```

---

### Task 14: 冒烟 & 最终验证

**Files:** 无新增/修改

此任务无代码产出，仅全流程走查确认验收。

- [ ] **Step 1: 全量单测通过**

Run: `npm run test:unit`
Expected: 所有单测 PASS（含本次新增 14 + 8 共 22 条）。若有 fail，修复后重跑。

- [ ] **Step 2: TS 编译通过**

Run: `npx nuxi typecheck 2>&1 | tail -20`
Expected: 无错误输出。

- [ ] **Step 3: lint 通过**

Run: `npm run lint 2>&1 | tail -20`
Expected: 0 error（warning 若有是既有的，忽略）。

- [ ] **Step 4: 浏览器端到端冒烟**

浏览器登录后逐项验证：

| 场景 | 预期 |
|---|---|
| 顶栏铃铛角标 | 有未读时显示数字，≥100 显示 99+，无未读时不显示 |
| 点铃铛 | 弹出 Popover（380×480），显示最近 20 条未读（onlyUnread=true 默认） |
| Popover 切"全部" | 列表含已读条目 |
| Popover 点已读卡 | 不触发已读接口（幂等），有 biz 则跳转并关面板 |
| Popover 点未读卡 | 卡片小红点消失 / 角标减 1 / 跳转（有 biz）/ 关面板 |
| Popover 点"全部标为已读" | 角标归零 / toast 提示 / 列表全变已读态 |
| Popover 点"查看全部 →" | 跳 `/notifications` 整页 |
| 整页 4 Tab | 每 Tab 角标单独显示该分类未读数 |
| 整页切 Tab | 列表筛选生效 + 未读角标跟随 |
| 整页"只看未读" | 列表过滤 |
| 整页点卡片 | 同 Popover |
| 整页"XX 全部标为已读" | 按当前 Tab 范围执行 |
| 整页分页 | 大于 pageSize 时底部出现分页器 |
| M24 卡片跳转 | 进 `/docs/repo/:id?openSettings=approval`，组设置弹窗自动打开到审批配置 Tab（前提 repo 页已集成 GroupSettingsModal） |
| 断网恢复后 | 角标数准确（WS 重连对账） |
| 未登录访问 `/notifications` | `auth.global.ts` 拦截跳 `/login` |
| 暗黑模式 | 铃铛 / Popover / 卡片 / 整页样式适配，未读态可辨识 |

- [ ] **Step 5: 合并提交信息（总结 commit）**

手动回顾 `git log --oneline -20`，确认 12 次功能 commit 有序清晰，若有需要可在本地 squash 整理（用户会自行处理，不强制）。

- [ ] **Step 6: 完成**

无需 commit。对用户报告：
- ✅ A 阶段验收通过
- ✅ `feature-gap-checklist.md` 的「通知触发点接入清单」已列出 M1-M24 待接入状态
- ✅ 写入侧 `createNotification` helper 和 `NOTIFICATION_TEMPLATES` 模板表已就位
- ⏳ 后续开发任何涉及 PRD §6.8.2 消息触发的业务模块时，按清单纪律接入

---

## 附：验收 DoD

1. 4 个 `/api/notifications` 接口可用 + 22 条单测 PASS
2. 顶栏铃铛 + Popover + 整页三端联动
3. WS badge 未读数能正确更新
4. `NOTIFICATION_TEMPLATES` M1-M24 全部定义 + 强类型 build 参数
5. `feature-gap-checklist.md` 通知触发点清单完整
6. `api-auth-design.md` / `dev-progress.md` 已同步
7. 暗黑 + 亮色样式均无突兀
