# R4 Discovery Parity Gap Directory

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

本文是 R4 Discovery 的只读 parity gap directory。它不授权 R4 Macro、PostgreSQL runtime、SQL、migration、Docker DB、ProviderSelector PostgreSQL mode、dual read、dual write、shadow write、durable settlement、`Pilot` 或 `Production`。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本文只作为 R4 Discovery gap reference 进入 synthetic internal application decision package。它不授权 R4 Macro、`Pilot`、`Production`，且 PostgreSQL runtime 保持 `NOT_AUTHORIZED`。

## Repository Port Matrix

| Surface             | Current evidence                                  | Gap                                                                        | Status                    |
| ------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------- |
| repository ports    | `services/api/src/repository-ports.ts`            | ports exist but not all API surfaces route through facade                  | `SOURCE_ONLY_INFERENCE`   |
| repository facade   | `services/api/src/repository-facade.ts`           | settlement path uses facade; admin/demo-state still has direct store reads | `SOURCE_ONLY_INFERENCE`   |
| JSON adapter        | `services/api/src/json-repository-adapter.ts`     | current default runtime                                                    | `CURRENT_LOCAL_READ_ONLY` |
| Postgres adapter    | `services/api/src/postgres-repository-adapter.ts` | not active runtime                                                         | `NOT_AUTHORIZED`          |
| direct store access | `services/api/src/server.ts`                      | remains for auth/admin/course/team/run/demo-state                          | `DISCOVERY_ONLY`          |

## JSON Runtime Authority Matrix

| Capability                 | Current state                           | Boundary                |
| -------------------------- | --------------------------------------- | ----------------------- |
| default runtime            | JSON / memory store                     | active local runtime    |
| settlement truth           | simulation-core via API settlement path | current authority       |
| replay evidence            | evidence-only helper path               | not formal truth writer |
| snapshot migration scripts | present                                 | not SQL migration       |
| PostgreSQL runtime         | `NOT_AUTHORIZED`                        | no runtime activation   |

## PostgreSQL Adapter Presence Matrix

| Area             | Presence                                     | Gap                |
| ---------------- | -------------------------------------------- | ------------------ |
| adapter source   | present                                      | not active         |
| runtime selector | no active PostgreSQL selector in API runtime | runtime opt-in gap |
| RLS              | no current runtime RLS proof                 | evidence gap       |
| transactions     | no current DB transaction proof              | evidence gap       |
| migrations       | SQL migration not authorized                 | evidence gap       |
| rollback         | no SQL rollback proof                        | evidence gap       |

## ProviderSelector Inventory

Current source supports JSON/custom provider concepts. It does not authorize ProviderSelector PostgreSQL mode, dual read, dual write, shadow write, migration, SQL or Docker DB.

## Gap Directory

| Gap                  | Current classification | Next decision needed                   |
| -------------------- | ---------------------- | -------------------------------------- |
| RLS evidence         | `NOT_PROVEN`           | R4 Macro or R4b scope decision         |
| transaction evidence | `NOT_PROVEN`           | database runtime decision              |
| idempotency evidence | `PARTIAL_JSON_RUNTIME` | cross-process proof later              |
| concurrency evidence | `PARTIAL_IN_PROCESS`   | distributed lock / DB lock proof later |
| migration / rollback | `NOT_AUTHORIZED`       | SQL migration authorization later      |
| runtime opt-in       | `NOT_AUTHORIZED`       | ProviderSelector decision later        |
| recovery / backup    | `NOT_PROVEN`           | durable recovery decision later        |

## R4b Versus R4 Macro Boundary

R4 Discovery is `READ_ONLY_ONLY`. R4 Macro remains `NOT_AUTHORIZED`. This directory must not be used as PostgreSQL readiness, durable settlement readiness, R9 readiness or R10 readiness proof.

## R7-B Scenario Lifecycle Discovery Update

`R7-B` adds scenario lifecycle evidence that is useful to R4 Discovery, but it does not close R4 Macro gaps.

| R4 Discovery area                        | R7-B current evidence                                    | Remaining gap                                                  | Classification            |
| ---------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| Repository Port Matrix                   | no repository port mutation                              | API surfaces still need future port/facade migration decisions | `SOURCE_ONLY_INFERENCE`   |
| JSON Runtime Authority Matrix            | scenario lifecycle remains JSON-only and pure TypeScript | no PostgreSQL runtime proof                                    | `CURRENT_LOCAL_READ_ONLY` |
| Direct Store Access Inventory            | no new direct store access                               | existing legacy direct-store exceptions remain                 | `DISCOVERY_ONLY`          |
| ProviderSelector Inventory               | no ProviderSelector PostgreSQL mode                      | runtime selector remains future work                           | `NOT_AUTHORIZED`          |
| Migration / Rollback Risk Directory      | no SQL or migration execution                            | rollback is not proven                                         | `NOT_AUTHORIZED`          |
| RLS Evidence Gap Directory               | no database runtime                                      | RLS not proven                                                 | `NOT_PROVEN`              |
| Transaction Evidence Gap Directory       | no database transaction                                  | cross-process transaction proof absent                         | `NOT_PROVEN`              |
| Idempotency Evidence Gap Directory       | R7-B bound scenario mutation is rejected locally         | durable cross-process idempotency not proven                   | `PARTIAL_JSON_RUNTIME`    |
| Runtime Opt-In Evidence Gap Directory    | no runtime opt-in added                                  | opt-in mechanism not authorized                                | `NOT_AUTHORIZED`          |
| Recovery / Backup Evidence Gap Directory | synthetic cleanup boundary documented                    | backup/restore not proven                                      | `NOT_PROVEN`              |

This update is documentation only. It does not implement R4 Macro, PostgreSQL runtime, SQL, migration, Docker DB, ProviderSelector PostgreSQL mode, dual read, dual write, shadow write, transaction locking, RLS, backup restore, Pilot or Production.

## R7-C Scenario Factory Discovery Update

`R7-C` adds Scenario Factory Runtime and Shadow Arena evidence on top of the merged R7-B lifecycle. This improves the JSON-only scenario asset governance inventory, but it does not close R4 Macro gaps.

| R4 Discovery area                        | R7-C current evidence                                       | Remaining gap                                                  | Classification            |
| ---------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| Repository Port Matrix                   | no repository port mutation                                 | API surfaces still need future port/facade migration decisions | `SOURCE_ONLY_INFERENCE`   |
| JSON Runtime Authority Matrix            | Scenario Factory remains pure TypeScript and JSON-only      | no PostgreSQL runtime proof                                    | `CURRENT_LOCAL_READ_ONLY` |
| Direct Store Access Inventory            | no new direct store access                                  | existing legacy direct-store exceptions remain                 | `DISCOVERY_ONLY`          |
| ProviderSelector Inventory               | no ProviderSelector PostgreSQL mode                         | runtime selector remains future work                           | `NOT_AUTHORIZED`          |
| Migration / Rollback Risk Directory      | no SQL or migration execution                               | rollback is not proven                                         | `NOT_AUTHORIZED`          |
| RLS Evidence Gap Directory               | no database runtime                                         | RLS not proven                                                 | `NOT_PROVEN`              |
| Transaction Evidence Gap Directory       | no database transaction                                     | cross-process transaction proof absent                         | `NOT_PROVEN`              |
| Idempotency Evidence Gap Directory       | release candidate binding rejects silent mutation locally   | durable cross-process idempotency not proven                   | `PARTIAL_JSON_RUNTIME`    |
| Runtime Opt-In Evidence Gap Directory    | no runtime opt-in added                                     | opt-in mechanism not authorized                                | `NOT_AUTHORIZED`          |
| Recovery / Backup Evidence Gap Directory | Shadow Arena evidence is candidate-only and non-overwriting | backup/restore and cross-process recovery remain unproven      | `NOT_PROVEN`              |

This update is documentation only. It does not implement R4 Macro, PostgreSQL runtime, SQL, migration, Docker DB, ProviderSelector PostgreSQL mode, dual read, dual write, shadow write, transaction locking, RLS, backup restore, Pilot or Production.

## R5/R6 Course Delivery Discovery Update

`R5/R6 Course Delivery` adds a synthetic Course Blueprint and Learning Evidence guard that reuses the current JSON runtime and R7-C Scenario Factory evidence. This improves the course/run/round delivery inventory, but it does not close R4 Macro gaps.

| R4 Discovery area                        | Course Delivery current evidence                                          | Remaining gap                                                  | Classification            |
| ---------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| Repository Port Matrix                   | no repository port mutation                                               | API surfaces still need future port/facade migration decisions | `SOURCE_ONLY_INFERENCE`   |
| JSON Runtime Authority Matrix            | Course/Run/Round uses current JSON runtime and simulation-core settlement | no PostgreSQL runtime proof                                    | `CURRENT_LOCAL_READ_ONLY` |
| Direct Store Access Inventory            | no new runtime direct-store access; guard uses synthetic seed setup only  | existing legacy direct-store exceptions remain                 | `DISCOVERY_ONLY`          |
| ProviderSelector Inventory               | no ProviderSelector PostgreSQL mode                                       | runtime selector remains future work                           | `NOT_AUTHORIZED`          |
| Migration / Rollback Risk Directory      | no SQL or migration execution                                             | rollback is not proven                                         | `NOT_AUTHORIZED`          |
| RLS Evidence Gap Directory               | no database runtime                                                       | RLS not proven                                                 | `NOT_PROVEN`              |
| Transaction Evidence Gap Directory       | repeated settlement remains idempotent in JSON runtime                    | cross-process transaction proof absent                         | `PARTIAL_JSON_RUNTIME`    |
| Idempotency Evidence Gap Directory       | duplicate settle returns the same replay hash without extra formal result | durable cross-process idempotency not proven                   | `PARTIAL_JSON_RUNTIME`    |
| Runtime Opt-In Evidence Gap Directory    | no runtime opt-in added                                                   | opt-in mechanism not authorized                                | `NOT_AUTHORIZED`          |
| Recovery / Backup Evidence Gap Directory | Learning Evidence is excluded from truth hash and writes no formal result | backup/restore and cross-process recovery remain unproven      | `NOT_PROVEN`              |

This update is documentation only. It does not implement R4 Macro, PostgreSQL runtime, SQL, migration, Docker DB, ProviderSelector PostgreSQL mode, dual read, dual write, shadow write, transaction locking, RLS, backup restore, Pilot or Production.

## Program 020 Course Delivery Productization Discovery Update

`Course Delivery Productization V1` strengthens the synthetic course/run/round delivery evidence after PR #204 entered master. It adds a focused API helper, integration guard and documentation for Course Blueprint binding, three-part feedback, Learning Evidence and idempotent state transitions. It still does not close R4 Macro gaps.

| R4 Discovery area                        | Program 020 current evidence                                                               | Remaining gap                                                  | Classification            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------- |
| Repository Port Matrix                   | no repository port mutation                                                                | API surfaces still need future port/facade migration decisions | `SOURCE_ONLY_INFERENCE`   |
| JSON Runtime Authority Matrix            | Course Delivery remains JSON runtime and current simulation-core settlement                | no PostgreSQL runtime proof                                    | `CURRENT_LOCAL_READ_ONLY` |
| Direct Store Access Inventory            | idempotency strengthening is limited to existing route state transitions                   | existing legacy direct-store exceptions remain                 | `DISCOVERY_ONLY`          |
| ProviderSelector Inventory               | no ProviderSelector PostgreSQL mode                                                        | runtime selector remains future work                           | `NOT_AUTHORIZED`          |
| Migration / Rollback Risk Directory      | no SQL or migration execution                                                              | rollback is not proven                                         | `NOT_AUTHORIZED`          |
| RLS Evidence Gap Directory               | no database runtime                                                                        | RLS not proven                                                 | `NOT_PROVEN`              |
| Transaction Evidence Gap Directory       | repeated course publish, round lock, settlement and publish are covered in JSON runtime    | cross-process transaction proof absent                         | `PARTIAL_JSON_RUNTIME`    |
| Idempotency Evidence Gap Directory       | duplicate state-transition requests avoid duplicate audit side effects where tested        | durable cross-process idempotency not proven                   | `PARTIAL_JSON_RUNTIME`    |
| Runtime Opt-In Evidence Gap Directory    | no runtime opt-in added                                                                    | opt-in mechanism remains future work                           | `NOT_AUTHORIZED`          |
| Recovery / Backup Evidence Gap Directory | Learning Evidence and Shadow Arena evidence remain non-overwriting and excluded from truth | backup/restore and cross-process recovery remain unproven      | `NOT_PROVEN`              |

This update is documentation only. It does not implement R4 Macro, PostgreSQL runtime, SQL, migration, Docker DB, ProviderSelector PostgreSQL mode, dual read, dual write, shadow write, transaction locking, RLS, backup restore, Pilot or Production.

## Program 021 Course Delivery Runtime V2 Discovery Update

`Course Delivery Runtime V2` converges the PR #205 course delivery productization path with Scenario Factory, Replay evidence, Shadow Arena, Tenant Admin scope, Platform explicit authority and Learning Evidence truth isolation. It remains JSON-runtime synthetic evidence and does not close R4 Macro gaps.

| R4 Discovery area                        | Program 021 current evidence                                                                                   | Remaining gap                                                  | Classification            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| Repository Port Matrix                   | no repository port mutation                                                                                    | API surfaces still need future port/facade migration decisions | `SOURCE_ONLY_INFERENCE`   |
| JSON Runtime Authority Matrix            | Course Delivery Runtime V2 remains current JSON runtime plus simulation-core settlement                        | no PostgreSQL runtime proof                                    | `CURRENT_LOCAL_READ_ONLY` |
| Direct Store Access Inventory            | evidence helper is pure and does not add direct-store reads or writes                                          | existing legacy direct-store exceptions remain                 | `DISCOVERY_ONLY`          |
| ProviderSelector Inventory               | no ProviderSelector PostgreSQL mode                                                                            | opt-in mechanism remains future work                           | `NOT_AUTHORIZED`          |
| Migration / Rollback Risk Directory      | no SQL or migration execution                                                                                  | rollback is not proven                                         | `NOT_AUTHORIZED`          |
| RLS Evidence Gap Directory               | no database runtime                                                                                            | RLS not proven                                                 | `NOT_PROVEN`              |
| Transaction Evidence Gap Directory       | repeated settlement and Shadow Arena non-overwrite remain verified only in the JSON runtime                    | cross-process transaction proof absent                         | `PARTIAL_JSON_RUNTIME`    |
| Idempotency Evidence Gap Directory       | repeated settlement keeps stable replay hash and formal result identity in the synthetic guard                 | durable cross-process idempotency not proven                   | `PARTIAL_JSON_RUNTIME`    |
| Runtime Opt-In Evidence Gap Directory    | no runtime opt-in added                                                                                        | opt-in mechanism remains future work                           | `NOT_AUTHORIZED`          |
| Recovery / Backup Evidence Gap Directory | Course Delivery Runtime V2 records internal-only known limits but does not test backup restore or crash replay | backup/restore and cross-process recovery remain unproven      | `NOT_PROVEN`              |

This update is documentation only. It does not implement R4 Macro, PostgreSQL runtime, SQL, migration, Docker DB, ProviderSelector PostgreSQL mode, dual read, dual write, shadow write, transaction locking, RLS, backup restore, Pilot or Production.

## Program 022 Course Runtime V3 Discovery Update

`Course Runtime V3` adds request-id idempotency, audit request-id integrity and
synthetic course execution convergence on top of the merged Runtime V2 path. It
remains JSON-runtime synthetic evidence and does not close R4 Macro gaps.

| R4 Discovery area                        | Program 022 current evidence                                                                                         | Remaining gap                                                  | Classification            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| Repository Port Matrix                   | `decision.submit` idempotency readback uses the repository facade for decision and audit lookup                      | API surfaces still need future port/facade migration decisions | `SOURCE_ONLY_INFERENCE`   |
| JSON Runtime Authority Matrix            | Course Runtime V3 remains current JSON runtime plus simulation-core settlement                                       | no PostgreSQL runtime proof                                    | `CURRENT_LOCAL_READ_ONLY` |
| Direct Store Access Inventory            | evidence helper is pure and does not add direct-store reads or writes; server guard uses existing route runtime data | existing legacy direct-store exceptions remain                 | `DISCOVERY_ONLY`          |
| ProviderSelector Inventory               | no ProviderSelector PostgreSQL mode                                                                                  | opt-in mechanism remains future work                           | `NOT_AUTHORIZED`          |
| Migration / Rollback Risk Directory      | no SQL or migration execution                                                                                        | rollback is not proven                                         | `NOT_AUTHORIZED`          |
| RLS Evidence Gap Directory               | no database runtime                                                                                                  | RLS not proven                                                 | `NOT_PROVEN`              |
| Transaction Evidence Gap Directory       | request-id idempotency is verified in JSON runtime only                                                              | cross-process transaction proof absent                         | `PARTIAL_JSON_RUNTIME`    |
| Idempotency Evidence Gap Directory       | duplicate decision submit, round lock, settlement and publish stay stable in the synthetic guard                     | durable cross-process idempotency not proven                   | `PARTIAL_JSON_RUNTIME`    |
| Runtime Opt-In Evidence Gap Directory    | no runtime opt-in added                                                                                              | opt-in mechanism remains future work                           | `NOT_AUTHORIZED`          |
| Recovery / Backup Evidence Gap Directory | internal draft records known limits but does not test backup restore or crash replay                                 | backup/restore and cross-process recovery remain unproven      | `NOT_PROVEN`              |

This update is documentation only. It does not implement R4 Macro, PostgreSQL
runtime, SQL, migration, Docker DB, ProviderSelector PostgreSQL mode, dual read,
dual write, shadow write, transaction locking, RLS, backup restore, Pilot or
Production.

## Program 025 L1 Golden M1 Runtime Contract Completion Discovery Update

`L1 Golden M1 Runtime Contract Completion` extends the Program 024 consolidation
artifact with an explicit runtime contract matrix for the existing Runtime V3
API / BFF / server-command path. It records role, tenant, course, team, DTO,
request-id, audit-event, state, projection, stable-error and forbidden-caller
metadata for the Golden M1 internal synthetic application harness. It remains
JSON-runtime synthetic evidence and does not close R4 Macro gaps.

| R4 Discovery area                        | Program 025 current evidence                                                                                        | Remaining gap                                                  | Classification            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| Repository Port Matrix                   | no repository port mutation; contract matrix documents existing API / BFF / server-command path only                | API surfaces still need future port/facade migration decisions | `SOURCE_ONLY_INFERENCE`   |
| JSON Runtime Authority Matrix            | runtime contract completion remains JSON-runtime synthetic evidence plus existing simulation-core settlement        | no PostgreSQL runtime proof                                    | `CURRENT_LOCAL_READ_ONLY` |
| Direct Store Access Inventory            | evidence helper is pure and adds no direct-store reads or writes                                                    | existing legacy direct-store exceptions remain                 | `DISCOVERY_ONLY`          |
| ProviderSelector Inventory               | no ProviderSelector PostgreSQL mode                                                                                 | opt-in mechanism remains future work                           | `NOT_AUTHORIZED`          |
| Migration / Rollback Risk Directory      | no SQL or migration execution                                                                                       | rollback is not proven                                         | `NOT_AUTHORIZED`          |
| RLS Evidence Gap Directory               | no database runtime                                                                                                 | RLS not proven                                                 | `NOT_PROVEN`              |
| Transaction Evidence Gap Directory       | idempotency and stable duplicate command evidence remain JSON-runtime only                                          | cross-process transaction proof absent                         | `PARTIAL_JSON_RUNTIME`    |
| Idempotency Evidence Gap Directory       | contract matrix records required idempotency keys, request ids and stable error paths for current synthetic harness | durable cross-process idempotency not proven                   | `PARTIAL_JSON_RUNTIME`    |
| Runtime Opt-In Evidence Gap Directory    | no runtime opt-in added                                                                                             | opt-in mechanism remains future work                           | `NOT_AUTHORIZED`          |
| Recovery / Backup Evidence Gap Directory | no backup restore, crash replay or distributed recovery proof                                                       | backup/restore and cross-process recovery remain unproven      | `NOT_PROVEN`              |

This update is documentation only. It does not implement R4 Macro, PostgreSQL
runtime, SQL, migration, Docker DB, ProviderSelector PostgreSQL mode, dual read,
dual write, shadow write, transaction locking, RLS, backup restore, Pilot or
Production.

## Program 024 L1 Golden M1 Course Runtime Consolidation Discovery Update

`L1 Golden M1 Course Runtime Consolidation` consumes the merged Runtime V3 and
L1 Synthetic Internal Application Readiness evidence. It consolidates the
Teacher Course Operations, Student Decision and Feedback, Tenant Admin scope,
Replay / Shadow Replay, Learning Evidence, R8-G1 draft and G0-G7 ledger
surfaces into one synthetic JSON-runtime package. It remains documentation and
evidence-helper work only and does not close R4 Macro gaps.

| R4 Discovery area                        | Program 024 current evidence                                                                             | Remaining gap                                                  | Classification            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| Repository Port Matrix                   | no repository port mutation                                                                              | API surfaces still need future port/facade migration decisions | `SOURCE_ONLY_INFERENCE`   |
| JSON Runtime Authority Matrix            | Golden M1 consolidation consumes JSON-runtime synthetic evidence and does not write formal truth         | no PostgreSQL runtime proof                                    | `CURRENT_LOCAL_READ_ONLY` |
| Direct Store Access Inventory            | evidence helper is pure and does not add direct-store reads or writes                                    | existing legacy direct-store exceptions remain                 | `DISCOVERY_ONLY`          |
| ProviderSelector Inventory               | no ProviderSelector PostgreSQL mode                                                                      | opt-in mechanism remains future work                           | `NOT_AUTHORIZED`          |
| Migration / Rollback Risk Directory      | no SQL or migration execution                                                                            | rollback is not proven                                         | `NOT_AUTHORIZED`          |
| RLS Evidence Gap Directory               | no database runtime                                                                                      | RLS not proven                                                 | `NOT_PROVEN`              |
| Transaction Evidence Gap Directory       | idempotency evidence remains in JSON runtime only                                                        | cross-process transaction proof absent                         | `PARTIAL_JSON_RUNTIME`    |
| Idempotency Evidence Gap Directory       | duplicate decision, lock, settlement and publish stability are consolidated from Runtime V3 evidence     | durable cross-process idempotency not proven                   | `PARTIAL_JSON_RUNTIME`    |
| Runtime Opt-In Evidence Gap Directory    | no runtime opt-in added                                                                                  | opt-in mechanism remains future work                           | `NOT_AUTHORIZED`          |
| Recovery / Backup Evidence Gap Directory | R8-G1 draft remains internal-only and does not test backup restore, crash replay or distributed recovery | backup/restore and cross-process recovery remain unproven      | `NOT_PROVEN`              |

This update is documentation only. It does not implement R4 Macro, PostgreSQL
runtime, SQL, migration, Docker DB, ProviderSelector PostgreSQL mode, dual read,
dual write, shadow write, transaction locking, RLS, backup restore, Pilot or
Production.

## Non-Proofs

This directory does not prove `G0 PASS`, `L1 READY`, `Pilot`, `Production`, PostgreSQL runtime, SQL migration, backup restore or durable settlement.
