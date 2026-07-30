# BLP Current Reality Map

## Assessment identity

- Repository: `qidianzhiku/SimWar`
- Source SHA: `1a13d81a43f667d80d3da2eaffe8aae8e48b45f8`
- Assessment mode: `READ_ONLY_SOURCE_AND_DOCS_REBASE`
- Runtime authority: `JSON_INTERNAL_ONLY`
- Generated for: `CAND-L1P-M0-BLP-FORMAL-REBASE`

This map records current source facts. It does not activate BLP, approve a
model, or establish a Model Registry.

## Evidence basis

Primary graph evidence:

- `graphs/codegraph-required/CG-007.txt`
- `graphs/codegraph-required/CG-008.txt`
- `graphs/graphify-required/GF-005.txt`
- `graphs/graphify-required/GF-006.txt`

Evidence root:

`C:\Users\Marshall\AppData\Local\Temp\E-SIMWAR-POST-C1-BOUNDED-PARALLEL-LAUNCH-20260730T112225Z`

Lower-priority external reference:

- Source document:
  `D:\HuaweiMoveData\Users\Marshall\Desktop\SimWar开发\SimWarL2\BLP\SimWar_独立BLP_RCNL模型开发计划_V2.0_Stage4B整合版_20260727_排版审校版.docx`
- Read-only extract:
  `C:\Users\Marshall\AppData\Local\Temp\E-SIMWAR-M0-BLP-FORMAL-REBASE-20260730T112225Z\reference-BLP-RCNL-plan-extract.txt`
- Document status:
  `FORMAL ENGINEERING BASELINE CANDIDATE / OWNER REVIEW`
- Implementation claim: `NOT CLAIMED`

Evidence priority remains:

```text
current source and tests
  > fresh CodeGraph and Graphify evidence
  > repository governance
  > external BLP/RCNL candidate plan
```

Critical source readback:

- `services/api/src/server.ts` - `createApiRuntime`
- `services/api/src/simulation.ts` - `calculateSettlement`
- `services/simulation-core/src/toy-logit-engine.ts` - `createToyLogitEngine`
- `services/api/src/parameter-set-authority.ts` - `ParameterSetVersion`
- `services/api/src/formal-run-runtime-binding.ts` - `createFormalRunRuntimeBinding`
- `services/api/src/formal-runtime-input-resolver.ts` -
  `resolveFormalRuntimeInputsForActiveRun`
- `services/api/src/run-manifest-replay-evidence.ts` -
  `createM1RunReplayEvidence`
- `packages/shared-contracts/src/index.ts` - `ParameterSet`, `ModelCallLog`,
  and `CoachOutput`

## Classification vocabulary

| Classification   | Meaning                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `ACTIVE_RUNTIME` | Reached by the default current API composition.                                                 |
| `FIXTURE`        | Test or contract sample; not runtime authority.                                                 |
| `REFERENCE`      | Contract, type, reference string, or design description without a proven active implementation. |
| `SHADOW`         | Explicitly isolated candidate or comparison-only behavior that cannot write official results.   |
| `HISTORICAL`     | Retained prior assessment, plan, or source anchor; not current runtime proof.                   |
| `UNKNOWN`        | Current evidence cannot prove the capability or relationship.                                   |

## Twelve required questions

| #   | Question                                        | Current answer                                                                                                                                                                                                                                                                                                              | Classification                                                                 | Evidence                                                                                                                |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Where are the current BLP code assets?          | No production BLP or PyBLP implementation, package, adapter, or callable symbol was found in current `apps/`, `services/`, `packages/`, `plugins/`, `contracts/`, `scripts/`, or tests. BLP currently appears in architecture, model-contract, planning, and governance descriptions.                                       | `UNKNOWN` for implementation; `REFERENCE` for documents                        | `CG-007`, `GF-005`, repository-wide exact-source scan                                                                   |
| 2   | Which assets are active runtime?                | The active settlement path uses `createToyLogitEngine`, not a BLP implementation. The default API composes JSON formal authority and `createJsonRepositoryProvider`.                                                                                                                                                        | `ACTIVE_RUNTIME` for toy-logit and JSON authority; BLP is not proven active    | `server.ts:createApiRuntime`; `simulation.ts:calculateSettlement`; `toy-logit-engine.ts:createToyLogitEngine`           |
| 3   | Which assets are fixture, reference, or shadow? | `model-call-log` schema/fixture are contract assets; `model_version_ref` is a reference string; BLP design prose is reference material; R7 shadow-alignment assets are comparison/gate descriptions and tests, not a BLP Shadow Replay runtime.                                                                             | `FIXTURE`, `REFERENCE`, `SHADOW`                                               | `contracts/schemas/model-call-log.v1.json`; `contracts/fixtures/model-call-log.valid.json`; `GF-005`; `CG-008`          |
| 4   | Does a formal ModelVersion exist?               | A `model_version_ref` string is carried by `ParameterSetVersion` and copied into `FormalRunRuntimeBinding.model_version_references`. No source-proven ModelVersion lifecycle entity, command service, registry port, approval store, or runtime resolver was found.                                                         | `REFERENCE` for the string; `UNKNOWN` for formal ModelVersion authority        | `parameter-set-authority.ts`; `formal-run-runtime-binding.ts`; `CG-008`                                                 |
| 5   | What is the parameter source?                   | Current formal parameters originate in append-only JSON `ParameterSetVersion.parameter_values`, selected by exact id/version/content digest and materialized by the active resolver. The runtime shape only admits `model_family: "toy_logit"`.                                                                             | `ACTIVE_RUNTIME`                                                               | `parameter-set-authority.ts`; `formal-runtime-input-resolver.ts`; `packages/shared-contracts/src/index.ts:ParameterSet` |
| 6   | Is BLP bound to ParameterSet?                   | No. ParameterSet is formally bound, and it carries a `model_version_ref`, but the current runtime schema constrains `model_family` to `toy_logit`. No BLP artifact digest or BLP ModelVersion authority is resolved.                                                                                                        | `UNKNOWN` for BLP binding; `ACTIVE_RUNTIME` for toy-logit ParameterSet binding | `parameter-set.v1.json`; `ParameterSet`; `FormalRunRuntimeBinding`                                                      |
| 7   | What is the relationship to Golden M1?          | Current Golden M1 tests exercise the toy-logit engine and exact formal ParameterSet/Scenario bindings. BLP is not an input to the current Golden.                                                                                                                                                                           | `ACTIVE_RUNTIME` for toy-logit Golden; BLP relationship `UNKNOWN`              | `course-blueprint-golden-non-interference.test.ts`; `default-persisted-authority-full-golden-chain.test.ts`; `GF-006`   |
| 8   | What is the relationship to Replay hash?        | Current `replay_hash` is computed from parameter-set id, scenario-package id, run id, round number, seed, decisions, and resulting `state_true`. `model_version_ref` is captured in formal replay evidence metadata but is not an explicit field in the legacy `buildReplayHash` input. No BLP hash relationship is proven. | `ACTIVE_RUNTIME` for current hash; BLP relationship `UNKNOWN`                  | `simulation.ts:buildReplayHash`; `run-manifest-replay-evidence.ts:createManifest`                                       |
| 9   | What is the relationship to Settlement truth?   | `createToyLogitEngine().settle()` calculates market, operations, finance, and score, after which the API creates and persists `SettlementResult`. There is no BLP writer in this path.                                                                                                                                      | `ACTIVE_RUNTIME` for toy-logit; BLP write relationship absent from proven path | `simulation.ts:calculateSettlement`; `toy-logit-engine.ts:createToyLogitEngine`                                         |
| 10  | Which evidence is historical?                   | BLP/RCNL, PyBLP calibration, Model Registry, and Shadow Replay descriptions in broad architecture and engineering documents are requirements or roadmap material unless tied to current symbols and tests. Historical SHA anchors and file-citation remnants are not current runtime proof.                                 | `HISTORICAL` or `REFERENCE`                                                    | `docs/contracts/model-engineering-contract.md`; `docs/architecture/system-architecture.md`; `DEVELOPMENT_PLAN.md`       |
| 11  | Which future gates are required?                | Formal ModelVersion authority, artifact provenance/digests, BLP adapter boundary, exact ParameterSet binding, offline calibration evidence, Golden Solver tests, Shadow Replay non-overwrite, tenant/security projections, performance, rollback, and explicit T4 Owner authorization.                                      | `UNKNOWN` until separately implemented and proven                              | `BLP_FORMAL_REBASE_GAP_REGISTER.yaml`                                                                                   |
| 12  | Which work must not block C2?                   | BLP implementation, calibration, Model Registry, Shadow Replay runtime, PyBLP dependency selection, model deployment, and model governance UI do not block Teacher Blueprint Studio because C2 reuses the existing CourseBlueprint/ParameterSet/formal binding surfaces and does not require model mutation.                | `REFERENCE` planning conclusion grounded in disjoint source paths              | `CG-010`; `GF-010`; lane ownership matrix                                                                               |

## Candidate target versus current code

| Candidate target from external plan                                                              | Current code fact at source SHA                                                                                          | Current classification                            | Admission rule                                                                        |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| PyBLP Reference Engine for offline estimation, diagnostics, and counterfactuals                  | No PyBLP dependency, Python model package, Reference Adapter, or calibration job is present in the current source scope. | `REFERENCE`; implementation `UNKNOWN`             | Requires `M-RB1` artifact census and separate dependency/license decision.            |
| SimWar independent deterministic BLP runtime                                                     | Active settlement directly calls `createToyLogitEngine`; no BLP runtime adapter or selection authority is present.       | `REFERENCE`; runtime `UNKNOWN`                    | Requires `M-RB2` differential reproduction and T4 runtime decision.                   |
| Governed `BLPModelVersion` / ModelVersion authority                                              | Current code has a `model_version_ref` string inherited from ParameterSet, but no ModelVersion lifecycle/registry.       | `REFERENCE`; authority `UNKNOWN`                  | Requires sole writer, lifecycle, immutable artifact digest, approval, and rollback.   |
| Differential Golden between PyBLP reference and SimWar runtime                                   | Current Golden covers the existing toy-logit engine only.                                                                | `REFERENCE`; suite `UNKNOWN`                      | Requires deterministic fixtures, tolerances, reproducibility, and independent review. |
| Stage 4B Deterministic Social Signal Resolver -> bounded Runtime Preference State -> BLP runtime | No source-proven resolver, preference-state authority, compatibility profile, or BLP bridge exists.                      | `REFERENCE`; implementation `UNKNOWN`             | Requires `M-RB3`, then M-STK join gates; OFF/zero-signal parity must be proven first. |
| BLP produces `DemandEstimate` candidate; Simulation Core L1 accepts or rejects it                | Current simulation core computes market demand internally and writes official truth through the existing engine path.    | Target `REFERENCE`; current core `ACTIVE_RUNTIME` | A future adapter must remain candidate-only and cannot become a truth writer.         |

The candidate plan's boundary is accepted as a future design constraint:

- Agent/LLM must not modify ModelVersion, ParameterSet, or model coefficients.
- BLP may produce only a `DemandEstimate` candidate.
- Simulation Core L1-L3 remains the sole official Truth writer.
- Stage 4B Resolver output is bounded runtime-state input, not a parameter,
  calibration result, share, occupancy, revenue, profit, score, or rank.
- `M-RB0 -> M-RB1 -> M-RB2 -> M-RB3` remains a future evidence sequence,
  not a set of completed gates.

## Current runtime chain

```text
Teacher/API command
  -> JSON formal ParameterSet and ScenarioPackage authority
  -> exact FormalRunRuntimeBinding
  -> resolveFormalRuntimeInputsForActiveRun
  -> calculateSettlement
  -> createToyLogitEngine
  -> market -> operations -> finance -> score
  -> SettlementResult
  -> replay_hash and read-only Replay evidence
```

BLP does not appear in this source-proven chain.

## Known limits

- Static graphs cannot prove the behavior of absent external services.
- No BLP dependency or external artifact was installed or executed.
- No model calibration, Golden Solver, or BLP Shadow Replay was run.
- The external candidate plan's user-declared implementation baseline was not
  promoted because current repository evidence did not locate the claimed
  implementation artifacts.
- `model_version_ref` identity is not backed by a source-proven ModelVersion
  authority.
- The existing broad model documents contain intended architecture and
  historical references that must not be promoted to runtime fact.
- JSON compensating atomicity remains not crash-safe.
- Issue #111 remains an open known limit.
- PostgreSQL, Pilot, and Production remain unauthorized.
