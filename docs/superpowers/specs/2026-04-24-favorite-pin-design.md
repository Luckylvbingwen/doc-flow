---
title: 收藏 / 置顶 B 阶段设计（写端闭环）
status: draft
owner: lvbingwen
date: 2026-04-24
scope: 收藏 + 置顶（POST/DELETE 写端 + 前端按钮）
---

# 收藏 / 置顶 B 阶段设计

> A 阶段已就绪（读端 / 表 / 角标 / 个人中心 tab）；本次补齐写端 + UI 按钮 + 永久删除级联清理，形成端到端闭环。

---

## 一、现状（零改动）

| 组件 | 位置 | 状态 |
|---|---|---|
| 收藏表 `doc_document_favorites` | schema:221 / doc.sql:295 | ✅ UK `(document_id, user_id)` + 索引 `(user_id, created_at)` |
| 置顶表 `doc_document_pins` | schema:255 / doc.sql:310 | ✅ UK `(document_id, group_id)` + 索引 `(group_id, pinned_at)` |
| log action `FAVORITE_ADD/REMOVE`、`PIN_ADD/REMOVE` | `server/constants/log-actions.ts:101-104` | ✅ 常量 + `favorite_pin` 类映射 |
| 仓库列表读端返回 `isFavorited`/`isPinned` | `server/api/documents/index.get.ts:29,52-53,65` | ✅ JOIN + `ORDER BY is_pinned DESC` |
| 文件详情读端返回 `isFavorited`/`isPinned` | `server/api/documents/[id]/index.get.ts:27,55-56` | ✅ |
| 个人中心 `favorite` tab 接通 | `server/api/personal/documents.get.ts:141` | ✅ |
| 仓库列表行首角标（⭐ 黄 / 📌 蓝） | `pages/docs/repo/[id].vue:67-74` | ✅ |
| seed 样例 | `doc_seed.sql:220-227 / 543-545 / 712-717` | ✅ 5 条收藏 + 1 条置顶 + 日志样例 |

## 二、本次交付

### 2.1 后端接口（4 个）

| 方法 | 路径 | 权限 | 幂等行为 |
|---|---|---|---|
| `POST`   | `/api/documents/:id/favorite` | 登录即可 | 已收藏返回 200 ok（**不重写日志**） |
| `DELETE` | `/api/documents/:id/favorite` | 登录即可 | 未收藏返回 200 ok（**不重写日志**） |
| `POST`   | `/api/documents/:id/pin`      | `requireMemberPermission`（组管理员 / 上游管理员） | 已置顶返回 200 ok |
| `DELETE` | `/api/documents/:id/pin`      | 同上 | 未置顶返回 200 ok |

统一返回：`{ isFavorited: boolean }` 或 `{ isPinned: boolean }`，便于前端乐观更新后对账。

### 2.2 级联清理（1 处）

`server/api/recycle-bin/purge.post.ts` 事务内追加：
```ts
await tx.doc_document_favorites.deleteMany({ where: { document_id: { in: purgeIds.map(BigInt) } } })
await tx.doc_document_pins.deleteMany({ where: { document_id: { in: purgeIds.map(BigInt) } } })
```
草稿删除（`draft.delete.ts`）只是软删进回收站，**不清理**（用户可能恢复，保留收藏是对的）。

### 2.3 前端 API 封装 + 类型

- `api/documents.ts` 新增 `apiFavoriteDocument` / `apiUnfavoriteDocument` / `apiPinDocument` / `apiUnpinDocument`
- `types/document.ts` 无需改动（`isFavorited`/`isPinned` 已在 `DocumentDetail` / `DocumentListItem`）

### 2.4 前端 UI 入口

**A. 仓库列表行 actions 下拉（`pages/docs/repo/[id].vue`）**
- 下拉菜单追加 2 项：
  - `收藏 / 取消收藏`（所有成员可见，根据 `row.isFavorited` 切换文案 + 图标）
  - `置顶 / 取消置顶`（仅管理员 `canPin` 可见，同上切换）
- 点击 → 乐观更新 `row.isFavorited` / `row.isPinned` → 调 API → 失败回滚 + msgError

**B. 文件详情页 PageTitle actions（`pages/docs/file/[id].vue`）**
- 加 2 个图标按钮：
  - ⭐ 收藏/取消（`<el-button circle :type="isFavorited ? 'warning' : 'default'">`）
  - 📌 置顶/取消（仅管理员可见，`<el-button circle :type="isPinned ? 'primary' : 'default'">`）
- 同样走乐观更新 + 回滚

**C. `canPin` 判定**
后端 `requireMemberPermission` 的等价前端判定：用户是组负责人、或组内管理员（`role=1`）、或 super/company/dept/pl_head 中在该组 scope 内的任一。
- **方案**：在读端 `/api/documents/:id` 响应里已经有 `canRemove` 等权限字段，追加 `canPin: boolean`，前端直接用，不重复复杂判定
- 同理列表接口 `/api/documents` 的 `list` 响应也追加 `canPin`（但所有行 canPin 都是同一值，因为都在同一组）—— 实际可以在 response 顶层加一次即可

**最终决定**：`GET /api/documents` 顶层追加 `canPin: boolean`，列表行不重复；`GET /api/documents/:id` 响应追加 `canPin: boolean`。详见 §3.3。

## 三、实现细节

### 3.1 写端 handler 模板（以 favorite.post.ts 为例）

```ts
// server/api/documents/[id]/favorite.post.ts
export default defineEventHandler(async (event) => {
	const user = event.context.user
	if (!user) return fail(event, 401, AUTH_REQUIRED, '请先登录')

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	const docId = BigInt(idStr)

	const doc = await prisma.doc_documents.findUnique({
		where: { id: docId },
		select: { id: true, title: true, group_id: true, deleted_at: true, deleted_at_real: true },
	})
	if (!doc || doc.deleted_at) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (doc.deleted_at_real) return fail(event, 409, DOCUMENT_NOT_FOUND, '文档已删除')

	// 幂等：用 upsert 天然 idempotent；但需判定是否"新建"才写日志
	const existing = await prisma.doc_document_favorites.findUnique({
		where: { uk_doc_fav_user: { document_id: docId, user_id: BigInt(user.id) } },
		select: { id: true },
	})
	if (existing) return ok({ isFavorited: true }, '已收藏')

	await prisma.doc_document_favorites.create({
		data: { id: generateId(), document_id: docId, user_id: BigInt(user.id) },
	})
	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.FAVORITE_ADD,
		targetType: 'document',
		targetId: Number(doc.id),
		groupId: doc.group_id != null ? Number(doc.group_id) : null,
		documentId: Number(doc.id),
		detail: { desc: `收藏文件「${doc.title}」` },
	})
	return ok({ isFavorited: true }, '已收藏')
})
```

**pin.post.ts 区别**：
1. 权限 `requireMemberPermission(event, { scopeType, scopeRefId, ownerUserId, groupId })`（需拉组信息）
2. 写表 `doc_document_pins` 带 `group_id = doc.group_id` / `pinned_by = user.id`
3. 日志 `PIN_ADD`

### 3.2 Prisma unique key 访问

Prisma 生成的复合 UK 名需用 `@@unique` 的 `map` 字段 camelCase：
- `doc_document_favorites`：map = `uk_doc_fav_user` → Prisma client 用 `doc_document_favorites.findUnique({ where: { uk_doc_fav_user: { ... } } })` 或 `document_id_user_id`（取决于 Prisma 版本）
- 实际运行时确认：若 `uk_doc_fav_user` 识别不了，回落用 `findFirst({ where: { document_id, user_id } })`

### 3.3 读端增加 `canPin` 字段

```ts
// server/api/documents/index.get.ts 顶层响应追加
return ok({
	list,
	total,
	reviewingCount,
	canPin: await canUserPinInGroup(user.id, groupId),   // 新增
})

// server/api/documents/[id]/index.get.ts 顶层响应追加
return ok({
	...detail,
	canPin: await canUserPinInGroup(user.id, doc.group_id),  // 新增
})
```

封装为 `server/utils/group-permission.ts` 的 `canUserPinInGroup(userId, groupId): Promise<boolean>`，内部逻辑等价于 `requireMemberPermission` 的布尔返回（而非 fail 响应），避免重复。

### 3.4 前端乐观更新模板

```ts
// 示例：仓库列表行 "收藏"
async function onToggleFavorite(row: DocumentListItem) {
	const orig = row.isFavorited
	row.isFavorited = !orig                                // 乐观更新
	try {
		const res = orig
			? await apiUnfavoriteDocument(row.id)
			: await apiFavoriteDocument(row.id)
		if (!res.success) throw new Error(res.message)
		// 服务端返回的 isFavorited 做对账（兜底幂等）
		row.isFavorited = res.data.isFavorited
		msgSuccess(res.message || (orig ? '已取消收藏' : '已收藏'))
	} catch (e) {
		row.isFavorited = orig                            // 回滚
		msgError('操作失败，请重试')
	}
}
```

### 3.5 级联清理实现

```ts
// server/api/recycle-bin/purge.post.ts 事务内
await prisma.$transaction(async (tx) => {
	await tx.doc_documents.updateMany({ ... })
	await tx.doc_document_versions.updateMany({ ... })
	// 新增：收藏 / 置顶级联硬删（这两张表没 deleted_at 列，直接 deleteMany）
	await tx.doc_document_favorites.deleteMany({ where: { document_id: { in: purgeIds.map(BigInt) } } })
	await tx.doc_document_pins.deleteMany({ where: { document_id: { in: purgeIds.map(BigInt) } } })
})
```

---

## 四、测试策略

- **Zod schema 单测**：本次无新 schema，跳过
- **API 集成测试**（可选补，不在本轮强制）：
  - `POST favorite` 两次 → 第二次不重复写日志（count 不变）
  - 普通成员 `POST pin` → 403
  - 组管理员 `POST pin` → 200
  - 永久删除文档 → 相关 favorites/pins 记录消失
- **联调验证**：登录 10001（super_admin，自动有所有组管理员权限）手动点 ⭐ / 📌，观察：
  - 角标出现 / 消失
  - 仓库列表 ORDER BY 确实把置顶排到最前
  - `doc_operation_logs` 出现对应条目
  - 个人中心"收藏"tab 数量变化

## 五、风险与回退

| 风险 | 缓解 |
|---|---|
| Prisma UK 名识别失败 | 回落 `findFirst + create`；运行时第一次报错即切 |
| `canPin` 判定需查角色表，增加读接口延迟 | `group-permission.ts` 的 SQL 查询复用，单接口 +1 查询可接受 |
| 前端乐观更新状态错乱（快速连点） | 按钮加 `disabled` during pending；row 级 `pendingFav` / `pendingPin` 标记 |
| 永久删除后，仍有旧客户端缓存显示收藏 | 下次拉列表时 JOIN 自动过滤，实际无感 |

回退：删除 4 个 handler 文件 + 仓库页/详情页按钮即可。读端 / 表 / seed 不受影响。

---

## 六、验收清单

- [ ] 4 个写端 handler 接入
- [ ] `recycle-bin/purge` 级联清理 favorites / pins
- [ ] 2 个读端接口追加 `canPin`
- [ ] 前端 4 个 API 函数 + 2 处 UI 按钮 + 乐观更新回滚
- [ ] `docs/api-auth-design.md` 新增 4 个接口说明（§3.x）
- [ ] `docs/feature-gap-checklist.md` §一 追加"FavoriteButton / PinButton"行打 ✅（或标注按钮内联在页面）、§2.7 文件详情补行
- [ ] `docs/dev-progress.md` 追加条目
