# SimWar Frontend Experience Refoundation — Implementation Plan

> **Execution:** Use `superpowers:subagent-driven-development`. Each product task has
> one writer, an isolated worktree, focused tests, task review, exact file staging, and
> a serial merge. Product outcome WIP remains one.

**Goal:** Replace three monolithic, duplicated SPA experiences with one authority-safe,
task-oriented design system and four truthful role workspaces, then close the wave with
fresh-clone evidence.

**Architecture:** `@simwar/ui` supplies presentation-only tokens and React components.
Apps adapt current BFF DTOs into those components. Stable hash locations organize the
existing SPA workbenches without inventing backend routes. Formal commands remain in
their existing public route/service paths and are gated by server-issued allowed
actions. All exact-source audit artifacts live in `docs/design/ui-refoundation/`.

**Stack:** npm workspaces, TypeScript, React 19, Vite 7, Vitest 4, Playwright 1.61,
CSS custom properties, Figma variables and components.

## Global constraints

- Base every product PR on the latest protected `origin/master` and use an independent
  `codex/` branch/worktree.
- Never modify PR #372 or PR #365. Before every PR merge, refresh their state and
  re-evaluate changed-file overlap.
- Never modify simulation-core, settlement shapes, replay hashes, canonical decision
  selection, truth fields, role permissions, tenant scope, or Student visibility.
- Frontend code must not import API stores or call `/internal/v1`.
- `AllowedActionButton` consumes a server-issued allowed-action list; presentation
  state cannot authorize a command.
- Enterprise capabilities are hosted through existing Admin contracts. Unsupported
  capabilities are closed known limits.
- User-visible product copy is Simplified Chinese except immutable product names,
  abbreviations, exact references, digests, and versions.
- Run only real repository commands. Preserve baseline failures as evidence; do not
  silently mix unrelated remediation into a product PR.
- Stage explicit files only. Product PRs merge one at a time after exact-head required
  checks pass. Governance closes once, after all product PRs.

## Task 1: Freeze current reality and design authority

**Files:**

- Create `docs/design/ui-refoundation/README.md`
- Create `docs/design/ui-refoundation/principles.md`
- Create `docs/design/ui-refoundation/current-reality-receipt.md`
- Create `docs/design/ui-refoundation/page-inventory.csv`
- Create `docs/design/ui-refoundation/route-state-matrix.csv`
- Create `docs/design/ui-refoundation/component-inventory.csv`
- Create `docs/design/ui-refoundation/authority-visibility-boundary.md`
- Create `docs/design/ui-refoundation/open-pr-ownership-map.md`
- Create `docs/design/ui-refoundation/design-tokens.json`
- Create `docs/design/ui-refoundation/code-connect-map.json`
- Create `docs/design/ui-refoundation/visual-baseline/README.md`

**Steps:**

1. Record exact master SHA, GitHub permissions/protection/check facts, open-PR
   ownership, Graphify/CodeGraph provenance, runtime identities, pages, states, BFFs,
   DTOs, allowed actions, tests, duplication, and visual baseline hashes.
2. Parse both JSON files and every CSV file with a deterministic local script.
3. Confirm `git diff --name-only` is limited to the task files.
4. Review all claims against source/runtime receipts; remove inference presented as
   fact.

## Task 2: Build `@simwar/ui` with strict TDD

**Files:**

- Create `packages/ui/package.json`
- Create `packages/ui/tsconfig.json`
- Create `packages/ui/src/index.ts`
- Create `packages/ui/src/tokens.css`
- Create `packages/ui/src/styles.css`
- Create `packages/ui/src/components/*.tsx`
- Create `tests/unit/ui-foundation.test.tsx`
- Modify `tsconfig.build.json`
- Modify `package-lock.json` only as required to register the workspace

**RED:**

1. Write behavior tests using `react-dom/server` for:
   - `ContextBar` rendering only supplied server context;
   - `AuthorityBadge` visible Chinese authority semantics;
   - `AllowedActionButton` native disablement and human-readable reason when the
     action is not in the server list;
   - `ReceiptPanel` command/actor/time/correlation/status/reuse-conflict evidence;
   - `KnownLimitBanner` four-part limitation contract;
   - `StatePanel` loading/empty/blocked/stale/conflict/permission/error recovery;
   - `AppShell` skip link and landmark structure.
2. Run `npx vitest run tests/unit/ui-foundation.test.tsx` and observe module-not-found or
   missing-export failures.

**GREEN:**

3. Create the package with no new runtime framework or icon dependency.
4. Implement the minimum semantic components and export typed props.
5. Implement CSS tokens exactly matching Figma WEB code syntax. Include
   `prefers-reduced-motion`, `:focus-visible`, 44 px interactive targets, editorial
   rules, responsive shell breakpoints, and status patterns that do not rely on color.
6. Register the package in the TypeScript solution and lockfile.
7. Run the focused test until green.

**REFACTOR AND VERIFY:**

8. Remove duplicate rendering helpers only when behavior remains covered.
9. Run `npm run typecheck`, `npm run lint`, `npm run build`, and
   `npm run check:direct-store-boundaries`.
10. Run the full unit suite separately to avoid process-pressure false failures; record
    any unchanged baseline failure verbatim.

## Task 3: Create the development Design System Lab

**Files:**

- Create `packages/ui/src/DesignSystemLab.tsx`
- Create `tests/unit/ui-design-system-lab.test.tsx`
- Modify `packages/ui/src/index.ts`
- Modify `packages/ui/src/styles.css` only if required

**Steps:**

1. First write a server-rendered test proving every PR1 component and critical state is
   discoverable by accessible heading/name, then observe it fail.
2. Add a development-only gallery component covering default, disabled, loading,
   ready, blocked, stale, conflict, unknown, permission denied, and error examples.
3. Avoid mocked component placeholders; render real components.
4. Run focused tests, typecheck, lint, and build.

## Task 4: Synchronize Figma foundation and code mapping

**External file:** Figma `g73vJXbLoQVhY87lbUaueL`

**Repository files:**

- Modify `docs/design/ui-refoundation/code-connect-map.json`
- Modify `docs/design/ui-refoundation/current-reality-receipt.md`

**Steps:**

1. Validate six variable collections, exact WEB syntax, scoped variables, alias
   integrity, typography styles, and elevation styles.
2. Build local editable component sets only after code component names are final.
3. Validate metadata and screenshots after each component family.
4. Attempt simple React Code Connect mappings. If Starter/library publication blocks
   them, preserve the returned error and use the repository mapping as authority.
5. Record `FIGMA_STARTER_3_PAGE_LIMIT` and the three-page physical/logical-section
   mapping without claiming twelve physical pages.

## Task 5: PR1 verification, review, and serial merge

1. Run focused UI tests, typecheck, lint, build, direct-store boundary, contract tests,
   hidden-unicode, and Prettier on the PR allowlist.
2. Run Playwright against the Design System Lab or a temporary harness at 1440, 1280,
   1024, and 390 px; capture screenshots outside the repository until accepted.
3. Dispatch an independent task review and one whole-branch review. Resolve every
   critical or important finding.
4. Refresh live master and open PR manifests. Rebase/update the branch if needed.
5. Stage only the allowlist, create a Conventional Commit, push, and open a draft PR
   with Summary, Validation, and Scope Notes.
6. Verify the exact PR head has required checks `quality`, `browser-smoke`, and
   `Analyze JavaScript and TypeScript`. Merge only when external policy permits and all
   review findings are resolved.

## Task 6: Product PR2 — Admin and Teacher migration

1. Create a fresh exact-master worktree after PR1 merges.
2. Write failing interaction/browser tests for task-oriented Admin and Teacher logical
   locations, all legacy workbench reachability, Chinese labels, allowed-action gating,
   recovery states, and no internal routes.
3. Consume `@simwar/ui`, split the monolithic shells, and consolidate duplicated
   Course Report, D5 Export, D6 Transfer Research, and Golden Journey presentation
   layers without altering their DTO/command behavior.
4. Create the truthful Enterprise Course Factory section in Admin, with closed known
   limits for unsupported contracts.
5. Do not modify `apps/student/src/StudentRoleAdvisor.tsx`,
   `apps/teacher/src/TeacherDebriefAdvisor.tsx`, or `tests/e2e-ui/w020-advisory.spec.ts`
   while PR #365 owns them.
6. Run relevant unit, contract, build, and full browser gates; review, push, open, and
   serially merge the exact green head.

## Task 7: Product PR3 — Student and Enterprise completion

1. Create a fresh exact-master worktree after PR2 merges.
2. Write failing browser tests for role mission, safe cockpit, evidence, private draft,
   collaboration, divergence, confirmation, submission, result/causal explanation,
   learning report/path, and permission-denied/error states.
3. Migrate Student to `@simwar/ui` and safe BFF projections. Reduce broad
   `/demo-state` browser dependency only through existing public/BFF contracts.
4. Complete Enterprise Admin states that are supported after PR2; keep missing
   contracts closed.
5. Prove no cross-team, `state_true`, private peer draft, score/rank, or permission
   widening.
6. Run and serially merge an exact-head green PR.

## Task 8: Product PR4 — Integration and acceptance

1. Create a fresh exact-master worktree after PR3 merges.
2. Add automated accessibility tooling only if license-compatible and necessary;
   document the dependency and update the lockfile in this single-writer PR.
3. Build visual regression coverage for the route/workbench/state matrix at 1440,
   1280, 1024, and 390 px.
4. Verify keyboard order, focus visibility, target sizes, reduced motion, contrast,
   dialog/drawer recovery, no horizontal page overflow, and draft preservation.
5. Measure route/app bundles and interaction readiness; remove accidental duplication
   without changing business behavior.
6. Run the repository’s full current gates plus the complete browser suite. Review,
   push, open, and serially merge the exact green head.

## Task 9: Fresh-clone acceptance

1. Resolve the final protected master SHA after all product merges.
2. Clone/detach that exact SHA into a new directory, run `npm ci`, then run hidden
   Unicode, formatting on wave files, lint, typecheck, unit, contract, direct-store,
   build, and full browser gates.
3. Capture Admin, Teacher, Student, Enterprise logical workspace, Design System Lab,
   core states, and responsive screenshots.
4. Compare against the frozen baseline and produce a visual-diff manifest.
5. Verify no product services remain running and no tracked source was mutated.

## Task 10: Exactly one governance closure PR

1. Create one final exact-master governance worktree and branch.
2. Update current-cycle and L1+ portfolio carriers with product PR merge SHAs,
   exact-head checks, fresh-clone evidence, Figma limitations, baseline inherited
   failures, npm audit facts, no-production/no-pilot/no-human-validation statements,
   and `automatic_next_start: false`.
3. Do not authorize W025 or any successor through this closure.
4. Run governance/document checks, review, push, open, and merge exactly one closure
   PR if branch policy permits.
5. Mark the goal complete only after the closure merge and live protected-master
   readback prove the final state.
