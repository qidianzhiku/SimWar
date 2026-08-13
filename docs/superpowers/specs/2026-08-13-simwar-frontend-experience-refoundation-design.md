# SimWar Frontend Experience Refoundation — Design Specification

## Status and authority

This specification freezes the implementation interpretation of owner authorization
`SIMWAR-OWNER-AUTH-FE-WAVE-001-20260813` for source baseline
`bb343faf0c38e4a4a6d8b7928d0a0f35ecf8ad37`.

The accepted product outcome is exactly:

```text
SIMWAR_FRONTEND_EXPERIENCE_REFOUNDATION_COMPLETE_WITH_LIMITS
```

This is a frontend experience wave. It must not change simulation-core, settlement,
score, rank, replay hashing, canonical decision selection, tenant scope, role
permissions, Student visibility, or any formal writer boundary.

## Current reality decision

Current source and repeatable runtime establish the following design inputs:

- Admin, Teacher, and Student are three Vite React applications mounted at `/`.
- There is no runtime router or route registry. Existing product capabilities are
  conditional workbenches inside three long SPA shells.
- Enterprise has no independent app or executable BFF. Its truthful frontend host is
  the existing Admin tenant/platform surface; missing capabilities remain closed or
  are labelled as known limits.
- Teacher and Admin share duplicated report, export, and research workbenches. All
  three apps duplicate shell, panel, identity, action, and known-limit styles.
- Shared BFF DTOs already carry actor role, allowed actions, audit references,
  redaction markers, runtime paths, and explicit non-proof fields. UI components must
  consume those fields; they must not reconstruct them.
- Current root pages are vertically dense: Admin about 4,541 px, Teacher about 5,888
  px, and Student about 2,539 px at 1440 x 900 after login.

The migration therefore introduces a shared task-oriented shell and logical workspace
navigation. It does not pretend that undocumented backend routes exist. Logical
workspace locations may use stable hash routes until a server fallback contract exists.

## Product model

The unified platform contains four role workspaces:

1. **Admin Delivery & Trust** — delivery, tenant scope, entitlement, governed assets,
   audit, receipts, environment recovery, and known limits.
2. **Teacher Course OS** — a “Today / 今日工作” operating surface for preparation,
   teams, rounds, publication, debrief, evidence confirmation, reporting, validation,
   and closure.
3. **Student Executive Environment** — role mission, observable operating context,
   private draft, collaboration, team confirmation, submission, result explanation,
   and learning evidence.
4. **Enterprise Course Factory & Sponsor** — a role-isolated Admin workspace exposing
   only current tenant/platform contracts. Missing Source Registry, Canonical Mapping,
   Scenario Draft, Course Recipe, Validation Suite, immutable publication, or sponsor
   aggregation capabilities are closed known limits until a contract exists.

Every workspace has two layers:

- **Task layer:** the current mission, next valid action, blockers, and recovery.
- **Intelligence layer:** evidence, causal explanation, receipts, exact references,
  advisory output, and known limits.

## Design language

The visual system combines clear, direct, recoverable interaction with a restrained
business-school editorial hierarchy. It does not copy any protected school identity,
wordmark, shield, or proprietary layout.

### Color roles

| Role                | Value     | Meaning                                          |
| ------------------- | --------- | ------------------------------------------------ |
| Editorial Crimson   | `#A51C30` | Brand emphasis and chapter markers only          |
| Authority Navy      | `#162334` | Context, authority, governance, primary action   |
| Learning Teal       | `#287C7A` | Evidence, learning, explanation, progress        |
| Decision Gold       | `#C6923B` | Decision focus and variables requiring attention |
| Official / Risk Red | `#B64A45` | Formal risk, destructive or irreversible action  |
| Ink                 | `#171717` | Primary text                                     |
| Secondary Gray      | `#65727D` | Secondary text                                   |
| Warm Paper          | `#F7F4EE` | Canvas                                           |
| Surface             | `#FFFFFF` | Work surface                                     |

Editorial Crimson is never an error color. Official / Risk Red is never decorative.

### Type, spacing, radius, and motion

- UI font stack: system sans first, then PingFang SC, Noto Sans CJK SC, and Microsoft
  YaHei fallbacks.
- Editorial headings: Songti SC, STSong, or Noto Serif CJK SC, used sparingly.
- Digests and exact references: system monospace stack.
- Spacing: `4 / 8 / 12 / 16 / 24 / 32 / 48` px.
- Radius: `4 / 8 / 12` px. Cards are not the default container for every section.
- Elevation: `0 / 1 / 2`, with rules and spacing preferred over shadow.
- Motion: `120 / 180 / 240` ms and disabled under `prefers-reduced-motion`.

## Shared component contracts

The shared package is `@simwar/ui`. Components are presentational authority
consumers. They do not fetch, infer, or persist business data.

### `AppShell` and `RoleNavigation`

- Provide skip navigation, landmark structure, current workspace identity, role
  navigation, and a focused content region.
- Expose one primary page action; supporting actions remain visually subordinate.
- Logical navigation is supplied by the app and may map to hash locations. The shell
  does not synthesize business scope.

### `ContextBar`

- Renders only fields explicitly supplied from server DTOs: tenant, course, session,
  run, round, team, role, and mode.
- Missing values are shown as unknown or omitted according to caller policy.
- It never reads URL state, localStorage, demo store state, or route parameters.

### `AuthorityBadge`

Distinguishes exactly this canonical ordered enum set; aliases are not permitted:

| enum              | Chinese label |
| ----------------- | ------------- |
| `official`        | 正式          |
| `draft`           | 草稿          |
| `shadow`          | 影子          |
| `advisory`        | 建议          |
| `system-result`   | 系统结果      |
| `ai-explanation`  | AI 解释       |
| `teacher-comment` | 教师点评      |
| `unknown`         | 未知          |

The visible Chinese label and color role must agree.

### `AllowedActionButton`

- Receives the server-issued `allowedActions` list and the exact `action` it
  represents.
- A missing action makes the native button disabled.
- A disabled button exposes a human-readable reason adjacent to or through an
  accessible description.
- Risk actions use the risk variant but remain server-authorized; styling never
  authorizes a command.
- Formal command callers own confirmation, idempotency, receipts, and conflict
  handling. The component cannot bypass them.

### `ReceiptPanel`

Renders command, actor, timestamp, correlation ID, status, and reuse/conflict state.
It is an audit view, not a second command writer.

### `EvidenceDrawer`

Is read-only. Editing links point to the existing sole-writer workflow or create a new
version; the drawer never mutates formal evidence in place.

### `KnownLimitBanner`

Always separates: current limitation, what is unaffected, what is not proven, and
scope. A generic “coming soon” banner is not sufficient.

### State and recovery components

`StatePanel` covers loading, empty, partial, ready, blocked, stale, conflict, unknown,
permission denied, and error. Command states additionally cover submitting,
committed, reused, conflict, and failed. Recovery actions use explicit Chinese verbs
such as “重新加载”, “安全重试”, or “返回修订”.

## Information architecture and route strategy

The source baseline has only one route per app, so “full route migration” means every
current workbench remains reachable while being reorganized into task-oriented logical
destinations. No current workbench may disappear.

- Admin logical locations: delivery overview; tenants and scope; governed assets;
  authority and security projection; audit and receipts; runtime support; trust and
  known limits; environment recovery; enterprise course factory.
- Teacher logical locations: Today; course preparation; teams and roles; round control;
  results and publication; Debrief Studio; evidence confirmation; Report Builder;
  Validation Session; close and cleanup.
- Student logical locations: role mission; operating cockpit; evidence; private draft;
  collaboration; divergence; team confirmation; final submission; result and causal
  chain; debrief; learning report; learning path.

PR 1 provides the navigation contract but does not rewrite app routing. PRs 2 and 3
perform migration with stable hash locations and compatibility anchors. PR 4 verifies
all legacy workbenches remain reachable.

## Responsive behavior

- 1440 px: 12-column Admin/Teacher working layout with persistent navigation.
- 1280 px: reduced gutters; content hierarchy remains unchanged.
- 1024 px: Student-optimized layout; secondary intelligence moves below task content.
- 390 px: read-only summaries, critical alerts, draft-safe light tasks, and explicit
  handoff to desktop for high-density or irreversible operations.
- No horizontal page scroll at the target widths. Data tables may use an explicitly
  labelled internal scroll region when column preservation is necessary.

## Accessibility contract

- Automated WCAG 2.2 AA checks cover semantic landmarks, names, roles, contrast,
  keyboard operation, focus visibility, dialog/drawer behavior, reduced motion, and
  target sizes.
- `:focus-visible` is never removed without a stronger replacement.
- Status cannot rely on color alone.
- Loading preserves layout; errors preserve user drafts.
- Disabled actions remain discoverable with an explanation.
- A Playwright visual and accessibility matrix covers 1440, 1280, 1024, and 390 px.

## Figma and code consistency

Figma file `g73vJXbLoQVhY87lbUaueL` is the editable collaboration file. Figma variables
use the same CSS syntax as `@simwar/ui`. The Starter plan limits the file to three
physical pages, so the requested twelve logical pages are represented as deterministic
sections inside:

1. `00_设计原则`
2. `01_Foundations & Tokens`
3. `02_Product Workspaces & Code Connect`

This limitation is recorded as `FIGMA_STARTER_3_PAGE_LIMIT`; no paid upgrade is
authorized. Repository `code-connect-map.json` is the durable mapping authority if
Figma library publication or Code Connect is unavailable.

## Delivery decomposition

### Product PR 1 — Frontend Foundation

Design tokens, shared components, shell primitives, context/authority/receipt/evidence
and state system, Design System Lab primitives, audit receipts, Figma foundations, and
focused unit tests.

### Product PR 2 — Admin and Teacher migration

Task-oriented Admin and Teacher shells, shared duplicated workbenches, BFF allowed
action gating, Chinese copy, Enterprise course-factory known-limit workspace, and
browser coverage. It must not touch the W020 advisor files owned by open PR #365 until
that ownership is resolved.

### Product PR 3 — Student and Enterprise completion

Student task/collaboration/submission/result/learning experience and the truthful
Enterprise Admin workspace. Student uses safe BFF projections; broad demo-state
dependency is reduced without widening visibility.

### Product PR 4 — Integration and acceptance

Responsive, automated accessibility, visual regression, performance cleanup, full
route/workbench/state matrix, exact-head CI, fresh-clone browser acceptance, and final
Figma/code synchronization.

### Governance closure

Exactly one final governance closure PR records serial product merges, exact-head
checks, fresh-clone evidence, unresolved external limits, and the final outcome. No
automatic successor is authorized.

## Explicit non-goals

- No production or pilot deployment.
- No human-validation claim.
- No simulation-core or settlement change.
- No truth, score, rank, replay, permission, tenant, or Student visibility expansion.
- No independent Enterprise engine or invented BFF.
- No modification to open PR #372 or #365.
- No paid Figma/plugin purchase.
