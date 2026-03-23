---
name: nitro-prisma-transaction-safety
description: Ensure Nitro + Prisma write flows are transaction-safe, idempotent, and resilient under concurrent requests.
---

# Nitro Prisma Transaction Safety

## Use When

- Implementing multi-step write APIs.
- Handling version increment, status transition, or side effects.
- Reviewing race condition risks.

## Checklist

- Transaction boundary defined.
- Idempotency strategy (token/key/check).
- Optimistic/pessimistic concurrency control as needed.
- Explicit rollback behavior.
- Stable error code and status mapping.

## Output

- Safety risk list.
- Recommended transaction plan.
- Test cases for concurrency and rollback.
