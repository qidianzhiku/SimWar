# MW4 Governance Closure

## Formal Multi-Round Lifecycle Continuation

Document ID: `SIMWAR-MW4-GOV-00`

Version: `1.0`

Status: `GOVERNANCE_CLOSURE_CANDIDATE`

Repository: `qidianzhiku/SimWar`

Product outcome: `FORMAL_MULTI_ROUND_LIFECYCLE_CONTINUATION`

Product PR: [#385](https://github.com/qidianzhiku/SimWar/pull/385)

Product merge: `422bb78eac6d1f267976f4c63d57ca7e7d755139`

Product merge tree: `3f975206e48457da68b4310779fb3b43c233842b`

Governance PR: `RECORDED_AT_PR_CREATION`

Automatic successor: `false`

Human validation: `NOT_PERFORMED`

Pilot / production: `NOT_AUTHORIZED`

This document is the single docs-only governance closure for MW4. It records
the product merge, fresh detached readback, post-merge graph state, measured
method, finding disposition, and known limits. It does not authorize a new
Product Wave or alter settlement, replay, migration, AI, or infrastructure
runtime semantics.

## 1. Outcome and delivery gate

The single product outcome was to allow a formal run whose published
predecessor round can be continued into the next deterministic draft round,
with a server-authoritative command, exact run/tenant/round identity,
idempotent retry behavior, and Teacher/Student projections of the resulting
round context.

The product slice is complete with limits:

- `POST /api/v1/runs/{runId}/rounds/{roundNo}/continue` is server-authorized by
  `round:continue` and is executed under the existing per-run mutation lock.
- Continuation requires the exact tenant and run, a published predecessor, and
  no conflicting exact successor state.
- A deterministic successor identity is reused on exact retry; the server
  emits a receipt and audit event for the action.
- The Teacher BFF and Teacher workspace expose the current round context and
  continuation action from server-projected state.
- The Student BFF preserves published-only visibility and the integrated
  browser path confirms the newly created round context without granting the
  learner teacher authority.
- No ordinary round-count/max-round policy was introduced. The supported
  outcome is continuation of an explicitly addressed predecessor, not an
  assertion that the product has a complete unrestricted round factory.

The exact Product PR required checks converged to green after one same-wave
test-only recovery commit. Product PR #385 merged normally; no auto-merge was
used and no Product PR after #385 was created.

## 2. Fresh source and post-merge identity

```text
source SHA before Product PR: 7fe4df1a1944fdb07474a42e85c3a5735ace20d6
Product PR final head:         f38e159172a5cecff521aea832c69fc2e74f97c8
Product merge SHA:             422bb78eac6d1f267976f4c63d57ca7e7d755139
Product merge tree:            3f975206e48457da68b4310779fb3b43c233842b
```

The post-merge clone was created from GitHub at the exact merge commit, was
detached, and initially read back with no tracked or untracked changes. The
post-merge CodeGraph index added the merged files and reported:

```text
files: 537
nodes: 8,519
edges: 33,879
database: 36.22 MB
status: up to date
```

The post-merge graph index is an external evidence artifact, not repository
truth. The source clone used for CodeGraph acquired the expected local
`.codegraph/` directory as an untracked indexing artifact after the clean-clone
readback; this does not alter the detached source commit.

## 3. Method score

| Dimension | Weight | Score | Evidence-based rationale |
| --- | ---: | ---: | --- |
| A. Outcome integrity | 25 | 25 | One selected outcome, one formal writer, one Product PR, no MW1/MW2/MW3 reopening, and explicit limits preserved. |
| B. Development efficiency | 25 | 21 | One product branch and PR, one bounded test-only recovery commit, focused red-first tests, and no opportunistic refactor; the initial browser-smoke failure incurred measurable convergence cost. |
| C. Parallel coordination | 15 | 13 | Read-only repository, frontend, and backend/model/graph cells were used; mutation remained serialized and no shared-hot-file collision occurred. |
| D. Quality convergence | 15 | 13 | Required remote checks converged green, contract and product tests passed, and browser failure evidence was preserved; inherited format debt, audit advisories, and detached-test limitation remain disclosed. |
| E. Graph engineering ROI | 10 | 8 | CodeGraph materially supported call-path and impact discovery; Graphify was incomplete and correctly fell back to source readback. |
| F. Governance and autonomy | 10 | 10 | Owner authorization, exact-head merge, fresh clone, one governance closure, no auto-successor, and explicit stop boundary were observed. |
| **Total** | **100** | **90** | **A — EXCELLENT_METHOD** |

The score evaluates method quality, not human teaching effectiveness or
production readiness.

## 4. Efficiency actuals

The external event ledger is the authoritative calculation input for the
metrics below. The first ledger event was the evidence-root freeze at
`2026-08-16T17:44:07.9394945-07:00`. Validation events include both first-pass
and bounded recovery attempts; retry cost is not hidden.

| Metric | Actual | Definition / limit |
| --- | ---: | --- |
| Outcome completeness | 1/1 = 100% bounded | The selected product outcome is merged and browser/API evidenced; ordinary round factory and teaching effectiveness remain outside scope. |
| First-pass required remote checks | 2/3 = 66.7% | Quality and Analyze passed on first remote run; browser-smoke required the recorded same-wave test recovery. Final required checks were 3/3. |
| Rework ratio | 1/2 = 50% | One recovery commit over two Product PR commits; the second commit changed only the existing browser test's round matcher and assertion projection. |
| Merge conflict rate | 0/1 = 0% | One Product PR merge, no merge conflict or rebase. |
| Parallel efficiency | N/A_SINGLE_WRITER | High-risk product mutation was intentionally single-writer. |
| Parallel gain | N/A_SINGLE_WRITER | Read-only discovery was parallelized; product mutation was not parallelized. |
| Core final UNKNOWN | 0 | Every required final gate is PASS, PASS_WITH_LIMITS, or an explicit blocked/known-limit classification. |

The final frozen pack records the numeric wall time, lead time, convergence
cost, coordination overhead, evidence density, and artifact counts after the
governance merge readback, because the governance merge timestamp is not known
at authoring time and must not be guessed.

## 5. Writer topology and resource locks

High-risk product writer: one.

Product PR: `#385` — released by the merge.

Governance writer: this one docs-only PR.

Support lanes: read-only during MW4; no support-lane mutation was admitted.

The product mutation ownership topology was:

```text
Teacher command / BFF projection
        |
        v
server.ts -> round-continuation.ts -> repository ports / existing stores
        |
        v
shared contracts + OpenAPI + schema/fixture + focused tests
```

Settlement, replay truth, simulation-core selection, migration, Postgres
activation, and Student source were deliberately not made mutation owners.
The existing JSON default runtime remains authoritative for local execution;
bounded Postgres remains an explicit opt-in path.

## 6. Graph contribution and source readback

CodeGraph was used as a navigation and impact-discovery aid. Its findings were
closed by reading back exact source and tests. The useful post-merge symbols
included `RoundContinuationError`, `RoundContinuationResult`,
`continueRoundWithRunLock`, `continueRound`, `createFormalBoundRun`, and the
Teacher round context relationships.

Graphify extraction did not produce a completed final graph artifact. The
result is classified as `GRAPHIFY_INCOMPLETE_WITH_SOURCE_FALLBACK`; it is not a
failed product gate. No graph-only claim is used for implementation, safety,
or completion.

## 7. Required-check and baseline delta

Final Product PR remote checks:

- `quality`: PASS
- `browser-smoke`: PASS after the preserved first failure and scoped recovery
- `Analyze JavaScript and TypeScript`: PASS
- CodeQL: PASS

Local evidence includes focused lifecycle tests, typecheck, build, lint,
contract validation, product test suite, browser smoke, role-workflow browser
journey, hidden-unicode check, direct-store boundary check, and security audit.

Known non-green or limited checks are not silently promoted:

- repository-wide format check remains blocked by inherited debt outside the
  changed scope;
- security audit passes the configured critical threshold but reports 2 low
  and 7 high advisories without dependency mutation authorization;
- bounded Postgres replay could not run because
  `SIMWAR_TEST_DATABASE_URL` was absent;
- the fresh detached post-merge clone's full `npm test` hit the existing
  direct-store guard's `git symbolic-ref --short HEAD` assumption. The
  product-branch full suite passed 204/204 files and 1,298/1,298 tests; the
  detached readback limitation is recorded separately and is not repaired by
  this closure.

## 8. Finding closure

| Finding family | Disposition | Closure evidence |
| --- | --- | --- |
| F1. Round continuation authority | CLOSED_WITH_LIMITS | Server permission, run lock, exact predecessor/successor resolver, receipt, and focused tests. |
| F2. Round identity and state transition | CLOSED_WITH_LIMITS | Tenant/run/round identity, published predecessor requirement, deterministic successor identity, and Teacher/Student projection evidence. |
| F3. Cross-layer contract integration | CLOSED | Shared permission/result types, OpenAPI route/schema/fixture, BFF projection, contract checks. |
| F4. Idempotency and recovery | CLOSED_WITH_LIMITS | Exact retry reuse and negative/conflict tests; no durable cross-process uniqueness claim. |
| F5. Validation and governance | CLOSED_WITH_LIMITS | Required remote checks green after one scoped recovery; inherited debt and environment limits remain explicit. |

## 9. Preserved baselines and non-proofs

MW1 Canonical Decision Admission, MW2 Publication Gate Safety, and MW3 Round
Scoped Teacher Context / Command Integrity remain historical baselines and are
not reopened, rewritten, or relabeled. MW3 remains `PASS_WITH_LIMITS` with a
partially measurable historical baseline.

MW4 does not prove:

- ordinary multi-round creation policy or an unrestricted round-count model;
- settlement, replay hash, or publication redesign;
- durable multi-process uniqueness without a database constraint;
- general PostgreSQL, RLS, backup/PITR/DR, or production operations;
- human validation, teaching effectiveness, pilot, or production readiness;
- BLP, Shanghai, Small Model, Multi-Agent, or external provider runtime;
- automatic successor authorization.

## 10. Closure and expiry

The Product Mainline WIP is zero after Product PR #385 merged. The one
governance closure PR is the only remaining MW4 mutation. After its expected
head merge and fresh master readback, all MW4 resource locks expire and the
mission stops.

Governance reclosure count: `0`.

This closure expires if product source, Teacher or Student runtime,
round-continuation contract, server authority, settlement/replay truth,
visibility semantics, or the exact master head changes. A future mission must
fresh-read protected master and may not reuse this document as current source
truth.

Next mission: `NOT_STARTED_PENDING_OWNER_DIRECTION`.

Automatic next start: `false`.
