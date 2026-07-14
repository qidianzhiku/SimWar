# L1 Synthetic Data Reset and Abort Procedure

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

Phase 7:
NOT_AUTHORIZED

Controlled Pilot:
NOT_AUTHORIZED

Production:
NOT_AUTHORIZED

PostgreSQL runtime:
NOT_AUTHORIZED
```

本 procedure 只描述 synthetic JSON runtime reset and abort handling。它不授权 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration、durable settlement、backup restore 或 real data cleanup。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本 procedure 只能支持 synthetic abort/reset evidence。它不证明 durable recovery、`Pilot`、`Production`，且 PostgreSQL runtime 保持 `NOT_AUTHORIZED`。

## REL-040 Release-Candidate Binding

```text
Current master anchor:
695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf

Phase 5 Outcome:
L1_GATE_EXCEPTION_WITH_OWNER_AND_EXPIRY

Phase 6 Entry:
PHASE6_PACK_PR_CANDIDATE

G0 Exception Expiry:
2026-07-21T23:59:59+08:00
```

This reset and abort procedure is part of the R8-G1 internal application pack
release candidate. It covers synthetic reset evidence only and does not create a
durable recovery, backup or restore guarantee.

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

Hard abort triggers:

- Student sees `state_true`.
- Student sees private replay metadata or private trace data.
- cross-tenant or cross-team access succeeds.
- replay evidence can overwrite an official result.
- official result identity or replay hash changes unexpectedly.
- settlement state is unknown or contradictory.
- protected marker appears in DOM or browser console.
- PostgreSQL, SQL, migration, Pilot, Production, external users or real data become necessary.

## Synthetic Data Cleanup Checklist

1. Confirm the session used only a test-created in-memory store and synthetic identities.
2. Stop the test server through its normal teardown path.
3. Confirm the test did not target `tmp/simwar-store.json` or any real/customer data path.
4. Confirm the fresh-store assertion proves only absence from a new in-memory instance.
5. Preserve bounded evidence before discarding the synthetic process state.
6. Mark cleanup `BLOCKED` if the data origin or tenant scope is unknown.
7. Do not use SQL, migration, database deletion, `git clean`, direct JSON editing or production cleanup tools.
8. Record `SYNTHETIC_IN_MEMORY_RESET_ONLY` and the explicit durable-recovery non-proof.

## Evidence Classification

| Evidence                         | Classification              |
| -------------------------------- | --------------------------- |
| `TRUTH-403-001` controlled abort | `INTEGRATION_TEST_EVIDENCE` |
| request id preservation          | `INTEGRATION_TEST_EVIDENCE` |
| no protected sentinel echo       | `INTEGRATION_TEST_EVIDENCE` |
| fresh in-memory reset            | `INTEGRATION_TEST_EVIDENCE` |
| backup restore                   | `NOT_IMPLEMENTED`           |
| durable recovery                 | `NOT_IMPLEMENTED`           |
| cross-process recovery           | `NOT_IMPLEMENTED`           |
| durable retention                | `NOT_IMPLEMENTED`           |
| production cleanup               | `NOT_AUTHORIZED`            |

## Non-Proofs

This procedure is not a `Pilot` or `Production` recovery runbook and does not prove PostgreSQL runtime, SQL migration or durable settlement.

## REL-040 Evidence Handoff

| Field                | Value                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Evidence Type        | `ABORT_RESET_EVIDENCE / DOCS_ONLY`                                                                             |
| Source SHA           | `695cf955b3c9ab1d96b7fb59ac92671cf82dfdcf`                                                                     |
| Result               | `PHASE6_PACK_PR_CANDIDATE`                                                                                     |
| Scope of Proof       | Synthetic reset model and abort handling boundary                                                              |
| Explicit Non-Proof   | Not Phase 7, not backup restore, not durable recovery, not cross-process recovery or production cleanup        |
| Owner                | Marshall                                                                                                       |
| Expiry Trigger       | 2026-07-21 23:59:59 +08:00 or earlier master, reset, cleanup, runtime store, replay or privacy boundary change |
| Revalidation Command | `npm test -- tests/integration/l1-session-abort-reset-recovery.test.ts`                                        |
| No-Go Trigger        | Missing hard abort trigger, real data cleanup claim, durable recovery claim or forbidden runtime requirement   |
