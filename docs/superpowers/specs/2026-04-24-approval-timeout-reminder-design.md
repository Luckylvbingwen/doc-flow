---
title: 审批超时催办设计（M5 / M6 + cron）
status: draft
owner: lvbingwen
date: 2026-04-24
scope: 审批流运行时 B 阶段
---

# 审批超时催办设计

> 闭合 `docs/feature-gap-checklist.md §2.1` 审批章节最后一个遗留项 —— "催办触发逻辑（定时任务扫描超时节点）"。
> PRD 依据：§6.4 审批中心 / §244 默认依次审批 / §327（与本次无关）。
> A 阶段已落地：M1/M2/M3/M4/M7/M8/M9 通知接入、APPROVAL_SUBMIT/PASS/REJECT/WITHDRAW 埋点、驳回意见必填校验、ApprovalDrawer 变更摘要 —— **本次仅补 M5/M6 + 时间轴扫描 cron**。

---

## 一、背景与范围

### 1.1 已具备条件（零数据迁移）
| 字段 / 配置 | 位置 | 当前默认 | 备注 |
|---|---|---|---|
| `doc_approval_instance_nodes.remind_count` | schema / doc.sql L477 | `0` | 已有，直接 UPDATE |
| `doc_approval_instance_nodes.last_reminded_at` | schema / doc.sql L478 | `NULL` | 已有，UPDATE 为 NOW() |
| `doc_approval_templates.timeout_hours` | schema / doc.sql L410 | `24` | 每组模板各自一个 |
| `doc_system_config.remind_max_count` | doc.sql L683 | `3` | 全局，到上限触发 M6 |
| `NOTIFICATION_TEMPLATES.M5 / M6` | server/constants/notification-templates.ts | — | 模板已定义，未调用 |
| `doc_approval_instances.template_id` | schema L53 | 提交时写入 | 本次 cron 直接 JOIN 模板取 `timeout_hours` |

### 1.2 本次交付
1. Nitro scheduled task `approval:remind-timeout` — 每整点扫描 → 发 M5 / M6 → 更新 `remind_count` / `last_reminded_at`
2. `server/utils/system-config.ts` — 带进程内 5 分钟缓存的 `getSystemConfig(key, default)` helper
3. 2 个新操作日志 action：`approval.remind` / `approval.remind_limit`，归 `approval` 类
4. 2 条演示 seed（刚超时 25h / 已达上限 96h 后仍未处理）
5. 四地同步 + 文档更新

### 1.3 不在本次范围
- 前端列表的超时徽章展示 — 审批中心列表已在 A 阶段把 `remind_count > 0` 渲染成红底徽章（`ApprovalListCard`）
- M24 审批链成员因离职/调岗移除 — 依赖"离职交接运行时"整体设计，归后续
- 超时后自动撤回审批 — PRD §6.4 "您可撤回重新提交"说明由提交人主动操作，不做自动撤回

---

## 二、超时与催办模型

### 2.1 单节点超时起算点

```
node_order = 1        →  inst.started_at
node_order = N (N>1)  →  同 instance 下 node_order = N-1 节点的 action_at
```

**语义**：每个审批人从"球踢到自己这儿"开始有完整的 `timeout_hours` 小时窗口。避免多级审批在前级卡时长后，后级审批人被挤压成只有几小时窗口。

### 2.2 催办节奏（解法 A）

令 `M = doc_system_config.remind_max_count`（默认 3），`T = doc_approval_templates.timeout_hours`（默认 24）：

| 当前 `remind_count` | 触发条件 | 动作 | 副作用 |
|---|---|---|---|
| `0` | `NOW() - <node_start> >= T` | 发 **M5** 给当前审批人 | `remind_count=1`, `last_reminded_at=NOW()`, 写 `approval.remind` 日志 |
| `1..M-1` | `NOW() - last_reminded_at >= T` | 发 **M5** 给当前审批人 | `remind_count++`, `last_reminded_at=NOW()`, 写 `approval.remind` 日志 |
| `M` | `NOW() - last_reminded_at >= T` | 发 **M6** 给**提交人** | `remind_count=M+1`（哨兵态）, `last_reminded_at=NOW()`, 写 `approval.remind_limit` 日志 |
| `>M` | — | **不再发** | 提交人需主动撤回 |

**统一表达**：取 `coalesce(last_reminded_at, <node_start>) + T <= NOW()` 为通用超时判定；`remind_count` 是否达上限决定发 M5 还是 M6。

### 2.3 事务边界
- 每个节点一次原子 UPDATE（UPDATE node SET remind_count=...）+ 对应通知/日志的 helper 调用
- 多个节点之间**不跨事务**，单节点失败不影响其他节点（每个 try/catch 包住，失败写 pino warn 继续）
- 扫描查询本身是读一致性即可，不需要 FOR UPDATE

---

## 三、实现结构

```
server/
├── tasks/
│   └── approval/
│       └── remind-timeout.ts           # 新增 — Nitro task
├── utils/
│   └── system-config.ts                # 新增 — 带缓存的配置读取
└── constants/
    └── log-actions.ts                  # 修改 — 追加 APPROVAL_REMIND / APPROVAL_REMIND_LIMIT
nuxt.config.ts                          # 修改 — scheduledTasks 追加 '0 * * * *': ['approval:remind-timeout']
docs/
├── patch-007-approval-timeout-reminder.sql  # 新增 — 演示 seed（可重入）
├── doc_seed.sql                              # 修改 — 四地同步
└── dev-progress.md / feature-gap-checklist.md  # 修改 — 状态回写
```

### 3.1 核心扫描 SQL（Prisma.$queryRaw）

```sql
SELECT
  n.id            AS node_id,
  n.instance_id,
  n.node_order,
  n.approver_user_id,
  n.remind_count,
  n.last_reminded_at,
  i.initiator_user_id,
  i.started_at,
  i.document_id,
  d.title,
  d.group_id,
  t.timeout_hours,
  prev.action_at  AS prev_action_at
FROM doc_approval_instance_nodes n
JOIN doc_approval_instances      i ON i.id = n.instance_id
JOIN doc_documents               d ON d.id = i.document_id
LEFT JOIN doc_approval_templates t ON t.id = i.template_id
LEFT JOIN doc_approval_instance_nodes prev
       ON prev.instance_id = n.instance_id
      AND prev.node_order  = n.node_order - 1
WHERE i.status         = 2                             -- reviewing
  AND n.node_order     = i.current_node_order          -- 当前节点
  AND n.action_status  = 1                             -- pending
  AND d.deleted_at     IS NULL
  AND COALESCE(n.last_reminded_at,
               IF(n.node_order = 1, i.started_at, prev.action_at))
      <= NOW(3) - INTERVAL COALESCE(t.timeout_hours, 24) HOUR
```

处理结果：对每一行判定 `remind_count` 与 `remind_max_count`，分流为 M5 或 M6。

### 3.2 system-config.ts 设计

```ts
// server/utils/system-config.ts
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { value: string, expireAt: number }>()

export async function getSystemConfig(key: string, defaultValue: string): Promise<string>
export async function getSystemConfigNumber(key: string, defaultValue: number): Promise<number>
export function invalidateSystemConfigCache(key?: string): void    // 配置更新时手动失效（未来管理后台用）
```

- 进程内 `Map` 缓存，TTL 5 分钟
- 缓存 miss → 查 DB → 写缓存；配置不存在 → 返回 default 但不缓存，避免"空值污染"
- helper 层面吞异常：DB 连不上时回退到 default（cron 不应因此整体失败）

### 3.3 remind-timeout.ts 执行流

```
1. logger.info('start')
2. maxRemind = getSystemConfigNumber('remind_max_count', 3)
3. rows = $queryRaw(扫描 SQL)
4. for row of rows:
     if row.remind_count < maxRemind:
        action = M5, nextCount = row.remind_count + 1
     else if row.remind_count === maxRemind:
        action = M6, nextCount = row.remind_count + 1   // 哨兵，避免再次触发
     else:
        continue                                        // 已发过 M6，不再处理
     try:
        UPDATE node SET remind_count = nextCount, last_reminded_at = NOW()
        createNotification(...)
        writeLog(APPROVAL_REMIND or APPROVAL_REMIND_LIMIT, actor=0)
     catch e:
        logger.warn({ err, nodeId: row.node_id }, 'remind failed, skip')
5. logger.info({ m5Count, m6Count, skipCount }, 'done')
```

### 3.4 日志埋点（`actor_user_id = 0`，系统触发）

| action | target | detail_json | 归类 |
|---|---|---|---|
| `approval.remind` | `target_type=approval`, `target_id=instance_id` | `{ desc, nodeOrder, remindCount, triggeredBy: 'cron.approval-remind-timeout' }` | approval |
| `approval.remind_limit` | 同上 | `{ desc, nodeOrder, maxTimes, triggeredBy: 'cron.approval-remind-timeout' }` | approval |

---

## 四、演示 seed（patch-007）

**原则**：不重用现有 `62007..62014`（它们是"待我审批 10001"tab 的样例，动它们会破坏审批中心列表演示）。单独新建 2 条专用于观察 cron。

| ID | 文档 | 归属人 | 当前级 | `started_at` | `remind_count` | `last_reminded_at` | 预期 cron 结果 |
|---|---|---|---|---|---|---|---|
| inst 62020 / node 63022 | 50032「Cron 演示·刚超时」 | 10002 | 1 (审批人 10004) | NOW-25h | 0 | NULL | 首次 M5，count=1 |
| inst 62021 / node 63023 | 50033「Cron 演示·达上限」 | 10002 | 1 (审批人 10005) | NOW-96h | 3 | NOW-25h | M6 给 10002，count=4 |

对应 `doc_documents` / `doc_document_versions` 各补 2 条（走 ID 50032/50033、51030/51031）。

---

## 五、风险与回退

| 风险 | 缓解 |
|---|---|
| cron 在启动期或 DB 慢 SQL 时被 Nitro 默认 timeout | Nitro task 默认不 timeout，长查询风险低；仍设 10s logger.warn 软阈值 |
| 两次同 cron 重叠执行 | `remind_count` 作为乐观锁——UPDATE WHERE remind_count=旧值 AND last_reminded_at=旧值；并发下一个成功一个失败（静默跳过） |
| template_id 为空（未选模板的旧数据） | `LEFT JOIN` 取不到 `timeout_hours` → `COALESCE(..., 24)` 兜底 |
| 通知 / 日志写入失败 | 单节点 try/catch，pino warn，整批继续 |
| 大量历史待办瞬时触发风暴 | 首次上线 cron 当前时刻点前的"累积超时"会一次性发 — 可接受（测试环境量不大，生产首次上线前手动清理）|

回退：移除 `nuxt.config.ts` scheduledTasks 一行即停止调度；已写入的 `remind_count` / `last_reminded_at` 保留不影响业务。

---

## 六、验收

- [ ] 本地执行 `npm run dev`，手动触发 task（`await runTask('approval:remind-timeout')` 或等整点）
- [ ] patch-007 seed 注入后跑 cron，观察：
  - 50032 → 产生 1 条 M5 通知给 10004、1 条 `approval.remind` 操作日志；节点 `remind_count` 0→1
  - 50033 → 产生 1 条 M6 通知给 10002、1 条 `approval.remind_limit` 操作日志；节点 `remind_count` 3→4
- [ ] 再跑一次 cron：50032 不触发（未到下一 24h），50033 不触发（哨兵已过）
- [ ] `feature-gap-checklist.md §2.1` 催办项打 ✅，M5 / M6 打 ✅ 2026-04-24
