# 通知中心 — 设计文档

> 日期：2026-04-18
> 范围：A 阶段 — 站内通知读端（铃铛 Popover + 整页 + 未读角标 + 已读操作）+ 写入侧 helper + 模板表
> 不在本次范围：各业务模块的触发点接入、飞书消息推送（M25 + 所有消息飞书端）、同意/拒绝类按钮行为

---

## 1. 功能概述

在顶栏增加铃铛入口，点击展开下拉 Popover 快速浏览最近通知，面板底部提供"查看全部"跳转整页 `/notifications`。整页按 PRD §6.8.4 分 4 个 Tab（全部 / 审批通知 / 系统通知 / 成员变更）。铃铛上显示全局未读红角标，Tab 上显示分类未读角标。

**PRD 对应**：§6.8 通知中心（§6.8.1 功能说明、§6.8.2 消息纵览 M1-M24、§6.8.4 通知中心页面）、§1284 通知推送延迟 < 5s。

**原型参考**：`docs/prototype-v21.0.html:669-675`（顶栏铃铛 + 红角标）、`docs/prototype-v21.0.html:4424-4511`（`renderNotifications` 4 Tab 列表）。

---

## 2. 范围边界

| 事项 | 本次（A 阶段） | 后续 |
|---|---|---|
| 顶栏铃铛 + 红角标（99+） | ✅ | — |
| Popover 下拉面板（近 20 条 + 未读/全部切换 + 底部操作） | ✅ | — |
| 整页 `/notifications`（4 Tab + segment + 分页 + 全部已读） | ✅ | — |
| 点卡片 → 标已读 + 跳转 `biz_type/biz_id` 对应页 | ✅ | — |
| 4 个读/写 API + 自己权限过滤 | ✅ | — |
| WebSocket 复用 `badge` 消息推送未读数 | ✅ | — |
| 写入侧 helper `createNotification(...)` + 24 模板表 | ✅（仅代码在位，不被调用） | — |
| 通知触发点清单（`feature-gap-checklist.md` 专表） | ✅ | — |
| 种子数据 40-50 条覆盖 M1-M24 | ✅ | — |
| 各业务模块触发点接入（审批、成员、跨组移动、权限申请等） | ❌ | 对应模块开发时按纪律补 |
| 飞书消息推送（§6.8.3 + M25） | ❌ | 飞书集成独立模块 |
| 同意/拒绝/撤回类卡片按钮 | ❌ | A 阶段整卡仅跳转；按钮行为等对应业务模块 |

---

## 3. 架构分层

```
┌─ layouts/prototype.vue ──────────────────────────────┐
│  header: [暗黑切换]  [NotificationBell 铃铛]  [用户菜单]│
│                          │                            │
│                          ├─ 点击 → NotificationPopover  │
│                          │    ├─ 未读/全部 segment      │
│                          │    ├─ 近 20 条 NotificationCard │
│                          │    │   └─ 点卡 → 标已读+跳转+关面板│
│                          │    └─ [全部已读] [查看全部 →] │
│                          │                            │
│                          └─ 红角标 ← wsStore.badges.notifications│
└──────────────────────────────────────────────────────┘

pages/notifications.vue  （layout=prototype, fixedLayout）
  ├─ 4 Tab（全部(N) / 审批通知(N) / 系统通知(N) / 成员变更(N)）
  ├─ 顶部右侧：[未读/全部 segment]  [当前 Tab 全部已读]
  └─ 卡片列表（NotificationCard 复用）+ Pagination（每页 20，服务端分页）

WebSocket 流：
  业务模块 → createNotification() → INSERT + 查新未读数 → wsSendToUser(userId, {type:'badge', payload:{notifications:N}})
       前端 handleMessage → wsStore.updateBadges → 铃铛红角标 + 当前打开的列表不自动插入（刷新时才拿新数据）

对账点（C 方案）：
  ① 登录完成后 → 调 /unread-count 初始化 badge
  ② WS `open` 重连成功 → 调 /unread-count 补账
  ③ Popover 打开时 → 拉一次 list（不缓存）
  ④ 点已读 / 全部已读 → 本地 badge 减 + 服务端 WS 也会推（幂等）
```

---

## 4. 数据层

### 4.1 表结构（复用，不改）

```
doc_notifications (id, user_id, category, msg_code, title, content, biz_type, biz_id, read_at, created_at)
```

| 字段 | 约定 |
|---|---|
| `category` TINYINT | `1`=审批通知（M1-M7）；`2`=系统通知（M8-M17,M24）；`3`=成员变更（M18-M23） |
| `msg_code` VARCHAR(10) | `'M1'`..`'M24'`，前端靠此查 `NOTIFICATION_META` 映射图标/配色 |
| `title` VARCHAR(200) | **完整渲染后的文案**（如 `王建国 提交了文件《xxx》的审批，请处理`） |
| `content` VARCHAR(2000) | 可选副文案（M4 驳回原因、M6 催办次数等）；空则卡片单行 |
| `biz_type` VARCHAR(50) | `'document'` \| `'group'` \| `'group_approval'` \| `null`（A 阶段仅此 3 类 + null） |
| `biz_id` BIGINT UNSIGNED | 对应业务 ID；`null` 时点卡仅标已读不跳转 |
| `read_at` DATETIME(3) | `null` 即未读；标已读时写入当前时间（幂等：已有值不覆盖） |

**索引（已有）**：`idx_user_read_created(user_id, read_at, created_at)`、`idx_category(user_id, category)`。

### 4.2 biz_type 跳转映射（A 阶段）

| biz_type | 跳转路由 | 典型消息 |
|---|---|---|
| `document` | `/docs/file/:biz_id` | M1-M9、M17 |
| `group` | `/docs/repo/:biz_id` | M18、M22、M23 |
| `group_approval` | `/docs/repo/:biz_id?openSettings=approval` | M24 |
| `null` | 不跳转 | M10/M11/M12/M13/M14/M15/M16/M19/M20/M21、及以上任何无 biz 的场景 |

`/docs/repo/[id].vue` 需要在挂载后检测 `route.query.openSettings === 'approval'` 并自动打开 `GroupSettingsModal` 到审批配置 Tab；跳后要清 query（防刷新重复弹）。

### 4.3 种子数据

在 `doc_seed.sql` 追加 40-50 条覆盖 M1-M24 每种至少 1 条，分散到 2-3 个用户（系统管理员、普通成员、组负责人），时间分布于近一周，约 1/3 保持未读。

---

## 5. 后端 API

目录：`server/api/notifications/`。全部 handler **不**挂 `requirePermission`，仅通过 `event.context.user.id` 过滤 `user_id`（用户只能读/改自己的通知）。

### 5.1 接口清单

| 方法路径 | 说明 |
|---|---|
| `GET /api/notifications/index.get.ts` | 分页列表 |
| `GET /api/notifications/unread-count.get.ts` | 未读计数（总数 + 按 category） |
| `PUT /api/notifications/[id]/read.put.ts` | 标记单条已读 |
| `PUT /api/notifications/read-all.put.ts` | 批量已读（可按 category） |

### 5.2 详细签名

**GET /api/notifications**
```
Query:
  category?    number      // 1|2|3，不传=全部
  onlyUnread?  boolean     // 默认 false
  page         number      // 默认 1
  pageSize     number      // 默认 20，最大 50
Response:
  {
    list: NotificationItem[],
    total: number,
    page: number,
    pageSize: number
  }

NotificationItem: {
  id: string,
  category: 1 | 2 | 3,
  msgCode: string,
  title: string,
  content: string | null,
  bizType: string | null,
  bizId: string | null,
  read: boolean,
  readAt: number | null,  // ms
  createdAt: number       // ms
}
```

**GET /api/notifications/unread-count**
```
Response: {
  total: number,
  byCategory: { '1': number, '2': number, '3': number }
}
```

**PUT /api/notifications/[id]/read**
- 仅 owner；已读幂等（不覆盖 read_at，直接返回成功）；非 owner 返回 404
- 执行后：查新未读数，通过 `wsSendToUser` 推一次 `badge`
- Response: `{}`

**PUT /api/notifications/read-all**
```
Body: { category?: 1 | 2 | 3 }  // 不传=全部分类
Response: { updated: number }
```
- 执行后：推一次 `badge`

### 5.3 Zod Schema

`server/schemas/notification.ts`：
- `notificationListQuerySchema` — category/onlyUnread/page/pageSize（带默认值 + 上限校验 + `z.coerce.boolean`）
- `readAllBodySchema` — optional category（1|2|3）

**类型从 schema 推导**：`types/notification.ts` 用 `z.infer<typeof ...>`。

---

## 6. 写入侧 Helper + 模板表（A 阶段关键产物）

### 6.1 目标

让后续任何业务模块开发"想触发通知"时，**只写一行**即可，避免绕过契约手写 INSERT，也避免丢失消息模板一致性。

### 6.2 `server/utils/notify.ts`

```ts
/**
 * 通知开发纪律：
 * 1. 业务模块触发通知统一走 createNotification(NOTIFICATION_TEMPLATES.Mx.build(...))
 *    不要绕过模板直接 INSERT doc_notifications
 * 2. 新增业务行为 → 对照 PRD §6.8.2 定位 M 码 → 用此文件的 NOTIFICATION_TEMPLATES 查模板
 * 3. M1-M24 的归属模块和触发点进度见 docs/feature-gap-checklist.md
 *    「通知触发点清单」章节，完成后打 ✅
 * 4. 新增 biz_type 时同步更新 types/notification.ts + 前端 resolveRoute
 */
export async function createNotification(opts: CreateNotificationOpts): Promise<void>
export async function createNotifications(list: CreateNotificationOpts[]): Promise<void>

type CreateNotificationOpts = {
  userId: bigint | number
  category: 1 | 2 | 3
  msgCode: string
  title: string
  content?: string
  bizType?: 'document' | 'group' | 'group_approval'
  bizId?: bigint | number
}
```

内部实现：
1. 生成雪花 ID（`server/utils/snowflake.ts`）
2. `prisma.doc_notifications.create(...)`
3. `prisma.doc_notifications.count({ where: { user_id, read_at: null } })`
4. `wsSendToUser(Number(userId), { type: 'badge', payload: { notifications: count } })`
5. `createNotifications` 走事务 + 按 userId 分组推一次 badge

### 6.3 `server/constants/notification-templates.ts`（M1-M24 模板表）

**代码侧单一事实源**：枚举全部 24 种消息，每种含 category、triggerModule 标签、触发点描述、强类型 build 函数。

```ts
import type { CreateNotificationOpts } from '~/server/utils/notify'

export type NotificationTemplate<P extends object = object> = {
  category: 1 | 2 | 3
  msgCode: string
  triggerModule: TriggerModule
  triggerPoint: string   // 人类可读的触发时机描述
  build: (params: P & { toUserId: bigint | number }) => CreateNotificationOpts
}

export type TriggerModule =
  | 'approval-runtime'        // M1-M7
  | 'document-lifecycle'      // M8, M9
  | 'ownership-transfer'      // M10, M11
  | 'cross-move'              // M12, M13
  | 'permission-request'      // M14, M15, M16
  | 'share'                   // M17
  | 'group-member'            // M18, M19, M20
  | 'role-assign'             // M21
  | 'group-owner'             // M22
  | 'hr-handover'             // M23
  | 'approval-chain-change'   // M24

export const NOTIFICATION_TEMPLATES = {
  M1: {
    category: 1,
    msgCode: 'M1',
    triggerModule: 'approval-runtime',
    triggerPoint: '文件提交审批时（POST /api/approvals）',
    build: (p: { toUserId: bigint | number, submitter: string, fileName: string, fileId: bigint | number }) => ({
      userId: p.toUserId,
      category: 1,
      msgCode: 'M1',
      title: `${p.submitter} 提交了文件《${p.fileName}》的审批，请处理`,
      bizType: 'document',
      bizId: p.fileId,
    }),
  },
  // M2-M24 按同样结构补齐，build 参数类型按 PRD §6.8.2 "消息模版"列的占位符决定
  // 例如 M4 build 参数含 fileName / fileId / reason（驳回原因存入 content）；M5 含 fileName / fileId / overdueHours 等
} as const satisfies Record<string, NotificationTemplate<any>>
```

> **说明**：设计稿只示例 M1；完整 24 个模板在实施计划中一次性产出，以 PRD §6.8.2 的"消息模版"列为文案模板来源。

**使用示例**：
```ts
// 在将来某个业务 handler 里：
import { createNotification } from '~/server/utils/notify'
import { NOTIFICATION_TEMPLATES } from '~/server/constants/notification-templates'

await createNotification(
  NOTIFICATION_TEMPLATES.M18.build({
    toUserId: memberUserId,
    groupName,
    roleLabel: '可编辑',
    groupId,
  })
)
```

**反向查询**：`grep "triggerModule: 'approval-runtime'"` → 一次性列出审批运行时模块所属的 M 码。

### 6.4 双保险的另一半 —— 进度清单

`docs/feature-gap-checklist.md` 新增 **「通知触发点清单」** 章节：

```markdown
## 通知触发点接入清单

> M1-M24 各消息归属模块和触发点。开发对应模块时对照此表接入 `NOTIFICATION_TEMPLATES.Mx.build(...)`，接入后打 ✅ 并写完成日期。

| 消息 | 归属模块 | 触发点 | 状态 |
|---|---|---|---|
| M1 | approval-runtime | 文件提交审批 | ⏳ 待接入 |
| M2 | approval-runtime | 审批流转下一级 | ⏳ 待接入 |
| M3 | approval-runtime | 最后一级通过 | ⏳ 待接入 |
| M4 | approval-runtime | 任一级驳回 | ⏳ 待接入 |
| M5 | approval-runtime | 超时 24h 催办 | ⏳ 待接入 |
| M6 | approval-runtime | 催办达上限 | ⏳ 待接入 |
| M7 | approval-runtime | 提交人撤回 | ⏳ 待接入 |
| M8 | document-lifecycle | 新版本发布 | ⏳ 待接入 |
| M9 | document-lifecycle | 管理员从组移除文件 | ⏳ 待接入 |
| M10 | ownership-transfer | 发起归属人转移 | ⏳ 待接入 |
| M11 | ownership-transfer | 转移同意/拒绝/过期 | ⏳ 待接入 |
| M12 | cross-move | 发起跨组移动 | ⏳ 待接入 |
| M13 | cross-move | 移动同意/拒绝/过期 | ⏳ 待接入 |
| M14 | permission-request | 阅读权限申请 | ⏳ 待接入 |
| M15 | permission-request | 编辑权限申请 | ⏳ 待接入 |
| M16 | permission-request | 权限审批结果 | ⏳ 待接入 |
| M17 | share | 分享文档 | ⏳ 待接入 |
| M18 | group-member | 被添加为组成员 | ⏳ 待接入（组成员管理已有 API，B 阶段可一并补） |
| M19 | group-member | 成员权限变更 | ⏳ 待接入（同上） |
| M20 | group-member | 被移出组 | ⏳ 待接入（同上） |
| M21 | role-assign | 管理员指派/撤销 | ⏳ 待接入 |
| M22 | group-owner | 组负责人变更 | ⏳ 待接入 |
| M23 | hr-handover | 员工离职交接 | ⏳ 待接入 |
| M24 | approval-chain-change | 审批链成员因离职/调岗移除 | ⏳ 待接入 |
```

每做一个模块：`grep triggerModule` 反查 M 码 → 接入 → 在清单打 ✅。

---

## 7. 前端产物

### 7.1 组件

| 文件 | 职责 |
|---|---|
| `components/NotificationBell.vue` | 铃铛图标 + 红角标（99+）+ 触发 Popover；`<ClientOnly>` 包裹避免 SSR 角标闪烁 |
| `components/NotificationPopover.vue` | 下拉面板 380×480；未读/全部 segment；近 20 条列表；底部 [全部已读] [查看全部 →] |
| `components/NotificationCard.vue` | 单条卡片（图标圆 + title + 可选 content + 时间 + 未读点）；Popover 和整页复用；emits `read` / `navigate` |
| `pages/notifications.vue` | **改造**，删除现有 mock；4 Tab + segment + 卡片列表 + Pagination |

### 7.2 工具/类型/API

| 文件 | 职责 |
|---|---|
| `utils/notification-meta.ts` | `NOTIFICATION_META[msgCode]` → `{ icon, colorVar }`；`resolveRoute(bizType, bizId)` → `RouteLocationRaw \| null` |
| `types/notification.ts` | 从 Zod schema 推导的请求/响应类型 |
| `api/notifications.ts` | 4 个 API 封装（走 `useAuthFetch`） |

### 7.3 前端图标映射（`NOTIFICATION_META`）

```ts
import {
  Document, DocumentChecked, CircleCheck, CircleClose,
  AlarmClock, Warning, RefreshLeft, Promotion,
  User, UserFilled, Switch, Rank, Lock, Share, Setting,
} from '@element-plus/icons-vue'

// color 是 CSS 变量名，绑定到 .df-notification-card__icon 的 color / background
export const NOTIFICATION_META: Record<string, { icon: Component, color: 'primary' | 'success' | 'warning' | 'danger' | 'info' }> = {
  M1:  { icon: DocumentChecked, color: 'primary' },   // 新审批待处理
  M2:  { icon: DocumentChecked, color: 'primary' },   // 审批流转
  M3:  { icon: CircleCheck,     color: 'success' },   // 审批通过
  M4:  { icon: CircleClose,     color: 'danger'  },   // 审批驳回
  M5:  { icon: AlarmClock,      color: 'warning' },   // 超时催办
  M6:  { icon: Warning,         color: 'warning' },   // 催办达上限
  M7:  { icon: RefreshLeft,     color: 'info'    },   // 审批撤回
  M8:  { icon: Promotion,       color: 'success' },   // 新版本发布
  M9:  { icon: CircleClose,     color: 'danger'  },   // 文档移除
  M10: { icon: User,            color: 'warning' },   // 归属人转移请求
  M11: { icon: User,            color: 'info'    },   // 转移结果
  M12: { icon: Rank,            color: 'primary' },   // 跨组移动请求
  M13: { icon: Rank,            color: 'info'    },   // 跨组移动结果
  M14: { icon: Lock,            color: 'warning' },   // 阅读权限申请
  M15: { icon: Lock,            color: 'warning' },   // 编辑权限申请
  M16: { icon: CircleCheck,     color: 'success' },   // 权限审批结果
  M17: { icon: Share,           color: 'primary' },   // 收到分享
  M18: { icon: UserFilled,      color: 'success' },   // 被加入组
  M19: { icon: UserFilled,      color: 'primary' },   // 权限变更
  M20: { icon: UserFilled,      color: 'danger'  },   // 被移出组
  M21: { icon: User,            color: 'primary' },   // 管理员指派
  M22: { icon: Switch,          color: 'primary' },   // 组负责人变更
  M23: { icon: User,            color: 'warning' },   // 离职交接
  M24: { icon: Setting,         color: 'warning' },   // 审批链变更
}
```

色值由 CSS 变量 `--df-primary/--df-success/--df-warning/--df-danger/--df-info` 和 `--df-*-soft`（背景浅色）提供，暗色模式自适应。

### 7.4 WebSocket 接入

**不新增** `WsServerMessage` type；复用 `'badge'` 的 `notifications` 字段。`useWs` `handleMessage` 已处理 `type === 'badge'` 并更新 `wsStore.badges.notifications`，直接复用。

登录后 / WS 重连后的对账：在 `useWs` 的 `open` 事件内（或专用 composable `useNotificationBadge`）调一次 `/api/notifications/unread-count` 并写入 `wsStore.badges`。

### 7.5 `layouts/prototype.vue` 改动

在 header `.pf-header-actions` 内、暗黑切换按钮之后、用户菜单之前，插入：

```vue
<ClientOnly>
  <NotificationBell v-if="authStore.isAuthenticated" />
</ClientOnly>
```

### 7.6 "全部已读"范围

| 位置 | 范围 | 实现 |
|---|---|---|
| Popover 底部"全部已读" | **全部分类**所有未读 | `PUT /api/notifications/read-all` 空 body |
| 整页顶部"全部已读" | **当前 Tab** 未读 | `PUT /api/notifications/read-all` body `{ category: 当前 tab }`；全部 Tab 则空 body |

两处都**静默**执行（toast 提示"已全部标为已读"），无二次确认弹窗。

---

## 8. 样式

新增 `assets/styles/components/_notification.scss`，被 `assets/styles/components.scss` import（沿用项目"全局公共组件样式统一放 components.scss"的约定）：

- `.df-notification-bell` — 铃铛按钮 + 红角标（`.df-notification-bell__dot`，99+ 变椭圆）
- `.df-notification-popover` — 下拉面板骨架（头部 segment + 列表滚动 + 底部操作）
- `.df-notification-card` — 单条卡片；未读态 `background: var(--df-primary-soft)`；圆形图标底色用 `color-mix(in srgb, var(--df-<color>) 16%, transparent)`
- `.df-notification-list` — 列表间距 + 分隔线
- 暗色叠加写在 `dark.scss`

---

## 9. 测试

`tests/unit/schemas/notification.test.ts`：
- `notificationListQuerySchema` — category 合法/非法、onlyUnread 字符串 → boolean、page/pageSize 边界（默认、上限、负数）
- `readAllBodySchema` — category 可选 / 合法 / 非法

`tests/unit/utils/notification-meta.test.ts`：
- `resolveRoute('document', 123n)` → `/docs/file/123`
- `resolveRoute('group_approval', 45n)` → `/docs/repo/45?openSettings=approval`
- `resolveRoute(null, null)` → `null`
- `resolveRoute('unknown', 1n)` → `null`

A 阶段不覆盖 WS 推送、API 端到端、Popover 组件行为（E2E 不在范围）。

---

## 10. 文档更新清单

完成时需同步更新：

- `docs/api-auth-design.md` — 新增 4 个 `/api/notifications` 接口说明
- `docs/feature-gap-checklist.md` — 
  - 移除 `2.3 通知中心` 下的 4 个待做项（已 ✅ 于 2026-04-18）
  - 新增「通知触发点清单」章节（M1-M24 进度表）
  - 已完成表追加 `NotificationBell / NotificationPopover / NotificationCard` 条目
- `docs/dev-progress.md` — 追加 2026-04-18 条目

---

## 11. 关键决策回顾

| 决策点 | 选择 | 理由 |
|---|---|---|
| 铃铛形态 | B（Popover + 整页并存） | 快速浏览走 Popover，认真处理跳整页 |
| A 阶段范围 | 仅读端 + helper + 模板表 | 与操作日志一致，避免和未建模块耦合 |
| 实时机制 | C（WS 主 + 登录/重连对账） | 满足 PRD <5s，不做定时轮询 |
| 卡片按钮 | 全部无按钮，整卡点击 | 现阶段"同意/拒绝"类业务模块未建；整卡跳转已足够 |
| title/content | title 存完整文案，content 可选副文案 | 与 PRD §6.8.2 消息模版一致，渲染逻辑简单 |
| 图标体系 | Element Plus SVG + CSS 语义色变量 | 与项目其他图标一致；暗色自动适配 |
| WS type | 复用 `badge` 不新增 type | 最小改动；A 阶段不需要"新通知插队显示" |
| 写入侧纪律 | 模板表（代码）+ 清单表（文档）双保险 | 代码有模板函数保契约一致；文档有进度表防漏接 |

---

## 12. 实施顺序建议（给实现计划的 hint）

1. DB 种子数据先准备好 → 2. 后端 schema + 4 接口 + helper + 模板表 → 3. 前端类型/API/meta → 4. NotificationCard → 5. NotificationPopover → 6. NotificationBell + layouts 集成 → 7. pages/notifications.vue 改造 → 8. feature-gap-checklist 通知触发点清单 → 9. API 文档 + dev-progress → 10. 单测补齐。

详细任务分解由 `writing-plans` 生成的实施计划承担。
