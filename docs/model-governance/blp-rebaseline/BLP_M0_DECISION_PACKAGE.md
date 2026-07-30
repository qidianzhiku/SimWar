# BLP M0 Decision Package

## Decision summary

| Field                         | Value                                      |
| ----------------------------- | ------------------------------------------ |
| Candidate                     | `CAND-L1P-M0-BLP-FORMAL-REBASE`            |
| Source SHA                    | `1a13d81a43f667d80d3da2eaffe8aae8e48b45f8` |
| Lane                          | Read-only source, docs-only output         |
| Runtime authority             | `JSON_INTERNAL_ONLY`                       |
| BLP current status            | `REFERENCE_AND_UNKNOWN_NOT_ACTIVE_RUNTIME` |
| ModelVersion authority        | `UNKNOWN_NOT_IMPLEMENTED`                  |
| BLP Shadow Replay             | `UNKNOWN_NOT_IMPLEMENTED`                  |
| C2 impact                     | `NON_BLOCKING`                             |
| Runtime activation            | `NOT_AUTHORIZED`                           |
| External candidate            | `SIMWAR-PROGRAM-M-V2.0 / OWNER REVIEW`     |
| External implementation claim | `NOT CLAIMED`                              |

## Executive decision

M0 should close as a current-reality rebaseline with explicit unknowns. It
should not proceed into implementation, dependency selection, calibration,
Shadow Replay, or runtime activation under this lane.

The current product runtime is complete enough to identify its actual engine:
the API resolves exact JSON formal inputs and calls the TypeScript
`toy_logit_wellness_v1` settlement engine. Current source does not prove a BLP
implementation or ModelVersion registry. The formal Run stores a
`model_version_ref`, but that reference is inherited from ParameterSet and is
not independently resolved through model authority.

The external Program M V2.0 plan is admitted only as a lower-priority target
architecture. Its own `FORMAL ENGINEERING BASELINE CANDIDATE / OWNER REVIEW`
and `Implementation Claim: NOT CLAIMED` labels agree with this M0 outcome.

## Target architecture comparison

| External candidate target                                    | Current source fact                                        | Decision                                                    |
| ------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------- |
| PyBLP offline Reference Engine                               | No package, adapter, artifact, or execution evidence found | Retain as `REFERENCE`; do not install or activate           |
| Independent deterministic SimWar BLP runtime                 | Active path uses `createToyLogitEngine`                    | Retain as `REFERENCE`; future T4 decision                   |
| Formal `BLPModelVersion`                                     | Only `model_version_ref` string exists                     | ModelVersion authority remains `UNKNOWN`                    |
| Differential Golden                                          | Current Golden is toy-logit only                           | Future `M-RB2`; not passed                                  |
| Stage 4B deterministic Resolver and Runtime Preference State | No current implementation found                            | Wait for `M-RB3` and M-STK join gates                       |
| BLP produces `DemandEstimate` candidate                      | Current core computes market truth internally              | Accept candidate-only boundary; no current capability claim |

Binding future boundaries from the candidate plan:

1. Agent/LLM cannot modify ModelVersion, ParameterSet, or coefficients.
2. BLP can produce only a `DemandEstimate` candidate.
3. Simulation Core L1-L3 remains the sole official Truth writer.
4. Stage 4B output must be deterministic, bounded, versioned, expiring, and
   exact-bound before it can reach a future BLP adapter.
5. Plane OFF and zero-signal modes must prove exact parity.
6. Official Replay must make zero provider calls and use locked evidence.

## Twelve-question decision record

1. **Current BLP code assets:** no production BLP implementation was found;
   current assets are predominantly reference documents.
2. **Active runtime:** JSON formal authority plus
   `toy_logit_wellness_v1`; not BLP.
3. **Fixture/reference/shadow:** model-call-log fixture/schema, model reference
   strings, BLP architecture documents, and non-writing shadow-alignment
   descriptions.
4. **ModelVersion:** no formal lifecycle authority or registry is proven.
5. **Parameter source:** append-only JSON `ParameterSetVersion.parameter_values`
   resolved by exact id/version/digest.
6. **BLP ParameterSet binding:** not proven; current runtime schema is
   `toy_logit`.
7. **Golden M1:** current Golden exercises toy-logit and exact formal
   bindings; BLP is absent.
8. **Replay hash and private evidence are distinct:** the legacy
   `replay_hash` covers `parameter_set_id`, `scenario_package_id`, `run_id`,
   `round_no`, `seed`, structured decisions, and resulting `state_true`.
   Separately, the private Replay manifest and canonical evidence can carry
   exact version, digest, and model-reference metadata. That richer private
   evidence must not be described as input to the legacy hash, and the current
   hash does not prove coverage of every formal runtime identity. BLP has no
   proven relationship to either path.
9. **Settlement truth:** existing simulation core and settlement command are
   the writers; BLP has no proven call path.
10. **Historical evidence:** broad BLP/RCNL/PyBLP and Model Registry prose is
    design or roadmap evidence unless source-corroborated.
11. **Future gates:** ModelVersion authority, artifact provenance, exact
    ParameterSet compatibility, Golden Solver, Shadow Replay, visibility,
    rollback, and T4 activation.
12. **C2 non-blockers:** all BLP implementation, calibration, registry,
    deployment, and Shadow Replay work remains outside C2.

## Rebase gate disposition

| Gate                                                | M0 disposition                            |
| --------------------------------------------------- | ----------------------------------------- |
| `M-RB0 Repository Fact Map`                         | `PARTIAL_COMPLETE_BY_CURRENT_SOURCE_MAP`  |
| `M-RB1 Artifact / ModelVersion / Adapter Census`    | `PARTIAL_COMPLETE_WITH_CRITICAL_UNKNOWNS` |
| `M-RB2 Golden / Differential / Replay Reproduction` | `NOT_RUN`                                 |
| `M-RB3 Gate Mapping and Baseline Freeze`            | `NOT_PASSED`                              |

This lane therefore cannot advance to Stage 4B S2 or model activation.

## Accepted current classifications

| Asset                            | Classification             |
| -------------------------------- | -------------------------- |
| JSON repository/formal authority | `ACTIVE_RUNTIME`           |
| toy-logit settlement engine      | `ACTIVE_RUNTIME`           |
| ParameterSetVersion              | `ACTIVE_RUNTIME`           |
| `model_version_ref`              | `REFERENCE`                |
| model-call-log schema/fixture    | `REFERENCE` / `FIXTURE`    |
| BLP architecture prose           | `REFERENCE` / `HISTORICAL` |
| BLP implementation               | `UNKNOWN`                  |
| ModelVersion registry            | `UNKNOWN`                  |
| BLP Shadow Replay                | `UNKNOWN`                  |

## Boundary decision

BLP is not permitted to become a second writer. A future BLP lane must preserve:

- simulation core as the sole truth computation boundary;
- the existing settlement command as the sole SettlementResult writer;
- score and rank ownership;
- Replay non-overwrite;
- exact immutable ParameterSet and model identity;
- tenant and Student visibility restrictions;
- JSON as the sole active runtime until a separate runtime-authority decision.

## Future decision package requirements

A future Owner decision should not authorize “BLP” generically. It must
identify:

1. exact model family and implementation package;
2. exact artifact format and digest;
3. ModelVersion sole writer and lifecycle;
4. ParameterSet compatibility and feature mapper;
5. calibration data classification;
6. Golden Solver acceptance thresholds;
7. Shadow Replay inputs, outputs, and non-overwrite proof;
8. teacher/student/admin projections;
9. failure and rollback behavior;
10. resource and performance budgets;
11. exact files and dependencies;
12. T4 review and merge gate.

## C2 coexistence decision

M0 documentation owns only:

`docs/model-governance/blp-rebaseline/**`

C2 may continue without waiting for BLP formalization because it uses the
current CourseBlueprint lifecycle, formal ParameterSet reference, and current
Golden engine. M0 acquires no product, contract, Authority, Run, Replay,
Settlement, or heavy-validation lock.

## Known limits

- No model dependency was installed.
- No BLP code or artifact was executed.
- No calibration or predictive-validity claim was assessed.
- No Shadow Replay route was executed or proven.
- The external candidate plan was reviewed but not promoted to current fact.
- Graphs are static navigation evidence, not runtime proof.
- JSON compensating atomicity is not crash-safe.
- Issue #111 remains open.
- PostgreSQL, durable recovery, Pilot, and Production are not authorized.

## Recommended outcome

```text
M0_RESULT:
READ_ONLY_FORMAL_REBASE_COMPLETE_WITH_UNKNOWNS

BLP_RUNTIME:
NOT_PROVEN_ACTIVE

MODEL_REGISTRY:
NOT_PROVEN

SHADOW_REPLAY:
NOT_PROVEN

C2:
NOT_BLOCKED_BY_M0

NEXT_MODEL_MISSION:
NOT_AUTHORIZED_PENDING_SEPARATE_T4_OWNER_DIRECTION
```
