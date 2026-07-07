# Course Delivery Runtime V2 Synthetic Execution Evidence

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

`Course Delivery Runtime V2` is an internal synthetic evidence package. It
converges the merged course delivery productization path with Scenario Factory,
Replay evidence, Shadow Arena, role visibility and Learning Evidence isolation.

It does not prove `G0 PASS`, `L1 READY`, `Pilot`, `Production`, PostgreSQL
runtime, SQL, migration, durable settlement, R4 Macro, R9 or R10 readiness.

## Evidence Contract

The evidence helper is:

```text
services/api/src/course-delivery-runtime-v2.ts
```

It is a pure evidence-convergence helper. It does not register an API route,
does not mutate the store, does not change settlement math, does not change
Replay hashes, and does not expand Student visibility.

The helper returns:

```text
evidence_kind:
course_delivery_runtime_v2_synthetic_execution_evidence

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
course.publish
run.create
round.start
decision.submit
round.lock
round.settle_requested
round.publish
result.read
replay.evidence
shadow_arena.non_overwrite
learning_evidence.excluded_from_truth_hash
```

## Assertions

| Boundary               | Required assertion                                                               |
| ---------------------- | -------------------------------------------------------------------------------- |
| Course and run binding | Course, Run, Round, ScenarioPackage, ParameterSet and run-binding evidence align |
| Teams and decisions    | exactly two synthetic teams have validated decisions                             |
| Student projection     | no `state_true`, replay evidence, private replay or other-team identifiers       |
| Teacher evidence       | teacher-visible result includes two teams and matched Replay evidence            |
| Tenant Admin scope     | Tenant Admin sees only `tenant_demo`                                             |
| Platform authority     | Platform Admin visibility is explicit and recorded as governance evidence        |
| Replay                 | matched replay evidence writes no formal results                                 |
| Shadow Arena           | candidate replay evidence does not overwrite official result                     |
| Repeated settlement    | repeated settlement keeps stable replay hash and formal result identity          |
| Learning Evidence      | excluded from truth hash and writes no formal truth                              |

## Tests

Current guards:

```text
tests/integration/course-delivery-runtime-v2.test.ts
tests/e2e-ui/course-delivery-runtime-v2-smoke.spec.ts
```

The integration test uses the real API server and JSON runtime path to create a
course, two teams, one run, one round, two decisions, lock, settle, publish,
result read, Replay evidence, Shadow Arena evidence, Learning Evidence and
role-scoped projections.

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
course execution path. It remains internal-only until a separate Owner decision
changes the release boundary.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
