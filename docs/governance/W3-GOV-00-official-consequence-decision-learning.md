# SimWar W3 Governance Closure

Document ID: `W3-GOV-00`
Version: `V1.0`
Date: `2026-08-19 America/Los_Angeles`
Document Type: `GOVERNANCE_CLOSURE_AND_PLANNING_RECONCILIATION`
Repository: `qidianzhiku/SimWar`
Primary Outcome: `OFFICIAL_CONSEQUENCE_DECISION_LEARNING_CLOSED_LOOP`
Status: `GOVERNANCE_PR_PENDING`
Repository Mutation: `DOCS_ONLY_IN_ONE_GOVERNANCE_PR`
Product PR: `#394`
Product PR URL: `https://github.com/qidianzhiku/SimWar/pull/394`
Human Validation: `NOT_PERFORMED`
Pilot: `NOT_AUTHORIZED`
Production: `NOT_AUTHORIZED`
automatic_next_start: `false`
GOVERNANCE_MERGE: `PENDING_UNTIL_THIS_GOVERNANCE_PR_MERGES`
GOVERNANCE_RECLOSURE: `0`

## Closure boundary

This is the single governance closure for the existing W3 macro outcome. It
records the live Product merge, the post-merge evidence, and the remaining
limits. It does not create W4, W5, W6, a successor wave, a second truth or
learning authority, or a release authorization.

The W3 implementation remains an orchestration and learning-evidence surface.
It reuses the existing canonical Decision, round lock, settlement,
publication, D2 provenance, D3 Teacher Confirmation, and D4 Student Learning
Report authorities. W3 audit receipts and counterfactual comparisons are not
official settlement results, Replay truth, score/rank writers, or replacements
for the existing learning-report authority.

## Product merge and live readback

| Item | Exact evidence |
| --- | --- |
| Product base | `master@df10d7d0d7703e8b872ba69f337a7acabe5eed85` |
| Product source branch | `codex/w3-official-consequence-learning` |
| Product candidate head | `0ef92de003825f93ec6e2caa81536e2f768a31c5` |
| Product merge | `afc635016b8355cd7c2041062810778ae0754c64` |
| Product merge time | `2026-08-20T04:13:58Z` (`2026-08-19 21:13:58 America/Los_Angeles`) |
| Live `origin/master` after merge | `afc635016b8355cd7c2041062810778ae0754c64` |
| PR state after merge | `MERGED`; source head remains `0ef92de…`; merge was ordinary, non-force, non-admin, and non-auto |
| Required branch protection | strict; exact contexts: `quality`, `browser-smoke`, `Analyze JavaScript and TypeScript` |
| Blocking review threads | `0` at final pre-merge readback |

The final pre-merge readback proved `OPEN`, `NON_DRAFT`, `MERGEABLE`, `CLEAN`,
the exact candidate head, all required contexts successful, and no blocking
review threads. The Product merge was then performed once. Post-merge `master`
CI and CodeQL also completed successfully on the Product merge SHA.

## Required-check recovery record

The first browser-smoke attempt was cancelled during hosted Playwright/OS
dependency installation and did not execute browser assertions. The one
authorized targeted rerun executed the real browser tests and exposed a
Student `color-contrast` finding. The existing CSS-only remediation was kept
inside `apps/student/src/styles.css`; no accessibility PASS is claimed.

The next exact-head CI run initially reached the real focused browser tests,
which passed, but the visual comparator found that the PR4 candidate and
exact-base baseline had different W3 fixture state. The same-wave harness fix
was:

- commit `0ef92de003825f93ec6e2caa81536e2f768a31c5`,
  `fix(pr4): isolate visual baseline from W3 fixture`;
- override only the PR4 API web-server environment to
  `SIMWAR_PLAYWRIGHT_W3: "false"`;
- add a source regression assertion in
  `tests/unit/ui-pr4-integration.test.tsx`;
- preserve the dedicated W3 config with the W3 fixture enabled;
- preserve the visual threshold and the real browser assertions.

The successful final Product-head evidence was:

- CI run [`32330672097`](https://github.com/qidianzhiku/SimWar/actions/runs/32330672097):
  `quality` and `browser-smoke` successful;
- CodeQL run [`32330672114`](https://github.com/qidianzhiku/SimWar/actions/runs/32330672114):
  `Analyze JavaScript and TypeScript` successful;
- CodeQL check readback: successful;
- Product merge SHA CI run [`32331121732`](https://github.com/qidianzhiku/SimWar/actions/runs/32331121732):
  successful;
- Product merge SHA CodeQL run [`32331121801`](https://github.com/qidianzhiku/SimWar/actions/runs/32331121801):
  successful.

## Fresh detached validation

One fresh detached worktree was created at the exact Product merge SHA:

`C:\Temp\simwar-w3-postmerge-20260820t0414`

It was clean at checkout and after validation. The following evidence was
obtained from that exact detached state:

| Gate | Result |
| --- | --- |
| `npm ci` | `PASS`; dependency installation completed |
| `npm run typecheck` | `PASS` |
| `npm run test:contract` | `PASS`; 24 files, 57 tests; 20 baseline files, 37 M1 files, 26 schema/fixture groups |
| Full Vitest, default parallel attempt | environment worker timeout in one direct-store test; no product assertion failure |
| Full Vitest, bounded single-worker rerun | `PASS`; 210 files, 1322 tests |
| `npm run check:direct-store-boundaries` | `PASS`; new unapproved runtime access `0`, stale `0`, duplicate `0`, ambiguous `0` |
| Direct-store focused unit control | `PASS`; 8 tests |
| W3 contract/integration focused control | `PASS`; 5 tests |
| PR4 focused unit suite | `PASS`; 4 files, 49 tests |
| `npm run check:hidden-unicode` | `PASS`; no hidden Unicode control characters |
| `npm run lint` | `PASS` |
| `npm run build` | `PASS` for shared contracts, gateways, simulation-core, API, UI, Admin, Teacher, Student |
| `npm run security:audit` | critical gate `PASS`; inherited audit report has 9 vulnerabilities (2 low, 7 high) |
| PR4 real Chromium surface acceptance | `PASS`; 4 tests, including Lab, Admin/Enterprise, Teacher, Student |
| Dedicated W3 real Chromium journey | `PASS`; 1 test for publication, reflection, and counterfactual boundaries |
| Detached worktree integrity | `PASS`; exact merge SHA and clean status after artifact receipt move |

The initial parallel full-suite timeout was not used as a PASS. It was
resolved as a verification-environment worker contention issue by the
single-worker run, which passed the complete 210-file/1322-test suite. The
security advisories remain a known dependency limit and were not silently
fixed as part of this closure.

The local browser evidence roots were kept outside the product checkout. The
valid PR4 evidence root is:

`C:\Temp\simwar-w3-postmerge-pr4-evidence-20260820t0414`

The PR4 configuration rejected two invalid local paths before browser launch;
those were configuration guards, not product test results. The corrected run
used the required external `pr4-<id>` store path and completed successfully.

## Product outcome readback

The merged source and fresh browser journey support the following bounded
chain:

`W027 canonical Decision` → `round lock` → `decision batch freeze` →
`settlement` → `SETTLED` → `Teacher preview/publish gate` → `PUBLISHED` →
`Student-safe official result` → `causal/mechanism debrief` → `one-change
counterfactual` → `reflection` → `evidence selection` → `Teacher
Confirmation` linkage → `Student Learning Report` readback → `next-round
hypothesis handoff`.

This is machine/product validation only. It does not prove Human Validation
effectiveness, teaching effectiveness, pilot readiness, or production
readiness.

## Authority and visibility delta

### Authority delta

- W3 adds shared DTO/schema validation, BFF orchestration routes, safe UI
  surfaces, and append-only audit receipts for the learning trace.
- Existing canonical Decision admission remains the formal decision authority.
- Existing settlement and publication paths remain the formal result
  authorities.
- Existing Replay inputs and truth hash remain authoritative; the W3 bounded
  comparison is not a second Replay authority.
- Existing D2, D3, and D4 services remain the writers/readers for their
  respective evidence, confirmation, and learning-report authorities.
- No simulation-core semantics, settlement result shape, replay hash input,
  score/rank authority, database schema, provider, Postgres runtime, or RLS
  activation was introduced by this outcome.

### Student visibility delta

Student access remains tenant/course/run/team/round scoped and requires a
published official result. The Student surface exposes only the safe official
projection, bounded causal labels, reflection, confirmed evidence linkage, and
next-round hypothesis. It does not expose raw private event payloads or widen
Student visibility into private state. A full role/activity-scoped audit
receipt guarantee is not proven for every W3 reflection/evidence lookup:
`role_key` and `activity_id` are not yet part of the receipt lookup identity in
the reviewed path. This closure therefore makes no role-scoped security PASS
claim for that path.

## Known limits and non-claims

- `ACCESSIBILITY: PASS_NOT_CLAIMED`.
- The known Student color-contrast limitation remains visible: approximately
  `2.84:1` on `.sw-app-shell__primary-action > .compatibility-copy` against
  the identified dark background. This is not a WCAG, WCAG 2.2, or full
  accessibility PASS.
- Human Validation was not performed.
- Pilot and Production are not authorized.
- General PostgreSQL, RLS, migration readiness, cross-process durability, and
  external teaching-effectiveness claims are not proven.
- `npm audit` reports 9 inherited dependency vulnerabilities; the critical
  threshold command passed, but the advisories remain open evidence limits.
- CodeGraph was unavailable for this detached checkout because no `.codegraph`
  index was present. This is recorded as unavailable, not as graph PASS.
- `W3-SECURITY-LIMIT-ROLE-ACTIVITY-RECEIPT`: the reviewed W3 `buildRecord()` /
  `recordId()` path does not yet prove actor binding to `context.role_key` or
  receipt-key binding to `activity_id`. This remains an unresolved runtime
  security limit; this docs-only governance PR does not claim to repair it.

## Governance self-reference and release condition

This document intentionally contains the required self-reference:

`GOVERNANCE_MERGE: PENDING_UNTIL_THIS_GOVERNANCE_PR_MERGES`

The governance PR must contain this document only, pass the repository's
required checks, have no blocking review findings, and merge normally. After
that merge, an external readback receipt must record:

`GOVERNANCE_PR`, `GOVERNANCE_HEAD`, `GOVERNANCE_MERGE_SHA`, `FINAL_MASTER_SHA`,
and `READBACK_TIMESTAMP`.

No governance re-closure may be created to replace this self-reference.
Resource locks may be released only after Product merge, Governance merge, and
the successful external post-governance readback. The successor budget is
zero: `NEXT_EXECUTION=NOT_STARTED` and `AUTOMATIC_NEXT_START=FALSE`.

## Final closure condition

This W3 outcome is `PRODUCT_COMPLETE_WITH_LIMITS_GOVERNANCE_PENDING` until
this single governance PR merges and the external readback receipt proves the
final master state. After that readback, release the W3 logical locks and
stop. Do not start a successor or reopen the Product PR.
