# SimWar P1 Figma Commercial Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the shared UI foundation and the Admin/Teacher/Student visual layers with the approved Figma P1 design system and close the commercial frontend evidence chain without changing business authority.

**Architecture:** Keep `packages/ui` as the single visual authority. Map Figma variables/components to existing CSS tokens and React components, then refine each app at its existing hash section boundaries. All data remains sourced through current BFF adapters and existing role-safe projections.

**Tech Stack:** npm workspaces, TypeScript, React, Vite, CSS custom properties, Vitest, Playwright, Axe/browser evidence, Figma MCP.

**Spec:** `docs/superpowers/specs/2026-08-21-fe-p1-commercial-frontend-spec.md`

## Global Constraints

- Start from `origin/master` exact SHA in an isolated worktree; never touch the protected dirty checkout.
- Figma file `6ezOykmrZbMbFEYPfIkZ07` is the visual source of truth; preserve existing Figma content and use incremental, validated writes.
- Allowed source scope: `packages/ui/**`, frontend visual layers under `apps/admin/**`, `apps/teacher/**`, `apps/student/**`, and frontend tests/docs/evidence.
- Forbidden source scope: `services/**`, `contracts/**`, `db/**`, `packages/shared-contracts/**`, settlement/replay/canonical Decision paths, permission/tenant rules, AI/model/provider activation.
- Do not add a second design system, direct-store reader, frontend business writer, or new backend/API route.
- Every Figma mutation returns created/mutated IDs and is validated with metadata and screenshots before the next phase.
- Human validation, Pilot, Production, provider activation, and model activation must remain `NOT_PERFORMED`/`NOT_AUTHORIZED`.

---

### Task 1: Freeze current reality and the Figma/code map

**Files:**
- Create: `docs/architecture/fe-p1-current-reality-receipt.md`
- Create: `docs/architecture/fe-p1-figma-code-map.md`
- Read: `packages/ui/src/tokens.css`, `packages/ui/src/styles.css`, `packages/ui/src/components/**`, `apps/*/src/App.tsx`, relevant app styles and tests

**Interfaces:**
- Consumes: Figma metadata for `13:2`, `18:4`, `39:2`; exact `origin/master` SHA; current app/hash navigation and shared component exports.
- Produces: exact token/component/node mapping and an explicit allowed/forbidden file list used by every later task.

- [ ] Record exact master/tree SHA, worktree safety, runtime authority, current hash destinations, current token values, current Figma variable/component IDs, and known limits.
- [ ] Map each Figma component to the existing React/CSS owner and classify `REUSE`, `EXTEND`, or `NEW`.
- [ ] Record every code/Figma token conflict; Figma wins for visual values only.
- [ ] Run `git diff --check` and confirm the receipt files are the only new documentation in this task.

### Task 2: Repair and extend the Figma P1 foundation

**Files:**
- Figma file `6ezOykmrZbMbFEYPfIkZ07`, existing pages/collection/components only; preserve all existing content.
- Create/update evidence ledger outside the repo worktree for returned Figma IDs.

**Interfaces:**
- Consumes: Task 1 token map; existing local collection `SimWar P1` (`VariableCollectionId:14:2`); existing component sets on page `18:4`.
- Produces: validated Figma variables/styles/component descriptions/variants that match the code token contract.

- [ ] Re-read local collections, variables, styles, and components before every write phase.
- [ ] Reuse the existing `SimWar P1` collection; add only missing semantic tokens required by the spec.
- [ ] Set explicit variable scopes and WEB code syntax for every touched variable; alias semantic values rather than duplicating primitives.
- [ ] Add only the text/effect styles required by the existing code and P1 board; do not create duplicate paint styles when variables are sufficient.
- [ ] Extend existing component sets only where the current visual grammar needs a missing state; document `SUPPORTED`/`NOT_APPLICABLE` states in descriptions.
- [ ] Validate each mutation with `get_metadata` and `get_screenshot`; record all IDs and screenshots.

### Task 3: Normalize shared UI code to the Figma system

**Files:**
- Modify: `packages/ui/src/tokens.css`
- Modify: `packages/ui/src/styles.css`
- Modify only if required: `packages/ui/src/components/**`, `packages/ui/src/workbenches/**`, `packages/ui/src/index.ts`
- Test: existing `tests/unit/ui-*.test.tsx`, `tests/unit/ui-*.test.ts`, `tests/e2e-ui/pr4-design-system-lab.spec.ts`

**Interfaces:**
- Consumes: Task 1 mapping and Task 2 Figma token/component IDs.
- Produces: one shared token grammar and reusable components with no direct business authority.

- [ ] Add failing assertions for token values, focus treatment, min control height, status semantics, and supported recovery states.
- [ ] Replace duplicated or conflicting shared raw values with semantic custom properties mapped to Figma names.
- [ ] Keep component APIs stable; add only visual/state props needed to represent existing server-projected states.
- [ ] Run focused unit/component tests and the UI lab build/verification after each component family.

### Task 4: Refine P2-B Student and Teacher visual layers

**Files:**
- Modify: `apps/student/src/p2b-decision-learning.css`
- Modify: `apps/teacher/src/p2b-teacher-debrief.css`
- Modify only when visual integration requires: `apps/student/src/P2BDecisionLearningJourney.tsx`, `apps/teacher/src/P2BTeacherDebriefWorkspace.tsx`
- Test: `tests/unit/p2b-decision-learning.test.tsx`, `tests/unit/p2b-teacher-debrief.test.tsx`, `tests/e2e-ui/pr4-p2b-decision-learning-teacher-debrief.spec.ts`

**Interfaces:**
- Consumes: existing W3/D2/D3/D4 safe projections and `#student-debrief`/`#teacher-debrief` hash sections.
- Produces: Figma-aligned colors, spacing, typography, status/recovery presentation with unchanged data/authority boundaries.

- [ ] Add failing CSS/component assertions for token reuse, official/advisory distinction, loading/blocked/empty/stale/error/recovery states, keyboard focus, and mobile behavior.
- [ ] Replace P2-B local hex literals with shared semantic tokens; preserve state branching and Chinese customer-facing copy.
- [ ] Verify no frontend what-if calculation, direct store access, formal writer, or visibility widening is introduced.
- [ ] Run focused Vitest and real-BFF P2-B browser/Axe coverage.

### Task 5: Close Admin, Teacher, and Student shared visual grammar

**Files:**
- Modify only visual-layer owners under `apps/admin/src/**`, `apps/teacher/src/**`, `apps/student/src/**` identified in Task 1.
- Test: `tests/unit/ui-admin-refoundation.test.tsx`, `tests/unit/ui-teacher-refoundation.test.tsx`, `tests/unit/ui-student-refoundation.test.tsx`, `tests/e2e-ui/ui-refoundation-*.spec.ts`, `tests/e2e-ui/pr4-integration.spec.ts`

**Interfaces:**
- Consumes: shared UI components and existing hash navigation/AppShell contracts.
- Produces: consistent navigation, context, status, error, recovery, and empty-state grammar across all three roles.

- [ ] Add or update state coverage without changing route IDs, API calls, role visibility, or business values.
- [ ] Verify Admin, Teacher, and Student use the same shared component primitives while retaining role-specific data projections.
- [ ] Run focused unit tests and browser smoke at desktop and mobile viewports; record console errors and screenshot artifacts.

### Task 6: Responsive, keyboard, accessibility, and visual fidelity gate

**Files:**
- Modify only scoped frontend CSS/component files when a reproducible mismatch is found.
- Create/update: frontend evidence manifests and `FIGMA_CODE_DELTA` receipt under `docs/architecture/` / `docs/governance/`.

**Interfaces:**
- Consumes: final Figma screenshots, running app screenshots, Axe/keyboard/browser output.
- Produces: `BLOCKING_MISMATCH=0`, responsive matrix, WCAG 2.2 AA target evidence, and known-limit classification.

- [ ] Run at `1440x900`, `1280x800`, `1024x768`, and `390x844`.
- [ ] Verify visible primary action, no horizontal overflow, no clipping, keyboard order, focus, dialog/drawer behavior, and mobile simplification.
- [ ] Verify headings/labels/error association/non-color cues/reduced motion/200% zoom/44px touch targets.
- [ ] Re-read Figma metadata and screenshots and classify every delta as `MATCHED`, `ACCEPTABLE_DIFFERENCE`, or `MISMATCHED_MUST_FIX`.

### Task 7: Commercial delivery audit and product PR

**Files:**
- Create: `docs/governance/fe-p1-commercial-delivery-audit.md`
- Product code/docs: only files listed by the exact write allowlist and Tasks 1–6.

**Interfaces:**
- Consumes: all prior tests, screenshots, receipts, exact head, and Figma IDs.
- Produces: one Product PR with Summary, Validation, Scope Notes, rollback, and known limits.

- [ ] Confirm `BLOCKING=0`, `MUST_FIX=0`, no duplicate design system, no route break, no console errors, no authority breach, no direct store, and no visibility widening.
- [ ] Run the full applicable local gate set and preserve exact command output.
- [ ] Commit only explicitly allowed files with a Conventional Commit.
- [ ] Create one Product PR and wait for required checks; remediate ordinary failures on the same branch/PR.

### Task 8: Merge, fresh post-merge validation, and governance closure

**Files:**
- Create: docs-only governance closure receipt under `docs/governance/`

**Interfaces:**
- Consumes: merged Product PR, merge SHA, final master SHA, fresh clone/worktree.
- Produces: one docs-only Governance Closure PR and final `CODEX_EXECUTION_FEEDBACK`.

- [ ] After required checks and gates pass, merge once using the authorized serial merge path.
- [ ] Create a fresh detached checkout of final master; run npm ci, typecheck, build, tests, browser, a11y, responsive and visual evidence checks.
- [ ] Confirm the original dirty worktree was not changed.
- [ ] Create exactly one docs-only governance closure PR, merge after checks pass, and record Human Validation=`NOT_PERFORMED`, Pilot=`NOT_AUTHORIZED`, Production=`NOT_AUTHORIZED`, automatic_next_start=`false`.
