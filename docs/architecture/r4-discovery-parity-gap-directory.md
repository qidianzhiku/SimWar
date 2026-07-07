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

## Non-Proofs

This directory does not prove `G0 PASS`, `L1 READY`, `Pilot`, `Production`, PostgreSQL runtime, SQL migration, backup restore or durable settlement.
