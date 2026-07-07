# L1 Synthetic Data Reset and Abort Procedure

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

本 procedure 只描述 synthetic JSON runtime reset and abort handling。它不授权 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration、durable settlement、backup restore 或 real data cleanup。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本 procedure 只能支持 synthetic abort/reset evidence。它不证明 durable recovery、`Pilot`、`Production`，且 PostgreSQL runtime 保持 `NOT_AUTHORIZED`。

## Synthetic Reset Model

The current integration harness uses `createP1Store()` with an in-memory store. A fresh store instance is the synthetic reset boundary used by `tests/integration/l1-session-abort-reset-recovery.test.ts`.

This proves only:

- previous synthetic run ids are absent from a fresh in-memory store
- previous synthetic settlement replay hashes are absent from a fresh in-memory store
- no real data was created

This does not prove:

- crash recovery
- cross-process recovery
- backup restore
- durable retention
- PostgreSQL restore
- distributed recovery

## Abort Procedure

1. Stop the synthetic session when a stable failure code appears.
2. Preserve the request id and error code.
3. Confirm the response does not echo protected sentinel values.
4. Confirm no protected truth, private replay metadata, other tenant data or other team data is visible.
5. Decide whether to restart with a fresh synthetic store.
6. Do not edit runtime, service, route, schema, OpenAPI, database, migration, package files or lockfiles to continue.

## Evidence Classification

| Evidence                         | Classification              |
| -------------------------------- | --------------------------- |
| `TRUTH-403-001` controlled abort | `INTEGRATION_TEST_EVIDENCE` |
| request id preservation          | `INTEGRATION_TEST_EVIDENCE` |
| no protected sentinel echo       | `INTEGRATION_TEST_EVIDENCE` |
| fresh in-memory reset            | `INTEGRATION_TEST_EVIDENCE` |
| backup restore                   | `NOT_IMPLEMENTED`           |
| durable recovery                 | `NOT_IMPLEMENTED`           |

## Non-Proofs

This procedure is not a `Pilot` or `Production` recovery runbook and does not prove PostgreSQL runtime, SQL migration or durable settlement.
