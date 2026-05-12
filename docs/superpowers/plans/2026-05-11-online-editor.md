# Online Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现在线 Markdown 编辑器，支持新建草稿/编辑草稿/编辑已发布副本三种模式，含多人实时协同（Yjs + Hocuspocus）与右侧批注面板，对齐 PRD §6.3.5/§6.3.6/§6.3.7。

**Architecture:** 编辑器页面 `pages/docs/editor/[id].vue` 使用 Milkdown Crepe（`@milkdown/vue`）渲染 WYSIWYG，内容以 `draft_content` 字段自动保存到数据库，发布时将草稿内容上传 MinIO 生成正式 `doc_document_versions` 记录再走现有审批流（`executeUpload resubmit` 路径）。多人协同通过独立 Hocuspocus Docker 服务（端口 1234）+ Yjs 实现，前端使用 `@milkdown/plugin-collab` + `y-websocket` 接入。

**Tech Stack:** `@milkdown/crepe`, `@milkdown/vue`, `@milkdown/plugin-collab`, `yjs`, `y-websocket`, `@hocuspocus/server`, KaTeX（Crepe 内置）

---

## 文件结构总览

### 新增文件
| 文件 | 说明 |
|---|---|
| `docs/patch-009-online-editor.sql` | DB 补丁：doc_type + draft_content 字段 |
| `server/schemas/document-editor.ts` | Zod schema：创建草稿 / 保存内容 / 编辑副本 |
| `server/api/documents/index.post.ts` | POST /api/documents — 新建空白 Markdown 草稿 |
| `server/api/documents/[id]/content.get.ts` | GET /api/documents/:id/content — 加载草稿内容 |
| `server/api/documents/[id]/content.put.ts` | PUT /api/documents/:id/content — 自动保存 |
| `server/api/documents/[id]/edit-copy.post.ts` | POST /api/documents/:id/edit-copy — 创建编辑副本 |
| `server/api/documents/[id]/annotations.get.ts` | GET 批注列表 |
| `server/api/documents/[id]/annotations.post.ts` | POST 创建批注 |
| `server/api/documents/[id]/annotations/[annotationId].put.ts` | PUT 更新批注/标记解决 |
| `server/api/documents/[id]/annotations/[annotationId].delete.ts` | DELETE 软删除批注 |
| `layouts/editor.vue` | 编辑器专用布局（无侧栏）|
| `components/MilkdownEditor.vue` | Milkdown Crepe 封装组件（含协同） |
| `composables/useDocEditor.ts` | 自动保存 + 标题同步状态管理 |
| `pages/docs/editor/[id].vue` | 编辑器页面 |
| `components/AnnotationPanel.vue` | 右侧批注面板组件 |
| `api/document-editor.ts` | 前端 API 调用封装 |
| `types/document-editor.ts` | 编辑器相关前端类型 |
| `hocuspocus/index.ts` | Hocuspocus 协同服务入口 |
| `hocuspocus/package.json` | Hocuspocus 服务依赖 |
| `hocuspocus/tsconfig.json` | Hocuspocus TS 配置 |
| `hocuspocus/Dockerfile` | Hocuspocus Docker 构建 |

### 修改文件
| 文件 | 改动说明 |
|---|---|
| `docs/doc.sql` | CREATE TABLE doc_documents 加两个字段 |
| `prisma/schema.prisma` | doc_documents model 加 doc_type/draft_content |
| `server/api/documents/[id]/publish.post.ts` | 新增在线文档发布路径（doc_type=2 材料化 draft→MinIO） |
| `utils/personal-matrix.ts` | 加 'edit' action（status=1/2 草稿） |
| `pages/profile.vue` | 接入「新建文档」+ 「编辑」动作 |
| `pages/docs/file/[id].vue` | 加「编辑」按钮 → 创建编辑副本入口 |
| `docker-compose.yml` | 新增 hocuspocus 服务 |
| `docs/feature-gap-checklist.md` | 完成项打 ✅ |

---

## Task 1: DB Patch 009 — doc_type & draft_content

**Files:**
- Create: `docs/patch-009-online-editor.sql`
- Modify: `docs/doc.sql`
- Modify: `prisma/schema.prisma`

- [ ] **创建 `docs/patch-009-online-editor.sql`**

```sql
-- patch-009-online-editor.sql
-- 在线编辑器：文档类型标记 + 草稿内容字段

SET @col1 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'doc_documents' AND COLUMN_NAME = 'doc_type');
SET @sql1 = IF(@col1 = 0,
  "ALTER TABLE doc_documents ADD COLUMN doc_type TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '文档类型: 1=文件上传 2=在线Markdown' AFTER ext",
  'SELECT 1');
PREPARE s1 FROM @sql1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @col2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'doc_documents' AND COLUMN_NAME = 'draft_content');
SET @sql2 = IF(@col2 = 0,
  "ALTER TABLE doc_documents ADD COLUMN draft_content MEDIUMTEXT NULL COMMENT '在线编辑草稿内容，发布时写入MinIO生成版本' AFTER doc_type",
  'SELECT 1');
PREPARE s2 FROM @sql2; EXECUTE s2; DEALLOCATE PREPARE s2;
```

- [ ] **更新 `docs/doc.sql`**：在 `CREATE TABLE doc_documents` 中 `ext` 列之后插入：

```sql
  `doc_type` tinyint unsigned NOT NULL DEFAULT '1' COMMENT '文档类型: 1=文件上传 2=在线Markdown',
  `draft_content` mediumtext COMMENT '在线编辑草稿内容，发布时写入MinIO生成版本',
```

- [ ] **更新 `prisma/schema.prisma`**，在 `model doc_documents` 的 `ext` 字段之后加：

```prisma
doc_type      Int     @default(1) @db.UnsignedTinyInt
draft_content String? @db.MediumText
```

- [ ] 执行补丁（开发环境）：

```bash
# 在 MySQL 容器中执行，或用 MySQL 客户端连接后运行
docker compose exec db mysql -uroot -pdocflow_pwd docflow < docs/patch-009-online-editor.sql
```

- [ ] 重新生成 Prisma Client：

```bash
npm run prisma:generate
```

- [ ] **提交**：`feat: patch-009 在线编辑器 doc_type + draft_content 字段`

---

## Task 2: 服务端 Schema & 类型

**Files:**
- Create: `server/schemas/document-editor.ts`
- Create: `types/document-editor.ts`

- [ ] **创建 `server/schemas/document-editor.ts`**：

```typescript
import { z } from 'zod'

export const createDraftSchema = z.object({
	title: z.string().min(1).max(255).default('未命名文档'),
	groupId: z.number().int().positive().optional(),
})

export const saveContentSchema = z.object({
	content: z.string(),
	title: z.string().min(1).max(255).optional(),
})

export const createEditCopySchema = z.object({})  // body 为空，docId 从路由取

export type CreateDraftBody = z.infer<typeof createDraftSchema>
export type SaveContentBody = z.infer<typeof saveContentSchema>
```

- [ ] **创建 `types/document-editor.ts`**：

```typescript
export interface DraftContent {
	title: string
	content: string
	status: number  // 1=草稿 2=编辑中
	docType: number // 1=文件 2=在线Markdown
}

export interface EditCopyResult {
	id: string
	isNew: boolean
}

export interface AnnotationItem {
	id: string
	content: string
	quoteText: string
	startOffset: number
	endOffset: number
	authorName: string
	createdAt: number
	status: number  // 1=打开 2=已解决
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'
```

- [ ] **提交**：`feat: 在线编辑器 Zod schemas 与类型定义`

---

## Task 3: POST /api/documents — 新建空白草稿

**Files:**
- Create: `server/api/documents/index.post.ts`

> **注意**：`server/api/documents/index.get.ts`（文档列表）已存在，此处新建 `index.post.ts`。

- [ ] **创建 `server/api/documents/index.post.ts`**：

```typescript
/**
 * POST /api/documents
 * 新建在线 Markdown 草稿（PRD §6.3.5 新建文档）
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import { createDraftSchema } from '~/server/schemas/document-editor'
import { GROUP_NOT_FOUND } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:create')
	if (permErr) return permErr
	const user = event.context.user!

	const body = await readValidatedBody(event, createDraftSchema.parse)

	if (body.groupId) {
		const group = await prisma.doc_groups.findFirst({
			where: { id: BigInt(body.groupId), deleted_at: null },
			select: { id: true },
		})
		if (!group) return fail(event, 404, GROUP_NOT_FOUND, '目标组不存在')
	}

	const docId = generateId()
	await prisma.doc_documents.create({
		data: {
			id: BigInt(docId),
			owner_user_id: BigInt(user.id),
			created_by: BigInt(user.id),
			title: body.title,
			ext: 'md',
			doc_type: 2,
			status: 1,
			group_id: body.groupId ? BigInt(body.groupId) : null,
			draft_content: '',
		},
	})

	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DOC_UPLOAD,
		targetType: 'document',
		targetId: Number(docId),
		groupId: body.groupId,
		documentId: Number(docId),
		detail: { desc: `新建在线文档草稿「${body.title}」` },
	})

	return ok({ id: docId.toString() }, '草稿创建成功')
})
```

- [ ] **提交**：`feat: POST /api/documents 新建在线Markdown草稿`

---

## Task 4: GET + PUT /api/documents/:id/content — 加载与自动保存

**Files:**
- Create: `server/api/documents/[id]/content.get.ts`
- Create: `server/api/documents/[id]/content.put.ts`

- [ ] **创建 `server/api/documents/[id]/content.get.ts`**：

```typescript
/**
 * GET /api/documents/:id/content
 * 加载草稿/编辑副本内容（仅 doc_type=2）
 */
import { prisma } from '~/server/utils/prisma'
import { DOCUMENT_NOT_FOUND, PERMISSION_DENIED, INVALID_PARAMS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	const docId = BigInt(idStr)

	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, title: true, doc_type: true, draft_content: true, status: true, owner_user_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (doc.doc_type !== 2) return fail(event, 400, INVALID_PARAMS, '该文档不是在线编辑文档')

	// 权限：归属人 或 有编辑权限（permission <= 2）
	const isOwner = Number(doc.owner_user_id) === user.id
	if (!isOwner) {
		const perm = await prisma.doc_document_permissions.findFirst({
			where: { document_id: docId, user_id: BigInt(user.id), deleted_at: null },
			select: { permission: true },
		})
		if (!perm || perm.permission > 2) return fail(event, 403, PERMISSION_DENIED, '无权编辑此文档')
	}

	return ok({
		title: doc.title,
		content: doc.draft_content ?? '',
		status: doc.status,
		docType: doc.doc_type,
	})
})
```

- [ ] **创建 `server/api/documents/[id]/content.put.ts`**：

```typescript
/**
 * PUT /api/documents/:id/content
 * 自动保存草稿内容（仅 doc_type=2，status=1/2）
 */
import { prisma } from '~/server/utils/prisma'
import { saveContentSchema } from '~/server/schemas/document-editor'
import { DOCUMENT_NOT_FOUND, PERMISSION_DENIED, DOCUMENT_STATUS_INVALID, INVALID_PARAMS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	const docId = BigInt(idStr)

	const body = await readValidatedBody(event, saveContentSchema.parse)

	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, doc_type: true, status: true, owner_user_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (doc.doc_type !== 2) return fail(event, 400, INVALID_PARAMS, '该文档不是在线编辑文档')
	if (doc.status !== 1 && doc.status !== 2) {
		return fail(event, 409, DOCUMENT_STATUS_INVALID, '仅草稿或编辑中文档可保存')
	}

	const isOwner = Number(doc.owner_user_id) === user.id
	if (!isOwner) {
		const perm = await prisma.doc_document_permissions.findFirst({
			where: { document_id: docId, user_id: BigInt(user.id), deleted_at: null },
			select: { permission: true },
		})
		if (!perm || perm.permission > 2) return fail(event, 403, PERMISSION_DENIED, '无权编辑此文档')
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const updateData: Record<string, any> = {
		draft_content: body.content,
		updated_at: new Date(),
		updated_by: BigInt(user.id),
	}
	if (body.title) updateData.title = body.title

	await prisma.doc_documents.update({ where: { id: docId }, data: updateData })

	return ok(null, '已保存')
})
```

- [ ] **提交**：`feat: GET/PUT /api/documents/:id/content 草稿内容加载与自动保存`

---

## Task 5: POST /api/documents/:id/edit-copy — 创建编辑副本

**Files:**
- Create: `server/api/documents/[id]/edit-copy.post.ts`

- [ ] **创建 `server/api/documents/[id]/edit-copy.post.ts`**：

```typescript
/**
 * POST /api/documents/:id/edit-copy
 * 为已发布文档创建编辑副本（PRD §6.3.5 编辑副本机制）
 * - 一文档只有一份活跃副本；若已存在则直接返回其 ID
 * - 从当前版本 MinIO 文件加载初始内容
 */
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { getStorage } from '~/server/utils/storage'
import { DOCUMENT_NOT_FOUND, DOCUMENT_STATUS_INVALID, PERMISSION_DENIED, INVALID_PARAMS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
	const permErr = await requirePermission(event, 'doc:read')
	if (permErr) return permErr
	const user = event.context.user!

	const idStr = getRouterParam(event, 'id')
	if (!idStr || !/^\d+$/.test(idStr)) return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
	const docId = BigInt(idStr)

	const doc = await prisma.doc_documents.findFirst({
		where: { id: docId, deleted_at: null },
		select: { id: true, title: true, status: true, owner_user_id: true, current_version_id: true, group_id: true },
	})
	if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')
	if (doc.status !== 4) return fail(event, 409, DOCUMENT_STATUS_INVALID, '仅已发布文档可创建编辑副本')

	// 权限：归属人 或 可编辑成员（permission <= 2）
	const isOwner = Number(doc.owner_user_id) === user.id
	if (!isOwner) {
		const perm = await prisma.doc_document_permissions.findFirst({
			where: { document_id: docId, user_id: BigInt(user.id), deleted_at: null },
			select: { permission: true },
		})
		if (!perm || perm.permission > 2) return fail(event, 403, PERMISSION_DENIED, '无编辑权限')
	}

	// 检查是否已有活跃副本
	const existing = await prisma.doc_documents.findFirst({
		where: { source_doc_id: docId, status: { in: [1, 2] }, deleted_at: null },
		select: { id: true },
	})
	if (existing) {
		return ok({ id: existing.id.toString(), isNew: false }, '已有活跃编辑副本')
	}

	// 加载原文档当前版本内容（MinIO）
	let initialContent = ''
	if (doc.current_version_id) {
		const version = await prisma.doc_document_versions.findFirst({
			where: { id: doc.current_version_id, deleted_at: null },
			select: { storage_key: true, storage_bucket: true },
		})
		if (version) {
			try {
				const storage = getStorage()
				const stream = await storage.getObject(version.storage_bucket ?? 'documents', version.storage_key)
				const chunks: Buffer[] = []
				for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
				initialContent = Buffer.concat(chunks).toString('utf-8')
			} catch {
				// 加载失败时以空内容创建副本，不阻断流程
			}
		}
	}

	const copyId = generateId()
	await prisma.doc_documents.create({
		data: {
			id: BigInt(copyId),
			source_doc_id: docId,
			owner_user_id: BigInt(user.id),
			created_by: BigInt(user.id),
			title: doc.title,
			ext: 'md',
			doc_type: 2,
			status: 2,  // 编辑中
			group_id: doc.group_id,
			draft_content: initialContent,
		},
	})

	return ok({ id: copyId.toString(), isNew: true }, '编辑副本已创建')
})
```

- [ ] **提交**：`feat: POST /api/documents/:id/edit-copy 创建编辑副本`

---

## Task 6: 修改 publish.post.ts — 支持在线文档发布

**Files:**
- Modify: `server/api/documents/[id]/publish.post.ts`

在线文档（doc_type=2）发布时没有 MinIO 文件，需先将 `draft_content` 上传为 `.md` 文件，然后走现有 `resubmit` 审批路径。

- [ ] **在 `publish.post.ts` 初始查询中加入 `doc_type` 和 `draft_content`**：

找到 `select:` 块（约第 49 行），加两个字段：
```typescript
select: {
  id: true,
  title: true,
  ext: true,
  status: true,
  group_id: true,
  owner_user_id: true,
  current_version_id: true,
  deleted_at: true,
  doc_type: true,        // ← 新增
  draft_content: true,   // ← 新增
},
```

- [ ] **在 `if (!currentVersion)` 检查之前，插入在线文档材料化逻辑**（约第 88 行）：

```typescript
// ── 在线文档发布：将 draft_content 材料化为 MinIO 版本 ──
if (doc.doc_type === 2 && !currentVersion) {
  if (!doc.draft_content) {
    return fail(event, 409, DOCUMENT_STATUS_INVALID, '草稿内容为空，无法发布')
  }
  // 1. 上传 draft_content 到 MinIO
  const { getStorage } = await import('~/server/utils/storage')
  const { generateId: genId } = await import('~/server/utils/snowflake')
  const storage = getStorage()
  const versionId = genId()
  const storageKey = `documents/${doc.id}/v1.0/${versionId}.md`
  const contentBuffer = Buffer.from(doc.draft_content, 'utf-8')
  await storage.putObject('documents', storageKey, contentBuffer, contentBuffer.length, { 'Content-Type': 'text/markdown; charset=utf-8' })

  // 2. 创建 doc_document_versions 记录
  const newVersion = await prisma.doc_document_versions.create({
    data: {
      id: BigInt(versionId),
      document_id: doc.id,
      version_no: 'v1.0',
      storage_key: storageKey,
      storage_bucket: 'documents',
      file_size: BigInt(contentBuffer.length),
      mime_type: 'text/markdown',
      uploaded_by: BigInt(user.id),
    },
  })

  // 3. 更新 doc.current_version_id
  await prisma.doc_documents.update({
    where: { id: doc.id },
    data: { current_version_id: BigInt(versionId) },
  })

  // 赋值，让后续 executeUpload 能正常取到 currentVersion
  // @ts-ignore
  currentVersion = newVersion
}
```

- [ ] **提交**：`feat: publish.post.ts 支持在线文档材料化发布`

---

## Task 7: 前端 API 封装

**Files:**
- Create: `api/document-editor.ts`

- [ ] **创建 `api/document-editor.ts`**：

```typescript
import type { DraftContent, EditCopyResult, AnnotationItem } from '~/types/document-editor'
import type { ApiResult } from '~/types/api'

const useHttp = () => useAuthFetch()

// ── 草稿 ──
export const apiCreateDraft = (body?: { title?: string; groupId?: number }) =>
	useAuthFetch()<ApiResult<{ id: string }>>('/api/documents', { method: 'POST', body: body ?? {} })

export const apiGetDocContent = (id: number) =>
	useAuthFetch()<ApiResult<DraftContent>>(`/api/documents/${id}/content`)

export const apiSaveDocContent = (id: number, body: { content: string; title?: string }) =>
	useAuthFetch()<ApiResult<null>>(`/api/documents/${id}/content`, { method: 'PUT', body })

// ── 编辑副本 ──
export const apiCreateEditCopy = (id: number) =>
	useAuthFetch()<ApiResult<EditCopyResult>>(`/api/documents/${id}/edit-copy`, { method: 'POST', body: {} })

// ── 批注 ──
export const apiGetAnnotations = (docId: number) =>
	useAuthFetch()<ApiResult<AnnotationItem[]>>(`/api/documents/${docId}/annotations`)

export const apiCreateAnnotation = (docId: number, body: { content: string; quoteText: string; startOffset: number; endOffset: number }) =>
	useAuthFetch()<ApiResult<AnnotationItem>>(`/api/documents/${docId}/annotations`, { method: 'POST', body })

export const apiUpdateAnnotation = (docId: number, annotationId: string, body: { content?: string; status?: number }) =>
	useAuthFetch()<ApiResult<null>>(`/api/documents/${docId}/annotations/${annotationId}`, { method: 'PUT', body })

export const apiDeleteAnnotation = (docId: number, annotationId: string) =>
	useAuthFetch()<ApiResult<null>>(`/api/documents/${docId}/annotations/${annotationId}`, { method: 'DELETE' })
```

- [ ] **提交**：`feat: api/document-editor.ts 编辑器前端接口封装`

---

## Task 8: 编辑器布局

**Files:**
- Create: `layouts/editor.vue`

- [ ] **创建 `layouts/editor.vue`**：

```vue
<template>
	<div class="editor-layout">
		<slot />
	</div>
</template>

<style>
.editor-layout {
	display: flex;
	flex-direction: column;
	height: 100vh;
	overflow: hidden;
	background: var(--df-panel);
}
</style>
```

- [ ] **提交**：`feat: layouts/editor.vue 编辑器专用布局`

---

## Task 9: 安装 Milkdown + MilkdownEditor 组件

**Files:**
- Create: `components/MilkdownEditor.vue`

- [ ] **安装依赖**：

```bash
npm install @milkdown/crepe @milkdown/vue @milkdown/plugin-collab yjs y-websocket
```

- [ ] **创建 `components/MilkdownEditor.vue`**：

```vue
<template>
	<MilkdownProvider>
		<div ref="editorRoot" class="milkdown-host" />
	</MilkdownProvider>
</template>

<script setup lang="ts">
import { MilkdownProvider } from '@milkdown/vue'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

const props = defineProps<{
	initialContent: string
	readonly?: boolean
	docId?: number
	enableCollab?: boolean
}>()

const emit = defineEmits<{
	(e: 'update', content: string): void
	(e: 'presenceUpdate', users: Array<{ id: number; name: string; color: string }>): void
}>()

const editorRoot = ref<HTMLElement>()
let crepe: Crepe | null = null

// 协同相关（懒加载，仅 enableCollab=true 时初始化）
let ydoc: import('yjs').Doc | null = null
let wsProvider: import('y-websocket').WebsocketProvider | null = null

onMounted(async () => {
	if (!editorRoot.value) return

	crepe = new Crepe({
		root: editorRoot.value,
		defaultValue: props.initialContent,
		features: {
			[Crepe.Feature.Latex]: true,
		},
		featureConfigs: {
			[Crepe.Feature.Placeholder]: {
				text: '输入 / 插入内容，或直接开始写作...',
			},
		},
	})

	crepe.on(listener => {
		listener.markdownUpdated((_ctx, markdown) => {
			emit('update', markdown)
		})
	})

	await crepe.create()

	if (props.readonly) crepe.setReadonly(true)

	// 协同接入
	if (props.enableCollab && props.docId) {
		await setupCollab(props.docId)
	}
})

async function setupCollab(docId: number) {
	if (!crepe) return
	const [{ Doc }, { WebsocketProvider }, { collab, collabServiceCtx }] = await Promise.all([
		import('yjs'),
		import('y-websocket'),
		import('@milkdown/plugin-collab'),
	])

	const authStore = useAuthStore()
	const token = authStore.accessToken ?? ''
	const wsHost = (useRuntimeConfig().public.hocuspocusUrl as string) ?? `ws://${location.host.replace(/:\d+$/, '')}:1234`

	ydoc = new Doc()
	wsProvider = new WebsocketProvider(wsHost, `doc-${docId}`, ydoc, {
		params: { token },
	})

	crepe.editor.use(collab)

	wsProvider.once('synced', (isSynced: boolean) => {
		if (!isSynced || !ydoc || !wsProvider) return
		crepe!.editor.action(ctx => {
			const collabService = ctx.get(collabServiceCtx)
			collabService.bindDoc(ydoc!).setAwareness(wsProvider!.awareness).connect()
		})
	})

	// Presence
	wsProvider.awareness.on('change', () => {
		const states = Array.from(wsProvider!.awareness.getStates().values())
		const users = states.map((s: Record<string, unknown>) => s.user).filter(Boolean) as Array<{ id: number; name: string; color: string }>
		emit('presenceUpdate', users)
	})

	// 设置自身 presence
	const colors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6']
	wsProvider.awareness.setLocalStateField('user', {
		id: authStore.user?.id,
		name: authStore.user?.name,
		color: colors[(authStore.user?.id ?? 0) % colors.length],
	})
}

onUnmounted(async () => {
	wsProvider?.destroy()
	ydoc?.destroy()
	await crepe?.destroy()
	crepe = null
})

defineExpose({
	getMarkdown: () => crepe?.getMarkdown() ?? '',
	setReadonly: (val: boolean) => crepe?.setReadonly(val),
})
</script>

<style>
.milkdown-host {
	width: 100%;
	height: 100%;
}

/* 覆盖 Milkdown 默认样式以适配项目主色 */
.milkdown .editor {
	padding: 0 48px 120px;
	max-width: 900px;
	margin: 0 auto;
	font-size: 15px;
	line-height: 1.75;
}
</style>
```

- [ ] 确认 `nuxt.config.ts` 中 vite 对 wasm/binary 资源无冲突（Milkdown 含 KaTeX 字体，正常情况 Nuxt 自动处理）

- [ ] **提交**：`feat: MilkdownEditor 组件（Crepe + 可选协同）`

---

## Task 10: useDocEditor Composable — 自动保存 + 标题同步

**Files:**
- Create: `composables/useDocEditor.ts`

- [ ] **创建 `composables/useDocEditor.ts`**：

```typescript
import { ref, computed, onUnmounted } from 'vue'
import { apiSaveDocContent } from '~/api/document-editor'
import type { SaveStatus } from '~/types/document-editor'

export function useDocEditor(docId: Ref<number>) {
	const { msgError } = useNotify()
	const saveStatus = ref<SaveStatus>('saved')
	let pendingContent: string | null = null
	let pendingTitle: string | null = null
	let saveTimer: ReturnType<typeof setTimeout> | null = null

	function onContentChange(content: string, title?: string) {
		pendingContent = content
		if (title !== undefined) pendingTitle = title
		saveStatus.value = 'unsaved'
		if (saveTimer) clearTimeout(saveTimer)
		saveTimer = setTimeout(flushSave, 2000)
	}

	async function flushSave() {
		if (pendingContent === null) return
		saveStatus.value = 'saving'
		const snapshot = { content: pendingContent, title: pendingTitle ?? undefined }
		pendingContent = null
		pendingTitle = null
		try {
			await apiSaveDocContent(docId.value, snapshot)
			saveStatus.value = 'saved'
		} catch {
			saveStatus.value = 'error'
			msgError('自动保存失败')
		}
	}

	const saveStatusLabel = computed(() => {
		const map: Record<SaveStatus, string> = {
			saved: '已保存',
			saving: '保存中...',
			unsaved: '未保存',
			error: '保存失败',
		}
		return map[saveStatus.value]
	})

	onUnmounted(() => {
		if (saveTimer) clearTimeout(saveTimer)
	})

	return { saveStatus, saveStatusLabel, onContentChange, flushSave }
}
```

- [ ] **提交**：`feat: useDocEditor composable 自动保存与状态管理`

---

## Task 11: 编辑器页面

**Files:**
- Create: `pages/docs/editor/[id].vue`

- [ ] **创建 `pages/docs/editor/[id].vue`**：

```vue
<template>
	<div class="editor-shell">
		<!-- ─── 顶栏 ─── -->
		<header class="editor-topbar">
			<div class="editor-topbar__left">
				<el-button link class="editor-back-btn" @click="handleBack">
					<el-icon><ArrowLeft /></el-icon>
				</el-button>
				<input
					v-model="title"
					class="editor-title-input"
					placeholder="未命名文档"
					maxlength="255"
					@input="onTitleInput"
				/>
				<span class="editor-save-status" :class="`is-${saveStatus}`">{{ saveStatusLabel }}</span>
			</div>

			<div class="editor-topbar__right">
				<!-- 协作者头像 -->
				<AvatarStack v-if="onlineUsers.length" :users="onlineUsers" :max="5" style="margin-right: 8px" />
				<!-- 批注面板切换 -->
				<el-button size="small" @click="annotationOpen = !annotationOpen">批注</el-button>
				<!-- 提交发布 -->
				<el-button type="primary" size="small" :disabled="saveStatus === 'saving'" @click="handlePublish">
					提交发布
				</el-button>
				<!-- 更多 -->
				<el-dropdown trigger="click">
					<el-button size="small">
						<el-icon><MoreFilled /></el-icon>
					</el-button>
					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item @click="handleTransfer">转移归属人</el-dropdown-item>
							<el-dropdown-item @click="handleShare">分享</el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</div>
		</header>

		<!-- ─── 主体 ─── -->
		<div class="editor-body">
			<!-- 编辑区 -->
			<main class="editor-main">
				<ClientOnly>
					<MilkdownEditor
						v-if="!loading && content !== null"
						ref="milkdownRef"
						:initial-content="content"
						:doc-id="docId"
						:enable-collab="enableCollab"
						@update="onEditorUpdate"
						@presence-update="onPresenceUpdate"
					/>
					<div v-else class="editor-loading">
						<el-skeleton :rows="8" animated />
					</div>
				</ClientOnly>
			</main>

			<!-- 批注面板 -->
			<aside v-if="annotationOpen" class="editor-annotation-aside">
				<AnnotationPanel :doc-id="docId" />
			</aside>
		</div>
	</div>

	<!-- 发布弹窗复用 -->
	<PublishModal
		v-if="publishTarget"
		v-model="publishModalVisible"
		:doc="publishTarget"
		@success="onPublishSuccess"
	/>

	<!-- 转移归属人弹窗复用 -->
	<OwnershipTransferModal
		v-if="docId"
		v-model="transferModalVisible"
		:document-id="docId"
		:document-title="title"
		:exclude-user-id="currentUserId"
		@success="handleBack"
	/>

	<!-- 分享弹窗复用 -->
	<ShareLinkModal
		v-if="docId"
		v-model="shareModalVisible"
		:document-id="docId"
		:file-name="`${title}.md`"
	/>
</template>

<script setup lang="ts">
import { ArrowLeft, MoreFilled } from '@element-plus/icons-vue'
import { apiGetDocContent } from '~/api/document-editor'
import { useDocEditor } from '~/composables/useDocEditor'
import type { PersonalDocItem } from '~/types/personal'

definePageMeta({ layout: 'editor' })
useHead({ title: '编辑器 - DocFlow' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const currentUserId = computed(() => authStore.user?.id ?? 0)

const docId = computed(() => Number(route.params.id))
const enableCollab = ref(true)  // 生产环境开启协同；可按 feature flag 控制

// ── 内容加载 ──
const title = ref('未命名文档')
const content = ref<string | null>(null)
const loading = ref(true)

onMounted(async () => {
	const res = await apiGetDocContent(docId.value)
	if (res.success) {
		title.value = res.data.title
		content.value = res.data.content
	} else {
		useNotify().msgError(res.message || '加载失败')
		router.back()
	}
	loading.value = false
})

// ── 自动保存 ──
const { saveStatus, saveStatusLabel, onContentChange, flushSave } = useDocEditor(docId)

const milkdownRef = ref<{ getMarkdown: () => string } | null>(null)

function onEditorUpdate(markdown: string) {
	onContentChange(markdown, undefined)
}

function onTitleInput() {
	onContentChange(milkdownRef.value?.getMarkdown() ?? '', title.value)
}

// ── Presence ──
const onlineUsers = ref<Array<{ id: number; name: string; color: string }>>([])
function onPresenceUpdate(users: typeof onlineUsers.value) {
	onlineUsers.value = users.filter(u => u.id !== currentUserId.value)
}

// ── 返回 ──
async function handleBack() {
	await flushSave()
	router.back()
}

// ── 发布 ──
const publishModalVisible = ref(false)
const publishTarget = computed<PersonalDocItem | null>(() => {
	if (!docId.value) return null
	return { id: docId.value, title: title.value, ext: 'md', status: 1 } as PersonalDocItem
})

function handlePublish() {
	publishModalVisible.value = true
}

function onPublishSuccess() {
	publishModalVisible.value = false
	router.back()
}

// ── 批注面板 ──
const annotationOpen = ref(false)

// ── 转移/分享弹窗 ──
const transferModalVisible = ref(false)
const shareModalVisible = ref(false)

function handleTransfer() { transferModalVisible.value = true }
function handleShare() { shareModalVisible.value = true }
</script>

<style>
.editor-shell {
	display: flex;
	flex-direction: column;
	height: 100vh;
	overflow: hidden;
}

.editor-topbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 16px;
	height: 52px;
	border-bottom: 1px solid var(--df-border);
	background: var(--df-panel);
	flex-shrink: 0;
	gap: 12px;
}

.editor-topbar__left {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
	min-width: 0;
}

.editor-topbar__right {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}

.editor-back-btn { padding: 4px; }

.editor-title-input {
	flex: 1;
	min-width: 0;
	border: none;
	outline: none;
	background: transparent;
	font-size: 15px;
	font-weight: 600;
	color: var(--df-text);
}

.editor-save-status {
	font-size: 12px;
	color: var(--df-subtext);
	white-space: nowrap;
}
.editor-save-status.is-error { color: var(--el-color-danger); }
.editor-save-status.is-saving { color: var(--el-color-primary); }

.editor-body {
	display: flex;
	flex: 1;
	overflow: hidden;
}

.editor-main {
	flex: 1;
	overflow-y: auto;
	padding: 32px 0;
}

.editor-annotation-aside {
	width: 300px;
	border-left: 1px solid var(--df-border);
	overflow-y: auto;
	flex-shrink: 0;
}

.editor-loading { padding: 48px 48px; }
</style>
```

- [ ] 确认 `AnnotationPanel` 组件占位（Task 17 实现前可用 `<div>批注面板（待实现）</div>` 代替）

- [ ] **提交**：`feat: pages/docs/editor/[id].vue 编辑器页面`

---

## Task 12: 个人中心接入 — 新建文档 + 编辑草稿

**Files:**
- Modify: `utils/personal-matrix.ts`
- Modify: `pages/profile.vue`

- [ ] **在 `utils/personal-matrix.ts`** 中将 `ActionKind` 加入 `'edit'`，并在 `getActions` 中加规则：

```typescript
// ActionKind 加 'edit'
export type ActionKind = 'view' | 'download' | 'share' | 'publish' | 'withdraw' | 'delete' | 'transfer' | 'requestEdit' | 'edit'

// getActions 中，草稿/编辑中 + 在线文档 → 编辑按钮（主按钮区）
// 在 push view 之前插入：
if ((doc.status === 1 || doc.status === 2) && doc.docType === 2 && isOwner) {
	actions.push({ kind: 'edit', label: '编辑', type: 'primary', inMenu: false })
}
```

> `PersonalDocItem` 需同时加 `docType` 字段，在 `types/personal.ts` 中补充：`docType: number`，后端接口也需在 SQL 中 SELECT `doc_type AS docType`（检查 `server/api/personal/documents.get.ts`）。

- [ ] **在 `pages/profile.vue`** 中：

1. 将「新建文档」按钮 handler 改为调用 API 并跳转：

```typescript
import { apiCreateDraft } from '~/api/document-editor'

async function handleNewDoc() {
	const res = await apiCreateDraft({ title: '未命名文档' })
	if (res.success) {
		await navigateTo(`/docs/editor/${res.data.id}`)
	}
}
```

2. 在 `onActionClick` 的 switch 中加 `edit` case：

```typescript
case 'edit':
	await navigateTo(`/docs/editor/${doc.id}`)
	break
```

- [ ] **提交**：`feat: 个人中心接入新建文档与编辑草稿入口`

---

## Task 13: 文件详情页 — 编辑按钮 + 编辑副本流程

**Files:**
- Modify: `pages/docs/file/[id].vue`

- [ ] **在 `pages/docs/file/[id].vue`** 顶栏操作区找到「编辑」按钮占位，接入真实逻辑：

```typescript
import { apiCreateEditCopy } from '~/api/document-editor'

const creatingCopy = ref(false)

async function handleEdit() {
	const { msgConfirm, msgError } = useNotify()
	try {
		await msgConfirm(
			'将为此文档创建一份编辑副本，原已发布版本不受影响。一份文档同时只有一份活跃副本。',
			'确认编辑'
		)
	} catch { return }

	creatingCopy.value = true
	try {
		const res = await apiCreateEditCopy(Number(route.params.id))
		if (res.success) {
			await navigateTo(`/docs/editor/${res.data.id}`)
		}
	} finally {
		creatingCopy.value = false
	}
}
```

将模板中编辑按钮绑定 `@click="handleEdit"` 并加 `:loading="creatingCopy"`。

- [ ] **提交**：`feat: 文件详情页编辑按钮接入编辑副本流程`

---

## Task 14: 路由守卫 — 草稿自动跳编辑器

**Files:**
- Modify: `pages/docs/file/[id].vue`

- [ ] **在文件详情页 `onMounted` 中，加载文档详情后判断跳转**：

```typescript
// 在 detail.value 赋值之后加：
if (detail.value?.docType === 2 && (detail.value.status === 1 || detail.value.status === 2)) {
	await navigateTo(`/docs/editor/${detail.value.id}`, { replace: true })
	return
}
```

> 需确认 `DocumentDetail`（`types/document.ts`）已包含 `docType` 字段；若无，在接口 `server/api/documents/[id]/index.get.ts` 的 SELECT 和响应 map 中补加 `doc_type AS docType`。

- [ ] **提交**：`feat: 文件详情页检测在线草稿自动跳转编辑器`

---

## Task 15: Hocuspocus 协同服务

**Files:**
- Create: `hocuspocus/package.json`
- Create: `hocuspocus/tsconfig.json`
- Create: `hocuspocus/index.ts`
- Create: `hocuspocus/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **创建 `hocuspocus/package.json`**：

```json
{
  "name": "docflow-hocuspocus",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node index.js"
  },
  "dependencies": {
    "@hocuspocus/server": "^2.13.0",
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **创建 `hocuspocus/tsconfig.json`**：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": ".",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["index.ts"]
}
```

- [ ] **创建 `hocuspocus/index.ts`**：

```typescript
import { Server } from '@hocuspocus/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET ?? 'please-set-a-strong-random-secret-here-min-32'
const PORT = parseInt(process.env.HOCUSPOCUS_PORT ?? '1234', 10)

interface JwtPayload { id: number; name: string }

const server = Server.configure({
  port: PORT,

  async onAuthenticate({ token }) {
    if (!token) throw new Error('缺少 token')
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
      return { userId: payload.id, userName: payload.name }
    } catch {
      throw new Error('token 无效')
    }
  },

  async onConnect({ documentName, context }) {
    console.log(`[hocuspocus] ${(context as { userName: string }).userName} → 房间 ${documentName}`)
  },
})

server.listen().then(() => {
  console.log(`[hocuspocus] 协同服务已启动，端口 ${PORT}`)
})
```

- [ ] **创建 `hocuspocus/Dockerfile`**：

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json index.ts ./
RUN npm install && npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/package.json /app/index.js ./
RUN npm install --omit=dev
EXPOSE 1234
CMD ["node", "index.js"]
```

- [ ] **在 `docker-compose.yml`** 中 `redis:` 服务之后加：

```yaml
  hocuspocus:
    build: ./hocuspocus
    ports:
      - "1234:1234"
    environment:
      - JWT_SECRET=${JWT_SECRET:-please-set-a-strong-random-secret-here-min-32}
      - HOCUSPOCUS_PORT=1234
    restart: unless-stopped
```

- [ ] **在 `.env.example`** 中补充：

```
# 协同编辑服务（前端连接地址）
NUXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234
```

- [ ] **在 `nuxt.config.ts`** 的 `runtimeConfig.public` 中加：

```typescript
hocuspocusUrl: process.env.NUXT_PUBLIC_HOCUSPOCUS_URL ?? 'ws://localhost:1234',
```

- [ ] **提交**：`feat: Hocuspocus 协同服务 Docker 容器与配置`

---

## Task 16: 批注后端 CRUD

**Files:**
- Create: `server/api/documents/[id]/annotations.get.ts`
- Create: `server/api/documents/[id]/annotations.post.ts`
- Create: `server/api/documents/[id]/annotations/[annotationId].put.ts`
- Create: `server/api/documents/[id]/annotations/[annotationId].delete.ts`
- Create: `server/schemas/annotation.ts`

数据库表 `doc_document_annotations` 已存在（字段：id, document_id, version_id, user_id, start_offset, end_offset, quote_text, content TEXT, status TINYINT, created_at, updated_at）。

- [ ] **创建 `server/schemas/annotation.ts`**：

```typescript
import { z } from 'zod'

export const createAnnotationSchema = z.object({
  content: z.string().min(1).max(2000),
  quoteText: z.string().max(500).default(''),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
})

export const updateAnnotationSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  status: z.literal(2).optional(),  // 2=已解决
})
```

- [ ] **创建 `server/api/documents/[id]/annotations.get.ts`**：

```typescript
import { prisma } from '~/server/utils/prisma'
import { DOCUMENT_NOT_FOUND, INVALID_PARAMS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
  const permErr = await requirePermission(event, 'doc:read')
  if (permErr) return permErr

  const idStr = getRouterParam(event, 'id')
  if (!idStr || !/^\d+$/.test(idStr)) return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
  const docId = BigInt(idStr)

  const doc = await prisma.doc_documents.findFirst({
    where: { id: docId, deleted_at: null }, select: { id: true },
  })
  if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

  const rows = await prisma.doc_document_annotations.findMany({
    where: { document_id: docId, status: 1 },
    include: { doc_users: { select: { name: true } } },
    orderBy: { created_at: 'asc' },
  })

  return ok(rows.map(r => ({
    id: r.id.toString(),
    content: r.content,
    quoteText: r.quote_text ?? '',
    startOffset: r.start_offset,
    endOffset: r.end_offset,
    authorName: r.doc_users?.name ?? '',
    createdAt: r.created_at.getTime(),
    status: r.status,
  })))
})
```

- [ ] **创建 `server/api/documents/[id]/annotations.post.ts`**（新建批注，参考 comments.post.ts 结构，需要 `generateId` + insert `doc_document_annotations`）

- [ ] **创建 `server/api/documents/[id]/annotations/[annotationId].put.ts`**（更新内容或标记解决）

- [ ] **创建 `server/api/documents/[id]/annotations/[annotationId].delete.ts`**（软删除 status=2）

- [ ] **提交**：`feat: 批注 CRUD API（GET/POST/PUT/DELETE）`

---

## Task 17: AnnotationPanel 批注面板组件

**Files:**
- Create: `components/AnnotationPanel.vue`

- [ ] **创建 `components/AnnotationPanel.vue`**：

```vue
<template>
  <div class="annotation-panel">
    <div class="annotation-panel__header">
      <span class="annotation-panel__title">批注 ({{ openCount }})</span>
      <el-button size="small" type="primary" link @click="showAddForm = true">+ 新增</el-button>
    </div>

    <!-- 新增输入区 -->
    <div v-if="showAddForm" class="annotation-panel__add">
      <el-input v-model="newContent" type="textarea" :rows="3" placeholder="输入批注内容..." />
      <div class="annotation-panel__add-actions">
        <el-button size="small" @click="showAddForm = false">取消</el-button>
        <el-button size="small" type="primary" :loading="submitting" @click="handleAdd">提交</el-button>
      </div>
    </div>

    <!-- 批注列表 -->
    <el-scrollbar>
      <div v-if="!loading && annotations.length === 0" class="annotation-panel__empty">暂无批注</div>
      <div v-for="item in annotations" :key="item.id" class="annotation-item">
        <div class="annotation-item__quote" v-if="item.quoteText">{{ item.quoteText }}</div>
        <div class="annotation-item__content">{{ item.content }}</div>
        <div class="annotation-item__meta">
          <span>{{ item.authorName }}</span>
          <span>{{ formatTime(item.createdAt) }}</span>
        </div>
        <div class="annotation-item__actions">
          <el-button size="small" link @click="handleResolve(item.id)">标记解决</el-button>
          <el-button size="small" link type="danger" @click="handleDelete(item.id)">删除</el-button>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { apiGetAnnotations, apiCreateAnnotation, apiUpdateAnnotation, apiDeleteAnnotation } from '~/api/document-editor'
import { formatTime } from '~/utils/format'
import type { AnnotationItem } from '~/types/document-editor'

const props = defineProps<{ docId: number }>()

const annotations = ref<AnnotationItem[]>([])
const loading = ref(true)
const showAddForm = ref(false)
const newContent = ref('')
const submitting = ref(false)
const openCount = computed(() => annotations.value.filter(a => a.status === 1).length)

onMounted(load)

async function load() {
  loading.value = true
  const res = await apiGetAnnotations(props.docId)
  if (res.success) annotations.value = res.data
  loading.value = false
}

async function handleAdd() {
  if (!newContent.value.trim()) return
  submitting.value = true
  await apiCreateAnnotation(props.docId, { content: newContent.value, quoteText: '', startOffset: 0, endOffset: 0 })
  newContent.value = ''
  showAddForm.value = false
  submitting.value = false
  await load()
}

async function handleResolve(id: string) {
  await apiUpdateAnnotation(props.docId, id, { status: 2 })
  annotations.value = annotations.value.filter(a => a.id !== id)
}

async function handleDelete(id: string) {
  await apiDeleteAnnotation(props.docId, id)
  annotations.value = annotations.value.filter(a => a.id !== id)
}
</script>
```

- [ ] **在 `assets/styles/components.scss`** 中补充批注面板样式（`.annotation-panel`, `.annotation-item` 等基础布局）

- [ ] **提交**：`feat: AnnotationPanel 批注面板组件`

---

## Task 18: nuxt.config.ts 补充运行时配置

**Files:**
- Modify: `nuxt.config.ts`

- [ ] 在 `nuxt.config.ts` 的 `runtimeConfig` 中加（如果 Task 15 未加）：

```typescript
runtimeConfig: {
  // ...existing...
  public: {
    // ...existing...
    hocuspocusUrl: process.env.NUXT_PUBLIC_HOCUSPOCUS_URL ?? 'ws://localhost:1234',
  },
},
```

- [ ] **提交**：`feat: nuxt.config.ts 补充 hocuspocusUrl 运行时配置`

---

## Task 19: 补全 annotations.post/put/delete 接口

**Files:**
- Create: `server/api/documents/[id]/annotations.post.ts`
- Create: `server/api/documents/[id]/annotations/[annotationId].put.ts`
- Create: `server/api/documents/[id]/annotations/[annotationId].delete.ts`

> Task 16 中 GET 接口已完成，此任务补全剩余三个。

- [ ] **创建 `annotations.post.ts`**：

```typescript
import { prisma } from '~/server/utils/prisma'
import { generateId } from '~/server/utils/snowflake'
import { createAnnotationSchema } from '~/server/schemas/annotation'
import { DOCUMENT_NOT_FOUND, INVALID_PARAMS } from '~/server/constants/error-codes'

export default defineEventHandler(async (event) => {
  const permErr = await requirePermission(event, 'doc:read')
  if (permErr) return permErr
  const user = event.context.user!

  const idStr = getRouterParam(event, 'id')
  if (!idStr || !/^\d+$/.test(idStr)) return fail(event, 400, INVALID_PARAMS, '文档 ID 非法')
  const docId = BigInt(idStr)

  const doc = await prisma.doc_documents.findFirst({
    where: { id: docId, deleted_at: null }, select: { id: true },
  })
  if (!doc) return fail(event, 404, DOCUMENT_NOT_FOUND, '文档不存在')

  const body = await readValidatedBody(event, createAnnotationSchema.parse)
  const id = generateId()

  await prisma.doc_document_annotations.create({
    data: {
      id: BigInt(id),
      document_id: docId,
      user_id: BigInt(user.id),
      content: body.content,
      quote_text: body.quoteText,
      start_offset: body.startOffset,
      end_offset: body.endOffset,
      status: 1,
    },
  })

  return ok({ id: id.toString() }, '批注已添加')
})
```

- [ ] **创建 `annotations/[annotationId].put.ts`** 和 **`[annotationId].delete.ts`**（参考 comments 同名接口结构）

- [ ] **提交**：`feat: 批注 POST/PUT/DELETE 接口`

---

## Task 20: 更新 feature-gap-checklist.md

**Files:**
- Modify: `docs/feature-gap-checklist.md`

- [ ] 在 §2.9 个人中心中将「编辑」项标记完成
- [ ] 在 §2.7 文件详情中将「编辑按钮」和「在线编辑器」标记完成
- [ ] 新增「在线编辑器」完成章节到「已完成功能」节
- [ ] 更新「最后更新」日期
- [ ] **提交**：`docs: feature-gap-checklist 在线编辑器全部完成`

---

## 验收清单

完成所有任务后，手动验证以下流程：

- [ ] 个人中心点「新建文档」→ 跳编辑器 → 标题可修改 → 内容输入 2s 后显示「已保存」
- [ ] 个人中心草稿列表「编辑」→ 跳编辑器 → 内容正确加载
- [ ] 文件详情页「编辑」→ 弹确认 → 创建副本 → 跳编辑器 → 原发布文档不变
- [ ] 编辑器「提交发布」→ PublishModal 正常弹出 → 提交后返回
- [ ] 直接访问在线草稿的 `/docs/file/:id` → 自动 redirect 到 `/docs/editor/:id`
- [ ] 两个浏览器窗口同时打开同一文档的编辑器 → 内容实时同步（协同）
- [ ] 批注面板新增 / 解决 / 删除正常
- [ ] `docker compose up` 后 hocuspocus 服务正常启动
