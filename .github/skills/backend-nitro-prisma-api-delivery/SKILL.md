---
name: backend-nitro-prisma-api-delivery
description: 基于 Nitro + Prisma 设计与交付后端 API，覆盖参数校验、事务安全与错误结构一致性。
---

# 后端 Nitro Prisma API 交付

## 适用场景

- 在 `server/api/` 新增或改造接口。
- 在 `prisma/schema.prisma` 设计或调整数据模型。
- 新增飞书或第三方集成接口。

## 输入要求

- 接口清单与业务规则。
- 请求/响应契约。
- 数据落库策略与副作用要求。

## 执行步骤

1. 明确接口路径、方法与鉴权规则。
2. 校验请求参数，拦截非法状态流转。
3. 以最小查询面实现 Prisma 数据访问。
4. 多步骤写入场景使用事务封装。
5. 返回稳定响应结构，明确失败原因。
6. 记录关键风险：幂等、并发竞争、权限边界。

## 输出格式

- API 契约摘要。
- Prisma 模型与表映射。
- 错误处理与回滚策略。
- 测试检查清单。

## 仓库约定

- 按业务域组织 `server/api/**` 接口目录。
- 复用 `server/utils/prisma.ts` 的 Prisma 客户端。
- 集成密钥放在 runtime config 与 `.env`。

## 中文调用示例

```text
用 backend-nitro-prisma-api-delivery 实现“文档版本提交接口”。

范围：
- API：POST /api/version/commit
- 模型：Document、DocumentVersion
- 规则：仅创建人可提交，重复提交需幂等

输出：
- 接口契约
- Prisma 变更建议
- 事务与回滚方案
- 测试点清单
```
