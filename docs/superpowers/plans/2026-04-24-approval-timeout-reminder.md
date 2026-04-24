---
title: 审批超时催办实现计划（M5 / M6 + cron）
spec: 2026-04-24-approval-timeout-reminder-design.md
status: in-progress
owner: lvbingwen
date: 2026-04-24
---

# 审批超时催办实现计划

分 3 阶段，每阶段结束后暂停等用户自行 commit。

---

## 阶段 1：数据 / 工具层

### Task 1-1：log-actions 追加 2 个常量

**文件**：`server/constants/log-actions.ts`

- `LOG_ACTIONS` 的「审批操作」段新增：
  - `APPROVAL_REMIND: 'approval.remind'`
  - `APPROVAL_REMIND_LIMIT: 'approval.remind_limit'`
- `LOG_ACTION_TO_TYPE` 对应两项归入 `'approval'`

### Task 1-2：system-config.ts helper

**文件**：`server/utils/system-config.ts`（新增）

- 签名：
  ```ts
  getSystemConfig(key: string, defaultValue: string): Promise<string>
  getSystemConfigNumber(key: string, defaultValue: number): Promise<number>
  invalidateSystemConfigCache(key?: string): void
  ```
- 进程内 `Map<string, { value, expireAt }>`，TTL 5 分钟
- 读 DB 走 `prisma.doc_system_config.findUnique({ where: { config_key: key } })`
- 异常吞掉返回 default（用 pino warn 记录）
- `getSystemConfigNumber` 基于 `getSystemConfig` + `Number(v)`，NaN 回退 default

### Task 1-3：patch-007 SQL

**文件**：`docs/patch-007-approval-timeout-reminder.sql`（新增）

内容：
- 插入 2 个文档 (50032 / 50033)、2 个版本 (51030 / 51031)、2 个审批实例 (62020 / 62021)、2 个审批节点 (63022 / 63023)
- 全部用 `INSERT ... ON DUPLICATE KEY UPDATE` / `INSERT IGNORE` 保证可重入
- 归组选 40001（公司层组，PL/部门无关）；审批人用现有 10004 / 10005
- 注明 `-- 演示用：供 approval:remind-timeout cron 观察 M5 / M6 落库`

### Task 1-4：四地同步

- `docs/doc_seed.sql` — 在 K.1 段后追加 K.3 段，复制 patch-007 的 INSERT（带 `ON DUPLICATE KEY UPDATE`）
- `docs/doc.sql` / `docs/rbac.sql` / `prisma/schema.prisma` — **本次无结构变更**，跳过

### 阶段 1 commit message 草稿

```
feat: 审批超时催办 · 数据层（log action + system-config helper + 演示 seed）

- 追加 approval.remind / approval.remind_limit 两个 log action，归 approval 类
- 新增 server/utils/system-config.ts — 带 5 分钟进程内缓存的配置读取 helper
- 新增 docs/patch-007-approval-timeout-reminder.sql — 2 条 cron 演示 seed（刚超 25h / 达上限 96h）
- 四地同步：doc_seed.sql K.3 段补相同数据（可重入）
```

**⏸ 暂停，等用户 commit**

---

## 阶段 2：cron 主体

### Task 2-1：remind-timeout.ts

**文件**：`server/tasks/approval/remind-timeout.ts`（新增）

- `defineTask({ meta: { name: 'approval:remind-timeout', description: '审批超时催办扫描（M5/M6）' }, async run() {...} })`
- `useLogger('task:approval-remind')` 打 start / 每条节点处理 / 统计行
- 扫描 SQL 见 spec §3.1（Prisma.$queryRaw）
- 处理循环见 spec §3.3，M5 用 `createNotification(NOTIFICATION_TEMPLATES.M5.build({ ... overdueHours: Math.floor((NOW - nodeStart) / 3600) }))`，M6 用 `NOTIFICATION_TEMPLATES.M6.build({ ... maxTimes })`
- UPDATE 用 Prisma model 方法 `prisma.doc_approval_instance_nodes.update` 走乐观锁：`where: { id: nodeId, remind_count: oldCount }`（Prisma 不直接支持多字段 where by PK，改用 updateMany + count 校验；或者用 $executeRaw UPDATE ... WHERE id=? AND remind_count=? 返回行数判定）
- 返回 `{ result: { scanned, m5, m6, skipped } }`

### Task 2-2：nuxt.config.ts 注册

**文件**：`nuxt.config.ts`

- `scheduledTasks` 追加一行：`'0 * * * *': ['approval:remind-timeout']`
- 确保与 `'0 2 * * *': ['feishu:sync-contacts']` 同级，不冲突

### 阶段 2 commit message 草稿

```
feat: 审批超时催办 · cron 主体（approval:remind-timeout 每小时扫描）

- server/tasks/approval/remind-timeout.ts — 按节点级 24h 超时 + remind_count 状态机发 M5/M6
- nuxt.config.ts scheduledTasks 追加 '0 * * * *': ['approval:remind-timeout']
- 超时起算：第 1 级用 inst.started_at，第 N 级用前级 action_at
- 状态机：remind_count 0→M-1 发 M5 给当前审批人；=M 发 M6 给提交人；>M 不再发
- 乐观锁 UPDATE WHERE remind_count=旧值 防并发重复推送
- 每节点独立 try/catch，失败 warn 不阻塞其他节点
```

**⏸ 暂停，等用户 commit**

---

## 阶段 3：文档同步 + 联调

### Task 3-1：feature-gap-checklist.md

- §2.1 审批管理：催办触发逻辑打 ✅ 2026-04-24
- §七、通知触发点接入清单：M5 / M6 打 ✅ 2026-04-24 + 改注

### Task 3-2：dev-progress.md

- 追加 `## 2026-04-24` 段，`### feat: 审批超时催办 B 阶段（M5/M6 + cron）`，列交付项、规格依据（PRD §6.4 / doc_system_config.remind_max_count）、范围、延迟项（M24 审批链成员离职移除、超时自动撤回）
- 待开发表格：审批流运行时行改为 ✅ A 阶段 + B 阶段 均完成

### Task 3-3：联调自检清单（运行期）

- `npm run dev`
- 手动触发 `await runTask('approval:remind-timeout')`（或等整点）
- 50032 → 节点 remind_count 0→1、last_reminded_at 更新、产生 M5 通知给 10004、产生 approval.remind 日志
- 50033 → 节点 remind_count 3→4、产生 M6 通知给 10002、产生 approval.remind_limit 日志
- 再跑一次：两条都不触发（前者 24h 未到，后者已过哨兵）

### 阶段 3 commit message 草稿

```
docs: 审批超时催办 B 阶段 — 文档同步（feature-gap / dev-progress）

- feature-gap-checklist §2.1 催办 + §七 M5/M6 打 ✅ 2026-04-24
- dev-progress 追加 2026-04-24 审批超时催办 B 阶段条目
- 待开发表格：审批流运行时标记完成
```

**⏸ 阶段 3 结束，任务关闭**
