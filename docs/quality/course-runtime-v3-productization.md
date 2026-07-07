# Course Runtime V3 Synthetic Execution Evidence

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

PostgreSQL runtime:
NOT_AUTHORIZED
```

`Course Runtime V3` is an internal synthetic evidence package. It converges the
Course Delivery Runtime V2 path with request-id idempotency, audit integrity,
Scenario Factory binding, Replay evidence, Shadow Arena non-overwrite, role
scope and Learning Evidence isolation.

It does not prove `G0 PASS`, `L1 READY`, `Pilot`, `Production`, PostgreSQL
runtime, SQL, migration, durable settlement, R4 Macro, R9 or R10 readiness.

## Evidence Contract

The evidence helper is:

```text
services/api/src/course-runtime-v3.ts
```

It is a pure evidence-convergence helper. It does not register an API route,
does not mutate the store, does not change settlement math, does not change
Replay hashes, and does not expand Student visibility.

The helper returns:

```text
evidence_kind:
course_runtime_v3_synthetic_execution_evidence

direct_store_delta:
NONE

known status:
G0 Status = EXCEPTION
G0 PASS = NOT_GRANTED
L1 Status = NOT_READY
```

## Required Runtime Chain

The synthetic execution must cover:

```text
course.blueprint
course.publish
run.create
scenario.bind
round.start
decision.submit
decision.submit.idempotent_replay
round.lock
round.settle_requested
round.publish
result.read.student_redacted
result.read.teacher_evidence
tenant_admin.scope
replay.evidence
shadow_arena.non_overwrite
learning_evidence.excluded_from_truth_hash
audit.integrity
```

## Assertions

| Boundary          | Required assertion                                                                 |
| ----------------- | ---------------------------------------------------------------------------------- |
| Blueprint         | Course, scenario package, parameter set, plugin, engine and seed provenance align  |
| Decision submit   | duplicate request id returns the same decision without duplicate audit side effect |
| Round lock        | repeated lock is stable and does not create duplicate audit side effects           |
| Settlement        | repeated settlement keeps stable replay hash and formal result identity            |
| Round publish     | repeated publish is stable and does not duplicate audit side effects               |
| Student scope     | denied actions fail closed and Student views expose no protected markers           |
| Teacher evidence  | Teacher-visible result includes matched Replay evidence                            |
| Tenant Admin      | Tenant Admin visibility remains limited to `tenant_demo`                           |
| Replay            | matched Replay evidence writes no formal results                                   |
| Shadow Arena      | candidate evidence does not overwrite official results                             |
| Learning Evidence | excluded from truth hash and writes no formal truth                                |
| Audit integrity   | state transition evidence retains request ids and detects duplicate side effects   |

## Runtime Idempotency Scope

`decision.submit` now treats a repeated request id from the same tenant and
actor as an idempotent replay only when the run, round, team and submitted
decision payload match the original command. Reusing the same request id for a
different decision command returns a conflict.

This is JSON-runtime request replay protection. It is not a cross-process or
database transaction guarantee, and it does not claim durable settlement.

## Tests

Current guards:

```text
tests/integration/course-runtime-v3-synthetic-execution.test.ts
tests/e2e-ui/course-runtime-v3-smoke.spec.ts
```

The integration test uses the real API server and JSON runtime path to create a
course, two teams, one run, one round, two decisions, lock, settle, publish,
result read, Replay evidence, Shadow Arena evidence, Learning Evidence,
request-id idempotency and role-scoped projections.

The browser smoke renders the evidence summary through the existing Teacher,
Student and Tenant Admin browser shells and checks that student-visible content
does not include protected markers.

## Non-Goals

This package does not:

- modify `SettlementResult` shape
- modify settlement formulas
- modify `replay_hash`, `manifest_hash` or `canonical_evidence_digest` semantics
- implement `truth_hash`
- activate PostgreSQL runtime
- add SQL or migration work
- implement durable settlement
- make Learning Evidence a formal truth writer
- expand Student visibility
- close #111, #114 or #115

## Known Limits

```text
does_not_claim_g0_pass
does_not_claim_l1_ready
does_not_activate_postgresql_runtime
does_not_prove_durable_settlement
```

The evidence is suitable for independent evidence review of the synthetic
course runtime path. It remains internal-only until a separate Owner decision
changes the release boundary.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
