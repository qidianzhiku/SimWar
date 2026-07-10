# R7 Teacher Scenario Readiness Product Surface

The Teacher app exposes an internal-only Scenario Readiness panel inside the
existing Run Workspace. The panel derives `runId` from the current Teacher
workspace state and asks for only a Scenario Package ID and a ParameterSet ID.

The panel calls exactly:

```text
GET /api/v1/bff/teacher/runs/:runId/scenario-selection-readiness
```

The browser sends a Bearer token but no `x-tenant-id`; tenant scope remains
server-resolved by the merged endpoint. The panel persists nothing and has no
Scenario activation, ParameterSet write, Replay, settlement, or publishing
control.

The rendered states are `IDLE`, `LOADING`, `READY`, `BLOCKED`, local
`INVALID_REQUEST`, and generic safe authentication, authorization,
out-of-scope, and internal-error states. `READY` and `BLOCKED` show only the
endpoint's approved readiness fields, evidence freshness, stable No-Go codes,
explicit non-proofs, and Known Limits.

This is a Teacher product surface, not a Student, Tenant Admin, or Platform
Admin surface. It does not establish Scenario runtime activation, formal truth
authority, `G0 PASS`, `L1 READY`, Pilot readiness, or Production readiness.
