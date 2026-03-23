---
name: backend-nitro-prisma-api-delivery
description: Build and review Nitro API endpoints with Prisma models, including validation, transaction safety, and error shape consistency.
---

# Backend Nitro Prisma API Delivery

## Use When

- Creating API files under `server/api/`.
- Designing or refactoring Prisma schema in `prisma/schema.prisma`.
- Adding Feishu or third-party integration endpoints.

## Required Input

- Endpoint list and business rules.
- Request/response contract.
- Data persistence and side effects.

## Workflow

1. Define endpoint path, method, and auth expectations.
2. Validate request payload and reject invalid state transitions.
3. Implement Prisma operations with minimal query surface.
4. Wrap multi-step writes in transactions when needed.
5. Return stable response shape with explicit failure reasons.
6. Record risk points: idempotency, race condition, permission boundary.

## Output Format

- API contract summary.
- Prisma model/table mapping.
- Error and rollback strategy.
- Test checklist.

## Notes for This Repo

- Place endpoint by domain in `server/api/**`.
- Reuse Prisma client from `server/utils/prisma.ts`.
- Keep integration secrets in runtime config and `.env`.
