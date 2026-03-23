---
name: vue3-pinia-store
description: Design and refactor Pinia stores with clear boundaries, typed state, and predictable actions for Nuxt3 projects.
---

# Vue3 Pinia Store

## Use When

- Adding shared state across pages/components.
- Refactoring bloated page-local state into reusable store modules.

## Checklist

- Define minimal state shape.
- Keep async logic in actions.
- Separate derived data via getters.
- Keep side effects explicit and traceable.
- Avoid storing temporary UI-only state globally.

## Output

- Store API design.
- Action flow.
- Edge-case handling.
