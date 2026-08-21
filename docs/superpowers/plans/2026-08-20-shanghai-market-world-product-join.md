# Shanghai Market World Product Join Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the verified M2 Shanghai ElderCare Market World usable in the existing SimWar Teacher, Student, and Admin product journey through exact-reference binding and role-safe projections.

**Architecture:** Extend the existing Course model and `RepositoryFacade.courses.saveCourse` path with an optional city-neutral `MarketWorldRef`; a small read-only product-safe projection validates the exact ref and supplies role-specific projections. Teacher binding, Student visibility, and Admin audit all reuse the current BFF/auth/tenant boundaries, while no new registry, scenario writer, route family, or settlement input is introduced.

**Tech Stack:** TypeScript, npm workspaces, Vitest, native Node HTTP BFF, React/Vite, Playwright, JSON Schema, OpenAPI, existing `@simwar/ui` components.

**Spec:** `C:\Users\Marshall\.codex\attachments\2d2dba46-fce6-4d98-bfce-e89bce4dfa1d\pasted-text-1.txt`

## Global Constraints

- Exact `market_world_id + version + digest`; never auto-latest.
- Market World is product context only; it cannot write `state_true`, demand, occupancy, finance, score, rank, SettlementResult, or Replay truth.
- Use the existing tenant-scoped Course repository writer; do not add a second Course writer or Scenario registry.
- Only the de-identified role-safe M2 projection may be materialized; raw source paths, provider rows, private coefficients, and restricted manifests stay outside the repo.
- Student projection is absent before Course visibility and must not expose other-team/private/result data.
- `INSURANCE_CAPITAL` and `AI_NATIVE_OPERATOR` remain `DRAFT_NON_BINDABLE` / `LIMITED`.
- One Product PR only; no M3, Scenario Factory, model, ParameterSet, provider, Postgres, or Figma activation.

## File map

- Create `packages/shared-contracts/src/market-world.ts`: exact ref, readiness, Teacher/Student/Admin projection types and semantic guards.
- Modify `packages/shared-contracts/src/index.ts`, `index.ts` Course interface, and `contracts/schemas/market-world.v1.json`; add the OpenAPI paths for the three BFF surfaces.
- Create `services/api/src/market-world-product.ts`: immutable safe projection, digest/integrity validation, and role-specific projection helpers.
- Create `services/api/src/market-world-binding-service.ts`: idempotent Course binding using the existing Course repository and audit port with compensating recovery.
- Modify `services/api/src/server.ts` only for route adapters, scoped actors, existing ports, audit receipts, and Student workspace decoration.
- Create `apps/teacher/src/market-world-client.ts` and `apps/teacher/src/MarketWorldBindingPanel.tsx`; mount the panel in the existing Teacher readiness surface.
- Create `apps/admin/src/market-world-client.ts` and `apps/admin/src/MarketWorldAuditPanel.tsx`; mount it in the existing Admin delivery overview.
- Modify `apps/student/src/StudentRoleWorkflowPanel.tsx` to render the optional `SHANGHAI_MARKET_BRIEF` within the existing role mission.
- Add contract, unit, integration, security, and real-BFF Playwright tests; update only the relevant frontend/API styling if required.
- Create `docs/product/shanghai-market-world-product-reuse-map.md` and this plan; no raw M2 pack files are copied.

### Task 1: Contract and product-safe projection RED/GREEN

**Files:**

- Create: `tests/contract/market-world-contract.test.ts`
- Create: `tests/unit/market-world-product.test.ts`
- Create: `packages/shared-contracts/src/market-world.ts`
- Create: `services/api/src/market-world-product.ts`
- Modify: `packages/shared-contracts/src/index.ts`
- Modify: `packages/shared-contracts/src/index.ts` `Course`
- Create: `contracts/schemas/market-world.v1.json`

**Interfaces:**

- `MarketWorldRef = { market_world_id: string; version: string; digest: string }`.
- `createMarketWorldReference(input): MarketWorldRef` rejects blank ids, non-semver versions, non-SHA-256 digests, and `latest/current/default` aliases.
- `MARKET_WORLD_PRODUCT_PROJECTION` exposes only safe summaries and `getShanghaiMarketWorldReference()` returns its exact ref.
- `createTeacherMarketWorldProjection`, `createStudentMarketBriefProjection`, and `createAdminMarketWorldAuditProjection` are pure read projections.

- [ ] **Step 1: Write failing contract and product tests** covering exact ref, no auto-latest, digest mismatch, corrupt safe asset, limited archetypes, forbidden student fields, and pre-visibility absence.
- [ ] **Step 2: Run RED** with `npx vitest run tests/contract/market-world-contract.test.ts tests/unit/market-world-product.test.ts`; expect missing module/types and failed exact-reference assertions.
- [ ] **Step 3: Implement the minimal shared types and safe projection** using only the M2 role-safe content counts/narratives. Include `source_pack_manifest_digest` and M2 source digest in the receipt documentation, but never include source paths or raw source references in runtime projections.
- [ ] \*\*Step 4: Add `Course.market_world_reference?: MarketWorldRef`, export the types, and add the JSON Schema with `additionalProperties: false` for role-safe payloads.
- [ ] \*\*Step 5: Run the same focused tests plus `npm run build:test-prerequisites`; expect PASS.

### Task 2: Authoritative Course binding and BFF projections

**Files:**

- Create: `tests/unit/market-world-binding-service.test.ts`
- Create: `tests/integration/market-world-product-endpoint.test.ts`
- Create: `services/api/src/market-world-binding-service.ts`
- Modify: `services/api/src/server.ts`
- Modify: `contracts/openapi/p0-api.openapi.yaml`

**Interfaces:**

- `bindMarketWorldToCourse({ tenantId, courseId, reference, courses, appendAudit }): Promise<MarketWorldBindingReceipt>`.
- `GET /api/v1/bff/teacher/courses/{courseId}/market-world` returns Teacher projection.
- `POST /api/v1/bff/teacher/courses/{courseId}/market-world-binding` accepts exactly `{ market_world_reference }` and returns the exact receipt.
- `GET /api/v1/bff/admin/market-world-bindings` returns the tenant-scoped Admin projection list.
- Existing `GET /api/v1/bff/student/role-workspace` adds `market_world_visibility` and optional `market_brief` only after published/active Course visibility.

- [ ] **Step 1: Write failing unit/integration tests** for unknown ref, wrong digest, stale ref, missing/corrupt asset, tenant boundary, role boundary, duplicate same-ref idempotency, conflicting ref, partial write compensation, retry after transient read, and Student pre-visibility.
- [ ] **Step 2: Run RED** with `npx vitest run tests/unit/market-world-binding-service.test.ts tests/integration/market-world-product-endpoint.test.ts`; expect missing service/routes and failing assertions.
- [ ] **Step 3: Implement the service through existing `CourseRepositoryPort` and `AuditLogRepositoryPort`**. Read the scoped Course, return the existing receipt for the same ref, reject a different ref with conflict, save only the optional Course field, append the existing audit event, and restore the previous Course if the receipt/audit write fails.
- [ ] **Step 4: Add route adapters** with existing `createContext`, `requirePermission`, `actorHasAnyRole`, `sendJson`, and `createEnvelope`; never call `store.courses` from a route and never expose the safe asset to unauthorized actors.
- [ ] **Step 5: Decorate the existing Student role-workspace response** from the scoped Course; return no brief content for draft/pre-visibility or stale/unknown binding, and keep the existing role/merge/confirmation fields unchanged.
- [ ] \*\*Step 6: Run the focused unit/integration tests, `npm run test:contract`, and direct-store boundary check; expect PASS.

### Task 3: Teacher, Student, and Admin product surfaces

**Files:**

- Create: `apps/teacher/src/market-world-client.ts`
- Create: `apps/teacher/src/MarketWorldBindingPanel.tsx`
- Modify: `apps/teacher/src/App.tsx`
- Create: `apps/admin/src/market-world-client.ts`
- Create: `apps/admin/src/MarketWorldAuditPanel.tsx`
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/student/src/StudentRoleWorkflowPanel.tsx`
- Add focused frontend tests under `tests/e2e-ui/`

- [ ] **Step 1: Add failing component/browser assertions** for Teacher `LOADING/EMPTY/READY/LIMITED/STALE/CONFLICT/UNKNOWN/ERROR/RECOVERY/BOUND`, exact bind button/receipt, Student `SHANGHAI_MARKET_BRIEF`, and Admin bounded audit fields.
- [ ] **Step 2: Run RED** with the focused Playwright specs; expect missing labels/panel and unavailable market-world data.
- [ ] **Step 3: Implement the Teacher panel** inside the existing readiness section with `StatePanel`, exact ref display, GeoMarket/cohort/product/outside/archetype summaries, source categories, confidence/uncertainty, Known Limits, and recovery retry.
- [ ] **Step 4: Implement Student brief rendering** before the existing private fields, with market structure, customer tensions, service/outside-option landscape, archetype context, business tensions, freshness, and Known Limits; do not add a new route or decision authority.
- [ ] **Step 5: Implement Admin read-only list** using the existing tenant summary/loading/error language and show only exact ref, binding state, readiness, source categories, freshness, and Known Limits.
- [ ] \*\*Step 6: Run focused frontend typecheck/build and Playwright mocked component checks; expect PASS before real-BFF execution.

### Task 4: Security, recovery, and real BFF acceptance

**Files:**

- Create: `tests/security/market-world-security.test.ts`
- Create: `tests/e2e-ui/m2-p1-market-world-product-journey.spec.ts`
- Modify: `playwright.config.ts` only if an existing real-BFF project needs a minimal named entry

- [ ] **Step 1: Add failing security/browser cases** for cross-tenant access, Teacher-vs-Student field separation, Admin safe projection, raw identity/path/state_true/exact-coefficient/other-team/prepublish-result leakage, direct internal settle absence, stale/unknown recovery, and context-switch stale-cache invalidation.
- [ ] **Step 2: Run RED** with the focused security and browser specs; expect missing routes/labels or leakage assertions.
- [ ] **Step 3: Run the real BFF journey with mocks=0**: Teacher opens current course/scenario workspace, binds the exact Shanghai ref, reads receipt; Student enters the existing role journey and reads the safe brief; Admin reads the bounded audit list. Use API fixture setup only for tenant/course/role context, not browser route mocks.
- [ ] **Step 4: Fix only failures within the approved file map**, preserving Course/Scenario, role-workflow, settlement, replay, and tenant authority boundaries.
- [ ] \*\*Step 5: Run focused tests, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, and `npm run test:contract`; record unavailable or unrelated gates as limits rather than PASS.

### Task 5: Exact-head review and Product PR

**Files:**

- Modify only files from Tasks 1-4.

- [ ] **Step 1: Inspect `git status`, `git diff --check`, full diff, changed-file list, raw-copy count, second-writer check, and kernel dependency check.**
- [ ] **Step 2: Run exact-head source/PR review** against `6608ff44c99eb185444150b54512653453f29655`, including current checks and security/browser evidence.
- [ ] **Step 3: Commit one focused Conventional Commit** with explicit file paths; never use `git add -A`.
- [ ] **Step 4: Push the branch and create exactly one non-duplicate Product PR** with Summary, Validation, and Scope Notes; do not merge merely because GitHub reports mergeable.
- [ ] **Step 5: Read back the PR head and required checks once, then report the exact acceptance keys and keep `AUTOMATIC_NEXT_START: FALSE`.**

## Self-review

- Contract, backend, all three product surfaces, negative/recovery, tenant/security, real-BFF, exact-head, and single-PR requirements each have an explicit task.
- No task writes ParameterSet/Scenario publish/model/provider/Postgres state or changes settlement/replay semantics.
- No raw source file is copied; only the role-safe projection is materialized.
- The only persistence mutation is the existing tenant-scoped Course writer plus its existing audit writer, with compensation on partial failure.
