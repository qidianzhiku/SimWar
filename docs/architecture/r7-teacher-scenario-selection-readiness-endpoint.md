# R7 Teacher Scenario Selection Readiness Endpoint

## Runtime Surface

```text
GET /api/v1/bff/teacher/runs/:runId/scenario-selection-readiness
operation_id = R7_TEACHER_SCENARIO_SELECTION_READINESS_GET_V1
```

The endpoint is a Teacher-only, read-only BFF projection. It resolves the
tenant from the authenticated request context, reads the Run by path ID, and
derives `course_id` from that tenant-scoped Run. The client supplies only
`scenarioPackageId` and `parameterSetId` as query parameters.

## Read Path

The handler uses only these existing RepositoryFacade calls:

```text
runtime.repositoryProvider.facade.runs.getRun
runtime.repositoryProvider.facade.scenarios.getScenarioPackage
runtime.repositoryProvider.facade.parameterSets.getParameterSet
```

The selected Scenario Package and ParameterSet must belong to the resolved
tenant and match the immutable references already bound to the Run. Missing,
cross-tenant, and mismatched resources share one non-oracle `404` response.

## Gate And Projection

The projection calls the existing
`validateR7BffEndpointImplementationGate` evaluator. Contract drift fails
closed with `R7_BFF_SCENARIO_SELECTION_GATE_BLOCKED`; no parallel gate is
introduced. Status fields are serialized from the existing Scenario seed,
ParameterSet alignment, QA/provenance, calibration, and runtime-adapter
preparation contracts.

The endpoint does not return Scenario source material, ParameterSet values,
Replay artifacts, protected digests, `state_true`, SettlementResult data,
scores, or ranks.

## Authority Boundary

Current Teacher authority is the existing authenticated `teacher` role plus
tenant-scoped `course:read` permission. The repository has no separate
Teacher-to-Course assignment model. Therefore course authority is derived
from a Run visible through the Teacher's tenant-scoped facade read; this
endpoint does not invent a new assignment store or direct-store lookup.
The actor's home tenant must equal the resolved request tenant, so a subject
that also has `platform_admin` cannot use tenant switching on this
Teacher-only surface.

## Non-Proofs

```text
SCENARIO_RUNTIME_NOT_ACTIVATED
PARAMETERSET_NOT_MUTATED
REPLAY_NOT_EXECUTED
SETTLEMENT_NOT_EXECUTED
ENDPOINT_RESPONSE_NOT_FORMAL_TRUTH
```

This endpoint is not Scenario runtime activation, frontend consumption,
Teacher rehearsal, R8-G1 release, `G0 PASS`, `L1 READY`, Pilot readiness, or
Production readiness.
