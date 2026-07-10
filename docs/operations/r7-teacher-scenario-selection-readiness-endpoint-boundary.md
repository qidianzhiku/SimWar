# R7 Teacher Scenario Selection Readiness Endpoint Boundary

## Operator Contract

```text
Method: GET
Path: /api/v1/bff/teacher/runs/:runId/scenario-selection-readiness
Authentication: required
Role: teacher only
Tenant source: authenticated server context
Course source: tenant-scoped Run
Writes: none
```

The route is safe to call repeatedly because it performs only existing
RepositoryFacade reads and creates a response projection in memory. It does
not append audit events, bind a Scenario, modify a ParameterSet, execute
Replay, settle a round, or update formal state.

## Response Interpretation

`READY` means the selected, already-bound Scenario Package and ParameterSet
can be represented by this read-only selection-readiness projection. It does
not mean Scenario runtime activation or release approval.

`BLOCKED` is a successful, authorized projection with stable `no_go_reasons`.
It may be returned only after tenant, Run, Scenario, and ParameterSet scope
checks pass. Implementation-gate drift is instead a `409` fail-closed error.

Evidence freshness is currently represented as:

```text
collected_at = null
expires_at = null
is_expired = false
```

The source contracts do not currently carry timestamps. Operators must not
reinterpret `null` timestamps as durable or externally certified evidence.

## Operational Limits

```text
G0 Status: EXCEPTION
G0 PASS: NOT_GRANTED
L1 Status: NOT_READY
Scenario Runtime: NOT_AUTHORIZED
ParameterSet Mutation: NOT_AUTHORIZED
Replay / Settlement: NOT_RUN
PostgreSQL Runtime: NOT_AUTHORIZED
Pilot / Production: NOT_AUTHORIZED
```

No frontend selector, Student route, Tenant Admin route, Platform Admin route,
database adapter, OpenAPI change, or schema change is introduced.
