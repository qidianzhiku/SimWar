# R8-G1 L1 Golden M1 Course Runtime Consolidation Draft

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

This R8-G1 draft describes how an internal reviewer may inspect the Program
024 L1 Golden M1 Course Runtime Consolidation artifact. It is not a teacher
rehearsal approval, Pilot approval, Production approval, PostgreSQL runtime
authorization, R4 Macro authorization or durable settlement proof.

## Internal Reviewer Use

The reviewer may inspect:

- the PR #208 post-merge baseline result;
- the Runtime V3 synthetic course execution evidence;
- the L1 Synthetic Internal Application Readiness report;
- the Golden M1 runtime-consolidation report;
- Student redaction and negative visibility evidence;
- Teacher replay evidence and result publish evidence;
- Tenant Admin single-tenant summary;
- denied operations for Student lock, cross-team submit and cross-tenant read;
- replay, shadow replay and repeated settlement non-overwrite evidence;
- Learning Evidence exclusion from formal truth;
- R4 Discovery read-only gap statements.

## Required Hold Points

The reviewer must stop if any of the following appears:

- Student-visible protected marker leakage;
- Teacher evidence missing replay status or replay hash context;
- Tenant Admin can see another tenant;
- replay or shadow replay writes formal results;
- repeated settlement overwrites an official result;
- Learning Evidence enters settlement truth;
- direct-store delta is not `NONE`;
- R8-G1 material is treated as released;
- any claim upgrades `G0 PASS`, `L1 READY`, `Pilot` or `Production`.

## Non-Authorization

This draft does not authorize review, approval, merge, branch protection
mutation, ruleset mutation, workflow rerun, issue mutation, PostgreSQL runtime,
SQL, migration, Pilot or Production.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
