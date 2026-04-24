# 文档管理核心（A 阶段）— 设计文档

> 日期：2026-04-20
> 范围：A 阶段 — **前后端联通**文档核心链路（上传 → 版本 → 审批 → 发布 → 预览 → 下载 → 移除）+ 审批运行时最小子集 + 对象存储 MinIO 接入 + Markdown 预览管线
> 不在本次范围：在线编辑器（§6.3.5 独立模块，待框架选型）、多人协同（§6.3.7）、批注（§6.3.9）、评论（§6.3.4 底部 tab）、跨组移动、文档级权限、分享、格式转换实接（只留 stub 接口）

---

## 1. 功能概述

把 DocFlow 最核心的"文档生命周期"打通，让其他已实现的 A 阶段页面（审批中心、通知中心、操作日志、个人中心、回收站）开始消费**真实业务数据**，结束 Mock 阶段。

**用户主链路**：
```
上传 .md 文件到组 → 判定审批路径
  ├─ 审批人 = 提交人  → 自动通过 → 发布
  ├─ 审批开关 = 关    → 直接发布
  └─ 审批人 ≠ 提交人  → 起审批 [M1通知审批人] → 通过 [M3通知提交人+发布] / 驳回 [M4通知提交人]
                                                   ↓
已发布文档 → 查看详情（MD 预览 + 版本列表 + 下载）→ 上传新版本（递增版本号，重走审批）
                                                   ↓
管理员移除 → status=1（草稿，退回归属人个人中心）[M9通知归属人]
```

**PRD 对应**：
- §5.1 共享文档状态机
- §6.3.3 文件列表（上传弹窗、审批判定、异常处理）
- §6.3.4 文件详情（预览、版本记录、上传新版本、移除）
- §6.4 审批中心（起审批、通过、驳回，配合已存在的读端接口）
- §6.8.2 M1 / M3 / M4 / M7 / M8 / M9 通知触发点

**原型参考**：`docs/prototype-v21.0.html` 共享文档仓库详情页、文件详情页。

---

## 2. 范围边界

| 事项 | 本次（A 阶段） | 后续 |
|---|---|---|
| 对象存储 MinIO（docker + S3 SDK）| ✅ | — |
| 文件上传（首次 v1.0 / 更新 vX.Y）| ✅ 仅 `.md` | B 阶段：非 MD 走 format-converter 外部接口 |
| 文件列表（仓库详情页）| ✅ 已发布 + 审批中提示条 | — |
| 文件详情（预览 / 版本 / 下载）| ✅ 接真实数据 | — |
| 子组卡片（仓库详情页左上）| ✅ 只读展示 | B 阶段：操作菜单 |
| 组设置四 Tab（repo 页）| ❌ | B 阶段：接入已完成的 GroupSettingsModal |
| 审批运行时（起/通/驳）| ✅ M1/M3/M4/M7 | 超时催办（M5/M6）B 阶段 |
| 审批中心"提交审批"按钮 | ✅ 在文件详情页 | — |
| 审批抽屉（审批人视角）| ✅ 接入已有 `ApprovalDrawer.vue` | — |
| 移除文档（退回个人中心）| ✅ M9 | — |
| 编辑副本 / 新建草稿 / 编辑器入口 | ❌ 按钮 disable + 提示文案 | 编辑器独立模块 |
| 评论（§6.3.4 底部 tab）| ❌ | 独立模块（评论 API 已有 seed）|
| 批注（§6.3.9）| ❌ | 需编辑器前置 |
| 跨组移动 / 文档级权限 / 分享 / 置顶 / 收藏 | ❌ 全部按钮先隐藏 | 各自独立模块 |
| 飞书文档导入 | ❌ | 飞书集成独立模块 |
| 全屏预览器 / 版本对比 | ✅ 已存在的 `VersionCompareViewer` 接真实数据 | — |
| 回滚到历史版本 | ✅ 调 `/api/documents/:id/versions` POST（视为上传新版本）| — |
| 格式转换 | ❌ 只留 `FormatConverter` stub 接口 | B 阶段：实现 ExternalConverter（HTTP 外部接口）|
| 文件大小限制 50MB | ✅ | — |
| 同名文件检测 | ✅（按 PRD §6.3.3 "该组已存在同名文件"）| — |

---

## 3. 架构分层

```
┌─ pages/docs/repo/[id].vue（仓库详情页 · 重写）────────────┐
│  ├─ 子组卡片区（只读网格）                                 │
│  ├─ 审批中文件提示条（有 reviewing 文件时显示）            │
│  ├─ 操作栏：[上传文件] [导入飞书(disabled)]                │
│  └─ DataTable（文件名/版本/状态/上传者/更新时间/操作）     │
│     └─ 行操作：[详情] [···更多(下载/移除)]                 │
│           ↓                                                │
│  pages/docs/file/[id].vue（文件详情页 · 接真实数据）──────┤
│  ├─ 顶栏：返回 / [提交审批(草稿)] [上传新版本(已发布)]     │
│  │         [移除(已发布,管理员)]                           │
│  ├─ 文件信息卡（名称/类型/版本/状态）                      │
│  ├─ 预览区（DocPreview · MD 渲染 + 对比模式）              │
│  └─ VersionSidebar（版本列表 / 下载 / 回滚 / 对比 / 上传） │
│                                                            │
│  UploadFileModal.vue（新建）                              │
│  ├─ 首次上传：选文件 + change_note                         │
│  └─ 更新上传：选目标文件 + 选文件 + change_note            │
│                                                            │
│  ApprovalDrawer.vue（新建，审批抽屉）                     │
│  ├─ 文件信息 + 版本变更摘要（调 /api/version/compare）     │
│  ├─ 审批链可视化（横向节点）                               │
│  └─ 意见输入 + [通过] [驳回] 按钮                          │
└────────────────────────────────────────────────────────────┘
                         │
┌─ server/api/documents ─┴────────────────────────────────┐
│  GET    /api/documents                       列表       │
│  GET    /api/documents/:id                   详情       │
│  POST   /api/documents/upload                首次上传   │
│  POST   /api/documents/:id/versions          更新版本   │
│  GET    /api/documents/:id/versions          版本列表（替换 mock） │
│  GET    /api/documents/:id/download          下载       │
│  PUT    /api/documents/:id/remove            移除       │
└─────────────────────────────────────────────────────────┘
┌─ server/api/approvals ───────────────────────────────────┐
│  POST   /api/approvals                       发起审批   │
│  POST   /api/approvals/:id/approve           通过       │
│  POST   /api/approvals/:id/reject            驳回       │
└──────────────────────────────────────────────────────────┘
┌─ server/api/version ─────────────────────────────────────┐
│  POST   /api/version/compare                 已有，接真实 │
└──────────────────────────────────────────────────────────┘
                         │
┌─ server/utils ─────────┴─────────────────────────────────┐
│  storage/              S3 SDK 抽象（put/get/delete/url） │
│    ├─ types.ts         ObjectStorage 接口                │
│    ├─ minio.ts         MinIO 实现（默认）                │
│    └─ index.ts         单例导出                          │
│  format-converter/     格式转换占位                      │
│    ├─ types.ts         FormatConverter 接口              │
│    ├─ noop.ts          stub：只支持 .md                  │
│    └─ index.ts         单例导出                          │
│  extract.ts            已有 · 继续用                    │
│  diff.ts               已有 · 继续用                    │
│  notify.ts             已有 · M1/M3/M4/M7/M8/M9         │
│  operation-log.ts      已有 · LOG_ACTIONS.DOC_*/APPROVAL_│
└──────────────────────────────────────────────────────────┘
                         │
┌─ docker-compose.yml ───┴─────────────────────────────────┐
│  minio（新增）：S3 协议，9000/9001 端口                  │
│  db / redis / app（不改）                                │
└──────────────────────────────────────────────────────────┘
```

---

## 4. 数据层（复用，无 patch）

**核心表**：
- `doc_documents` — 主表，`status` 1草稿/2编辑中/3审批中/4已发布/5已驳回/6已删除
- `doc_document_versions` — 版本表，`storage_bucket`/`storage_key`/`checksum`/`version_no`(VARCHAR20)
- `doc_approval_instances` + `doc_approval_instance_nodes` — 审批实例 + 节点
- `doc_approval_templates` + `doc_approval_template_nodes` — 审批模板（组设置）

**不改结构**，所有字段已齐备（见 `docs/doc.sql:183-249`）。

**种子数据**（`docs/doc_seed.sql`）：
- 文档 50001（已发布·v1.0+v1.1）、50002（审批中·v1.0）、50003（草稿）、50004（编辑副本）+ 回收站 5 条
- 版本 51001-51009 均指向 `docflow-local` bucket，A 阶段**不需要把这些文件真实上传到 MinIO**（保留 mock storage_key 即可，下载时命中"文件不存在"的友好兜底 404，生产再补真实上传）

---

## 5. 状态机与路径判定

### 5.1 状态机（PRD §5.1 直译）

```
[空] ─ 上传文件 ─> 依审批判定路径：
    │
    ├── 审批人=提交人 OR 审批开关关闭 OR 组无审批模板
    │     └─> 直接发布（status=4, current_version_id=v.id, v.published_at=now）
    │         [写 operation_log: DOC_PUBLISH]
    │
    └── 审批人≠提交人 AND 审批开关打开 AND 组有模板
          └─> status=3 审批中
              创建 doc_approval_instances (status=2 审批中, current_node_order=1)
              创建 doc_approval_instance_nodes[...]
              [写 log: DOC_UPLOAD + APPROVAL_SUBMIT]
              [发送 M1 通知第一级审批人]
              │
              ├── 审批通过（最后一级）
              │     └─> 文档 status=4, current_version_id=v.id, v.published_at=now
              │         instance status=3, finished_at=now
              │         [写 log: APPROVAL_PASS + DOC_PUBLISH]
              │         [发送 M3 通知提交人]
              │         [发送 M8 通知组内可编辑成员 + 管理员]
              │
              ├── 审批通过（中间级）
              │     └─> instance.current_node_order++, 节点 action_status=2
              │         [写 log: APPROVAL_PASS]
              │         [发送 M2 通知下一级审批人]  ← 本次 A 阶段已定义模板，可顺便做
              │
              └── 审批驳回
                    └─> 文档 status=5, instance status=4, finished_at=now
                        节点 action_status=3, action_comment=reason
                        [写 log: APPROVAL_REJECT]
                        [发送 M4 通知提交人（reason → content）]

[已发布] ─ 上传新版本 ─> 同上路径（判定审批 / 直发布）
[已发布] ─ 管理员移除 ─> status=1 草稿（退回个人中心 + group_id 不改，owner 仍在个人中心看到）
                         [写 log: DOC_REMOVE]
                         [发送 M9 通知归属人]
[审批中] ─ 提交人撤回 ─> 走已有 /api/approvals/:id/withdraw（不动）
                         [发送 M7 通知已参与审批人]  ← 本次补做（现有 handler 未发）
```

### 5.2 审批路径判定算法

```ts
// server/utils/approval-router.ts（新建）
async function resolveApprovalPath(params: {
  documentId: bigint
  groupId: bigint
  versionId: bigint
  submitterId: bigint
}): Promise<
  | { path: 'direct_publish' }
  | { path: 'approval', templateId: bigint, nodes: Array<{ order: number, approverId: bigint }> }
> {
  // 1. 查组的启用模板（doc_approval_templates WHERE group_id=? AND enabled=1 AND deleted_at IS NULL）
  const tpl = await prisma.doc_approval_templates.findFirst(...)
  if (!tpl) return { path: 'direct_publish' }  // 无模板
  if (!tpl.enabled) return { path: 'direct_publish' }  // 开关关

  // 2. 查模板节点
  const nodes = await prisma.doc_approval_template_nodes.findMany({
    where: { template_id: tpl.id },
    orderBy: { order_no: 'asc' },
  })
  if (nodes.length === 0) return { path: 'direct_publish' }

  // 3. 排除提交人自己（依次审批模式，N 级链中遇到提交人自己的节点时自动通过）
  //    PRD §6.3.3 "审批人=提交人 → 自动通过直接发布" —— 当审批链只有提交人自己或者全是提交人时直发
  const nonSelf = nodes.filter(n => n.approver_user_id !== submitterId)
  if (nonSelf.length === 0) return { path: 'direct_publish' }

  // 4. 起审批（保留所有节点，提交人自己的节点在通过时会自动跳过）
  return {
    path: 'approval',
    templateId: tpl.id,
    nodes: nodes.map(n => ({ order: n.order_no, approverId: n.approver_user_id })),
  }
}
```

**重要细节**：依次审批流转到"提交人自己是审批人"的节点时，该节点自动 APPROVED（action_status=2，action_comment="提交人自审自动通过"），推进到下一级。这是 PRD §6.3.3 的"审批人=提交人自动通过"在多级链中的体现。

---

## 6. 基础设施

### 6.1 MinIO（docker-compose 追加）

```yaml
# docker-compose.yml 追加
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"   # S3 API
      - "9001:9001"   # Web 控制台
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # app 段 depends_on 追加：
  #   minio:
  #     condition: service_healthy

volumes:
  # 追加
  minio_data:
```

**启动后手动操作**（一次性）：
- 浏览器打开 `http://localhost:9001`，用 minioadmin / minioadmin 登录
- 创建 bucket `docflow-files`（与 `STORAGE_BUCKET` 环境变量一致）
- 或改为启动脚本 `tools/minio-init.sh` 自动创建 bucket（MC 命令，A 阶段可手动一次）

### 6.2 环境变量

`.env.example` 追加：
```
# ── 对象存储（MinIO / S3 兼容）──
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=docflow-files
STORAGE_PUBLIC_URL=http://localhost:9000  # 生成下载链接用（生产走 nginx 反代或 CDN）

# ── 格式转换（预留）──
# FORMAT_CONVERTER_ENDPOINT=
# FORMAT_CONVERTER_TOKEN=
```

### 6.3 存储抽象层

**目录**：`server/utils/storage/`

```ts
// types.ts
export interface ObjectStorage {
  /** 上传对象 */
  putObject(key: string, body: Buffer, opts: { mimeType?: string, checksum?: string }): Promise<void>
  /** 下载对象为 Buffer */
  getObject(key: string): Promise<Buffer>
  /** 获取对象 stream（大文件下载） */
  getObjectStream(key: string): Promise<NodeJS.ReadableStream>
  /** 删除对象 */
  deleteObject(key: string): Promise<void>
  /** 生成预签名下载链接（有效期 seconds，默认 600） */
  presignGetUrl(key: string, seconds?: number): Promise<string>
  /** 当前 bucket */
  readonly bucket: string
}

// minio.ts — 基于 @aws-sdk/client-s3 的实现
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export class MinioStorage implements ObjectStorage {
  constructor(private client: S3Client, readonly bucket: string) {}
  // ... 4 个方法实现
}

// index.ts
export const storage: ObjectStorage = new MinioStorage(
  new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION,
    credentials: { accessKeyId: ..., secretAccessKey: ... },
    forcePathStyle: true,  // MinIO 必须
  }),
  process.env.STORAGE_BUCKET!,
)
```

**依赖新增**：`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

**storage_key 生成规则**：
```
{groupId}/{documentId}/{versionNo}-{shortHash}.{ext}
例：40002/50002/v1.0-a3f7b1.md
```
- 加 shortHash（checksum 前 8 位）避免同 version_no 覆盖（理论上不会，UNIQUE 约束兜底）
- `groupId=NULL`（草稿）时用 `drafts/{documentId}/...`

### 6.4 格式转换 stub

**目录**：`server/utils/format-converter/`

```ts
// types.ts
export interface FormatConverter {
  /** 能否处理该扩展名 */
  canConvert(ext: string): boolean
  /** 转换文件到 Markdown */
  convert(input: { buffer: Buffer, ext: string, filename: string }): Promise<{
    content: string
    warnings?: string[]
  }>
}

// noop.ts — A 阶段实现：只认 .md
export class NoopConverter implements FormatConverter {
  canConvert(ext: string): boolean {
    return false  // 当前什么都不转
  }
  async convert(): Promise<never> {
    throw new Error('FORMAT_CONVERTER_NOT_AVAILABLE')
  }
}

// external.ts — 占位文件（空的，B 阶段补实现）
// TODO: B 阶段实现：调用外部接口
// - 外部 HTTP 接口约定：POST {endpoint}/convert multipart/form-data, 返回 { content: string, warnings?: string[] }
// - 环境变量：FORMAT_CONVERTER_ENDPOINT, FORMAT_CONVERTER_TOKEN

// index.ts
export const converter: FormatConverter = new NoopConverter()
// B 阶段：改为 new ExternalConverter(...)
```

**上传 handler 调用约定**：
```ts
const ext = filename.split('.').pop()?.toLowerCase()
if (ext === 'md') {
  // 直接存 buffer
} else if (converter.canConvert(ext!)) {
  const { content } = await converter.convert({ buffer, ext: ext!, filename })
  // 把转换后的 content 存为 .md
} else {
  return fail(event, 400, 'FILE_FORMAT_UNSUPPORTED', '当前仅支持 Markdown (.md)，其他格式转换能力建设中')
}
```

### 6.5 Markdown 渲染管线

**前端**（已有组件 `components/DocPreview.vue`，需补实现）：

依赖新增：
```json
"markdown-it": "^14",
"@types/markdown-it": "^14",
"highlight.js": "^11",
"katex": "^0.16",
"markdown-it-katex": "^2",
"dompurify": "^3",
"@types/dompurify": "^3"
```

渲染流程：
```ts
// utils/markdown.ts（新建）
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import katexPlugin from 'markdown-it-katex'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
  html: false,        // 禁用原始 HTML（配合 DOMPurify 双保险）
  linkify: true,
  breaks: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
}).use(katexPlugin)

export function renderMarkdown(content: string): string {
  const html = md.render(content)
  return DOMPurify.sanitize(html)
}
```

---

## 7. 后端 API 契约（10 套）

统一约定：
- 响应：`{ success: true, code: 0, message, data }` 或 `{ success: false, code, message }`
- 认证：默认需 JWT（鉴权中间件自动校验）
- 白名单：无新增（均需登录）
- 权限：用 `requirePermission(event, 'xxx')` 细粒度校验
- 错误码：沿用 `server/constants/error-codes.ts`，新增在下方列出

### 7.1 新增错误码

```ts
// server/constants/error-codes.ts 追加
export const DOCUMENT_NOT_FOUND       = 'DOCUMENT_NOT_FOUND'        // 文档不存在
export const DOCUMENT_STATUS_INVALID  = 'DOCUMENT_STATUS_INVALID'   // 文档状态不允许此操作
export const DOCUMENT_DUPLICATE_NAME  = 'DOCUMENT_DUPLICATE_NAME'   // 组内同名文档
export const VERSION_NOT_FOUND        = 'VERSION_NOT_FOUND'
export const FILE_TOO_LARGE           = 'FILE_TOO_LARGE'            // > 50MB
export const FILE_FORMAT_UNSUPPORTED  = 'FILE_FORMAT_UNSUPPORTED'   // 非 .md
export const FILE_CONVERT_FAILED      = 'FILE_CONVERT_FAILED'       // 转换失败
export const STORAGE_PUT_FAILED       = 'STORAGE_PUT_FAILED'
export const STORAGE_GET_FAILED       = 'STORAGE_GET_FAILED'
export const APPROVAL_NOT_APPROVER    = 'APPROVAL_NOT_APPROVER'     // 非当前审批人
export const APPROVAL_ALREADY_ACTED   = 'APPROVAL_ALREADY_ACTED'    // 该节点已处理过
export const APPROVAL_REASON_REQUIRED = 'APPROVAL_REASON_REQUIRED'  // 驳回意见必填
export const APPROVAL_NO_TEMPLATE     = 'APPROVAL_NO_TEMPLATE'      // 组未配置审批模板（需起审批时）
```

---

### 7.2 GET /api/documents（列表）

**权限**：`doc:read`
**查询参数**（`server/schemas/document.ts`）：
```ts
{
  groupId: number          // 必填：仓库（组）ID
  status?: 4               // 默认 4 已发布；仓库详情默认只看已发布
  keyword?: string         // 模糊搜索 title
  page: 1, pageSize: 20
}
```
**响应**：
```ts
{
  list: Array<{
    id: number
    title: string
    ext: string
    status: 1|2|3|4|5|6
    versionNo: string | null           // current_version.version_no
    fileSize: number | null
    ownerId: number
    ownerName: string
    updatedAt: number                  // 毫秒
    downloadCount: number
    isPinned: boolean                  // 是否置顶（仅本组）
    isFavorited: boolean               // 当前用户是否收藏
  }>
  total: number
  page: number
  pageSize: number
  reviewingCount: number              // 本组 status=3 的数量（提示条用）
}
```

**业务逻辑**：
- 默认 `status=4` 只看已发布（PRD §6.3.3 "编辑中草稿/审批中文档不在此列表"）
- 按 `doc_document_pins.pinned_at DESC NULLS LAST, updated_at DESC` 排序（置顶优先）
- `reviewingCount` 独立 COUNT 查询（给"有 N 个文件正在审批中..."提示条用）

### 7.3 GET /api/documents/:id（详情）

**权限**：`doc:read`
**响应**：
```ts
{
  id, title, ext, status, groupId, groupName,
  ownerId, ownerName,
  currentVersion: { id, versionNo, fileSize, mimeType, uploadedByName, publishedAt } | null,
  createdAt, updatedAt, downloadCount,
  isPinned, isFavorited,
  sourceDocId: number | null,           // 编辑副本来源（A 阶段永远 null）
  canEdit: boolean,                     // 当前用户权限判定（暂 false，编辑器落地时改）
  canRemove: boolean,                   // 当前用户是否组管理员
  canSubmitApproval: boolean,           // 草稿且 owner=self
  canUploadVersion: boolean,            // 已发布且 is group admin/editor
}
```

**业务**：单次 JOIN 出所有展示字段，前端免二次请求。

### 7.4 POST /api/documents/upload（首次上传）

**权限**：`doc:create`
**入参**（`multipart/form-data`）：
```
groupId:      40002
title:        "首字母大写.md"          （可选，默认用原文件名）
changeNote:   "初版"                 （可选）
file:         <binary>
```
**响应**：
```ts
{
  documentId: number
  versionId: number
  path: 'direct_publish' | 'approval'
  approvalInstanceId: number | null    // path=approval 时返回
}
```

**业务**：
1. 校验 `file.size <= 50MB`，否则 `FILE_TOO_LARGE`
2. 扩展名：`.md` 直接存；其他调 `converter.canConvert()`，当前返回 `FILE_FORMAT_UNSUPPORTED`
3. 校验组内同名：`SELECT id FROM doc_documents WHERE group_id=? AND title=? AND deleted_at IS NULL AND status IN (3,4)` 非空 → `DOCUMENT_DUPLICATE_NAME`
4. 计算 SHA-256
5. `storage.putObject(key, buffer, { mimeType })` 存 MinIO
6. 事务：
   - 生成 `documentId`（snowflake）
   - INSERT `doc_documents`（status 待定 / group_id / title / owner_user_id=self / created_by=self / ext='md'）
   - 生成 `versionId` 
   - INSERT `doc_document_versions`（version_no='v1.0', storage_key, storage_bucket, file_size, mime_type, checksum, uploaded_by=self, source_type=1）
   - 调用 `resolveApprovalPath()` 判定路径
   - **direct_publish**：UPDATE `doc_documents` SET status=4, current_version_id=versionId; UPDATE version SET published_at=NOW()
   - **approval**：UPDATE `doc_documents` SET status=3; INSERT `doc_approval_instances`（status=2, current_node_order=1, biz_id=versionId, biz_type=1）; INSERT 所有节点
7. 通知：
   - direct_publish：无需 M 通知（无审批人等待）；发送 M8 给组内可编辑 + 管理员（PRD §6.8.2）
   - approval：发送 M1 给第一级非 self 审批人
8. 操作日志：
   - DOC_UPLOAD（总是）
   - APPROVAL_SUBMIT（approval 路径）
   - DOC_PUBLISH（direct_publish 路径）

### 7.5 POST /api/documents/:id/versions（更新版本）

**权限**：`doc:update`
**入参**：`multipart/form-data`（同 7.4 但无 title / groupId）
**响应**：同 7.4
**业务**：
1. 文档必须 status ∈ {4 已发布, 5 已驳回}，否则 `DOCUMENT_STATUS_INVALID`（审批中 / 草稿走别的入口）
   - 5 已驳回 → 重新上传视为修正后重提
2. 版本号规则（默认策略）：
   - 从 `doc_document_versions` 查 MAX(version_no) 解析为 `vX.Y`
   - **递增 Y**：v1.0 → v1.1，v1.9 → v1.10（后端不做进位，保持字符串格式）
   - 如想跨主版本（vX → vX+1.0），A 阶段先不做（需要 UI 选择主/次，延后）
3. 同名检测 7.4 规则不变（按 title 不按版本，上传到同一 documentId 不触发）
4. 其余同首次上传（判定审批路径 / 事务 / 通知 / 日志）
5. 日志动作：`DOC_UPLOAD_VERSION`

### 7.6 GET /api/documents/:id/versions（版本列表）

**现状**：已有 handler（`server/api/documents/[id]/versions.get.ts`），但返回 mock
**本次修改**：接真实数据，移除 mock 块
**响应不变**：
```ts
{
  list: Array<{
    id, documentId, versionNo, fileSize, mimeType, changeNote, uploadedBy, uploaderName,
    publishedAt, createdAt, isCurrent, rollbackFrom
  }>, total, page, pageSize
}
```
**业务**：
- `SELECT v.*, u.name AS uploader_name, d.current_version_id FROM doc_document_versions v JOIN doc_users u ON u.id=v.uploaded_by JOIN doc_documents d ON d.id=v.document_id WHERE v.document_id=? AND v.deleted_at IS NULL ORDER BY v.created_at DESC LIMIT ? OFFSET ?`
- `isCurrent = (v.id === d.current_version_id)`
- `rollbackFrom` A 阶段永远 null（回滚功能延后到 B）

### 7.7 GET /api/documents/:id/download（下载）

**权限**：`doc:download`
**查询参数**：`?versionId=<id>`（可选，默认 current_version_id）
**响应**：`302 → presigned URL`，或直接流式返回（取决于配置）

**业务**：
1. 查 version 记录 + 文档归属校验
2. `storage.presignGetUrl(storage_key, 600)` 生成 10 分钟有效链接
3. `UPDATE doc_documents SET download_count = download_count + 1 WHERE id = ?`（异步，不阻塞返回）
4. 日志：`DOC_DOWNLOAD`
5. **A 阶段简化**：直接 302 redirect 到 presigned URL（浏览器跳转下载）

### 7.8 PUT /api/documents/:id/remove（移除）

**权限**：`doc:remove`
**入参**：空
**响应**：`{ id: number }`
**业务**：
1. 文档必须 status=4 已发布
2. 当前用户必须是组管理员（`group_members.permission=1 WHERE group_id=doc.group_id AND user_id=self`）或系统管理员
3. UPDATE `doc_documents` SET status=1 草稿（保留 group_id 和 current_version_id，owner_user_id 不变）
   - **注意**：PRD §5.1 "退回归属人个人中心" —— 个人中心的 `/api/personal/documents` 已经按 owner_user_id 查，status=1 会自然出现
4. 通知 M9 给 owner
5. 日志：`DOC_REMOVE`

### 7.9 POST /api/approvals（起审批）

**说明**：本接口主要**内部使用**（被 7.4 / 7.5 调用），也**对外暴露**用于文件详情页"提交审批"按钮（草稿 → 提交）。
**权限**：`approval:read`（任何员工可发起自己的审批）
**入参**：
```ts
{ documentId: number, versionId: number }
```
**响应**：
```ts
{ approvalInstanceId: number, path: 'direct_publish' | 'approval' }
```

**业务**：
- 校验文档 owner_user_id=self
- 校验文档 status ∈ {1 草稿, 5 已驳回}
- 调 `resolveApprovalPath()` 判定
- 事务走 7.4 的步骤 6-8

### 7.10 POST /api/approvals/:id/approve（通过）

**权限**：`approval:process`
**入参**：`{ comment?: string }`
**响应**：`{ id, status: 'reviewing' | 'approved' }`（完成级别 or 最终完成）

**业务**：
1. 校验 instance.status=2 审批中
2. 校验当前节点（order=instance.current_node_order）的 approver_user_id=self AND action_status=1
3. UPDATE 节点 action_status=2, action_comment, action_at=NOW
4. 判定是否有下一级非提交人节点：
   - **有**：UPDATE instance.current_node_order++，如果下一节点的审批人是提交人本人，递归自动通过（写 action_status=2 + action_comment="提交人自审自动通过"），继续推进
   - **无**（最后一级已完成）：
     - UPDATE instance.status=3 已通过, finished_at=NOW
     - UPDATE 文档 status=4 已发布, current_version_id = instance.biz_id
     - UPDATE version published_at=NOW
     - 发送 M3 通知提交人
     - 发送 M8 通知组内可编辑 + 管理员（去重，不含提交人）
     - 写日志 `DOC_PUBLISH`
5. 写日志 `APPROVAL_PASS`
6. 如果流转到下一级（非自动通过），发送 M2 给下一级审批人

### 7.11 POST /api/approvals/:id/reject（驳回）

**权限**：`approval:process`
**入参**：`{ comment: string }`（必填，1-500 字）
**响应**：`{ id, status: 'rejected' }`
**业务**：
1. 校验同 7.10 步骤 1-2
2. comment 空 → `APPROVAL_REASON_REQUIRED`
3. UPDATE 当前节点 action_status=3, action_comment, action_at=NOW
4. UPDATE instance.status=4 已驳回, finished_at=NOW
5. UPDATE 文档 status=5 已驳回
6. 发送 M4 通知提交人（reason 存 content）
7. 写日志 `APPROVAL_REJECT`

### 7.12 补做：POST /api/approvals/:id/withdraw 发送 M7

现有 `withdraw.post.ts` 未发 M7，本次补：撤回时查出已通过（action_status=2）的节点的 approver_user_id，去重后批量发 M7。

---

## 8. 审批运行时最小子集

**范围**：
- ✅ 起审批（7.9，且被 7.4/7.5 自动调用）
- ✅ 通过（7.10）：含中间级流转、最后一级发布、提交人自审自动跳过
- ✅ 驳回（7.11）：意见必填、文档转 5 已驳回
- ✅ 撤回补发 M7（7.12）
- ❌ 超时催办（M5/M6 + 定时扫描）—— B 阶段独立 cron

**通知触发对应关系**：
| M 码 | 何时 | 接收人 |
|---|---|---|
| M1 | 起审批 → 第一级节点创建时 | 第一级审批人（非 self）|
| M2 | approve 流转到下一级 | 下一级审批人（非 self）|
| M3 | 最后一级 approve | 提交人 |
| M4 | reject | 提交人 |
| M7 | withdraw | 已处理过的审批人（去重）|
| M8 | 文档发布（直发布 + 审批通过）| 组内可编辑成员 + 管理员（去重，不含提交人）|
| M9 | 管理员 remove | 归属人 |

---

## 9. 前端页面设计

### 9.1 `pages/docs/repo/[id].vue`（重写）

```
<ListPageShell>
  toolbar: [子组卡片区 2-3 列网格 max-h 120]
           [审批中提示条（reviewingCount > 0 时显示）]
           [顶栏按钮：上传文件 / 导入飞书(disabled)]
  filterBar: 搜索关键词
  body: DataTable fill-height
    - 文件名（带 MD 图标）+ 置顶图钉 + 收藏星 + 权限锁（锁本次不做）
    - 版本号
    - 状态 badge（只显示已发布，但支持未来切 tab）
    - 上传者
    - 更新时间
    - 操作：[详情] [···更多 dropdown: 下载 / 移除(管理员)]
  pagination: 服务端分页
</ListPageShell>

UploadFileModal v-model="uploadVisible" :group-id="groupId" @success="refresh"
```

**实现要点**：
- 使用已有 `useListPage` composable（和 admin.vue 一样）
- 表格列符合 PRD §6.3.3 规格（可选 `action-width=140`）
- "上传文件"按钮：受 `v-auth="'doc:create'"` 控制
- "移除"按钮：受 `v-auth="'doc:remove'"` 控制，且仅 status=4 显示

### 9.2 `pages/docs/file/[id].vue`（接真实数据）

**现有状态**：预览 + 版本侧边栏 + 对比完整，只是 mock 数据
**本次改动**：
1. 读 `/api/documents/:id` 初始化文件信息
2. 读 `/api/documents/:id/versions` 替换 `fetchVersions`
3. 下载按钮：跳 `/api/documents/:id/download?versionId=...`
4. "提交审批"按钮：
   - 显示条件：status ∈ {1 草稿, 5 已驳回} + owner=self
   - 点击：confirm → `POST /api/approvals`
5. "上传新版本"按钮：
   - 显示条件：status=4 + 有 `doc:update` 权限
   - 点击：打开 `UploadFileModal(mode='update')`
6. "移除"按钮：
   - 显示条件：status=4 + 组管理员
   - 点击：confirm → `PUT /api/documents/:id/remove`
7. 预览区：用 `renderMarkdown()` 渲染真实 content（调 `/api/documents/:id/download` 拉文件 → 提取文本 → 渲染）
   - **A 阶段简化**：预览一个独立接口 `/api/documents/:id/preview?versionId=...`，直接返回已渲染的 HTML 字符串（服务端渲染）
   - 或：前端拉 presigned URL 然后自己 fetch 文件 + 渲染。**选前者**（避免 CORS，且可以服务端缓存）

**补一个接口 7.13**：
### 7.13 GET /api/documents/:id/preview（新增）

**权限**：`doc:read`
**查询参数**：`?versionId=<id>`（可选）
**响应**：`{ html: string, versionNo: string, mimeType: string }`
**业务**：
- 查 version → storage.getObject(key) → utf-8 toString → renderMarkdown → DOMPurify → 返回 HTML
- 结果用 Redis 按 `preview:{versionId}` 缓存 5 分钟（md 文件一般不大，缓存有意义）
- A 阶段只处理 md（其他 mimeType 直接返回"暂不支持预览此格式"）

### 9.3 `components/UploadFileModal.vue`（新建）

```
<Modal title="上传文件" confirm-text="开始上传" @confirm="handleUpload">
  Step 1:
    <el-radio-group v-model="mode">
      <el-radio label="first">首次上传</el-radio>
      <el-radio label="update">更新上传</el-radio>
    </el-radio-group>
  Step 2A (first):
    [拖拽/选择 .md 文件，限 50MB]
    <el-input v-model="changeNote" placeholder="变更说明（可选）" />
    提示：首次上传的文件将自动标记为 v1.0，仅支持 Markdown (.md)
  Step 2B (update):
    <el-select v-model="targetDocumentId"> 已发布文件列表 </el-select>
    [拖拽/选择 .md 文件]
    <el-input v-model="changeNote" placeholder="变更说明（可选）" />
    提示：版本号将从 vX.Y 自动递增
  进度条（上传中）
</Modal>
```

**Props**：`groupId`, `mode?: 'first' | 'update'`, `lockedDocumentId?: number`（从文件详情页打开时用，锁定目标）

### 9.4 `components/ApprovalDrawer.vue`（新建，审批抽屉）

接入已有的审批中心"待我审批"卡片点击入口（PRD §6.4.2）：

```
<el-drawer title="审批处理" direction="rtl" size="620px">
  <ApprovalFileCard :approval="data" />         (文件信息：名/版本/发起人/时间)
  <ApprovalChain :nodes="data.chain" />         (链路可视化，已有组件)
  <VersionCompareSummary :summary="diffSummary" @full-compare="openFullCompare" />
                                                 (变更摘要 + 跳转全屏对比)
  <el-input type="textarea" v-model="comment" placeholder="审批意见..." />
  <div class="actions">
    <el-button @click="onReject" type="danger">驳回</el-button>
    <el-button @click="onApprove" type="primary">通过</el-button>
  </div>
</el-drawer>
```

**业务**：
- 驳回时 comment 必填（前端 + 后端双校验）
- 通过 / 驳回后：关抽屉 → toast → 触发审批中心 list refresh

---

## 10. 权限矩阵

| 操作 | 权限码 | 额外条件 |
|---|---|---|
| 查看文件列表 / 详情 / 预览 / 下载 | `doc:read` / `doc:download` | 需为组成员（由组成员表判定）|
| 上传新文件（首次）| `doc:create` | 需对该组有 `上传下载` 及以上权限 |
| 上传新版本 | `doc:update` | 需对该文档有 `可编辑` 权限（管理员 / 可编辑）|
| 提交审批（草稿 → 审批）| `approval:read` | 文档 owner=self + status ∈ {1,5} |
| 通过 / 驳回审批 | `approval:process` | 必须是当前节点 approver + action_status=1 |
| 撤回审批 | `approval:read` | 发起人 + status=2 |
| 移除文档 | `doc:remove` | 组管理员 or 系统管理员 |
| 删除草稿 | `doc:delete` | owner=self + status=1（已有接口）|

**组成员权限判定**：通过 `doc_group_members.permission` 字段（1 管理员 / 2 可编辑 / 3 上传下载 / 4 可阅读）+ `server/utils/group-permission.ts` 已有工具。

---

## 11. 操作日志触发点

| 动作 | 触发位置 | LOG_ACTIONS 码 |
|---|---|---|
| 上传文件（首次）| 7.4 | `DOC_UPLOAD` |
| 上传新版本 | 7.5 | `DOC_UPLOAD_VERSION` |
| 下载文件 | 7.7 | `DOC_DOWNLOAD` |
| 文件发布（直发 or 审批通过最后一级）| 7.4/7.5/7.10 | `DOC_PUBLISH` |
| 移除文件 | 7.8 | `DOC_REMOVE` |
| 起审批 | 7.4/7.5/7.9 | `APPROVAL_SUBMIT` |
| 审批通过（含自动跳过提交人节点）| 7.10 | `APPROVAL_PASS` |
| 审批驳回 | 7.11 | `APPROVAL_REJECT` |
| 撤回审批 | 已有 handler | `APPROVAL_WITHDRAW` |

所有日志通过已有 `server/utils/operation-log.ts` 的 `writeLog(...)` 写入。

---

## 12. Prisma 模型方法 vs 原生 SQL 选择

遵循 CLAUDE.md "混合模式"约定：

- **模型方法**（简单 CRUD）：
  - 单表 INSERT / UPDATE / findUnique / findFirst / count
  - 事务中各步骤的简单操作
- **$queryRaw**（复杂）：
  - 列表 JOIN 查询（文件列表 7.2、版本列表 7.6、审批通过时推进节点的复合条件）
  - 需要 `GROUP_CONCAT` / `COUNT + CASE` 等

---

## 13. 前端类型定义

**新增文件**：
- `types/document.ts` — `DocumentItem`、`DocumentDetail`、`DocumentListQuery`、`UploadResult` 等
- 前端**不重复定义**请求参数类型（CLAUDE.md 约定），从 Zod schema 推导：
  ```ts
  import type { DocumentUploadBody } from '~/server/schemas/document'
  ```

**新增前端 API**：
- `api/documents.ts` — 封装 7.2、7.3、7.4、7.5、7.6、7.7、7.8、7.13
- `api/approvals.ts`（追加）— 7.9、7.10、7.11

---

## 14. 测试点

**关键用例**（按分支覆盖）：

**上传 → 审批链路**
1. `上传 .docx 文件` → 返回 `FILE_FORMAT_UNSUPPORTED`
2. `上传 51MB .md 文件` → 返回 `FILE_TOO_LARGE`
3. `组内同名文件已存在` → 返回 `DOCUMENT_DUPLICATE_NAME`
4. `提交人 = 审批人（单级链）` → direct_publish，文档 status=4，无 M 通知
5. `提交人 ≠ 审批人（单级链）` → approval，文档 status=3，审批人收到 M1
6. `三级链：A → self → C` → 第一级 approve 后自动跳过 self 节点，直接到 C，C 收到 M2
7. `最后一级 approve` → 文档 status=4, current_version_id 更新, 提交人 M3, 组成员 M8
8. `reject` → 文档 status=5, 提交人 M4
9. `reject 时 comment 为空` → `APPROVAL_REASON_REQUIRED`
10. `提交人撤回` → 状态转 5，已审批过的节点 approver 收到 M7

**版本 + 下载**
11. `对 status=4 文档上传新版本` → v1.0 → v1.1
12. `对 status=3 文档上传新版本` → `DOCUMENT_STATUS_INVALID`
13. `下载 current version` → 302 presigned URL + download_count+1

**移除**
14. `组管理员 remove status=4` → status=1, owner 收 M9
15. `非管理员 remove` → 403 权限拒绝
16. `remove status=3 文档` → `DOCUMENT_STATUS_INVALID`

**预览**
17. `预览 .md 文档` → 返回渲染后 HTML
18. `预览 .docx 文档`（mock seed 中存在）→ 返回"暂不支持预览此格式"提示

**现有功能回归**
19. 审批中心列表（已有）— 起审批后新实例正确出现在 pending tab
20. 通知中心（已有）— M1/M3/M4/M7/M8/M9 卡片点击跳转正确

---

## 15. 非目标 / 延后项

| 延后项 | 延后原因 | 预计什么时候做 |
|---|---|---|
| 在线编辑器（+ 新建文档 / 编辑按钮）| 框架待定 | 领导定框架后独立立项 |
| 非 .md 格式转换 | 外部接口待给 | 接口就绪后改 `format-converter/external.ts` |
| 跨组移动、文档级权限、分享、收藏/置顶操作按钮 | 本次只做读端展示 | 各模块独立 PR |
| 飞书文档导入 | 飞书集成模块 | 独立立项 |
| 评论、批注、审批记录 tab | 预览/版本已占主线 | 独立 PR |
| 超时催办 M5/M6 | 需 cron | 定时任务模块 |
| 回滚历史版本 | A 阶段简化为"上传新版本"手工替代 | B 阶段 |
| 版本对比变更摘要（已有接口接 mock）| 本次接真实，已含在 7.6 后置 | —|

---

## 16. 风险 / 待确认项

**已定项**（不再问）：
- A2 MinIO ✅
- B1 只支持 .md + 留 stub ✅
- D2 含审批运行时（最小子集）✅
- E markdown-it + hljs + katex + DOMPurify ✅
- C 编辑器暂不做 ✅

**实施中待确认**（若需要再问你）：

1. **MinIO 生产是否用同一容器** — A 阶段 docker-compose 内部建 bucket 即可，生产部署时再决定走云 OSS 还是自建 MinIO
2. **预览缓存 TTL** — 当前定 5 分钟，如预览有交互（如后期加批注）需 invalidate，届时调整
3. **版本号递增策略** — 当前"只进次版本（Y++）"，如需支持用户选择"主版本 +1（v2.0）"需加 UI，A 阶段先不做
4. **同名文件判断范围** — 当前按"组内 status IN (3,4)"，草稿/已驳回/已删同名不冲突；你若要严格按"组内所有未删除"更严，告诉我改
5. **下载是 302 重定向还是流式代理** — 当前 302 到 presigned URL（简单高效），若未来需要鉴权日志 / 流量控制再改代理

---

## 17. 交付物清单

**新增文件**：
- `server/utils/storage/{types,minio,index}.ts`
- `server/utils/format-converter/{types,noop,index}.ts`
- `server/utils/approval-router.ts`
- `server/schemas/document.ts`
- `server/schemas/approval-runtime.ts`（submit/approve/reject 入参）
- `server/api/documents/index.get.ts` — 列表
- `server/api/documents/[id]/index.get.ts` — 详情
- `server/api/documents/[id]/preview.get.ts` — 预览
- `server/api/documents/[id]/download.get.ts` — 下载
- `server/api/documents/[id]/remove.put.ts` — 移除
- `server/api/documents/upload.post.ts` — 首次上传
- `server/api/documents/[id]/versions.post.ts` — 更新版本
- `server/api/approvals/index.post.ts` — 起审批
- `server/api/approvals/[id]/approve.post.ts`
- `server/api/approvals/[id]/reject.post.ts`
- `types/document.ts`
- `api/documents.ts`
- `utils/markdown.ts`
- `components/UploadFileModal.vue`
- `components/ApprovalDrawer.vue`
- `docs/superpowers/plans/2026-04-20-document-core.md`（实施计划）

**修改文件**：
- `docker-compose.yml` — 新增 minio 容器
- `.env.example` — 新增 STORAGE_* 变量
- `package.json` — 新增 @aws-sdk/client-s3、@aws-sdk/s3-request-presigner、markdown-it、highlight.js、katex、markdown-it-katex、dompurify
- `server/api/documents/[id]/versions.get.ts` — 去 mock，接真实
- `server/api/version/compare.post.ts` — 接真实 storage
- `server/api/approvals/[id]/withdraw.post.ts` — 补发 M7
- `server/constants/error-codes.ts` — 新增 13 个错误码
- `pages/docs/repo/[id].vue` — 重写
- `pages/docs/file/[id].vue` — 接真实数据 + 补按钮
- `pages/approvals.vue` — 待我审批卡片点击打开 ApprovalDrawer
- `docs/api-auth-design.md` — 登记 10 个新接口
- `docs/feature-gap-checklist.md` — M1/M3/M4/M7/M8/M9 打 ✅ + 2026-04-20 日期
- `docs/dev-progress.md` — 新增条目

**不修改**：
- `docs/doc.sql`、`docs/rbac.sql`、`docs/doc_seed.sql`、`prisma/schema.prisma` — 无需 patch

---

## 18. 架构决策摘要

| 决策 | 选择 | 理由 |
|---|---|---|
| 文件存储 | MinIO + @aws-sdk/client-s3 | 开发免费、生产无缝切云 OSS |
| 格式转换 | Stub 接口 + 外部 HTTP 占位 | 外部接口就绪时零改动主逻辑 |
| 在线编辑器 | A 阶段不做，按钮 disable | 框架待定，独立模块 |
| 审批运行时 | 含最小子集（起/通/驳/撤回M7）| 让审批中心 + 通知中心活起来 |
| Markdown 渲染 | 服务端渲染 + Redis 5min 缓存 | 避免 CORS、性能好 |
| 版本号 | 自动递增次版本 Y++ | 简单可行，主版本切换延后 |
| 下载 | 302 → presigned URL | 简单高效，鉴权由 preflight 接口完成 |
| 预览范围 | 只渲染 MD | 非 MD 转 MD 依赖 B 阶段 converter |
| 数据库 patch | 不做 | 现有 schema 字段齐全 |

---

附：**页面交互参考**（prototype-v21.0.html 对应）：
- 共享文档仓库详情（上传按钮 / 文件列表）
- 文件详情（预览 / 版本记录 / 对比）
- 审批中心（待我审批卡片点击进抽屉）
