# Teacher / Student BFF DTO Productization

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

R8-G1:
INTERNAL_ONLY_DRAFT_NOT_RELEASED

PostgreSQL runtime:
NOT_AUTHORIZED

Pilot / Production:
NOT_AUTHORIZED

Durable Settlement:
NOT_PROVEN
```

This document records Program 033 Teacher / Student BFF DTO productization
evidence after PR #214 entered `master`. It creates frontend-ready projection
contracts and read-only BFF aggregation routes for the current JSON runtime.

It does not release R8-G1, it does not mark L1 ready, and it does not authorize
PostgreSQL, Pilot, Production, durable settlement or real teacher rehearsal
work.

## Productization Scope

Program 033 converts existing controlled runtime evidence into read-only
product-facing DTOs:

| Surface                  | Route                                                       | Actor          | Mutation allowed | Evidence label                                                  |
| ------------------------ | ----------------------------------------------------------- | -------------- | ---------------- | --------------------------------------------------------------- |
| Teacher workspace        | `/api/v1/bff/teacher/runs/:runId/rounds/:roundNo/workspace` | Teacher        | no               | `BFF_DTO_PRODUCTIZATION_EVIDENCE / TEACHER_PROJECTION_EVIDENCE` |
| Student cockpit          | `/api/v1/bff/student/runs/:runId/rounds/:roundNo/cockpit`   | Student        | no               | `BFF_DTO_PRODUCTIZATION_EVIDENCE / STUDENT_PROJECTION_EVIDENCE` |
| Tenant Admin summary     | `/api/v1/bff/admin/tenant-summary`                          | Tenant Admin   | no               | `TENANT_BOUNDARY_EVIDENCE`                                      |
| Platform Admin authority | `/api/v1/bff/admin/platform-authority?scope=platform`       | Platform Admin | no               | `TENANT_BOUNDARY_EVIDENCE`                                      |

The routes aggregate existing in-memory JSON runtime state and public result
projection. They do not call settlement, do not write direct store state, do not
change replay hashes and do not create audit events.

## DTO Matrix

| DTO                         | Product purpose                                         | Protected boundary                             |
| --------------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| `TeacherDashboardDTO`       | Teacher course/run/round overview                       | no formal truth write authority                |
| `CourseWorkspaceDTO`        | Course and run context for Teacher workspace            | no direct store mutation                       |
| `RoundControlDTO`           | Current round state and allowed Teacher actions         | no score, rank or result overwrite             |
| `TeamMonitorDTO`            | Team decision submission status                         | no private student payload expansion           |
| `TeacherReplaySummaryDTO`   | Teacher-authorized replay summary and audit reference   | read-only evidence; not durable recovery proof |
| `StudentCockpitDTO`         | Student current run, round and team view                | no `state_true`                                |
| `DecisionFormDTO`           | Student decision form capability view                   | no truth-field write                           |
| `PublishedResultDTO`        | Student redacted result                                 | no private replay, manifest or digest fields   |
| `ThreePartFeedbackDTO`      | Student-facing observation / estimate / next-step slots | advisory only; not formal grade                |
| `LearningReportDTO`         | Student learning evidence summary                       | no teacher private evidence                    |
| `TenantAdminSummaryDTO`     | Tenant-scoped operational summary                       | no cross-tenant read                           |
| `PlatformAdminAuthorityDTO` | Explicit platform authority envelope                    | requires explicit platform scope               |

## AI Advisory Placeholder

The DTOs expose advisory slots only as safe placeholders:

```text
advisory_only = true
coach_output_reference = null
model_call_log_reference = null
```

No model is called. AI cannot write decisions, `SettlementResult`, score, rank,
`ParameterSet`, replay artifacts or `state_true`.

## Scenario / Parameter / Plugin References

DTOs may reference:

```text
scenario_package_id
parameter_set_id
plugin_package_id
seed
scenario_version
parameter_set_version
```

These are references only. Program 033 does not implement source registry,
licensing, QA, calibration batch, Scenario Factory MVP or plugin runtime
activation.

## Validation Evidence

Program 033 adds:

- `services/api/src/teacher-student-bff-dto.ts`
- `tests/integration/teacher-student-bff-dto-productization.test.ts`

The integration guard verifies:

- Teacher DTOs contain authorized teaching evidence without write authority;
- Student DTOs expose `state_obs` and `state_est` but not `state_true`;
- Student redacted results do not expose private replay or digest fields;
- Student actors cannot read another team or another tenant;
- Tenant Admin summary remains tenant-scoped;
- Platform Admin authority requires explicit platform scope;
- advisory slots are advisory-only and cannot write formal truth;
- BFF projections do not mutate direct store state;
- `SettlementResult` shape and replay hash semantics remain unchanged.

## Explicit Non-Proofs

```text
Teacher / Student DTO implemented != frontend complete
BFF DTO productization != L1 READY
BFF DTO productization != real teacher rehearsal
AI advisory placeholder != AI MVP complete
Scenario references != Scenario Factory MVP complete
local test success != Production readiness
Security scan/audit pass != complete security proof
Replay pass != durable recovery
```
