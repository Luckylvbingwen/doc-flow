---
name: nitro-prisma-transaction-safety
description: 确保 Nitro + Prisma 写入链路具备事务安全、幂等能力和并发稳定性。
---

# Nitro Prisma 事务安全

## 适用场景

- 实现多步骤写入 API。
- 处理版本递增、状态流转和副作用。
- 评估并发竞争与数据一致性风险。

## 检查清单

- 事务边界是否明确。
- 是否有幂等策略（token/key/幂等校验）。
- 是否需要乐观锁/悲观锁。
- 回滚行为是否可预期。
- 错误码与状态映射是否稳定。

## 输出

- 安全风险清单。
- 事务方案建议。
- 并发与回滚测试用例。

## 中文调用示例

```text
用 nitro-prisma-transaction-safety 评审“版本提交接口”的并发和回滚安全性。
```
