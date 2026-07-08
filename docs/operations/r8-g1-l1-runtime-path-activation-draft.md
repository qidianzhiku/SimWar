# R8-G1 L1 Runtime Path Activation Draft

```text
Evidence package boundary:
INTERNAL_ONLY_DRAFT_NOT_RELEASED

G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY
```

This draft is the Program 028 operator handoff for runtime-path activation. It
must not be used as a release checklist, Pilot readiness statement or Production
readiness statement.

## Operator Use

Use this package only to review whether L1 evidence is connected to existing
controlled runtime paths:

- Teacher course and round operations;
- Student decision submit;
- Student redacted result read;
- Tenant Admin scoped status and audit read;
- Platform Admin explicit authority boundary.

## Required Review Questions

1. Does each required runtime action map to an existing API path?
2. Are helper-only factories still labelled `HELPER_PATH`?
3. Do mutation paths retain permission, request-id and audit evidence?
4. Does Student projection exclude protected truth and private replay markers?
5. Does the package preserve `direct_store_delta = NONE`?
6. Does the package avoid claiming `G0 PASS`, `L1 READY`, Pilot or Production?

## Hold Conditions

Hold the package if any of the following are observed:

- a helper-only function is presented as runtime proof;
- a required runtime action is missing;
- Student-visible text contains protected markers;
- replay or shadow replay writes formal results;
- any new direct-store write appears;
- a PostgreSQL, SQL, migration, Pilot or Production action is proposed.

## Explicit Non-Authorization

This draft does not authorize:

- merge;
- release;
- branch protection or ruleset mutation;
- repository policy mutation;
- PostgreSQL runtime;
- SQL or migration;
- Pilot or Production;
- closing #111, #114 or #115.
