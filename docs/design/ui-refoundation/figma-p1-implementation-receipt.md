# SimWar Figma P1 implementation receipt

**Receipt ID**: `SIMWAR-FE-P1-FIGMA-IMPLEMENTATION-2026-08-20`

**Implementation code head**: `bc60b46c9cc483d3e933fad0f08d6b287e3ba712`

**Base**: `1fcd8c7c8339d42b24e1500ecc658390cf89bd8f` (`origin/master` at task start)

**Worktree / branch**: `C:\Users\Marshall\AppData\Local\Temp\simwar-fe-p1-implementation-closure-001` / `codex/fe-p1-implementation-closure-001`

**Figma file**: [SimWar Frontend P1 Design Board](https://www.figma.com/design/6ezOykmrZbMbFEYPfIkZ07), file key `6ezOykmrZbMbFEYPfIkZ07`

## Read-only source assessment

The file contains 15 pages and the following implementation-relevant boards:

| Figma page / board                 | Current frontend mapping                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `01 Design System` / `19:45`       | `packages/ui/src/tokens.css`, `packages/ui/src/styles.css`, `packages/ui/DesignSystemLab.tsx` |
| `02 Components` / `18:4`, `19:206` | `packages/ui/src/components/*`, `packages/ui/src/workbenches/*`, existing app-local panels    |
| `03 Teacher Portal` / `20:2`       | `apps/teacher/src/App.tsx`, `apps/teacher/src/styles.css`, `#teacher-*` hash sections         |
| `04 Student Portal` / `20:105`     | `apps/student/src/App.tsx`, `apps/student/src/styles.css`, `#student-*` hash sections         |
| `05 Admin Portal` / `20:210`       | `apps/admin/src/App.tsx`, `apps/admin/src/styles.css`, `#admin-*` hash sections               |
| `09 Mobile & Tablet` / `21:233`    | the same three applications at `1440x900`, `1280x800`, `1024x768`, and `390x844`              |

The applications intentionally remain single-root hash workspaces. There is no React Router in this scope, so the Figma “page” names map to existing hash destinations and workbench sections rather than invented browser routes.

## Synced design system

- Reused the existing Figma variable collection `SimWar P1` (`VariableCollectionId:14:2`) and extended it to 26 variables; no duplicate collection was created.
- Added six Inter text styles: H1 24/32, H2 20/28, Title 16/24, Body 14/22, Caption 12/18, and Metric 24/28.
- Added four component variant sets on the Components page: `ActionButton`, `StateBadge`, `StatePanel`, and `FormField`, each with explicit state variants and code-path descriptions.
- Updated the existing AppShell, DataTable, StatusBadge, DecisionForm, AIAdviceCard, and ReplayDiffCard descriptions to point to current source components and preserve advisory/replay/truth boundaries.
- Figma primitives remain exact (`#2F6BFF`, `#6B4EFF`, `#1F9D55`, `#C88719`, `#D14343`, `#8B5CF6`, `#0F766E`, `#A16207`, `#F7F9FC`, `#FFFFFF`, `#D9E2EC`, `#102A43`, `#52606D`).
- Added WCAG presentation aliases for light surfaces; these do not replace the Figma primitives or change business semantics.

## Direct code mappings

| Design element                          | Source mapping                                                                                          | Status                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| AppShell / context / navigation         | `packages/ui/src/components/AppShell.tsx`, `ContextBar.tsx`, `RoleNavigation.tsx`, app `main.tsx` files | existing shared foundation; active hash state remains app-owned             |
| AuthorityBadge / state taxonomy         | `packages/ui/src/components/AuthorityBadge.tsx`, `packages/ui/src/styles.css`                           | synced colors and accessible presentation aliases                           |
| AllowedActionButton                     | `packages/ui/src/components/AllowedActionButton.tsx`, server-provided `allowed_actions` consumers       | presentation-only; no new writer or permission inference                    |
| StatePanel / recovery                   | `packages/ui/src/components/StatePanel.tsx`                                                             | loading, empty, blocked, error and recovery visuals retained                |
| FormField / DecisionForm                | `apps/student/src/App.tsx`, `StudentRoleWorkflowPanel.tsx`                                              | existing server `editable_fields` and role permissions remain authoritative |
| Teacher / Student / Admin portal boards | respective `App.tsx` and `styles.css` files                                                             | token and surface sync only; API/BFF and truth paths unchanged              |

## Validation evidence

Clean exact-head browser evidence was written outside the repository at:
`C:\Users\Marshall\AppData\Local\Temp\simwar-figma-p1-final-20260820-045130`.

The evidence uses base `1fcd8c7c8339d42b24e1500ecc658390cf89bd8f`, head/actual `bc60b46c9cc483d3e933fad0f08d6b287e3ba712`, and a clean checkout. The Playwright result is `4 passed`, with 20 external PNG captures and no failed tests.

Already passing in the implementation worktree:

- Figma design contract unit: 2/2;
- focused UI unit set including the new contract: 7 files / 85 tests;
- root `npm run typecheck` and `npm run build`;
- shared UI, Admin, Teacher, and Student production builds;
- Prettier, hidden-Unicode, direct-store boundary guard, and scoped ESLint;
- clean PR4 browser matrix: 4/4, 20 external screenshots, 12 app runtime rows + 4 DesignSystemLab rows within budget; all hash-navigation timings are below 100 ms and CLS is 0.

## Limits and governance

- Code Connect remains `BLOCKED_BY_SEAT`: Figma reports that a Dev or Full seat on an Organization or Enterprise plan is required. Variables, styles, component variants, screenshots, and repository mappings are complete without claiming Code Connect completion.
- CodeGraph is `AVAILABLE_WITH_HISTORICAL_PATH_CONTAMINATION` in the original dirty workspace; the fresh implementation worktree has no `.codegraph`. Current source mapping is therefore based on exact-source reads and tests, not a fabricated fresh graph result.
- No backend, API, DTO, settlement, Replay truth, tenant, RBAC, Student visibility, Advisor/W020, or new writer changes are included.
- Figma board pages do not imply independent product routes. Current delivery remains the existing three root apps plus the shared DesignSystemLab.
