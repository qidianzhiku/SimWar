# Student Decision Context Evidence Contract

## Purpose

M31 adds one server-owned, student-safe evidence receipt for project-aware
student decision journeys. It connects an exact published CourseFactory
package/source epoch to the selected tenant, course, run, team, round, and
role without exposing the underlying source material or changing the formal
decision, settlement, score, rank, or replay authorities.

The evidence receipt is a consumer-context contract. It is not a new kernel,
runtime, registry, writer, parameter set, calibration result, or truth record.
`PUBLIC_SOURCE_BOUND` does not imply `CALIBRATED`; the current qualification
may remain `LIMITED` and calibration may remain `NOT_PROVEN`.

## Exact scope and lifecycle

The resolver accepts an exact scope containing tenant, course, run, team,
round, round number, activity, and assigned role. The returned identity is
also bound to the selected CourseFactory package/source references and their
immutable digest. A client may continue only with the exact `evidence_id`
returned for that scope.

Only a server-confirmed `READY` receipt is admissible to the project-aware
student action path. The receipt must still match all of the following:

- the authenticated tenant and assigned team;
- the exact course, run, round, round number, activity, and role;
- the single explicit ProjectAssignment for the course/run/team;
- the current published CourseFactory package/source identity and digest;
- the source rights, expiry, geography, unit, and qualification fields.

Missing, ambiguous, stale, expired, withdrawn, mismatched, or unauthorized
evidence fails closed. A project-aware request cannot silently fall back to an
implicit latest package, raw source, private locator, hidden model state, or
another team's context. The student projection exposes only the allowlisted
safe context and lifecycle state.

## Where the gate applies

The existing MAIN-owned path is reused:

```text
ProjectAwareStudentContext
  -> existing Student Role BFF / application service
  -> RoleWorkflow writes (save, ready, resolution, acknowledgement, merge, confirm)
  -> existing M2P5 learning/consequence/debrief/transfer journey
```

The gate is required only when the server finds an exact single project
assignment under the formal role-workflow admission policy. Ordinary formal
runs without such an assignment retain their existing route behavior. The
M2P5 route uses the same server-owned admission predicate before composing its
projection.

## Idempotent retries

Writes that may have been persisted before a response was lost perform an
authorized exact existing-record lookup before revalidating short-lived
current evidence:

- an existing same-source/same-values team resolution;
- an existing same-status/same-note role acknowledgement;
- an existing merge commit;
- an existing team confirmation.

If no exact record exists, the request proceeds through the current `READY`
evidence gate and creates a new record only through the existing command
service. A retry with changed source identity, selected values, status, note,
tenant, team, round, or role is not treated as the old receipt and remains
subject to normal validation and authorization.

## Authority and privacy boundaries

The evidence receipt is process/context information. It does not become
outcome information or learning evidence, and it is excluded from the formal
replay truth hash where the replay contract excludes context governance
records. Student-safe projections omit raw source contents, private
locators, source digests where not allowlisted, hidden calibration/model
truth, `state_true`, other teams' decisions, and unpublished outcomes.

Student, teacher, frontend, Agent, replay, and shadow paths do not write
official Truth, Settlement, Score, Rank, or Enterprise State. No Provider,
production PostgreSQL/RLS cutover, Human Validation, Pilot, or Production
activation is part of this contract.

## Validation obligations

The contract is protected by schema, unit, integration, real-BFF/browser, and
recovery tests. Required negative cases include missing evidence, stale or
expired evidence, source/package mismatch, ambiguous assignments,
cross-tenant/team scope, forbidden field leakage, and duplicate writer/route
attempts. The current repository's `lint`, `typecheck`, full build, contract
tests, and relevant role-workflow/M2P5 regressions are the executable
validation baseline; remote CI and CodeQL remain the merge gates.
