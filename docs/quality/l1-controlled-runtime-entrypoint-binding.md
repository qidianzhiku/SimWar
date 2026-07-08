# L1 Controlled Runtime Entrypoint Binding

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

This document records Program 029 evidence for binding the L1 Golden M1 path to
current API runtime entrypoints. It is internal evidence only. It does not claim
`G0 PASS`, `L1 READY`, `Pilot`, `Production`, PostgreSQL runtime, durable
settlement, R4 Macro, R9 or R10 readiness.

## Controlled Entrypoint Principle

Program 028 classified helper-only evidence separately from runtime paths. Program
029 adds a runtime guard that exercises the current HTTP API surface instead of
calling helper factories or direct store mutation.

The runtime binding is accepted only when the flow enters through route handlers
that already enforce:

- tenant context through `x-tenant-id` and token-bound actors;
- RBAC permissions through `requirePermission`;
- team scope through `decision.submit`;
- internal settlement through `requireServiceKernel`;
- Student projection redaction through result read;
- audit read through tenant or explicit Platform Admin scope.

## Runtime Entrypoint Matrix

| Capability              | Runtime entrypoint                                     | Current binding evidence                                                              | Remaining limitation                              |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Teacher course creation | `POST /api/v1/courses`                                 | creates draft course with approved scenario and parameter set                         | no external LMS/course catalog binding            |
| Teacher team binding    | `POST /api/v1/courses/:courseId/teams`                 | creates two teams with tenant users and denies learner team creation                  | no roster import workflow                         |
| Course publish          | `POST /api/v1/courses/:courseId/publish`               | publishes course and duplicate publish avoids duplicate audit                         | no production release workflow                    |
| Run creation            | `POST /api/v1/courses/:courseId/runs`                  | binds run to course, scenario, parameter set and seed                                 | JSON runtime only                                 |
| Round start             | `POST /api/v1/runs/:runId/rounds/:roundNo/start`       | opens draft round through Teacher authority                                           | no scheduled classroom clock                      |
| Student decision submit | `POST /api/v1/runs/:runId/rounds/:roundNo/decisions`   | accepts own-team decisions, rejects cross-team and truth-protected payloads           | role-section merge path remains separate evidence |
| Teacher lock            | `POST /api/v1/runs/:runId/rounds/:roundNo/lock`        | locks after submissions and duplicate lock is idempotent                              | single-process JSON runtime proof only            |
| Internal settlement     | `POST /internal/v1/runs/:runId/rounds/:roundNo/settle` | requires service kernel token/principal, commits once and reuses duplicate settlement | not durable cross-process settlement              |
| Teacher publish result  | `POST /api/v1/runs/:runId/rounds/:roundNo/publish`     | publishes official result and duplicate publish is idempotent                         | no external notification workflow                 |
| Student result read     | `GET /api/v1/runs/:runId/rounds/:roundNo/results`      | exposes only own team, omits `state_true` and replay evidence                         | not a full production privacy audit               |
| Teacher result read     | `GET /api/v1/runs/:runId/rounds/:roundNo/results`      | exposes classroom truth and replay evidence to authorized Teacher                     | JSON runtime evidence only                        |
| Tenant Admin status     | `GET /api/v1/demo-state`                               | returns tenant-scoped current state for internal status review                        | demo-state is not production observability        |
| Tenant / Platform audit | `GET /api/v1/audit/logs`                               | Tenant Admin sees tenant logs; Platform Admin can explicitly scope to tenant logs     | no centralized SIEM/telemetry adapter             |

## Guard Coverage

`tests/integration/l1-controlled-runtime-entrypoint-binding.test.ts` exercises the
current route dispatcher and verifies:

- Teacher, Student, Tenant Admin and Platform Admin roles are authenticated through
  `/api/v1/auth/login`.
- Teacher creates the course, binds two teams, publishes the course, creates a run
  and starts a round through route handlers.
- Student team scope denies cross-team decision submit.
- Truth-protected payloads fail closed without leaking the protected sentinel.
- Student users cannot lock a round or create a team.
- Service kernel settlement uses the internal runtime entrypoint and returns
  `committed` once, then `reused` on duplicate settlement.
- Student result projection omits `state_true`, other-team results and replay
  evidence.
- Teacher result projection includes both teams, replay evidence and classroom
  truth fields.
- Tenant Admin and Platform Admin audit/status reads stay inside explicit tenant
  scope.
- Idempotent course publish, decision submit, lock, settlement and result publish
  do not produce duplicate action logs.

## Helper Path Boundary

The following evidence remains useful but is not counted as runtime entrypoint
proof by itself:

- Program 027 internal validation helper;
- Program 028 runtime path activation helper;
- source-only CodeGraph or Graphify path inspection;
- static documentation matrices;
- browser smoke that renders evidence cards without executing API mutations.

Program 029 consumes these as context only. The new binding evidence comes from
the HTTP integration guard.

## Remaining Gaps

- PostgreSQL runtime, SQL, migration, RLS and transaction recovery are still not
  authorized or proven.
- Cross-process settlement idempotency and distributed locking are still not
  proven.
- Backup restore, crash replay and durable recovery remain future R4/R8 work.
- Student projection is tested for current result routes only; future export,
  telemetry or notification surfaces need their own guards if implemented.
- Program 029 does not convert internal evidence into `L1 READY`; it only reduces
  the helper-only runtime proof gap.

## Validation

Program 029 validation must include at least:

```powershell
npm run format:check
npm run check:hidden-unicode
npm run lint
npm run typecheck
npm test -- tests/integration/l1-controlled-runtime-entrypoint-binding.test.ts
npm test -- tests/integration/p0-flow.test.ts tests/integration/m1-teaching-loop.test.ts tests/integration/decision-submit-characterization.test.ts tests/integration/m1-run-manifest-replay-evidence.test.ts tests/integration/l1-runtime-path-activation.test.ts tests/integration/l1-controlled-runtime-entrypoint-binding.test.ts
npm run test:contract
npm run security:audit
npm run check:direct-store-boundaries
npm test
npm run build
```

`npm audit --json` may still report non-critical advisories from the existing
dependency graph. Program 029 does not authorize dependency or lockfile changes.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
