# L1P-W025 Durable Validation Environment Launch

**Status:** `CLOSED_AND_CURRENT_WITH_LIMITS`

**Product PR:** `#372`

**Product merge:** `93883f47af9d1ee8892eeabf40f78240c186589a`

**Product candidate:** `a24dad3f8d3aca905fafb0a42f05b2309e16e02f`

**Evidence root:**
`C:/Temp/simwar-w025-postmerge-20260813T003312Z`

## Primary Outcome

W025 delivers a durable PostgreSQL-backed validation-environment launch saga.
A launch combines exact approved ParameterSet and ScenarioPackage references,
target tenant, exact CourseBlueprint and CoursePackage inputs, a fresh learner
cohort, teams, roles, and a ValidationSession preflight. The resulting machine
environment reaches `READY_FOR_HUMAN_INTERNAL_VALIDATION_WITH_LIMITS`.

`ValidationEnvironmentLaunch` is orchestration evidence, not a second formal
authority. ParameterSet, ScenarioPackage, CoursePackage, Course/Run, users,
teams, roles, ValidationSession, Truth and settlement remain owned by their
existing command services and formal writers.

## Identity and Saga

The durable business identity is `tenant_id + launch_key_digest`. A canonical
request fingerprint binds all exact source, course and cohort inputs. The
lifecycle is:

```text
REQUESTED
-> BASELINE_READY
-> COURSE_RUN_READY
-> COHORT_READY
-> SESSION_PREFLIGHT_READY
-> READY
```

The same identity and fingerprint resumes or reuses the official launch. A
different fingerprint for the same identity fails closed with
`W025_LAUNCH_CONFLICT`. PostgreSQL uses transactional insert-or-read,
versioned compare-and-swap transitions and a separate bounded advisory-lock
pool, so same-key callers serialize without exhausting the formal transaction
pool or globally serializing independent keys.

## Crash and Concurrency Evidence

- C1, after the launch record: PASS.
- C2, after baseline provisioning: PASS.
- C3, after Course/Run creation: PASS.
- C4, after cohort, teams and roles: PASS.
- C5, after ValidationSession and preflight: PASS.
- Ten identical requests across two independent API processes: PASS.
- Durable result: one immutable launch identity and one READY row at version 5.
- Exact retry: reused the same official launch.
- Conflicting retry: failed closed with `W025_LAUNCH_CONFLICT`.
- Duplicate environments: 0.
- Second formal authorities: 0.
- Disposable PostgreSQL residue after validation: 0.

The crash proof uses actual API/process stop and restart. It does not depend on
same-process memory surviving the failure.

## Validation

- Frozen Acceptance: 100 rows, FAIL=0, UNKNOWN=0, NOT_MAPPED=0.
- W025 focused tests: 3 files / 34 tests PASS.
- W025 real PostgreSQL validation: 1 file / 2 tests PASS.
- W024 PostgreSQL regression: 1 file / 1 test PASS.
- PostgreSQL Replay: 20/20 PASS.
- Contract: 20 files / 48 tests PASS.
- Default Vitest: 186 files / 1155 tests PASS.
- Browser: 80 passed / 9 repository-defined skips; role-workflow: 1 passed.
- Direct-store guard: new/stale/duplicate/broad = 0.
- Typecheck, lint, build, hidden-Unicode and git diff checks: PASS.
- Security audit: critical threshold PASS; inherited 2 low / 7 high.
- Product PR checks: quality, browser-smoke, Analyze JavaScript and TypeScript,
  and CodeQL PASS.
- Independent review: BLOCKING=0 / MUST_FIX=0 / UNKNOWN=0.
- Fresh detached clone: clean at the exact product merge SHA.

No retry masking, skip, timeout increase, worker override, serialization
override or assertion weakening was used to claim these results.

## Graph Evidence and Actual ROI

Post-merge Graph Companion is bound to the exact product merge SHA with
`CURRENT_EXACT_SHA` freshness. Graphify is healthy at 12,118 nodes / 22,040
edges. CodeGraph is healthy at 482 files / 7,761 nodes / 31,428 edges with zero
pending changes, using an external index rather than a source-worktree
`.codegraph` directory.

Graphify materially confirmed source-bound scope and impact once. CodeGraph
materially confirmed caller/writer boundaries once. No graph call was credited
without a material contribution, and final source reconciliation missed zero
required tests. Graph evidence remains advisory: Graphify parser coverage may
be incomplete, and CodeGraph covering-test edges are supplemented by explicit
source review and the full test matrix.

## Authority and Limits

JSON remains the default runtime authority. PostgreSQL is active only when
explicitly selected for the bounded W024 Course/Run and W025 launch routes;
explicit Postgres mode never silently falls back to JSON. General PostgreSQL
application runtime and RLS are not authorized.

Durable recovery is proven only for the verified W024 and W025 journeys.
General CoursePackage compensation rollback remains unproven and is disclosed
by the registry. The direct-store static guard does not fully detect alias or
indirect access. Human Validation was not performed, and READY does not mean a
teacher or learner session occurred. Teaching effectiveness, Pilot and
Production are not proven or authorized.

Issue #351 remains open. W025 success does not depend on closing it. The
closure records one factual progress comment without claiming the broader
durable tenant-baseline transaction-boundary family is complete.

## Closure

W025 is closed after PR #372 ordinary merge, the clean detached post-merge
matrix, exact-SHA Graph Companion readback, the single docs-only Governance
Closure, Issue #351 factual progress recording, and governance readback.

All W025 product, launch-ledger, migration, crash/restart, concurrency, graph,
serial-merge, fresh-clone and governance locks are released only after that
readback. Governance reclosure count is 0. W026 and Human Validation are not
started, and `automatic_next_start` remains `false`.
