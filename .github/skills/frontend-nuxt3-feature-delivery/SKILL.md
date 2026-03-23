---
name: frontend-nuxt3-feature-delivery
description: 使用 Nuxt3 + Element Plus 交付功能页面，明确路由、状态与 API 映射，并输出可落地实施清单。
---

# 前端 Nuxt3 功能交付

## 适用场景

- 在 `pages/`、`layouts/` 新增业务页面。
- 在 `stores/` 中新增或调整 Pinia 状态。
- 使用 `$fetch` 对接后端接口。

## 输入要求

- 功能或 PRD 描述。
- 目标路由与用户关键操作。
- API 契约或临时响应结构。

## 执行步骤

1. 明确页面范围：入口路由、角色、关键动作、空态和错误态。
2. 定义页面数据模型，并映射到 API 字段。
3. 拆分状态：本地临时状态与 Pinia 共享状态。
4. 基于 Element Plus 设计交互，补齐加载与错误反馈。
5. 实现 API 调用层，统一异常处理与提示。
6. 验证桌面端/移动端显示与路由跳转逻辑。

## 输出格式

- 路由与页面清单。
- Pinia 改动点。
- API 依赖映射。
- 验收检查清单。

## 仓库约定

- Nuxt 页面优先采用 SSR 安全写法。
- 通用样式统一放在 `assets/styles/`。
- 业务共享状态放在 `stores/`，避免无边界全局状态。

## 中文调用示例

```text
用 frontend-nuxt3-feature-delivery 实现“文档列表页 + 筛选 + 详情跳转”。

范围：
- 页面：/documents、/documents/:id
- API：GET /api/documents, GET /api/documents/:id
- 状态：筛选条件与分页状态

输出：
- 页面结构方案
- Pinia 设计
- 接口字段映射表
- 验收清单
```
