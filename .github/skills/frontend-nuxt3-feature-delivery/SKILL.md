---
name: frontend-nuxt3-feature-delivery
description: Deliver Nuxt3 + Element Plus feature pages with clear route/store/API mapping and production-ready implementation checklist.
---

# Frontend Nuxt3 Feature Delivery

## Use When

- Building new pages in `pages/` and `layouts/`.
- Adding interaction flows with Pinia state in `stores/`.
- Integrating server APIs with `$fetch`.

## Required Input

- Feature/PRD description.
- Target routes and expected user actions.
- API contract or temporary response shape.

## Workflow

1. Clarify page scope: route entry, role, key actions, empty/error states.
2. Define data model for page and map fields to API response.
3. Split state into local state vs Pinia shared state.
4. Build UI with Element Plus components and loading/error feedback.
5. Add API adapter function and request error handling.
6. Validate desktop/mobile behavior and route navigation.

## Output Format

- Route and page list.
- Pinia store updates.
- API dependency mapping.
- Acceptance checklist.

## Notes for This Repo

- Prefer SSR-safe logic for Nuxt pages.
- Keep shared styles in `assets/styles/`.
- Keep business state in `stores/` and avoid overusing global state.
