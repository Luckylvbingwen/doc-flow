---
name: vue3-pinia-store
description: 在 Nuxt3 项目中设计和重构 Pinia 状态，保证边界清晰、动作可预测、易维护。
---

# Vue3 Pinia 状态设计

## 适用场景

- 需要在页面或组件间共享状态。
- 页面本地状态过重，需要抽离为可复用 Store。

## 检查清单

- 只定义必要状态结构，避免冗余字段。
- 异步逻辑统一放在 actions。
- 派生数据通过 getters 管理。
- 副作用显式处理且可追踪。
- 纯 UI 临时态避免塞进全局 Store。

## 输出

- Store API 设计。
- Action 执行流。
- 边界场景处理。

## 中文调用示例

```text
用 vue3-pinia-store 设计“文档筛选与分页”共享状态。
```
