# IM-O1 Industry Model Diagnostic Readiness

This contract is a query-only interpretation layer over the existing Model
Qualification authority. It does not register a model producer, mutate
adoption, write `REALIZED`, change settlement, or create a second Writer,
Store, Registry, or Truth Authority.

## Exact context

Every read is bound to the exact tenant, course, run, team, round,
`ScenarioPackage`, `ParameterSet`, and `Qualification` supplied by the caller.
The server re-reads the qualification, source, adoption selection, and
identity digests. A changed diagnostic-evidence or interpretation-policy digest
returns `REBASE_REQUIRED`; the client must not select `latest`, `current`,
`default`, `first`, `last`, or a newest timestamp.

The role endpoints are:

- `GET /api/v1/bff/teacher/model-qualification/diagnostic-readiness`
- `GET /api/v1/bff/admin/model-qualification/diagnostic-readiness`
- `GET /api/v1/bff/student/model-qualification/diagnostic-readiness`

The query requires `courseId`, `runId`, `teamId`, `roundId`,
`scenarioPackageId`, `parameterSetId`, and `qualificationId`. Optional expected
diagnostic and interpretation-policy digests are used only for freshness
comparison. An optional `w5DraftId` must identify one exact `BOUND` W5 draft;
it is never selected through latest/current/default/fallback behavior.

## Provability boundary

The current Model Qualification diagnostic producer is classified
`NOT_PROVEN` until an exact current producer proves the evidence family. A
diagnostic pass is not business truth and is not causal proof. The allowed
classes are `WANT_EVIDENCE`, `CAN_EVIDENCE`, `REALIZED_REFERENCE`, and
`NOT_PROVEN`. `REALIZED_REFERENCE` can only be attributed to the existing
Simulation Core or W4 authority; IM-O1 never calculates or writes `REALIZED`.
When `w5DraftId` is supplied and the server proves its exact binding, the
projection appends separate W5 WANT, canonical CAN feasibility, and
Simulation Core REALIZED reference producer entries. Each entry retains its
own authority and known limits; CAN `UNKNOWN` remains `UNKNOWN`, WANT remains
synthetic and uncalibrated, and the realized value remains reference-only.

## O5 qualified producer admission

The O5 extension adds a qualification-scoped admission decision for every
producer entry. A producer proves its own exact typed
`ModelVersionReference` and exact `ModelArtifactReference`; the admission
consumer compares those references with the server-resolved
`ModelQualification`. Producer qualification id/digest claims are optional
legacy metadata and are checked when present, but they are not required to
establish producer-intrinsic lineage and do not let a producer self-claim
qualification membership.
The legacy W5 runtime identity string (for example,
`eldercare_w5_governed_v1@1.1.0`) is evidence about the W5 producer only; it
is not parsed or implicitly mapped to a Model Qualification identity.

Missing or mismatched typed lineage is `QUALIFICATION_NOT_PROVEN`, and an
observed producer/model/artifact/qualification identity movement is
`REBASE_REQUIRED`. The service keeps the raw O3/O4 adapter classification for
the adapter contract tests, but the qualification-scoped diagnostic
projection downgrades an unproven entry to `NOT_PROVEN` and publishes its
deterministic admission digest. No admission result writes qualification,
adoption, settlement, official truth, or provider state.

Teacher and Admin receive the producer id, admission status, digest, and
known limits. Student receives only the status class and safe limits; internal
producer, qualification, artifact, and provenance identities remain omitted.

Teacher and Admin receive exact model, qualification, adoption, producer,
provenance, and digest fields for governed interpretation. Student receives
only readiness, evidence classes, bounded limits, exact context, `Provider=OFF`,
and `official_truth_write=false`; internal qualification/adoption identities,
raw producer diagnostics, and privileged provenance are omitted.

## Known limits

The endpoint is advisory and interpretation-only. Qualification is not proof
of universal calibration, portability, workplace transfer, financial impact,
or causal effect. Provider remains `OFF`, and no diagnostic result enters
Simulation Core settlement or official outcome truth.

## Verification

The focused contract and service tests are:

```text
npx vitest run tests/contract/industry-model-diagnostic-contract.test.ts
npx vitest run tests/unit/industry-model-diagnostic-readiness.test.ts tests/unit/industry-model-diagnostic-interpretation.test.ts
```
