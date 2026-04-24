---
title: 收藏 / 置顶 B 阶段实现计划
spec: 2026-04-24-favorite-pin-design.md
status: in-progress
owner: lvbingwen
date: 2026-04-24
---

# 收藏 / 置顶 B 阶段实现计划

分 3 阶段，每阶段结束后暂停等用户 commit。

---

## 阶段 1：后端写端 + 级联清理 + 权限扩展

### Task 1-1：`canUserPinInGroup` 工具函数

**文件**：`server/utils/group-permission.ts`（修改）

- 新增 `export async function canUserPinInGroup(userId: number, groupId: number | bigint | null): Promise<boolean>`
- 实现等价于 `requireMemberPermission` 的布尔返回：不返回 `fail` 响应，只返回 true/false
- 内部复用现有的 `prisma.doc_group_members` 查询 + role/scope 角色查询
- groupId 为空时返回 false（未归组文档无所谓置顶）

### Task 1-2：收藏写端（2 个 handler）

**文件**：
- `server/api/documents/[id]/favorite.post.ts`（新增）
- `server/api/documents/[id]/favorite.delete.ts`（新增）

- 权限：仅登录（任何员工可收藏自己能看到的文档）
- 幂等：已收藏/未收藏分别返回 `ok({ isFavorited: true/false })`，**不重写日志**
- 文档软删检查：`deleted_at` 或 `deleted_at_real` 任一非空 → 404
- 埋点：`FAVORITE_ADD` / `FAVORITE_REMOVE`，`detail.desc = 收藏/取消收藏文件「xxx」`

### Task 1-3：置顶写端（2 个 handler）

**文件**：
- `server/api/documents/[id]/pin.post.ts`（新增）
- `server/api/documents/[id]/pin.delete.ts`（新增）

- 权限：`requireMemberPermission(event, { scopeType, scopeRefId, ownerUserId, groupId })`，需先拉组信息
- 文档必须已归组（`group_id` 非空），否则 409
- 幂等逻辑同收藏
- 埋点：`PIN_ADD` / `PIN_REMOVE`，`detail.desc = 置顶/取消置顶文件「xxx」`、`detail.groupId`

### Task 1-4：读端追加 `canPin` 字段

**文件**：
- `server/api/documents/index.get.ts`（修改）：响应顶层追加 `canPin`（整组统一值，不下沉到 list）
- `server/api/documents/[id]/index.get.ts`（修改）：响应追加 `canPin`

### Task 1-5：永久删除级联清理

**文件**：`server/api/recycle-bin/purge.post.ts`（修改）

- 事务内 `updateMany doc_documents / doc_document_versions` 之后，追加两行：
  ```ts
  await tx.doc_document_favorites.deleteMany({ where: { document_id: { in: purgeIds.map(BigInt) } } })
  await tx.doc_document_pins.deleteMany({ where: { document_id: { in: purgeIds.map(BigInt) } } })
  ```

### Task 1-6：api-auth-design.md 新增 4 接口

**文件**：`docs/api-auth-design.md`（修改）

- 在 "文档" 接口段（或"收藏/置顶"新段）追加 4 个接口：POST/DELETE favorite + POST/DELETE pin
- 总览表对应行补齐
- 读端 2 个接口的响应 schema 补充 `canPin`

### 阶段 1 commit message 草稿

```
feat: 收藏/置顶 B 阶段 · 后端写端（4 接口 + 级联清理 + canPin 读端扩展）

- server/api/documents/[id]/favorite.post.ts / .delete.ts — 任何员工可收藏，幂等行为不重写日志
- server/api/documents/[id]/pin.post.ts / .delete.ts — 组管理员及上游管理员可置顶，requireMemberPermission 校验
- server/utils/group-permission.ts 追加 canUserPinInGroup helper（布尔返回版）
- server/api/documents/index.get.ts / [id]/index.get.ts — 响应追加 canPin，前端按钮可见性依据
- server/api/recycle-bin/purge.post.ts — 事务内级联清理 doc_document_favorites / doc_document_pins，防孤儿记录
- 埋点：favorite.add / favorite.remove / pin.add / pin.remove 四个 log action 接入
- docs/api-auth-design.md 补 4 个接口说明 + 读端 canPin 字段
```

**⏸ 暂停，等用户 commit**

---

## 阶段 2：前端 API + UI 接入

### Task 2-1：API 封装

**文件**：`api/documents.ts`（修改）

- 新增 `apiFavoriteDocument(id) / apiUnfavoriteDocument(id) / apiPinDocument(id) / apiUnpinDocument(id)`
- 返回类型：`ApiResult<{ isFavorited: boolean }>` 或 `{ isPinned: boolean }`

### Task 2-2：类型补充

**文件**：`types/document.ts`（修改）

- `DocumentListResponse` / `DocumentDetail` 追加 `canPin: boolean`
- 无需新增 FavoriteItem / PinnedItem（沿用 DocumentListItem）

### Task 2-3：仓库列表 UI（下拉菜单）

**文件**：`pages/docs/repo/[id].vue`（修改）

- 顶层 setup 拉 `canPin` from 列表接口响应
- 行 actions 下拉菜单追加 2 项：
  - `收藏 / 取消收藏`（所有成员可见，根据 `row.isFavorited`）
  - `置顶 / 取消置顶`（`v-if="canPin"`，根据 `row.isPinned`）
- 新增方法 `onToggleFavorite(row)` / `onTogglePin(row)`：
  - 行级 pending 标记（`favPendingId` / `pinPendingId`），防重复点击
  - 乐观更新 → API 调用 → 失败回滚 + msgError
  - 置顶切换后重排：由下次 `refresh()` 或手动本地重排保证 `is_pinned DESC`

### Task 2-4：文件详情页 UI（图标按钮）

**文件**：`pages/docs/file/[id].vue`（修改）

- PageTitle actions 插入 2 个圆形按钮（在"返回仓库"前，或最右侧）：
  - ⭐ `<el-button circle :type="detail.isFavorited ? 'warning' : 'default'" :icon="Star" @click="toggleFavorite">`
  - 📌 `<el-button v-if="detail.canPin" circle :type="detail.isPinned ? 'primary' : 'default'" :icon="Top" @click="togglePin">`
- 乐观更新 `detail.isFavorited` / `detail.isPinned`
- 失败回滚 + msgError

### 阶段 2 commit message 草稿

```
feat: 收藏/置顶 B 阶段 · 前端（API 封装 + 仓库列表下拉 + 详情页图标按钮）

- api/documents.ts 补 4 个 API 函数
- types/document.ts 列表/详情响应补 canPin
- pages/docs/repo/[id].vue 行 actions 下拉追加"收藏/取消收藏"（所有成员）+ "置顶/取消置顶"（管理员）
- pages/docs/file/[id].vue PageTitle 追加 ⭐ / 📌 圆形图标按钮（后者管理员可见）
- 两处统一乐观更新 + 失败回滚 + 行级 / 按钮级 pending 防重复点击
```

**⏸ 暂停，等用户 commit**

---

## 阶段 3：文档同步

### Task 3-1：feature-gap-checklist

**文件**：`docs/feature-gap-checklist.md`（修改）

- §一 公共组件表追加说明：`FavoriteButton / PinButton — 按钮内联在页面，未抽独立组件（单次点击交互无复用价值）`
- §2.5 仓库详情：追加 `[x] 行 actions 收藏/置顶下拉 ✅ 2026-04-24`
- §2.7 文件详情：追加 `[x] 收藏 / 置顶按钮 ✅ 2026-04-24`
- §六 数据层：追加 `[x] 收藏 / 置顶 API ✅ 2026-04-24`

### Task 3-2：dev-progress

**文件**：`docs/dev-progress.md`（修改）

- `## 2026-04-24` 段追加 `### feat: 收藏/置顶 B 阶段（写端 + UI + 级联清理）`：
  - 后端：4 接口、canUserPinInGroup helper、canPin 读端扩展、purge 级联
  - 前端：4 API、2 处 UI、乐观更新回滚
  - 规格依据：PRD §4.1 / §6.3.8 / §6.5 / §1235-1237
  - 范围：B 阶段（写端闭环）；不涉及引用文档的跨组置顶（依赖后续"文档引用"模块）
- 更新"待开发"表格：P2 评论/批注、收藏/置顶、文档引用、搜索、分享 行 — 收藏/置顶 标完成

### 阶段 3 commit message 草稿

```
docs: 收藏/置顶 B 阶段 — 文档同步

- feature-gap-checklist §2.5 / §2.7 / §六 追加收藏/置顶完成项
- dev-progress 追加 2026-04-24 收藏/置顶 B 阶段条目
- 待开发表格：P2 行中的"收藏/置顶"标记完成
```

**⏸ 阶段 3 结束，任务关闭**
