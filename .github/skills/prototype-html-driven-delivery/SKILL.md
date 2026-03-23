---
name: prototype-html-driven-delivery
description: 基于 docs/prototype-v4.html 原型单一事实源，驱动 Nuxt3 + Element Plus 页面、交互与后端接口协同开发。
---

# 原型驱动开发 Skill（DocFlow）

## 目标

将 `docs/prototype-v4.html` 作为原型真相源（Source of Truth），在后续开发中直接按原型结构进行实现、拆解、联调与验收。

## 原型真相源

- 主源文件：`docs/prototype-v4.html`
- 当前基线：v4 原型（标题显示 v7.0）
- 关键模块（已识别）：
  - 左侧导航与顶部 Header
  - 组织树与仓库浏览（`org-explorer`）
  - 文件详情页（`file-detail-header`）
  - 版本侧栏（`fd-version-sidebar`）
  - 版本对比视图（compare panes）
  - 飞书批注与弹层（`feishu-anno`）
  - 审批中心、通知中心、系统管理、回收站等页面块

## 适用场景

- 需要“按原型还原页面与交互”开发。
- 需要将原型拆为 Nuxt 页面、组件、Store、API 任务。
- 需要在 PRD、原型、代码之间建立一致性检查。

## 输入要求

- 目标范围（页面/模块/链路）。
- 是否需要同时输出 FE/BE/DB 拆解。
- 当前迭代约束（时间、优先级、非目标）。

## 执行步骤

1. 读取原型并锁定目标区域（按 class/id/功能块定位）。
2. 产出“原型块 -> 代码落点”映射：
   - 页面：`pages/**`
   - 组件：`components/**`（如新增）
   - 状态：`stores/**`
   - API：`server/api/**`
3. 先实现主链路，再补空态、错误态、权限态。
4. 为文件预览、版本对比、飞书批注预留接口与扩展点。
5. 交付时输出原型一致性检查清单。

## 输出格式

- 原型功能分解清单。
- 路由/组件/Store/API 映射表。
- 开发任务优先级（P0/P1/P2）。
- 风险与假设清单。
- 验收清单（对齐原型）。

## 开发约束（本项目）

- 前端：Nuxt3 + Element Plus + Pinia。
- 后端：Nitro API。
- 数据：Prisma + MySQL。
- 样式：优先复用全局设计变量，避免无序新增色值。

## 原型变更后的更新机制

当 `docs/prototype-v4.html` 改动时，必须同步更新本 Skill：

1. 比对变更：模块新增/删除、class/id 改名、交互流程变化。
2. 更新本文件中的“关键模块”和“执行步骤”。
3. 在文末“更新记录”追加一条变更说明。
4. 若改动影响调用方式，更新“中文调用示例”。

## 中文调用示例

```text
用 prototype-html-driven-delivery 按原型开发“文件详情 + 版本对比 + 飞书批注”。

范围：
- 原型来源：docs/prototype-v4.html
- 页面：文件详情页
- 接口：版本列表、版本对比、批注列表

输出：
- 原型块到代码映射
- FE/BE/DB 任务拆解
- 本迭代验收清单
```

```text
用 prototype-html-driven-delivery 把 org-explorer 区域落地到 Nuxt 页面。
要求：
- 保留左侧树 + 右侧仓库卡片布局
- 支持折叠、选中、hover 操作入口
- 输出组件拆分方案与状态设计
```

## 更新记录

- 2026-03-23：初始化 Skill，绑定 `docs/prototype-v4.html` 作为原型真相源。
