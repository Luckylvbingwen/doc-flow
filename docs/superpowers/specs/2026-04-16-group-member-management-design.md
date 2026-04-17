# 组成员管理 — 设计文档

> 日期：2026-04-16
> 范围：A 阶段 — 成员 CRUD + 飞书成员选择器（标准形态）
> 后续：B 阶段追加继承机制，C 阶段追加通知和日志

---

## 1. 功能概述

为文档组提供完整的成员管理能力，包括：查看成员列表、通过飞书通讯录选择器批量添加成员、修改成员权限、移除成员。组负责人（immutable_flag=1）不可修改权限或移除。

PRD 对应章节：§250-255（公司层组设置-成员管理）、§317-320（部门组差异）、§393-396（产品线组差异）、§430-441（成员选择器）。

---

## 2. 后端 API

### 2.1 接口列表

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/groups/:id/members` | 成员列表 |
| POST | `/api/groups/:id/members` | 批量添加成员 |
| PUT | `/api/groups/:id/members/:memberId` | 修改成员权限 |
| DELETE | `/api/groups/:id/members/:memberId` | 移除成员 |
| GET | `/api/users/tree` | 部门树 + 部门下用户列表（成员选择器数据源） |

### 2.2 GET /api/groups/:id/members

返回指定组的全部活跃成员（deleted_at IS NULL）。

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": "成员记录ID (doc_group_members.id)",
      "userId": "用户ID",
      "name": "张三",
      "email": "zhang@example.com",
      "avatar": "https://...",
      "role": 1,
      "sourceType": 1,
      "immutableFlag": 1,
      "joinedAt": 1713200000000
    }
  ]
}
```

**排序规则：** immutable_flag DESC → role ASC → joined_at ASC（负责人置顶，管理员优先）。

### 2.3 POST /api/groups/:id/members

批量添加成员。

**请求体：**

```json
{
  "members": [
    { "userId": 10002, "role": 3 },
    { "userId": 10003, "role": 2 }
  ]
}
```

**规则：**
- members 数组长度 1-50
- role 取值 1（管理员）/ 2（可编辑）/ 3（上传下载）
- 已是组成员的 userId 跳过，不报错
- source_type 写 1（手动添加），immutable_flag 写 0
- created_by 为当前操作人

**响应：** 返回新增的成员列表 + 跳过的数量。

### 2.4 PUT /api/groups/:id/members/:memberId

修改成员权限。

**请求体：**

```json
{
  "role": 2
}
```

**规则：**
- immutable_flag=1 的成员不可修改，接口返回 403
- role 取值 1 / 2 / 3

### 2.5 DELETE /api/groups/:id/members/:memberId

移除成员（软删除，设置 deleted_at）。

**规则：**
- immutable_flag=1 的成员不可移除，接口返回 403
- 不可移除自己（操作人 == 被移除人），返回 400

### 2.6 GET /api/users/tree

返回部门列表 + 部门下用户，供成员选择器使用。数据来源为本地已同步数据。

**数据关联方式：**
- `doc_departments` 为扁平结构（无 parent_id），前端展示为可展开的部门列表（非嵌套树）
- 用户-部门映射：`doc_feishu_users.feishu_department_ids`（JSON 数组）存储该用户所属的飞书部门 ID 列表
- 连接路径：`doc_users.feishu_open_id` ↔ `doc_feishu_users.feishu_open_id` → `feishu_department_ids` 包含 `doc_departments.feishu_department_id`
- 一个用户可能属于多个部门，会在多个部门下重复出现

**Query 参数：**
- `groupId`（可选）：传入时，返回数据中标记已是该组成员的用户

**响应：**

```json
{
  "success": true,
  "data": {
    "departments": [
      {
        "id": 1,
        "name": "技术部",
        "memberCount": 5,
        "members": [
          {
            "id": 10001,
            "name": "张三",
            "email": "zhang@example.com",
            "avatar": "https://...",
            "joined": false
          }
        ]
      }
    ]
  }
}
```

`joined: true` 表示该用户已是 groupId 对应组的成员，前端灰显 + 标记"已加入"。

### 2.7 权限校验

谁可以管理成员（与 PRD §223/§285/§348 对齐）：

| scope | 可管理成员的角色 |
|---|---|
| 公司层 | 系统管理员、公司层管理员（自建组） |
| 部门 | 部门负责人（继承管理员）、组负责人（本组） |
| 产品线 | 产品线负责人、组负责人（本组） |

实现方式：复用现有 `requireGroupPermission()` 逻辑，额外判断：组内 role=1（管理员）的成员也具有管理权限。

### 2.8 错误码

在 `server/constants/error-codes.ts` 中新增：

| 错误码 | 说明 |
|---|---|
| `MEMBER_IMMUTABLE` | 该成员不可修改/移除（组负责人或继承成员） |
| `MEMBER_SELF_REMOVE` | 不可移除自己 |
| `MEMBER_ALREADY_EXISTS` | 成员已存在（批量添加时作为跳过提示，不阻断） |

---

## 3. Zod Schema

文件：`server/schemas/group-member.ts`

```typescript
import { z } from 'zod'

// 添加成员 — 批量
export const addMembersSchema = z.object({
  members: z.array(z.object({
    userId: z.number().int().positive(),
    role: z.union([z.literal(1), z.literal(2), z.literal(3)])
  })).min(1).max(50)
})

// 修改权限
export const updateMemberRoleSchema = z.object({
  role: z.union([z.literal(1), z.literal(2), z.literal(3)])
})

export type AddMembersBody = z.infer<typeof addMembersSchema>
export type UpdateMemberRoleBody = z.infer<typeof updateMemberRoleSchema>
```

---

## 4. 前端组件

### 4.1 成员选择器弹窗 — `MemberSelectorModal.vue`

PRD §430-441 标准形态。通用组件，后续审批人选择等场景复用。

**Props：**
- `modelValue: boolean` — 控制弹窗显示
- `groupId?: number` — 传入时查询已加入成员，灰显+标记"已加入"
- `multiple?: boolean` — 是否多选，默认 true（负责人移交场景为 false）
- `excludeUserIds?: number[]` — 额外排除的用户 ID

**Emits：**
- `update:modelValue`
- `confirm(selectedUsers: SelectedUser[])` — 确认选择

**布局（参照飞书原生成员选择器）：**
- 弹窗分左右两栏
- **左栏**：
  - 顶部搜索框（按姓名模糊搜索全部用户）
  - 面包屑导航（如「联系人 > 组织架构 > 研发部」），点击可回退层级
  - 列表区：当前层级下的部门和成员混合展示。部门项点击后钻入下一层（更新面包屑），成员项显示复选框 + 头像 + 姓名
  - 已加入成员：复选框 disabled + 灰显 + 右侧标签"已加入"
- **右栏**：
  - 顶部「已选：N 个」
  - 已选成员列表（姓名 + ✕ 移除按钮）
- **底部**：取消 / 确认 按钮

**数据源：** `GET /api/users/tree?groupId=xxx`，查本地已同步的部门/用户数据。

### 4.2 组设置弹窗 — `GroupSettingsModal.vue`

组设置入口，包含三个 Tab。

**Props：**
- `modelValue: boolean`
- `groupId: number`
- `groupName: string`

**Tab 结构：**
1. **审批流配置** — 本阶段占位，显示"即将上线"
2. **成员管理** — 本阶段实现
3. **基本设置** — 本阶段实现（组名称编辑 + 归属层级只读 + 描述编辑 + 创建时间只读 + 删除组）

### 4.3 成员管理 Tab — `GroupMemberPanel.vue`

**布局：**
- 顶部行：「共 N 人」标题 + 「+ 邀请成员」按钮（右对齐）
- 表格列：

| 列 | 内容 |
|---|---|
| 成员 | 头像 + 姓名 |
| 邮箱 | 用户邮箱 |
| 权限 | el-select 下拉：管理员/可编辑/上传下载 |
| 来源 | badge 标签（组负责人=红色/飞书同步/手动添加） |
| 操作 | 「移除」文字按钮 |

**交互规则：**
- 组负责人行：权限下拉 disabled（锁定为管理员），无移除按钮，badge「组负责人」红色
- 普通成员行：权限下拉可切换（变更即时调用 PUT 接口），操作列有「移除」
- 移除确认：`"确定移除成员「{姓名}」吗？移除后该成员将无法访问此组的文件。"`
- 邀请成员：点击打开 MemberSelectorModal，确认后带权限下拉（默认：上传下载）调用 POST 接口

### 4.4 添加成员流程中的权限选择

依据 **PRD §254**：「添加成员 -- 飞书成员选择器 + 权限下拉 + 添加按钮 -- 默认权限：上传下载」。

实现方式：在 MemberSelectorModal 底部栏左侧放"默认权限"下拉（管理员 / 可编辑 / 上传下载，默认选中「上传下载」），右侧放"取消 / 确认"按钮。这样 PRD 要求的三要素（选择器 + 权限下拉 + 添加按钮）一次交互完成。

> 备注：原型 `prototype-v21.0.html` 中 `openMemberSelector` 简化实现，底部只有取消/确认，不体现权限下拉。以 PRD 为准。

### 4.5 数据调用链路

```
邀请成员按钮 → MemberSelectorModal(打开)
  → GET /api/users/tree?groupId=xxx（部门树+用户，标记已加入）
  → 用户多选 + 权限选择 → 确认
  → POST /api/groups/:id/members（批量添加）
  → 刷新成员列表

权限下拉变更 → PUT /api/groups/:id/members/:memberId → 刷新该行
移除按钮 → 确认弹窗 → DELETE /api/groups/:id/members/:memberId → 刷新列表
```

---

## 5. 前端类型定义

文件：`types/group-member.ts`

```typescript
// 从 Zod schema 推导请求类型
export type { AddMembersBody, UpdateMemberRoleBody } from '~/server/schemas/group-member'

// 成员列表项
export interface GroupMember {
  id: number
  userId: number
  name: string
  email: string | null
  avatar: string | null
  role: 1 | 2 | 3
  sourceType: 1 | 2 | 3
  immutableFlag: 0 | 1
  joinedAt: number
}

// 成员选择器 — 部门节点（扁平结构，无嵌套）
export interface DeptTreeNode {
  id: number
  name: string
  memberCount: number
  members: DeptTreeMember[]
}

// 成员选择器 — 部门下用户
export interface DeptTreeMember {
  id: number
  name: string
  email: string | null
  avatar: string | null
  joined: boolean
}

// 成员选择器 — 选中结果
export interface SelectedUser {
  id: number
  name: string
  avatar: string | null
}
```

---

## 6. 前端 API 封装

文件：`api/group-members.ts`

| 函数 | 方法 | 路径 |
|---|---|---|
| `fetchGroupMembers(groupId)` | GET | `/api/groups/${groupId}/members` |
| `addGroupMembers(groupId, body)` | POST | `/api/groups/${groupId}/members` |
| `updateMemberRole(groupId, memberId, body)` | PUT | `/api/groups/${groupId}/members/${memberId}` |
| `removeMember(groupId, memberId)` | DELETE | `/api/groups/${groupId}/members/${memberId}` |
| `fetchUserTree(groupId?)` | GET | `/api/users/tree` |

全部使用 `useAuthFetch()` 封装。

---

## 7. 文件清单

### 新增文件

| 文件 | 说明 |
|---|---|
| `server/schemas/group-member.ts` | Zod 校验 schema |
| `server/api/groups/[id]/members/index.get.ts` | 成员列表 |
| `server/api/groups/[id]/members/index.post.ts` | 批量添加成员 |
| `server/api/groups/[id]/members/[memberId].put.ts` | 修改权限 |
| `server/api/groups/[id]/members/[memberId].delete.ts` | 移除成员 |
| `server/api/users/tree.get.ts` | 部门树+用户列表 |
| `types/group-member.ts` | 前端类型 |
| `api/group-members.ts` | 前端 API 封装 |
| `components/MemberSelectorModal.vue` | 成员选择器弹窗 |
| `components/GroupSettingsModal.vue` | 组设置弹窗（3 Tab） |
| `components/GroupMemberPanel.vue` | 成员管理 Tab 面板 |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `server/constants/error-codes.ts` | 新增 MEMBER_IMMUTABLE / MEMBER_SELF_REMOVE 错误码 |
| `server/utils/group-permission.ts` | 增加组管理员（role=1）的成员管理权限判断 |
| `pages/docs/index.vue` | `onGroupSettings()` 从 stub 改为打开 GroupSettingsModal |
| `components/DocExplorerPanel.vue` | 组详情中显示成员数，设置按钮入口 |
| `docs/api-auth-design.md` | 更新接口文档 |

---

## 8. 不在本阶段范围

- 部门/产品线负责人自动继承（B 阶段）
- 负责人移交流程（B 阶段）
- 成员变更通知 M18-M22（C 阶段）
- 成员变更操作日志（C 阶段）
- 文档级权限设置（独立功能模块）
