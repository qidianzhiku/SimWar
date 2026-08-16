# SimWar MW1-GOV-00 | Canonical Decision Admission Safety Governance Closure

Document ID: MW1-GOV-00
Version: 1.0
Date: 2026-08-16
Status: GOVERNANCE CLOSURE CANDIDATE — PASS_WITH_LIMITS PENDING THIS PR MERGE
Mission: `SIMWAR-MACRO-WAVE-ROUND-1-PX1-CA-01-ACTIVE-MAINLINE-ADOPTION-CLOSURE-V1.0`
Execution base master: `35b61ae205d05f01b351e71ab3b1d7d9c5e2aeac`
Execution base tree: `131e53a021f79e522de1b1374095543c462392a4`
Product PR: [#379](https://github.com/qidianzhiku/SimWar/pull/379)
Product merge SHA: `a6eaa93afe6ce8f37d8dbedcead592998745dbcb`
Product merge tree: `417c373eab6bd024b751b42703d5784ee3933c6f`
Governance PR: this docs-only PR; number recorded in the external final readback
Implementation Claim: PX1-CA-01 is adopted in protected master; this document closes the Macro Wave governance record only.
Repository Mutation: Docs-only; no Product source, tests, migration, runtime, or historical evidence mutation.
Human Validation: NOT_PERFORMED
Pilot: NOT_AUTHORIZED
Production: NOT_AUTHORIZED
automatic_next_start: false

## Primary Outcome

PX1-CA-01 is the single adopted Product Mainline outcome for this Macro Wave. The protected master now enforces the bounded authority seam:

`ROLE_WORKFLOW_REQUIRED` → configured role readiness → validated current merge → confirmed team workflow → one submitted role-merge canonical Decision → exact canonical Decision set → round lock → exact formal settlement input → matching replay evidence.

`RoleWorkflowCommandService.confirmTeamDecision` is the only formal canonical Decision business writer. Direct Decision submission is compatibility-only under an explicit synthetic marker; missing policy is fail-closed and is never interpreted as Legacy.

## Product Merge and Evidence

- Product PR #379 merged ordinarily, without squash, rebase, force, or auto-merge.
- Product merge: `a6eaa93afe6ce8f37d8dbedcead592998745dbcb`.
- Fresh detached post-merge clone: `C:\Users\Marshall\.codex\px0-evidence\E-SIMWAR-MW1-20260816-072206\postmerge\fresh-detached-clone`.
- Fresh clone was clean at the merge SHA and `origin/master` independently read back to the same SHA.
- M3: external `E-SIMWAR-MW1-20260816-072206/deliverables/MW1-M3-PX1-CA-01-Post-Merge-Execution-and-Verification.md`.
- Required protected checks on the merge commit passed: quality, browser-smoke, Analyze JavaScript and TypeScript, and CodeQL.

## Cell Map and Handoffs

| Lane                       | Status   | Handoff                                                                          |
| -------------------------- | -------- | -------------------------------------------------------------------------------- |
| P0 Product Mainline        | COMPLETE | PR #379 adopted; no successor started.                                           |
| P1 / P2 Product candidates | OFF      | No mutation authority in this wave.                                              |
| R1 Graph / source          | COMPLETE | Graph contribution ledger; source readback is truth.                             |
| R2 Security / authority    | COMPLETE | One formal writer, no formal bypass, no implicit Legacy, no visibility widening. |
| R3 Challenge               | COMPLETE | Blocking findings 0; known limits are explicit.                                  |
| V1 Heavy validation        | COMPLETE | Serial fresh-clone full, contract, browser, CI, and bounded Postgres evidence.   |

The requested explorer subagent cells were unavailable because thread capacity was exhausted. R1/R2/R3 were completed sequentially by the primary controller; no subagent result is claimed.

## Graph Contribution Ledger

The detailed ledger is in `MW1-GRAPH-CONTRIBUTION-LEDGER.md`. Graphify and CodeGraph were built outside the Product source tree. They contributed navigation and impact discovery, not repository truth.

- Graphify post-merge: 12,570 nodes and 22,974 raw edges; diagnostics include skipped non-code, sensitive, JSON/fixture, and SQL inputs.
- CodeGraph post-merge: 526 files, 8,395 nodes, 26,910 edges, pending changes 0, worktree mismatch null; the reindex recommendation is retained because archive extraction metadata is absent.
- Material graph paths were read back in source: lock, formal replay, settlement, and `confirmTeamDecision`.
- Graph false positive: direct type coverage for `DecisionAdmissionPolicy` was not reported, while integration tests cover policy resolution and the shared union is source-confirmed.
- Graph false negative risk is not claimed absent; bounded source search and tests closed the relevant decision-authority paths.

## Finding Closure

| Family | Finding                              | Disposition                                                                                                                                                                                          |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1     | Canonical writer authority           | CLOSED — `confirmTeamDecision` / `commitRoleWorkflow` is the sole formal business path.                                                                                                              |
| F2     | Lock and settlement admission        | CLOSED_WITH_LIMITS — exact scoped deterministic set and digest are required in Formal Course.                                                                                                        |
| F3     | Replay and adapter parity            | CLOSED_WITH_LIMITS — production formal replay receives admitted set; explicit omitted-set helper fallback remains for compatibility callers. JSON is default; bounded PostgreSQL CI replay is green. |
| F4     | CI and governance environment limits | CLOSED_WITH_LIMITS — local PostgreSQL URL absent, full format debt inherited, dependency advisories unchanged, planning-carrier drift documented.                                                    |

Blocking findings: 0. Must-fix findings: 0. Unknown findings: 0.

## Authority and Visibility Invariants

- Second formal canonical writer: 0.
- Formal direct Decision bypass: 0.
- Implicit Legacy fallback: forbidden.
- Formal settlement latest/last selection: 0; latest selection remains only in explicit Legacy compatibility.
- Canonical set tenant/run/round/team scope: enforced and tested.
- Student private-field widening: 0 observed in this Product PR; no Student application source changed, and browser/API evidence retains role-safe projections.
- Historical official settlement, replay hash, manifest, score, rank, and prior wave evidence: not rewritten.

## Explicit Non-Claims and Deferred Work

The following remain deferred and were not reopened:

- Publication Gate safety → `PX1-PG-01`.
- selectedRound / round command integrity.
- Structured Student DecisionTrace.
- BLP / RCNL formal runtime or join.
- Shanghai formal calibration/join.
- Small Model / Instructor Intelligence mutation.
- Multi-Agent and external Provider mutation.
- General PostgreSQL, RLS, migration, Human Validation, Pilot, Production.

## Runtime and Validation Limits

- JSON remains the default runtime.
- PostgreSQL evidence is bounded to the explicit CI verification path; general PostgreSQL and RLS are not activated.
- Local `npm run test:postgres-replay` could not run because `SIMWAR_TEST_DATABASE_URL` was absent. Protected CI quality ran the same command with PostgreSQL 16 and passed 20/20.
- Full repository Prettier check remains inherited-debt limited (52 files); scoped Product changed-file formatting passed.
- Security threshold passed, while the repository dependency audit continues to report 2 low and 7 high existing vulnerabilities; no dependency update is included.
- Human Validation is not performed; Browser evidence is automated evidence only.

## Planning Carrier Disposition

The existing `docs/planning/current-cycle.yaml` and `docs/planning/l1-plus-portfolio-register.yaml` were freshly read at the Product merge base and still describe the older UI refoundation. They were intentionally not changed here because open PR #374 is a stale-base DIRTY PR occupying the same carriers. This Governance Closure does not close, rebase, or supersede PR #374, and it does not create a second carrier-repair PR.

This is a recorded governance limitation, not a claim that those carriers are current. Any future carrier reconciliation requires a fresh owner decision and must not be inferred from this closure document.

## Resource Lock Release Plan

Upon merge of this single Governance PR and detached readback:

- P0 Product hot-file ownership is released.
- P1/P2 remain OFF.
- R1/R2/R3 evidence cells are closed read-only.
- Browser and heavy-validation serial lanes are released.
- No shared contract, OpenAPI, server, settlement, replay, migration, UI, model, or provider writer remains authorized by this wave.
- `PRODUCT_MAINLINE_WIP = 0` after closure.
- `GOVERNANCE_RECLOSURE = 0`.
- `automatic_next_start = false`.

## Invalidation Triggers

This closure expires for future decision-making if Product source, authority writer, student visibility, contract, settlement/replay semantics, runtime default, protected-master state, or the deferred planning carriers change. A future mission must fresh-read current master and may not treat this document as permanent repository truth.
