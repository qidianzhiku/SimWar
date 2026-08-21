# SimWar FE-P1 current-reality receipt

Date: 2026-08-21
Mission: `SIMWAR-FE-P1-IMPLEMENTATION-CLOSURE-001`
Forward baseline: `origin/master` at `cfd35ddd560dba2da4420f8a7586f234391423fa`
Implementation branch: `codex/fe-p1-implementation-20260821`
Worktree: `D:\\codex\\worktrees\\simwar-fe-p1-implementation-20260821`

## Boundary

This receipt covers the frontend visual layer only. The implementation may
touch `packages/ui`, the visual CSS of the Admin/Teacher/Student apps, and
frontend tests/evidence. It does not modify services, contracts, database
adapters, simulation settlement, replay truth, canonical Decision, RBAC,
tenant visibility, or model/provider activation.

The protected workspace was dirty and remained untouched. The implementation
started in a clean short-lived worktree from the current remote baseline; no
historical feature SHA was treated as current source.

## Current frontend reality

- The three apps are Vite React applications without React Router. Navigation
  is role-specific hash navigation owned by `RoleNavigation`.
- Shared UI already owns `AppShell`, `RoleNavigation`, `ContextBar`,
  `AuthorityBadge`, `AllowedActionButton`, `KnownLimitBanner`, `ReceiptPanel`,
  `StatePanel`, `WorkbenchFrame`, `CourseReportWorkbench`, and
  `DesignSystemLab`.
- P2-B-specific aliases are package-owned in
  `packages/ui/src/p2b-tokens.css` and imported by the Student/Teacher journey
  styles only; the Admin initial bundle keeps the base P1 token payload.
- P1 visual authority is the existing SimWar Figma file and its `SimWar P1`
  variable collection. The current source continues to be the authority for
  behavioral and data boundaries.
- Figma has an existing component page with ActionButton, StateBadge,
  StatePanel, FormField variants, and handoff components mapped to the shared
  UI files. This wave reuses those components rather than creating a second
  design-system authority.
- CodeGraph was attempted before source exploration, but its local index did
  not expose current master symbols. The receipt therefore labels the result
  `CodeGraph degraded` and uses exact-SHA source, tests, and build evidence.

## Route mapping used by the visual work

The design board names product-intent routes such as `/admin/tenants` and
`/admin/audit`; the running app currently exposes equivalent hash sections.
No route migration was performed.

| Workspace | Current hash sections |
| --- | --- |
| Admin | `#admin-delivery-overview`, `#admin-tenants-entitlements`, `#admin-users-roles`, `#admin-assets`, `#admin-enterprise-course-factory`, `#admin-security-projection`, `#admin-audit-receipts`, `#admin-runtime-support`, `#admin-known-limits`, `#admin-environment-recovery`, `#admin-audit-events` |
| Teacher | `#teacher-today`, `#teacher-blockers`, `#teacher-courses`, `#teacher-readiness`, `#teacher-teams-roles`, `#teacher-round-control`, `#teacher-results`, `#teacher-debrief`, `#teacher-evidence`, `#teacher-reports`, `#teacher-validation`, `#teacher-close-cleanup` |
| Student | `#student-role-mission`, `#student-cockpit`, `#student-evidence`, `#student-enterprise-state`, `#student-private-draft`, `#student-collaboration`, `#student-divergence`, `#student-confirmation`, `#student-submission`, `#student-results`, `#student-debrief`, `#student-learning-report`, `#student-learning-path` |

P2-B visual integration is mounted in the existing student results/debrief and
teacher debrief workspaces. The six student stages and five teacher stages are
covered by existing component tests and retain their safe projection/BFF
contracts.

## Validation snapshot

- `npm ci`: pass (287 packages installed; the checkout reports 2 low and 7
  high audit findings in the existing dependency graph).
- `npm run typecheck`: pass.
- `npm run build`: pass for shared contracts, agent gateway, simulation core,
  API, UI, Admin, Teacher, and Student.
- Focused P2-B and token contract tests: 3 files, 12 tests passed.
- `npm test -- --no-file-parallelism --maxWorkers=1`: 231 files, 1419 tests
  passed. This serial rerun clears the two scheduling-sensitive failures seen
  in the initial parallel baseline.
- `git diff --check`: pass.
- Repository-wide `npm run format:check` remains red on 74 pre-existing files;
  the changed P2-B CSS is unchanged under Prettier and the new token contract
  test was formatted.
- The initial parallel `npm test` baseline reported two unrelated failures in
  `direct-store-boundary-check.test.ts` (10-second inventory timeout) and
  `store-snapshot-persistence.test.ts` (shell-metacharacter snapshot path
  returned null); the controlled serial rerun passed both without source
  changes. This visual wave does not change those store paths.

Human Validation, Pilot, and Production authorization are not claimed by this
automated receipt.
