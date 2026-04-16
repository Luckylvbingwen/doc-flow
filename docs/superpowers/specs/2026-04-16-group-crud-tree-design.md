# 文档组 CRUD + 树结构 + 产品线基础 CRUD — 设计文档

> 第一期：组的创建/编辑/删除/树结构展示 + 产品线基础 CRUD
> 对齐 PRD: 企业文档管理系统-产品需求说明文档 v2.1 §6.3.2

---

## 1. 范围

### 包含

- 组树查询接口（三分类：公司层 / 按部门 / 按产品线）
- 组 CRUD（创建、编辑、删除、详情）
- 产品线基础 CRUD（创建、编辑、删除、列表）
- 前端树接通真实数据，替换现有 mock
- 右侧面板根据选中节点类型展示内容
- 创建/编辑弹窗
- 树节点操作菜单
- 权限校验（按 PRD 角色规则）

### 不包含（后续迭代）

- 组成员管理（添加/移除/角色变更）
- 组设置（审批模板、文件大小限制、文件类型白名单、命名规范）
- 负责人交接 + 级联更新
- 部门负责人/产品线负责人自动继承机制
- 部门 CRUD（飞书单向同步，本期只读展示）

---

## 2. 后端 API

### 2.1 组树查询

```
GET /api/groups/tree
权限: 登录即可（树节点可见性由角色决定为后续迭代，本期返回全量树）
```

**响应结构**（直接匹配前端 `NavTreeCategory[]`）:

```jsonc
{
  "success": true,
  "code": "OK",
  "data": [
    {
      "id": "company",
      "label": "公司层",
      "scope": "company",
      "badge": 2,           // 直属组数量
      "groups": [
        {
          "id": 40001,
          "name": "公司文档中心",
          "fileCount": 5,    // 已发布文档数
          "owner": "文档负责人",
          "desc": "企业级公共文档目录",
          "children": []
        }
      ]
    },
    {
      "id": "department",
      "label": "按部门",
      "scope": "department",
      "badge": 3,
      "orgUnits": [
        {
          "id": "dept_20001",
          "label": "研发中心",
          "badge": 2,        // 直属组数量
          "groups": [
            {
              "id": 40002,
              "name": "研发规范组",
              "fileCount": 0,
              "owner": "文档负责人",
              "children": [
                { "id": 40004, "name": "Alpha项目组", "fileCount": 2, "owner": "文档编辑", "children": [] }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "productline",
      "label": "按产品线",
      "scope": "productline",
      "badge": 1,
      "orgUnits": [
        {
          "id": "pl_30001",
          "label": "DocFlow产品线",
          "badge": 1,
          "groups": [
            { "id": 40003, "name": "产品资料组", "fileCount": 0, "owner": "文档编辑", "children": [] }
          ]
        }
      ]
    }
  ]
}
```

**后端逻辑**:

1. 查询所有未删除的 `doc_groups`，按 `scope_type` 分组
2. 查询所有未删除的 `doc_departments`，构建部门 orgUnits
3. 查询所有未删除的 `doc_product_lines`，构建产品线 orgUnits
4. 递归构建组树（`parent_id` 关系）
5. 统计每组已发布文档数量（`doc_documents` where `status = 4` and `deleted_at IS NULL`）
6. 关联 `doc_users` 取负责人名称

### 2.2 组 CRUD

#### 创建组

```
POST /api/groups
Content-Type: application/json

{
  "name": "Alpha项目组",         // 必填，1-150 字符
  "description": "项目交付文档",  // 选填，最多 500 字符
  "scopeType": 2,                // 1=公司层 2=部门 3=产品线
  "scopeRefId": 20001,           // scopeType=2|3 时必填，关联部门/产品线 ID
  "parentId": 40002              // 选填，父组 ID（创建子组时传入）
}
```

**后端逻辑**:

1. Zod 校验请求体
2. 权限校验（见 §4）
3. 校验同级名称唯一（`parent_id` + `name` + `deleted_at IS NULL`）
4. 若有 `parentId`，校验父组存在且 `scope_type`/`scope_ref_id` 一致
5. 生成雪花 ID
6. 插入 `doc_groups`，`owner_user_id` = `created_by` = 当前用户
7. 插入 `doc_group_members`（当前用户，role=1 管理员，source_type=1 手动，immutable_flag=1）
8. 返回新组详情

#### 组详情

```
GET /api/groups/:id
```

返回组基本信息 + 负责人名称 + 文档统计。

#### 编辑组

```
PUT /api/groups/:id
Content-Type: application/json

{
  "name": "新名称",        // 选填
  "description": "新描述"  // 选填
}
```

**后端逻辑**: 权限校验 → 名称唯一校验（同级） → 更新字段。

#### 删除组

```
DELETE /api/groups/:id
```

**后端逻辑**:

1. 权限校验
2. 检查组下是否有未删除的文档（`doc_documents` where `group_id = :id` and `deleted_at IS NULL`）→ 有则拒绝
3. 检查组下是否有子组（`doc_groups` where `parent_id = :id` and `deleted_at IS NULL`）→ 有则拒绝
4. 软删除：设置 `deleted_at = NOW()`

### 2.3 产品线 CRUD

#### 列表

```
GET /api/product-lines
权限: 登录即可
```

返回所有未删除产品线（含负责人名称）。

#### 创建

```
POST /api/product-lines
权限: super_admin

{
  "name": "AI协同产品线",
  "description": "智能知识协同方向"
}
```

创建者自动成为 `owner_user_id`。

#### 编辑

```
PUT /api/product-lines/:id
权限: super_admin
```

#### 删除

```
DELETE /api/product-lines/:id
权限: super_admin
```

含组时拒绝删除（`doc_groups` where `scope_type = 3` and `scope_ref_id = :id` and `deleted_at IS NULL`）。

---

## 3. Zod 校验 Schema

文件: `server/schemas/group.ts`

```typescript
// 创建组
groupCreateSchema = z.object({
  name:        z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  scopeType:   z.number().int().min(1).max(3),
  scopeRefId:  z.number().int().positive().optional(),
  parentId:    z.number().int().positive().optional(),
})

// 编辑组
groupUpdateSchema = z.object({
  name:        z.string().min(1).max(150).optional(),
  description: z.string().max(500).optional(),
}).refine(d => d.name || d.description !== undefined, { message: '至少提供一个字段' })
```

文件: `server/schemas/product-line.ts`

```typescript
// 创建产品线
productLineCreateSchema = z.object({
  name:        z.string().min(1).max(150),
  description: z.string().max(500).optional(),
})

// 编辑产品线
productLineUpdateSchema = z.object({
  name:        z.string().min(1).max(150).optional(),
  description: z.string().max(500).optional(),
}).refine(d => d.name || d.description !== undefined, { message: '至少提供一个字段' })
```

---

## 4. 权限校验规则

### 组操作权限

| 操作 | 允许的角色 |
|------|-----------|
| 公司层创建组 | `super_admin`、`company_admin` |
| 部门下创建组 | 该部门的 `dept_head`（scope_type=1, scope_ref_id=部门ID） |
| 产品线下创建组 | 该产品线的 `pl_head`（scope_type=2, scope_ref_id=产品线ID）或 `super_admin` |
| 组下创建子组 | 该组的 `owner_user_id` |
| 编辑组 | 该组的 `owner_user_id`，或对应 scope 的管理角色（dept_head/pl_head/super_admin） |
| 删除组 | 同编辑组 |

### 产品线操作权限

| 操作 | 允许的角色 |
|------|-----------|
| 创建/编辑/删除产品线 | `super_admin` |

### 校验实现

新增工具函数 `server/utils/group-permission.ts`:

```typescript
/**
 * 校验用户是否有权操作指定组
 * 逻辑: 是组负责人 OR 拥有对应 scope 的管理角色
 */
async function requireGroupPermission(event, groupOrParams): Promise<void>
```

---

## 5. 前端架构

### 5.1 新增文件

```
api/groups.ts                          # 组 API 封装
api/product-lines.ts                   # 产品线 API 封装
server/schemas/group.ts                # 组 Zod schema
server/schemas/product-line.ts         # 产品线 Zod schema
server/api/groups/tree.get.ts          # 组树接口
server/api/groups/index.post.ts        # 创建组
server/api/groups/[id].get.ts          # 组详情
server/api/groups/[id].put.ts          # 编辑组
server/api/groups/[id].delete.ts       # 删除组
server/api/product-lines/index.get.ts  # 产品线列表
server/api/product-lines/index.post.ts # 创建产品线
server/api/product-lines/[id].put.ts   # 编辑产品线
server/api/product-lines/[id].delete.ts# 删除产品线
server/utils/group-permission.ts       # 组权限校验工具
components/GroupFormModal.vue           # 组 创建/编辑 弹窗
components/ProductLineFormModal.vue    # 产品线 创建/编辑 弹窗
components/DocExplorerPanel.vue        # 右侧面板（按节点类型展示内容）
components/TreeActionMenu.vue          # 树节点「更多」下拉菜单
```

### 5.2 改造文件

```
pages/docs/index.vue                   # 移除 mock，接入 API + 弹窗
types/doc-nav-tree.ts                  # 补充 owner、scopeType、scopeRefId 字段
```

### 5.3 组件设计

#### GroupFormModal

```
Props:
  visible: boolean        — 控制显隐
  mode: 'create' | 'edit' — 模式
  group?: object          — 编辑时传入现有数据
  location?: string       — 创建位置路径（如 "按部门 / 研发中心 / 研发规范组"）
  scopeType?: number      — 创建时的 scope
  scopeRefId?: number     — 创建时关联的部门/产品线 ID
  parentId?: number       — 创建子组时的父 ID

Events:
  update:visible          — 关闭
  success                 — 操作成功，外层刷新树
```

#### ProductLineFormModal

```
Props:
  visible: boolean
  mode: 'create' | 'edit'
  productLine?: object    — 编辑时传入

Events:
  update:visible
  success
```

#### DocExplorerPanel

```
Props:
  type: 'empty' | 'category' | 'department' | 'productline' | 'group'
  data: object            — 选中节点的数据

根据 type 渲染不同内容:
  empty       → 空状态引导
  category    → 分类统计 + 组卡片列表
  department  → 部门信息 + 组卡片列表
  productline → 产品线信息 + 组卡片列表
  group       → 组详情卡片 + 「进入仓库」按钮
```

#### TreeActionMenu

```
Props:
  nodeType: 'category' | 'org' | 'group'
  nodeData: object
  permissions: object     — 当前用户权限

菜单项根据节点类型和权限动态生成:
  组节点: 编辑、创建子组、删除
  部门节点: 创建组
  产品线节点: 编辑、创建组、删除
  公司层分类: 创建组
```

### 5.4 数据流

```
页面加载
  → fetchGroupTree()
  → 赋值给 treeCategories
  → DocNavTree 渲染

用户点击组节点
  → group-select 事件
  → 更新 selectedNode (type + data)
  → DocExplorerPanel 展示组详情

用户 hover「+」
  → category-create / org-create / group-create 事件
  → 打开 GroupFormModal 或 ProductLineFormModal（预填 scope 信息）

用户 hover「...」
  → category-more / org-more / group-more 事件
  → 打开 TreeActionMenu

弹窗提交成功
  → success 事件
  → 重新 fetchGroupTree() 刷新树
```

---

## 6. 数据库依赖

本期使用的表（均已在 doc.sql / rbac.sql 中创建）:

| 表 | 用途 |
|----|------|
| `doc_groups` | 组 CRUD + 树结构 |
| `doc_group_members` | 创建组时自动插入负责人记录 |
| `doc_departments` | 读取部门列表构建树 |
| `doc_product_lines` | 产品线 CRUD + 构建树 |
| `doc_documents` | 统计已发布文档数、删除前校验 |
| `doc_users` | 关联负责人名称 |
| `sys_user_roles` + `sys_roles` | 权限校验 |

---

## 7. 雪花 ID 生成

组、组成员、产品线等表的主键为 `BIGINT UNSIGNED`，需要雪花 ID 生成器。

新增 `server/utils/snowflake.ts`，提供 `generateId(): bigint` 函数。使用轻量级实现（基于时间戳 + 机器标识 + 序列号），无外部依赖。
