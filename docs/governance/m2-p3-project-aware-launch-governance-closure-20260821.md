# SimWar M2-P3 project-aware Course launch governance closure

Date: 2026-08-21

Mission: `SIMWAR-SH-M2-P3-PROJECT-AWARE-LAUNCH-V5.14-20260821`

Product PR: [#422](https://github.com/qidianzhiku/SimWar/pull/422)

Product head before merge: `04813dc40b8ab2fdfc57630c58dd9f915ecf5deb`

Product merge commit: `4d6e4f1077faa9e9096556a0f186900add13bc35`

Forward source: `origin/master` at
`4d6e4f1077faa9e9096556a0f186900add13bc35`

## Closure decision

`PASS_WITH_LIMITS` for the authorized M2-P3 project-aware Course launch scope.
The Product PR was merged after exact-reference readiness, lifecycle, active-Run,
open-opening-Round, team-set idempotency and OpenAPI review gates were closed.
The existing Course, Run, Round, Formal Course binding, W4 initial-state writer,
Project Library and role-safe Student authority paths remain the sole writers for
their respective domains. No second Course/Run writer, implicit latest/current
alias, student truth projection, settlement path, Replay truth input, API
provider, or model provider was introduced.

## Delivered scope

- Teacher readiness is derived from the exact tenant/Course/Run scope and reports
  `BLOCKED`, `STALE`, `DEGRADED`, `READY` or `UNKNOWN_VERIFYING` with actionable
  blocker ownership.
- Launch consumes the existing formal Run authority and requires an active Run,
  an open opening Round, exact validated ProjectProfile references, complete role
  assignments and a bound formal authority.
- Repeated launch commands are append-only and idempotent only when the exact
  tenant/Course/Run scope and derived participating team set are unchanged.
- Student context is role-safe and returns only the enrolled student's exact
  project brief and role context; forbidden truth, private source and other-team
  fields remain excluded.
- Admin audit is tenant-scoped and reads Project Library, readiness and launch
  receipt lineage without becoming a new runtime authority.
- All five project-aware BFF routes and their request/response/error schemas are
  declared in `contracts/openapi/p0-api.openapi.yaml`.

## Evidence receipts

- Mission and allowlist evidence: `C:\Temp\simwar-m2p3-v514-20260821\00-mission-control-receipt.md`
- Tool and repository evidence: `C:\Temp\simwar-m2p3-v514-20260821\01-tool-health-receipt.md`,
  `05-codegraph-receipt.md` and `06-graphify-and-kg-reconciliation.md`
- Design/reuse and research evidence: `C:\Temp\simwar-m2p3-v514-20260821\08-design-reuse-receipt.md`,
  `10-competitor-pattern-ledger.md` and `11-oss-allowlist-receipt.md`
- Review-fix receipt: `C:\Temp\simwar-m2p3-v514-20260821\12-review-fix-receipt.json`
- Detached post-merge receipt: `C:\Temp\simwar-m2p3-v514-20260821\13-post-merge-validation-receipt.json`
- Frontend budget receipt: `C:\Temp\simwar-m2p3-budget-422-merge.json`

The protected dirty workspace was not reset, cleaned, stashed or overwritten.
Implementation, review-fix validation and detached post-merge validation used
independent worktrees.

## Validation

- Local review-fix validation: unit 5/5, integration 2/2, project-aware contract
  4/4, full contract gate 29 files / 67 tests, typecheck, lint, build and hidden
  Unicode checks passed.
- Local real-BFF browser journey on the Product worktree: 1/1 passed.
- GitHub PR #422: `quality`, `browser-smoke`, `Analyze JavaScript and TypeScript`
  and CodeQL all passed for head `04813dc...`.
- Fresh detached worktree from merge commit `4d6e4f1...`: `npm ci --include=dev`,
  typecheck, focused unit/integration/contract tests 11/11, hidden Unicode,
  complete build and the real-BFF browser journey 1/1 passed.
- Fresh detached frontend budget receipt reported `status: passed` and
  `failures: []` for Admin, Teacher and Student under the existing budget.
- The detached worktree was clean and removed after validation.

## Known limits and non-claims

- `PASS_WITH_LIMITS` is not a full accessibility or WCAG PASS.
- Automated browser and axe-related repository checks are not Human Validation;
  Human Validation is `NOT_PERFORMED`.
- Pilot is `NOT_AUTHORIZED` and Production is `NOT_AUTHORIZED`.
- No provider activation, real model, autonomous successor, W6 work, release
  approval or external deployment is claimed.
- Existing issue #418 remains `PRESERVED_NOT_CONSUMED`; this closure does not
  consume, rewrite or close that issue.
- The repository's existing npm audit output reported 2 low and 7 high
  vulnerabilities; no dependency or lockfile change was made by this mission.
- CodeGraph evidence was retained as structural/tooling evidence; current
  source, exact SHA, local tests and remote checks are the acceptance authority.

## Rollback and authority boundary

The Product change is isolated in merged PR #422. Rollback can revert the
Product PR's merged change through the repository's normal reviewed rollback
process. This governance document is docs-only and does not mutate Course, Run,
Round, settlement, Replay, provider, deployment or production state.

This document closes only the M2-P3 Product PR and its governance readback. It
does not authorize a successor task.
