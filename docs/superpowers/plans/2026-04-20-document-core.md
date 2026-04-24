# 文档管理核心（A 阶段）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通 DocFlow 文档核心链路：上传 → 版本 → 审批 → 发布 → 预览 → 下载 → 移除。接入 MinIO 对象存储，落地审批运行时最小子集（起 / 通 / 驳 / 撤回补 M7），让已有的审批中心、通知中心、操作日志页面消费真实业务数据。

**Architecture:** 见 Spec 第 3 节。基础设施层（MinIO + storage 抽象 + format-converter stub + markdown 渲染）→ 数据层（复用 schema + Zod + 错误码）→ 后端 10 套 API + 3 处 mock 换真 → 前端封装 + 2 新弹窗 + 2 页面重写/接真实 → 文档同步。

**Tech Stack:** Nuxt 3 / Nitro / Prisma / Zod / Element Plus / Vue 3 Composition API / @aws-sdk/client-s3 / markdown-it / DOMPurify

**Spec:** `docs/superpowers/specs/2026-04-20-document-core-design.md`

**项目约定提醒：**
- **tab 缩进**（非空格）
- 消息提示统一用 `composables/useNotify.ts` 的 `useNotify()`，不直接用 `ElMessage`/`ElMessageBox`
- 前端请求类型从 Zod schema 推导（`z.infer`），不另建
- 新增接口必须同步更新 `docs/api-auth-design.md`
- 全局公共组件样式放 `assets/styles/components/` 下，不要在组件 `<style>` 里重复
- Prisma 模型方法里 BigInt 字段要 `BigInt()` 包裹
- `ok(data, msg?)` / `fail(event, status, code, msg)` / `requirePermission` 是 Nitro 自动导入，无需 import
- `event.context.user` 由鉴权中间件注入（含 id/name/email）
- 时间字段统一返回**毫秒时间戳**
- 所有新增接口默认需要 JWT（鉴权白名单不新增）

---

## 阶段 1：基础设施（Task 1-5）

### Task 1: 新增 npm 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装后端依赖**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: 安装前端渲染依赖**

```bash
npm install markdown-it markdown-it-katex highlight.js katex dompurify
npm install -D @types/markdown-it @types/dompurify
```

- [ ] **Step 3: 验证**

```bash
npm run build
```
确保 TS 编译通过、无版本冲突。

**Commit message:**
```
chore: 引入 S3 SDK + markdown 渲染依赖（文档核心 A 阶段前置）
```

---

### Task 2: docker-compose 追加 MinIO

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Create: `tools/minio-init.sh`（可选）

- [ ] **Step 1: 修改 `docker-compose.yml`**

在 `services` 下追加 minio 块（见 Spec §6.1 完整配置）。

在 `services.app.depends_on` 追加：
```yaml
minio:
  condition: service_healthy
```

在 `volumes` 追加：
```yaml
minio_data:
```

- [ ] **Step 2: 修改 `.env.example`**

追加：
```
# ── 对象存储（MinIO / S3 兼容）──
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=docflow-files
STORAGE_PUBLIC_URL=http://localhost:9000

# ── 格式转换（外部接口，B 阶段填）──
# FORMAT_CONVERTER_ENDPOINT=
# FORMAT_CONVERTER_TOKEN=

# ── MinIO 容器 root 凭据（可选覆盖）──
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
```

- [ ] **Step 3: 启动并手动创建 bucket**

```bash
docker compose up -d minio
```

浏览器打开 `http://localhost:9001`，用 `minioadmin / minioadmin` 登录，创建 bucket `docflow-files`。

- [ ] **Step 4: 把本地 `.env` 也补上相同变量**

（不要提交到 git）

**Test:**
- 健康检查通过：`docker compose ps minio` 状态为 `healthy`
- 控制台可登录，bucket 创建成功

**Commit message:**
```
feat: 新增 MinIO 对象存储容器 + 环境变量配置
```

---

### Task 3: storage 抽象层

**Files:**
- Create: `server/utils/storage/types.ts`
- Create: `server/utils/storage/minio.ts`
- Create: `server/utils/storage/index.ts`

- [ ] **Step 1: 创建 `server/utils/storage/types.ts`**

按 Spec §6.3 `ObjectStorage` 接口定义。含 `putObject` / `getObject` / `getObjectStream` / `deleteObject` / `presignGetUrl` / `bucket`。

- [ ] **Step 2: 创建 `server/utils/storage/minio.ts`**

```ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { ObjectStorage } from './types'

export class MinioStorage implements ObjectStorage {
	constructor(private client: S3Client, readonly bucket: string) {}

	async putObject(key: string, body: Buffer, opts: { mimeType?: string, checksum?: string }) {
		await this.client.send(new PutObjectCommand({
			Bucket: this.bucket,
			Key: key,
			Body: body,
			ContentType: opts.mimeType,
			ChecksumSHA256: opts.checksum,  // 可选，MinIO 会校验
		}))
	}

	async getObject(key: string): Promise<Buffer> {
		const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
		const chunks: Buffer[] = []
		for await (const chunk of res.Body as any) {
			chunks.push(Buffer.from(chunk))
		}
		return Buffer.concat(chunks)
	}

	async getObjectStream(key: string) {
		const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
		return res.Body as any
	}

	async deleteObject(key: string) {
		await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
	}

	async presignGetUrl(key: string, seconds = 600) {
		return getSignedUrl(
			this.client,
			new GetObjectCommand({ Bucket: this.bucket, Key: key }),
			{ expiresIn: seconds },
		)
	}
}
```

- [ ] **Step 3: 创建 `server/utils/storage/index.ts`**

```ts
import { S3Client } from '@aws-sdk/client-s3'
import { MinioStorage } from './minio'
import type { ObjectStorage } from './types'

const client = new S3Client({
	endpoint: process.env.STORAGE_ENDPOINT,
	region: process.env.STORAGE_REGION || 'us-east-1',
	credentials: {
		accessKeyId: process.env.STORAGE_ACCESS_KEY!,
		secretAccessKey: process.env.STORAGE_SECRET_KEY!,
	},
	forcePathStyle: true,  // MinIO 必须
})

export const storage: ObjectStorage = new MinioStorage(client, process.env.STORAGE_BUCKET!)

/** 生成 storage_key：{groupId?}/{documentId}/{versionNo}-{shortHash}.{ext} */
export function buildStorageKey(params: {
	groupId: bigint | number | null
	documentId: bigint | number
	versionNo: string
	checksum: string
	ext: string
}): string {
	const prefix = params.groupId ? `${params.groupId}` : 'drafts'
	const shortHash = params.checksum.slice(0, 8)
	return `${prefix}/${params.documentId}/${params.versionNo}-${shortHash}.${params.ext}`
}
```

- [ ] **Step 4: 验证**

编写临时脚本或 Nitro 测试路由放一个 putObject + getObject，确认 MinIO 交互正常。通过后移除。

**Commit message:**
```
feat(storage): 新增对象存储抽象层（MinIO / S3 兼容）
```

---

### Task 4: format-converter stub

**Files:**
- Create: `server/utils/format-converter/types.ts`
- Create: `server/utils/format-converter/noop.ts`
- Create: `server/utils/format-converter/index.ts`

- [ ] **Step 1: 创建 `types.ts`**

按 Spec §6.4 `FormatConverter` 接口定义。

- [ ] **Step 2: 创建 `noop.ts`**

```ts
import type { FormatConverter } from './types'

/**
 * A 阶段占位：只支持 .md，其他格式一律返回 false / 抛错
 * B 阶段：替换为 ExternalConverter（调用外部接口）
 */
export class NoopConverter implements FormatConverter {
	canConvert(_ext: string): boolean {
		return false
	}
	async convert(): Promise<never> {
		throw new Error('FORMAT_CONVERTER_NOT_AVAILABLE')
	}
}
```

- [ ] **Step 3: 创建 `index.ts`**

```ts
import { NoopConverter } from './noop'
import type { FormatConverter } from './types'

// TODO: B 阶段替换为 ExternalConverter
// import { ExternalConverter } from './external'
// export const converter: FormatConverter = new ExternalConverter({
//   endpoint: process.env.FORMAT_CONVERTER_ENDPOINT!,
//   token: process.env.FORMAT_CONVERTER_TOKEN,
// })
export const converter: FormatConverter = new NoopConverter()
```

**Commit message:**
```
feat(format-converter): 格式转换占位接口（A 阶段仅支持 .md，外部接口就绪后替换）
```

---

### Task 5: Markdown 渲染工具

**Files:**
- Create: `utils/markdown.ts`
- Modify: `assets/styles/main.scss`（引入 hljs + katex 样式）

- [ ] **Step 1: 创建 `utils/markdown.ts`**

```ts
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
// @ts-expect-error no types
import katexPlugin from 'markdown-it-katex'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
	html: false,
	linkify: true,
	breaks: true,
	highlight(str, lang) {
		if (lang && hljs.getLanguage(lang)) {
			try {
				return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`
			} catch { /* fallthrough */ }
		}
		return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
	},
}).use(katexPlugin)

export function renderMarkdown(content: string): string {
	const html = md.render(content)
	// 只在浏览器环境做 DOMPurify（SSR 下 DOMPurify 需要 jsdom，A 阶段渲染在 server 侧时也要做，见备注）
	if (typeof window === 'undefined') {
		// Server 侧：DOMPurify 需要 jsdom，这里简化为信任 markdown-it html:false 已提供的基础安全
		return html
	}
	return DOMPurify.sanitize(html)
}
```

> 备注：服务端渲染时因 `html: false`，markdown-it 本身已不会输出原始 HTML 标签。Task 15 的 `/preview` 接口在服务端调用 `renderMarkdown()` 返回 HTML 字符串，前端 v-html 前再走一次 `DOMPurify.sanitize()`（前端环境可用）。双重保险。

- [ ] **Step 2: 样式引入**

`assets/styles/main.scss` 在合适位置加：
```scss
@import 'highlight.js/styles/github.css';
@import 'katex/dist/katex.min.css';
```

- [ ] **Step 3: 验证**

临时脚本或 Vue 组件测试 `renderMarkdown('# 标题\n\n```js\nconst a=1\n```')` 返回预期 HTML。

**Commit message:**
```
feat(markdown): 新增 markdown-it 渲染管线 + 代码高亮 + LaTeX
```

---

## 阶段 2：数据层（Task 6-9）

### Task 6: Zod Schema（document + approval-runtime）

**Files:**
- Create: `server/schemas/document.ts`
- Create: `server/schemas/approval-runtime.ts`

- [ ] **Step 1: `server/schemas/document.ts`**

```ts
import { z } from 'zod'

/** GET /api/documents 列表查询 */
export const documentListQuerySchema = z.object({
	groupId: z.coerce.number().int().positive(),
	status: z.coerce.number().int().min(1).max(6).optional().default(4),
	keyword: z.string().trim().max(100).optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>

/** POST /api/documents/upload 首次上传（multipart 不走 Zod body，用 Zod 校验 form 字段） */
export const documentUploadFieldsSchema = z.object({
	groupId: z.coerce.number().int().positive(),
	title: z.string().trim().min(1).max(255).optional(),
	changeNote: z.string().trim().max(500).optional(),
})
export type DocumentUploadFields = z.infer<typeof documentUploadFieldsSchema>

/** POST /api/documents/:id/versions 更新版本（同 upload 但无 groupId/title） */
export const documentVersionUploadFieldsSchema = z.object({
	changeNote: z.string().trim().max(500).optional(),
})

/** GET /api/documents/:id/download query */
export const documentDownloadQuerySchema = z.object({
	versionId: z.coerce.number().int().positive().optional(),
})

/** GET /api/documents/:id/preview query */
export const documentPreviewQuerySchema = z.object({
	versionId: z.coerce.number().int().positive().optional(),
})
```

- [ ] **Step 2: `server/schemas/approval-runtime.ts`**

```ts
import { z } from 'zod'

/** POST /api/approvals 起审批 */
export const approvalSubmitSchema = z.object({
	documentId: z.number().int().positive(),
	versionId: z.number().int().positive(),
})
export type ApprovalSubmitBody = z.infer<typeof approvalSubmitSchema>

/** POST /api/approvals/:id/approve 通过 */
export const approvalApproveSchema = z.object({
	comment: z.string().trim().max(500).optional(),
})

/** POST /api/approvals/:id/reject 驳回（comment 必填） */
export const approvalRejectSchema = z.object({
	comment: z.string().trim().min(1, '驳回意见不能为空').max(500),
})
export type ApprovalRejectBody = z.infer<typeof approvalRejectSchema>
```

**Commit message:**
```
feat(schema): 新增文档 + 审批运行时 Zod 校验
```

---

### Task 7: 错误码追加

**Files:**
- Modify: `server/constants/error-codes.ts`

- [ ] **Step 1: 追加 13 个错误码**

追加到文件末尾：
```ts
// ─── 文档 ───
export const DOCUMENT_NOT_FOUND       = 'DOCUMENT_NOT_FOUND'
export const DOCUMENT_STATUS_INVALID  = 'DOCUMENT_STATUS_INVALID'
export const DOCUMENT_DUPLICATE_NAME  = 'DOCUMENT_DUPLICATE_NAME'
export const VERSION_NOT_FOUND        = 'VERSION_NOT_FOUND'

// ─── 文件 ───
export const FILE_TOO_LARGE           = 'FILE_TOO_LARGE'
export const FILE_FORMAT_UNSUPPORTED  = 'FILE_FORMAT_UNSUPPORTED'
export const FILE_CONVERT_FAILED      = 'FILE_CONVERT_FAILED'

// ─── 存储 ───
export const STORAGE_PUT_FAILED       = 'STORAGE_PUT_FAILED'
export const STORAGE_GET_FAILED       = 'STORAGE_GET_FAILED'

// ─── 审批运行时 ───
export const APPROVAL_NOT_APPROVER    = 'APPROVAL_NOT_APPROVER'
export const APPROVAL_ALREADY_ACTED   = 'APPROVAL_ALREADY_ACTED'
export const APPROVAL_REASON_REQUIRED = 'APPROVAL_REASON_REQUIRED'
export const APPROVAL_NO_TEMPLATE     = 'APPROVAL_NO_TEMPLATE'
```

**Commit message:**
```
feat: 新增 13 个错误码（文档 / 文件 / 存储 / 审批运行时）
```

---

### Task 8: 审批路径判定工具

**Files:**
- Create: `server/utils/approval-router.ts`

- [ ] **Step 1: 实现 `resolveApprovalPath`**

按 Spec §5.2 实现。关键点：
- 查询启用的 template
- 过滤出非提交人节点
- 空 → direct_publish
- 非空 → 返回完整节点列表（含提交人节点，由 approve handler 在遇到时自动跳过）

```ts
import { prisma } from '~/server/utils/prisma'

export type ApprovalPath =
	| { path: 'direct_publish' }
	| { path: 'approval', templateId: bigint, nodes: Array<{ order: number, approverId: bigint }> }

export async function resolveApprovalPath(params: {
	groupId: bigint
	submitterId: bigint
}): Promise<ApprovalPath> {
	const tpl = await prisma.doc_approval_templates.findFirst({
		where: { group_id: params.groupId, enabled: true, deleted_at: null },
		select: { id: true },
	})
	if (!tpl) return { path: 'direct_publish' }

	const nodes = await prisma.doc_approval_template_nodes.findMany({
		where: { template_id: tpl.id },
		orderBy: { order_no: 'asc' },
		select: { order_no: true, approver_user_id: true },
	})
	if (nodes.length === 0) return { path: 'direct_publish' }

	const nonSelf = nodes.filter(n => n.approver_user_id !== params.submitterId)
	if (nonSelf.length === 0) return { path: 'direct_publish' }

	return {
		path: 'approval',
		templateId: tpl.id,
		nodes: nodes.map(n => ({ order: n.order_no, approverId: n.approver_user_id })),
	}
}
```

**Commit message:**
```
feat: 新增审批路径判定工具（direct_publish / approval 二选一）
```

---

### Task 9: 前端类型 + API 封装（先骨架）

**Files:**
- Create: `types/document.ts`
- Create: `api/documents.ts`

- [ ] **Step 1: `types/document.ts`**

```ts
export interface DocumentListItem {
	id: number
	title: string
	ext: string
	status: 1|2|3|4|5|6
	versionNo: string | null
	fileSize: number | null
	ownerId: number
	ownerName: string
	updatedAt: number
	downloadCount: number
	isPinned: boolean
	isFavorited: boolean
}

export interface DocumentDetail {
	id: number
	title: string
	ext: string
	status: 1|2|3|4|5|6
	groupId: number | null
	groupName: string | null
	ownerId: number
	ownerName: string
	currentVersion: {
		id: number
		versionNo: string
		fileSize: number
		mimeType: string | null
		uploadedByName: string
		publishedAt: number | null
	} | null
	createdAt: number
	updatedAt: number
	downloadCount: number
	isPinned: boolean
	isFavorited: boolean
	sourceDocId: number | null
	canEdit: boolean
	canRemove: boolean
	canSubmitApproval: boolean
	canUploadVersion: boolean
}

export interface UploadResult {
	documentId: number
	versionId: number
	path: 'direct_publish' | 'approval'
	approvalInstanceId: number | null
}

export interface DocumentListResponse {
	list: DocumentListItem[]
	total: number
	page: number
	pageSize: number
	reviewingCount: number
}

export interface PreviewResponse {
	html: string
	versionNo: string
	mimeType: string
}
```

- [ ] **Step 2: `api/documents.ts` 骨架**

```ts
import type { ApiResult } from '~/types/api'
import type { DocumentListResponse, DocumentDetail, UploadResult, PreviewResponse } from '~/types/document'
import type { DocumentListQuery } from '~/server/schemas/document'

export function apiGetDocuments(params: DocumentListQuery) {
	return useAuthFetch<ApiResult<DocumentListResponse>>('/api/documents', { query: params })
}

export function apiGetDocument(id: number) {
	return useAuthFetch<ApiResult<DocumentDetail>>(`/api/documents/${id}`)
}

export function apiUploadDocument(formData: FormData) {
	return useAuthFetch<ApiResult<UploadResult>>('/api/documents/upload', {
		method: 'POST',
		body: formData,
	})
}

export function apiUploadNewVersion(id: number, formData: FormData) {
	return useAuthFetch<ApiResult<UploadResult>>(`/api/documents/${id}/versions`, {
		method: 'POST',
		body: formData,
	})
}

export function apiRemoveDocument(id: number) {
	return useAuthFetch<ApiResult<{ id: number }>>(`/api/documents/${id}/remove`, {
		method: 'PUT',
	})
}

export function apiPreviewDocument(id: number, versionId?: number) {
	return useAuthFetch<ApiResult<PreviewResponse>>(`/api/documents/${id}/preview`, {
		query: versionId ? { versionId } : {},
	})
}

export function apiDownloadDocumentUrl(id: number, versionId?: number) {
	// 返回 URL 给 <a href> 或 window.location
	const q = versionId ? `?versionId=${versionId}` : ''
	return `/api/documents/${id}/download${q}`
}
```

**Commit message:**
```
feat(types+api): 文档类型定义 + 前端 API 封装骨架
```

---

## 阶段 3：后端 API 主链路（Task 10-12，最重要，先跑通上传 → 审批 → 发布链）

### Task 10: POST /api/documents/upload（首次上传 + 路径判定 + 审批编排）

**Files:**
- Create: `server/api/documents/upload.post.ts`

- [ ] **Step 1: 骨架**

```ts
import { readMultipartFormData } from 'h3'
import { createHash } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { storage, buildStorageKey } from '~/server/utils/storage'
import { converter } from '~/server/utils/format-converter'
import { documentUploadFieldsSchema } from '~/server/schemas/document'
import { resolveApprovalPath } from '~/server/utils/approval-router'
import { generateSnowflakeId } from '~/server/utils/snowflake'
import {
	DOCUMENT_DUPLICATE_NAME, FILE_TOO_LARGE, FILE_FORMAT_UNSUPPORTED,
	STORAGE_PUT_FAILED, INVALID_PARAMS,
} from '~/server/constants/error-codes'
import { createNotification } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'
import { writeLog } from '~/server/utils/operation-log'
import { LOG_ACTIONS } from '~/server/constants/log-actions'
import type { UploadResult } from '~/types/document'

const MAX_SIZE = 50 * 1024 * 1024  // 50MB

export default defineEventHandler(async (event) => {
	await requirePermission(event, 'doc:create')
	const user = event.context.user!

	// 1. 解析 multipart
	const parts = await readMultipartFormData(event)
	if (!parts) return fail(event, 400, INVALID_PARAMS, '请求体非法')
	const fields: Record<string, string> = {}
	let fileBuf: Buffer | null = null
	let originalFilename = ''
	for (const p of parts) {
		if (p.name === 'file' && p.filename) {
			fileBuf = p.data
			originalFilename = p.filename
		} else if (p.name) {
			fields[p.name] = p.data.toString('utf-8')
		}
	}
	if (!fileBuf) return fail(event, 400, INVALID_PARAMS, '缺少文件')

	// 2. Zod 校验 fields
	const parsed = documentUploadFieldsSchema.safeParse(fields)
	if (!parsed.success) return fail(event, 400, INVALID_PARAMS, parsed.error.issues[0].message)
	const { groupId, title: titleInput, changeNote } = parsed.data

	// 3. 校验大小
	if (fileBuf.length > MAX_SIZE) return fail(event, 413, FILE_TOO_LARGE, '文件超过 50MB 限制')

	// 4. 校验格式 + 格式转换（A 阶段只接受 .md）
	const ext = originalFilename.split('.').pop()?.toLowerCase() || ''
	let contentBuf = fileBuf
	let finalExt = ext
	if (ext !== 'md') {
		if (!converter.canConvert(ext)) {
			return fail(event, 400, FILE_FORMAT_UNSUPPORTED, '当前仅支持 Markdown (.md)，其他格式转换能力建设中')
		}
		// B 阶段：const { content } = await converter.convert({ buffer: fileBuf, ext, filename: originalFilename })
		// contentBuf = Buffer.from(content, 'utf-8'); finalExt = 'md'
	}

	// 5. 标题
	const title = titleInput || originalFilename.replace(/\.[^.]+$/, '')

	// 6. 校验组内同名（status IN 3,4）
	const dup = await prisma.doc_documents.findFirst({
		where: {
			group_id: BigInt(groupId),
			title,
			deleted_at: null,
			status: { in: [3, 4] },
		},
		select: { id: true },
	})
	if (dup) return fail(event, 409, DOCUMENT_DUPLICATE_NAME, '该组已存在同名文件，请使用「更新上传」')

	// 7. 生成 ID + checksum
	const documentId = generateSnowflakeId()
	const versionId = generateSnowflakeId()
	const checksum = createHash('sha256').update(contentBuf).digest('hex')
	const storageKey = buildStorageKey({ groupId, documentId, versionNo: 'v1.0', checksum, ext: finalExt })

	// 8. 存 MinIO
	try {
		await storage.putObject(storageKey, contentBuf, { mimeType: 'text/markdown' })
	} catch (e) {
		console.error('[upload] storage.putObject failed', e)
		return fail(event, 500, STORAGE_PUT_FAILED, '文件存储失败')
	}

	// 9. 判定路径
	const routing = await resolveApprovalPath({ groupId: BigInt(groupId), submitterId: BigInt(user.id) })

	// 10. 事务写入 DB
	const result = await prisma.$transaction(async (tx) => {
		await tx.doc_documents.create({
			data: {
				id: documentId,
				group_id: BigInt(groupId),
				owner_user_id: BigInt(user.id),
				title,
				ext: finalExt,
				status: routing.path === 'direct_publish' ? 4 : 3,
				current_version_id: routing.path === 'direct_publish' ? versionId : null,
				created_by: BigInt(user.id),
				updated_by: BigInt(user.id),
			},
		})
		await tx.doc_document_versions.create({
			data: {
				id: versionId,
				document_id: documentId,
				version_no: 'v1.0',
				storage_key: storageKey,
				storage_bucket: storage.bucket,
				file_size: BigInt(contentBuf.length),
				mime_type: 'text/markdown',
				checksum,
				source_type: 1,
				change_note: changeNote || null,
				uploaded_by: BigInt(user.id),
				published_at: routing.path === 'direct_publish' ? new Date() : null,
			},
		})

		let approvalInstanceId: bigint | null = null
		if (routing.path === 'approval') {
			approvalInstanceId = generateSnowflakeId()
			await tx.doc_approval_instances.create({
				data: {
					id: approvalInstanceId,
					biz_type: 1,
					biz_id: versionId,
					document_id: documentId,
					template_id: routing.templateId,
					mode: 1,
					status: 2,
					initiator_user_id: BigInt(user.id),
					current_node_order: 1,
				},
			})
			for (const n of routing.nodes) {
				await tx.doc_approval_instance_nodes.create({
					data: {
						id: generateSnowflakeId(),
						instance_id: approvalInstanceId,
						node_order: n.order,
						approver_user_id: n.approverId,
						action_status: 1,
					},
				})
			}
		}

		return { approvalInstanceId }
	})

	// 11. 日志 + 通知（事务外）
	await writeLog({
		actorUserId: user.id,
		action: LOG_ACTIONS.DOC_UPLOAD,
		targetType: 'document',
		targetId: Number(documentId),
		groupId,
		documentId: Number(documentId),
		detail: { desc: `上传文件「${title}」`, versionNo: 'v1.0' },
	})

	if (routing.path === 'direct_publish') {
		await writeLog({
			actorUserId: user.id,
			action: LOG_ACTIONS.DOC_PUBLISH,
			targetType: 'document',
			targetId: Number(documentId),
			groupId,
			documentId: Number(documentId),
			detail: { desc: `文件「${title}」发布 v1.0` },
		})
		// 发送 M8 给组内可编辑 + 管理员（去重，不含提交人）
		await notifyM8(groupId, documentId, title, 'v1.0', user.id)
	} else {
		await writeLog({
			actorUserId: user.id,
			action: LOG_ACTIONS.APPROVAL_SUBMIT,
			targetType: 'approval',
			targetId: Number(result.approvalInstanceId!),
			groupId,
			documentId: Number(documentId),
			detail: { desc: `提交文件「${title}」审批` },
		})
		// 发送 M1 给第一级非 self 审批人
		const firstNode = routing.nodes.find(n => n.approverId !== BigInt(user.id))
		if (firstNode) {
			await createNotification(NOTIFICATION_TEMPLATES.M1.build({
				toUserId: firstNode.approverId,
				submitter: user.name || '',
				fileName: title,
				fileId: documentId,
			}))
		}
	}

	const payload: UploadResult = {
		documentId: Number(documentId),
		versionId: Number(versionId),
		path: routing.path,
		approvalInstanceId: result.approvalInstanceId ? Number(result.approvalInstanceId) : null,
	}
	return ok(payload, routing.path === 'direct_publish' ? '上传并发布成功' : '已提交审批')
})

/** 辅助：发送 M8 给组内可编辑 + 管理员（去重，不含提交人） */
async function notifyM8(groupId: number, documentId: bigint, title: string, versionNo: string, submitterId: number) {
	const members = await prisma.doc_group_members.findMany({
		where: {
			group_id: BigInt(groupId),
			permission: { in: [1, 2] },  // 管理员 / 可编辑
			user_id: { not: BigInt(submitterId) },
			deleted_at: null,
		},
		select: { user_id: true },
	})
	for (const m of members) {
		await createNotification(NOTIFICATION_TEMPLATES.M8.build({
			toUserId: m.user_id,
			fileName: title,
			fileId: documentId,
			version: versionNo,
		}))
	}
}
```

- [ ] **Step 2: 验证**

用 Postman/Thunder Client POST `/api/documents/upload` multipart，传 groupId + file（.md 小文件）：
- 组有审批模板（非 self）→ 返回 `path=approval` + approvalInstanceId；数据库文档 status=3，审批实例创建；审批人收到 M1
- 组无模板 → 返回 `path=direct_publish`；文档 status=4；组成员收到 M8
- 上传 .docx → 返回 `FILE_FORMAT_UNSUPPORTED`
- 上传 51MB → 返回 `FILE_TOO_LARGE`
- 同名上传 → 返回 `DOCUMENT_DUPLICATE_NAME`

**Commit message:**
```
feat(documents): 新增首次上传接口（含审批路径判定 + M1/M8 通知）
```

---

### Task 11: POST /api/documents/:id/versions（更新版本）

**Files:**
- Create: `server/api/documents/[id]/versions.post.ts`

- [ ] **Step 1: 实现**

逻辑同 Task 10，差异：
- 校验 `documentId` 文档存在 + status ∈ {4, 5} + 权限校验
- 版本号从 DB 查 MAX(version_no)，解析 `vX.Y` 后 Y++（v1.0 → v1.1；v1.9 → v1.10）
- **复用** Task 10 的核心逻辑（建议抽公共函数 `server/utils/document-upload.ts` 存储 + 事务 + 通知 + 日志）—— 但 A 阶段可以先复制粘贴，完工后再重构抽公共（避免卡在抽象设计上）

版本号解析：
```ts
function incrementVersion(latest: string): string {
	const m = latest.match(/^v(\d+)\.(\d+)$/)
	if (!m) return 'v1.0'
	return `v${m[1]}.${Number(m[2]) + 1}`
}
```

- [ ] **Step 2: 验证**

对 status=4 文档上传新版本 → v1.0 → v1.1
对 status=3 文档上传 → `DOCUMENT_STATUS_INVALID`

**Commit message:**
```
feat(documents): 新增更新版本接口（自动递增次版本号 Y++）
```

---

### Task 12: GET /api/documents（仓库文件列表）

**Files:**
- Create: `server/api/documents/index.get.ts`

- [ ] **Step 1: 实现**

使用 `$queryRaw` JOIN 查 title/ext/status/current_version_no/owner_name + LEFT JOIN pins/favorites。

```ts
const rows = await prisma.$queryRaw<Row[]>`
	SELECT
		d.id, d.title, d.ext, d.status, d.updated_at, d.download_count,
		d.owner_user_id, u.name AS owner_name,
		v.version_no, v.file_size,
		p.id IS NOT NULL AS is_pinned,
		f.id IS NOT NULL AS is_favorited
	FROM doc_documents d
	JOIN doc_users u ON u.id = d.owner_user_id
	LEFT JOIN doc_document_versions v ON v.id = d.current_version_id
	LEFT JOIN doc_document_pins p ON p.document_id = d.id AND p.group_id = ${BigInt(groupId)}
	LEFT JOIN doc_document_favorites f ON f.document_id = d.id AND f.user_id = ${BigInt(user.id)}
	WHERE d.group_id = ${BigInt(groupId)}
	  AND d.status = ${status}
	  AND d.deleted_at IS NULL
	  ${keyword ? Prisma.sql`AND d.title LIKE ${'%' + keyword + '%'}` : Prisma.empty}
	ORDER BY is_pinned DESC, d.updated_at DESC
	LIMIT ${pageSize} OFFSET ${offset}
`
const [{ cnt: total }] = await prisma.$queryRaw<[{ cnt: bigint }]>`
	SELECT COUNT(*) AS cnt FROM doc_documents d
	WHERE d.group_id = ${BigInt(groupId)} AND d.status = ${status} AND d.deleted_at IS NULL
	${keyword ? Prisma.sql`AND d.title LIKE ${'%' + keyword + '%'}` : Prisma.empty}
`
const [{ cnt: reviewingCount }] = await prisma.$queryRaw<[{ cnt: bigint }]>`
	SELECT COUNT(*) AS cnt FROM doc_documents
	WHERE group_id = ${BigInt(groupId)} AND status = 3 AND deleted_at IS NULL
`
```

- [ ] **Step 2: 验证**

seed 里 group_id=40004 有已发布文档，调用后返回非空列表。

**Commit message:**
```
feat(documents): 新增文件列表接口（分页 + 置顶优先 + 审批中提示计数）
```

---

## 阶段 3（续）：剩余文档接口（Task 13-18）

### Task 13: GET /api/documents/:id（详情）

**Files:**
- Create: `server/api/documents/[id]/index.get.ts`

- [ ] **Step 1: 实现**

单次 JOIN 查文档 + 当前版本 + 组名 + owner 名 + 当前用户的 pin/favorite/权限标志。

**Commit message:**
```
feat(documents): 新增文件详情接口
```

---

### Task 14: GET /api/documents/:id/download（下载）

**Files:**
- Create: `server/api/documents/[id]/download.get.ts`

- [ ] **Step 1: 实现**

```ts
const preUrl = await storage.presignGetUrl(v.storage_key, 600)
// 异步更新 download_count，不阻塞
prisma.doc_documents.update({ where: { id: doc.id }, data: { download_count: { increment: 1 } } }).catch(() => {})
writeLog({ ... LOG_ACTIONS.DOC_DOWNLOAD })
return sendRedirect(event, preUrl, 302)
```

**Commit message:**
```
feat(documents): 新增下载接口（presigned URL 302 重定向）
```

---

### Task 15: GET /api/documents/:id/preview（预览渲染）

**Files:**
- Create: `server/api/documents/[id]/preview.get.ts`
- Modify: `utils/markdown.ts`（server 侧安全 sanitize 兼容）

- [ ] **Step 1: 实现**

```ts
// 1. 查 version → storage_key
// 2. Redis 缓存 preview:{versionId}，命中直接返回
// 3. storage.getObject(key) → toString('utf-8') → renderMarkdown → 返回 HTML + 写缓存（TTL 300s）
```

MD 以外 mimeType 直接返回 `{ html: '<p>暂不支持预览此格式</p>', ... }`

**Commit message:**
```
feat(documents): 新增预览接口（服务端 MD 渲染 + Redis 5min 缓存）
```

---

### Task 16: PUT /api/documents/:id/remove（移除）

**Files:**
- Create: `server/api/documents/[id]/remove.put.ts`

- [ ] **Step 1: 实现**

```ts
await requirePermission(event, 'doc:remove')
// 校验 status=4
// 校验组管理员（复用 server/utils/group-permission.ts）
// UPDATE status=1（保留 group_id/current_version_id 不动）
// M9 通知 owner
// 日志 DOC_REMOVE
```

**Commit message:**
```
feat(documents): 新增移除接口（退回个人中心 + M9 通知）
```

---

### Task 17: GET /api/documents/:id/versions 去 mock

**Files:**
- Modify: `server/api/documents/[id]/versions.get.ts`

- [ ] **Step 1: 替换 mock 块**

按 Spec §7.6 的 SQL 实现。保留现有响应结构（前端 file/[id].vue 的 VersionSidebar 已对接此结构）。

**Commit message:**
```
fix(documents): 版本列表接口接入真实数据（去 mock）
```

---

### Task 18: POST /api/version/compare 接真实存储

**Files:**
- Modify: `server/api/version/compare.post.ts`

- [ ] **Step 1: 替换 mock 块**

按文件头注释里的 TODO 完成：从 DB 查 version → `storage.getObject()` → `extractText()` → `computeLineDiff()` → `renderDiffHtml()`

**Commit message:**
```
fix(version): 版本对比接口接入真实存储（去 mock）
```

---

## 阶段 4：审批运行时（Task 19-21）

### Task 19: POST /api/approvals（起审批）

**Files:**
- Create: `server/api/approvals/index.post.ts`

- [ ] **Step 1: 实现**

```ts
// body: { documentId, versionId }
// 校验文档 owner=self + status ∈ {1, 5}
// 校验 version 属于该文档且未删除
// 调 resolveApprovalPath + 事务（同 Task 10 的事务部分，复用！）
// direct_publish：文档 status=4, current_version_id=versionId, version.published_at=NOW
// approval：文档 status=3, 创建 instance + nodes
// 日志 APPROVAL_SUBMIT（+ DOC_PUBLISH 若直发）
// M1（若 approval）/ M8（若直发布）
```

**Commit message:**
```
feat(approvals): 新增起审批接口（兼直发布分支）
```

---

### Task 20: POST /api/approvals/:id/approve 和 /reject

**Files:**
- Create: `server/api/approvals/[id]/approve.post.ts`
- Create: `server/api/approvals/[id]/reject.post.ts`

- [ ] **Step 1: approve.post.ts**

```ts
// 1. 查 instance（select id, status, initiator_user_id, document_id, current_node_order, biz_id）
// 2. 校验 instance.status=2 AND 当前节点 approver_user_id=self AND action_status=1
// 3. 事务：
//    a. UPDATE 当前节点 action_status=2 + action_comment + action_at
//    b. 查下一节点，循环：如下一节点 approver_user_id = initiator_user_id，自动 action_status=2 + comment='提交人自审自动通过'，继续下一个
//    c. 若还有未处理节点（approver 非 self）：UPDATE instance.current_node_order = nextOrder
//    d. 若无未处理节点（全部 approved）：
//       - UPDATE instance status=3 + finished_at
//       - UPDATE 文档 status=4, current_version_id = instance.biz_id
//       - UPDATE version published_at = NOW
// 4. 日志 APPROVAL_PASS（若最后一级再发 DOC_PUBLISH）
// 5. 通知：
//    - 最后一级：M3 给 initiator + M8 给组内可编辑+管理员
//    - 中间级：M2 给下一级新 approver
```

- [ ] **Step 2: reject.post.ts**

```ts
// 1. 同 approve 校验
// 2. comment 必填（Zod 已校验）
// 3. UPDATE 节点 action_status=3, UPDATE instance status=4, UPDATE 文档 status=5
// 4. 日志 APPROVAL_REJECT
// 5. M4 通知 initiator（reason 存 content）
```

- [ ] **Step 3: 验证**

- 创建 N 级审批链，依次 approve 直至最后一级，检查 status 流转和通知
- 中途 reject，检查文档转 5，提交人收 M4

**Commit message:**
```
feat(approvals): 新增通过 / 驳回审批接口（含多级链流转 + 提交人自审自动跳过）
```

---

### Task 21: 撤回补发 M7

**Files:**
- Modify: `server/api/approvals/[id]/withdraw.post.ts`

- [ ] **Step 1: 追加 M7 通知**

在现有 handler 的"UPDATE status=WITHDRAWN"之后追加：
```ts
// 查所有已处理过的节点的审批人（去重，非 initiator）
const handledApprovers = await prisma.doc_approval_instance_nodes.findMany({
	where: {
		instance_id: instanceId,
		action_status: { in: [2, 3] },
	},
	select: { approver_user_id: true },
	distinct: ['approver_user_id'],
})
for (const a of handledApprovers) {
	if (a.approver_user_id !== BigInt(user.id)) {
		await createNotification(NOTIFICATION_TEMPLATES.M7.build({
			toUserId: a.approver_user_id,
			submitter: user.name || '',
			fileName: inst.doc_documents?.title ?? '',
			fileId: inst.document_id,
		}))
	}
}
```

**Commit message:**
```
feat(approvals): 撤回审批时补发 M7 通知已参与审批人
```

---

## 阶段 5：前端接入（Task 22-27）

### Task 22: 前端 API 补齐 + approvals 追加

**Files:**
- Modify: `api/approvals.ts`

- [ ] **Step 1: 追加**

```ts
import type { ApprovalSubmitBody, ApprovalRejectBody } from '~/server/schemas/approval-runtime'

export function apiSubmitApproval(body: ApprovalSubmitBody) {
	return useAuthFetch<ApiResult<{ approvalInstanceId: number, path: 'direct_publish' | 'approval' }>>('/api/approvals', {
		method: 'POST', body,
	})
}

export function apiApproveApproval(id: number, body: { comment?: string }) {
	return useAuthFetch<ApiResult<{ id: number, status: 'reviewing' | 'approved' }>>(`/api/approvals/${id}/approve`, {
		method: 'POST', body,
	})
}

export function apiRejectApproval(id: number, body: ApprovalRejectBody) {
	return useAuthFetch<ApiResult<{ id: number, status: 'rejected' }>>(`/api/approvals/${id}/reject`, {
		method: 'POST', body,
	})
}
```

**Commit message:**
```
feat(api): 前端补齐文档 + 审批运行时 API 封装
```

---

### Task 23: components/UploadFileModal.vue

**Files:**
- Create: `components/UploadFileModal.vue`

- [ ] **Step 1: 实现**

按 Spec §9.3 的布局。使用已有 `Modal.vue` 基础组件。

- `mode` 双单选卡片（首次 / 更新）
- 首次：`<el-upload :accept="'.md'" drag>` + changeNote 输入
- 更新：`<el-select v-model="targetDocumentId">`（拉 `/api/documents?groupId=xx&status=4` 列表）+ `<el-upload>` + changeNote
- 上传进度条
- 提交时构造 FormData，调 `apiUploadDocument` 或 `apiUploadNewVersion`
- 成功后 emit success 事件 + toast 根据 `path=direct_publish/approval` 区分文案

**Commit message:**
```
feat(components): 新增 UploadFileModal 上传弹窗（首次 / 更新 双模式）
```

---

### Task 24: components/ApprovalDrawer.vue

**Files:**
- Create: `components/ApprovalDrawer.vue`

- [ ] **Step 1: 实现**

按 Spec §9.4 的布局：
- 文件信息卡
- 审批链可视化（可先用简化 step bar：圆点 + 连线，不依赖已有 ApprovalChain 组件，A 阶段自绘）
- 变更摘要：调 `/api/version/compare` 显示
- 意见 textarea
- [通过] [驳回] 按钮（驳回必填 comment，前端实时校验）

**Commit message:**
```
feat(components): 新增 ApprovalDrawer 审批抽屉
```

---

### Task 25: pages/docs/repo/[id].vue（重写）

**Files:**
- Modify: `pages/docs/repo/[id].vue`

- [ ] **Step 1: 重写**

按 Spec §9.1 的结构，用 `useListPage` + `DataTable fill-height`。

**Commit message:**
```
feat(repo): 重写仓库详情页（接入真实文件列表 + 上传弹窗 + 审批中提示）
```

---

### Task 26: pages/docs/file/[id].vue（接真实数据）

**Files:**
- Modify: `pages/docs/file/[id].vue`

- [ ] **Step 1: 改造**

- 去掉 mock preview content
- onMounted 调 `apiGetDocument(id)` 初始化 fileName/fileType/status
- 调 `apiPreviewDocument(id)` 取 HTML，赋值给 DocPreview 组件（DocPreview 如果还是把 content 当 md 字符串传，改为直接接受已渲染 HTML，或新增 `html` prop）
- 版本列表：保持现有调用（Task 17 已接真实数据）
- 顶部按钮改造：
  - 提交审批（status ∈ {1,5} + owner=self）→ 调 `apiSubmitApproval`
  - 上传新版本（status=4）→ 打开 `UploadFileModal(mode='update', lockedDocumentId=id)`
  - 移除（status=4 + 组管理员）→ confirm → `apiRemoveDocument`
- 下载：window.location.href = apiDownloadDocumentUrl(...)

**Commit message:**
```
feat(file): 文件详情页接入真实数据（预览/版本/下载/提交审批/移除）
```

---

### Task 27: pages/approvals.vue 接入审批抽屉

**Files:**
- Modify: `pages/approvals.vue`

- [ ] **Step 1: 改造**

- "待我审批" tab 的卡片点击 → 打开 `ApprovalDrawer`
- 抽屉内审批完成（通过/驳回）后 refresh 列表
- "我发起的 / 我已处理" tab 卡片点击暂跳到文件详情页（A 阶段保持简单）

**Commit message:**
```
feat(approvals): 审批中心接入 ApprovalDrawer（待我审批入口）
```

---

## 阶段 6：文档同步 + 联调（Task 28-31）

### Task 28: 更新 docs/api-auth-design.md

**Files:**
- Modify: `docs/api-auth-design.md`

- [ ] **Step 1: 接口总览表追加 10 行**

包括：GET/POST /api/documents、POST /api/documents/upload、POST /api/documents/:id/versions、GET/PUT /api/documents/:id/*、POST /api/approvals、POST /api/approvals/:id/approve、POST /api/approvals/:id/reject。

- [ ] **Step 2: 详细说明章节追加**

每个接口含路径 / 权限 / 入参 / 出参样例 / 业务规则。

**Commit message:**
```
docs: 更新 api-auth-design.md 登记文档核心 10 个新接口
```

---

### Task 29: 更新 docs/feature-gap-checklist.md

**Files:**
- Modify: `docs/feature-gap-checklist.md`

- [ ] **Step 1: M1/M3/M4/M7/M8/M9 打 ✅**

```
| M1 | approval-runtime | 文件提交审批 — 通知当前审批人 | ✅ 2026-04-20 |
| M3 | approval-runtime | 最后一级通过 — 通知提交人 | ✅ 2026-04-20 |
| M4 | approval-runtime | 任一级驳回 — 通知提交人 | ✅ 2026-04-20 |
| M7 | approval-runtime | 提交人撤回 — 通知已参与审批人 | ✅ 2026-04-20 |
| M8 | document-lifecycle | 新版本发布 — 通知归属人+编辑成员+管理员 | ✅ 2026-04-20 |
| M9 | document-lifecycle | 管理员从组移除文件 — 通知归属人 | ✅ 2026-04-20 |
```

M2 暂不打（本次有代码但边界情况未完全验证），等 Task 31 联调通过后再补。

- [ ] **Step 2: 2.5 仓库详情 / 2.7 文件详情章节勾选**

标记"文件列表工具栏 ✅"、"批量操作 部分 ✅"等。

**Commit message:**
```
docs: feature-gap-checklist 标记 M1/M3/M4/M7/M8/M9 完成 + 仓库/文件详情进度
```

---

### Task 30: 更新 docs/dev-progress.md

**Files:**
- Modify: `docs/dev-progress.md`

- [ ] **Step 1: 追加 2026-04-20 条目**

包含：基础设施（MinIO / storage / format-converter / markdown 渲染）、后端 10 套 API、前端 2 弹窗 + 2 页面重写/接真实、通知触发点 M1/M3/M4/M7/M8/M9 接入。

**Commit message:**
```
docs: dev-progress 追加 2026-04-20 文档核心 A 阶段条目
```

---

### Task 31: 端到端联调

**Files:** （无代码修改，纯验证）

- [ ] **Step 1: 清库重建（可选）**

```bash
docker compose down -v
docker compose up -d
# 等 db/redis/minio 健康后
```

在 MinIO 控制台创建 bucket `docflow-files`。

- [ ] **Step 2: 核心用例跑通**

按 Spec §14 的 20 个用例逐一验证。记录发现的问题并修。

- [ ] **Step 3: 关键联动验证**

- 上传 .md → 审批人收到 M1（通知中心铃铛红点）
- 审批通过 → 提交人收到 M3、组成员收到 M8
- 审批驳回 → 提交人收到 M4
- 撤回 → 已参与审批人收到 M7
- 移除 → 归属人收到 M9
- 操作日志页能看到 DOC_UPLOAD / APPROVAL_SUBMIT / APPROVAL_PASS / DOC_PUBLISH / DOC_REMOVE 等条目
- 审批中心"待我审批" tab 出现新实例
- 文件详情页预览真实 MD 内容 + 版本列表
- 下载跳转 presigned URL 成功下载原文件

- [ ] **Step 4: 发 PR / 合入主干**

以功能块打包提交（按 Task 分组），或最后合并为一个大 PR 详述。

**Commit message (final):**
```
feat: 文档核心 A 阶段完整联通（上传/版本/审批/发布/预览/下载/移除）
```

---

## 总览

**共 31 个 Task**，预估工作量：

| 阶段 | Task 数 | 时长 |
|---|---|---|
| 1 基础设施 | 5 | 4-6 小时 |
| 2 数据层 | 4 | 2-3 小时 |
| 3 后端 API 主链路 | 9 | 8-10 小时 |
| 4 审批运行时 | 3 | 4-5 小时 |
| 5 前端 | 6 | 8-10 小时 |
| 6 文档 + 联调 | 4 | 3-4 小时 |

**总计约 29-38 小时**，密集开发 **3-5 天**。

---

## 风险与回退

| 风险 | 缓解 |
|---|---|
| MinIO 启动失败 | 回退 A1 本地磁盘：改 `storage/minio.ts` 为 `storage/fs.ts` 实现（fs.promises 读写 `./storage/{key}`），接口不变 |
| @aws-sdk 版本兼容性 | 锁定 `^3.x`；若首次调用报错，查看 forcePathStyle 是否开启 |
| markdown-it 与 Nuxt SSR 冲突 | renderMarkdown 函数不在 SSR 时调用（preview 接口服务端渲染 HTML 字符串，前端只 `v-html`）|
| 提交人自审跳过导致流程异常 | Task 20 单测多级链覆盖（self 在首/中/尾三种位置）|
| 事务超时（大文件上传）| 先写 storage 后写 DB，DB 事务只走小 INSERT |

---

## 跟 Spec 的对应关系

| Spec 章节 | 对应 Task |
|---|---|
| §6.1 MinIO | Task 2 |
| §6.3 storage | Task 3 |
| §6.4 format-converter | Task 4 |
| §6.5 Markdown 渲染 | Task 5 |
| §7.1 错误码 | Task 7 |
| §7.2-7.8 文档 API | Task 12-16 |
| §7.4 上传 | Task 10 |
| §7.5 更新版本 | Task 11 |
| §7.6 版本列表去 mock | Task 17 |
| §7.7 下载 | Task 14 |
| §7.9-7.11 审批运行时 | Task 19-20 |
| §7.12 撤回 M7 | Task 21 |
| §7.13 预览 | Task 15 |
| §9.1 repo 页 | Task 25 |
| §9.2 file 页 | Task 26 |
| §9.3 UploadFileModal | Task 23 |
| §9.4 ApprovalDrawer | Task 24 |
| §14 测试 | Task 31 |
