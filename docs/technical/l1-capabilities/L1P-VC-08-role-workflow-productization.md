# L1P-VC-08: Role Workflow Productization

**Status:** `CLOSED_AND_CURRENT_WITH_LIMITS`

**Product merge:** `#339` / `74b29acadf8a4649c7bdf128476bfcf0d4c629ad`

**Product files:** `apps/teacher/src/RoleWorkflowPanel.tsx`,
`services/api/src/store.ts`,
`tests/integration/role-workflow-endpoint.test.ts`

**Sole writer:** `RoleWorkflowCommandService`

**Runtime authority:** `JSON_INTERNAL_ONLY`

## Product Outcome

The default Golden demo fixture now exposes one distinct CEO, CFO, CMO and COO
member with the CEO as captain. The Teacher surface makes the complete-team
precondition visible and keeps assignment controls disabled until that
precondition is true. A valid default CEO assignment is executable through the
existing Role Workflow writer.

The existing nonviable-team guard remains fail closed with
`ROLE_WORKFLOW_TEAM_INCOMPLETE`; it still performs no assignment or event
write and does not alter the legacy Decision boundary.

The D2 eligible-event query is reachable after a valid active role assignment,
returns a safe empty projection when no eligible event exists, and continues to
deny reset, cross-scope, unauthorized-role, and student-route requests.

## Evidence

- PR #339 passed exact-head quality, browser-smoke and CodeQL checks.
- Independent challenge review recorded `BLOCKING=0` and `MUST_FIX=0`.
- Focused role/D2 tests passed 4 files / 24 tests.
- Contract gate passed 14 files / 37 tests.
- Post-merge fresh clone passed 157 files / 1019 tests, typecheck, build,
  direct-store boundary and hidden-Unicode checks.
- Three new real-browser/real-API synthetic sessions passed with explicit
  limits: `R4S-R5FIX-S1-20260804T155056024Z`,
  `R4S-R5FIX-S2-20260804T155056024Z`, and
  `R4S-R5FIX-S3-20260804T155056024Z`.
- Cell B was rebased onto the product merge with no source change and no
  second product PR.

## Boundaries and Known Limits

- No second Role authority, registry, resolver or writer was introduced.
- SettlementResult, Score, Rank, Simulation Core and Replay hash semantics are
  unchanged.
- D2 remains teacher-only and does not write Truth, SettlementResult, Score,
  Rank or Replay authority.
- `JSON_INTERNAL_ONLY` remains the sole active runtime authority.
- Human Validation remains blocked by the missing independent teacher session;
  all browser receipts in this cycle are synthetic-agent evidence.
- Issue #111 remains `OPEN_KNOWN_LIMIT`.
- PostgreSQL, durable recovery, Pilot, Production and successor work are not
  active, proven or authorized.

## Closure

This document is a docs-only governance closure for cycle
`L1PLUS-CYCLE-013-R5-SR2-ROLE-D2-REMEDIATION`. It does not authorize C4,
D3-D6, R5 continuation, or automatic successor work.

`automatic_next_start: false`
