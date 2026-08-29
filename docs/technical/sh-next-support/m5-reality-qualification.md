# M5 Reality Qualification and Golden Holdout Observatory

## Scope

M5 adds a lane-local, candidate-only qualification compiler to
`@simwar/sh-next-support`. It makes the transition from source conflict and
quality checks to an explicit `READY`, `LIMITED`, or `NOT_ELIGIBLE` result
replayable without writing Product Truth, Settlement, or a formal
ParameterSet.

The implementation is intentionally reference-only for this cycle. The
bounded source freeze records public-source shapes and synthetic conflict
fixtures, but does not claim that an official release was retrieved. No
private Shanghai project data is copied into the candidate pack.

## State transition

`STATE_A` is an unqualified source/observation candidate. `STATE_B` is a
validated qualification pack containing source-quality decisions, an explicit
conflict ledger, a zero-leakage holdout proof, RGI non-computability results,
fixed-seed Golden/Replay evidence, and a five-kind drift ledger.

`buildM5RealityQualificationPack()` is deterministic. It emits six reality
domains (`DEMAND`, `SPATIAL`, `OPS`, `FINANCE`, `CUSTOMER`, and `BEHAVIOR`),
preserves the two-value demand conflict, and keeps unsupported feature and RGI
values as `UNKNOWN`/`null`. `validateM5RealityQualification()` rejects digest
drift, conflict averaging, holdout leakage, unsupported RGI values, consumer
readiness claims without C0 binding, and any forbidden writer/provider flag.

## Qualification semantics

- `READY` is currently reserved for the deterministic replay-only scope.
- `LIMITED` represents a bounded reference candidate with unresolved conflict
  or incomplete domain coverage.
- `NOT_ELIGIBLE` is the only calibration result emitted by this pack because
  the current public release was not retrieved and no domain is proven for
  calibration.
- A `MODEL_CALIBRATED` claim is not emitted. `calibration_evidence` remains
  `NONE`, and every eligibility record sets both eligibility flags to `false`.
- Conflicting observations are retained as
  `PRESERVED_FOR_REVIEW`; there is no silent average or winner selection.

## Holdout, replay, and drift

The holdout uses an exact source-and-period partition. The pack carries empty
overlap and leakage lists plus an explicit proof string. This demonstrates
that the candidate ledger has no holdout leakage; it does not manufacture
missing real-world evidence.

Golden/Replay uses fixed seed `2026082905` and the
`DETERMINISTIC_QUALIFICATION_REPLAY_V1` algorithm. The candidate digest is
separate from formal truth and the pack records that neither formal results
nor Settlement is overwritten. The drift ledger covers `SOURCE`, `FEATURE`,
`RANGE`, `MODEL`, and `SCENARIO`; absent a current evidence snapshot each is
marked `NO_CURRENT_EVIDENCE` and routes to M6 lifecycle requalification.

## Consumer and authority boundary

The pack is classified as C1 and names the future MAIN regional-transfer and
scenario-evolution consumer, MOD calibration diagnostics, and frontend known
limits surface. It remains `consumer_ready=false`, `formal_join=false`, and
requires a future C0 source-contract seam. The M5 code is not a Shanghai
kernel/runtime, registry, or app and has no official Truth, Settlement, or
formal ParameterSet writer. Provider state is `OFF`; runtime authority is
`JSON_INTERNAL_ONLY`.

The JSON contract is
`contracts/schemas/sh-next-reality-qualification.v1.json`. The focused tests
are `tests/sh-next-support/m5-reality-qualification.test.ts` and
`tests/sh-next-support/m5-contract.test.ts`.
