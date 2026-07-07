# R7-A Eldercare Core Model Governance Boundary

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY
```

## Governance Purpose

This boundary keeps R7-A as a scenario asset foundation. It prevents a useful industry model draft from being overstated as L1 readiness, Pilot readiness, Production readiness, durable settlement or PostgreSQL runtime evidence.

## Authorized Scope

R7-A is limited to:

- simulation-core pure model code
- wellness plugin candidate asset
- simulation and integration tests
- synthetic fixture
- architecture, quality and governance documentation

## Explicit Non-Authorization

R7-A does not authorize:

- PR review bypass
- branch protection mutation
- ruleset mutation
- workflow rerun or dispatch
- Issue mutation or closeout
- package or lockfile changes
- service, server, route, auth or RBAC runtime changes
- OpenAPI or JSON Schema changes
- database, SQL, migration or Docker DB work
- ProviderSelector PostgreSQL mode
- durable settlement
- Pilot
- Production

## Truth Boundary

The asset must not modify formal truth authority, settlement result shape, replay hash semantics, manifest hash semantics, canonical evidence digest semantics or Student visibility authority.

## Future Escalation

Any future step that attempts to promote R7-A from scenario asset foundation into active runtime behavior needs a separate Owner authorization and an independent evidence review. The minimum future decision must explicitly name:

- target runtime surface
- allowed files
- forbidden files
- validation matrix
- rollback or hold rule
- whether schema/OpenAPI/database work is in scope

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
