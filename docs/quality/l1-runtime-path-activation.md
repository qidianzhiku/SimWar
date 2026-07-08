# L1 Runtime Path Activation Package

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

Pilot / Production:
NOT_AUTHORIZED

Durable Settlement:
NOT_PROVEN
```

This document records Program 028 runtime-path activation evidence after PR
#211 entered master. It does not introduce new API routes, service mutations,
schema changes, OpenAPI changes, database runtime, SQL, migration, Pilot or
Production work.

## Purpose

Program 027 made an internal validation ready package, but that package was
still a helper/report surface. Program 028 classifies the helper surfaces
against the existing controlled API runtime paths so later review can see which
evidence is runtime-backed and which evidence remains helper-only.

## Runtime Path Matrix

| Action                   | Existing runtime path                           | Actor                         | Permission / guard                                   | Audit boundary           |
| ------------------------ | ----------------------------------------------- | ----------------------------- | ---------------------------------------------------- | ------------------------ |
| `course.publish`         | `/api/v1/courses/:courseId/publish`             | Teacher                       | `course:publish`                                     | `course.publish`         |
| `run.create`             | `/api/v1/courses/:courseId/runs`                | Teacher                       | `run:create`                                         | `run.create`             |
| `round.start`            | `/api/v1/runs/:runId/rounds/:roundNo/start`     | Teacher                       | `round:start`                                        | `round.start`            |
| `decision.submit`        | `/api/v1/runs/:runId/rounds/:roundNo/decisions` | Student                       | `decision:submit`, team scope, truth-field rejection | `decision.submit`        |
| `round.lock`             | `/api/v1/runs/:runId/rounds/:roundNo/lock`      | Teacher                       | `round:lock`, state precondition                     | `round.lock`             |
| `round.settle_requested` | `/api/v1/runs/:runId/rounds/:roundNo/settle`    | Teacher                       | `round:settle`, settlement boundary                  | `round.settle_requested` |
| `round.publish`          | `/api/v1/runs/:runId/rounds/:roundNo/publish`   | Teacher                       | `round:publish`, state precondition                  | `round.publish`          |
| `result.read`            | `/api/v1/runs/:runId/rounds/:roundNo/results`   | Student / Teacher             | role projection and redaction                        | read-only                |
| `demo_state.read`        | `/api/v1/demo-state`                            | Tenant Admin                  | tenant projection                                    | read-only                |
| `audit.read`             | `/api/v1/audit/logs`                            | Tenant Admin / Platform Admin | tenant or explicit platform authority                | read-only                |

## Helper Path Classification

| Symbol                                             | File                                                            | Classification | Runtime caller observed | Meaning                                                 |
| -------------------------------------------------- | --------------------------------------------------------------- | -------------- | ----------------------- | ------------------------------------------------------- |
| `createL1InternalValidationReadyPackage`           | `services/api/src/l1-internal-validation-ready-package.ts`      | `HELPER_PATH`  | false                   | Program 027 package helper, not runtime proof by itself |
| `createL1GoldenM1CourseRuntimeConsolidationReport` | `services/api/src/l1-golden-m1-course-runtime-consolidation.ts` | `HELPER_PATH`  | false                   | Consolidates runtime evidence but is not an API path    |
| `createCourseRuntimeV3Evidence`                    | `services/api/src/course-runtime-v3.ts`                         | `HELPER_PATH`  | false                   | Synthetic evidence factory, not a route                 |
| `routeRequest`                                     | `services/api/src/server.ts`                                    | `RUNTIME_PATH` | true                    | Existing controlled API dispatcher                      |

The integration guard fails closed if helper-only evidence is misclassified as
runtime proof.

## Validation Evidence

Program 028 adds:

- `services/api/src/l1-runtime-path-activation.ts`
- `tests/integration/l1-runtime-path-activation.test.ts`
- `tests/e2e-ui/l1-runtime-path-activation.spec.ts`

The tests verify:

- every required runtime action is present;
- mutation runtime paths carry permission, request-id and audit evidence;
- Student result projection remains redacted;
- helper-only evidence cannot be classified as a runtime path;
- direct-store delta remains `NONE`;
- `G0 PASS` and `L1 READY` are not claimed.

## Known Limits

This package does not prove:

- `G0 PASS`;
- `L1 READY`;
- real external Teacher rehearsal;
- PostgreSQL runtime;
- SQL migration;
- distributed transaction safety;
- durable settlement;
- Pilot or Production readiness.

## Issue Relationship

Relates to #111.
Relates to #114.
Relates to #115.
