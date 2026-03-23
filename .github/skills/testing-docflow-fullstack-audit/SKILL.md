---
name: testing-docflow-fullstack-audit
description: Audit FE/BE/DB consistency for DocFlow business flows and attribute failures to FE, BE, DB, CONTRACT, RULE, or TEST_GAP.
---

# Testing DocFlow Fullstack Audit

## Use When

- Requirements are implemented but behavior is uncertain.
- Need to locate ownership of defects across FE/BE/DB.
- Need a first-round quality baseline before release.

## Required Input

- Target flow (example: upload -> preview -> version compare -> notify).
- Related pages, APIs, and Prisma models.
- Source docs (PRD/API docs).

## Workflow

1. Build a capability matrix by PRD story and current implementation.
2. Verify UI actions and visible state transitions.
3. Verify API path/method/field/error responses.
4. Verify DB model support for lifecycle, relation, and audit fields.
5. Classify each failure: FE, BE, DB, CONTRACT, RULE, TEST_GAP.
6. Provide fix priority with evidence.

## Output Format

- Consistency matrix.
- Gap and risk list.
- Root-cause attribution.
- Suggested test cases (unit/integration/e2e).

## Suggested Invocation

```text
Use testing-docflow-fullstack-audit for document version workflow.

Scope:
- Pages: ...
- APIs: ...
- Models: ...

Output:
- Matrix
- Gaps
- Attribution
- Prioritized fixes
```
