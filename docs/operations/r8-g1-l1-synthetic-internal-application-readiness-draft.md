# R8-G1 L1 Synthetic Internal Application Readiness Draft

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

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

This R8-G1 draft describes how the Program 023 readiness artifact can be used
inside an internal-only synthetic application review. It is not a teacher
rehearsal approval, Pilot approval, Production approval or PostgreSQL runtime
authorization.

## Operator Use

The draft may be used by an internal reviewer to inspect:

- the PR #207 post-merge baseline result;
- the Course Runtime V3 synthetic execution evidence;
- the L1 readiness report generated from the Runtime V3 evidence;
- Student redaction, Teacher replay evidence and Tenant Admin scope;
- denied operations for Student lock, cross-team decision submit and
  cross-tenant result read;
- replay and shadow replay non-overwrite evidence;
- learning evidence exclusion from formal truth.

## Required Hold Points

The internal reviewer must stop if any of the following appears:

- Student-visible protected marker leakage;
- Teacher evidence missing replay status or replay hash context;
- Tenant Admin can see another tenant;
- replay or shadow replay writes formal results;
- Learning Evidence enters settlement truth;
- direct-store delta is not `NONE`;
- any claim upgrades `G0 PASS`, `L1 READY`, `Pilot` or `Production`.

## Non-Authorization

This draft does not authorize review, approval, merge, branch protection
mutation, ruleset mutation, workflow rerun, issue mutation, PostgreSQL runtime,
SQL, migration, Pilot or Production.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
