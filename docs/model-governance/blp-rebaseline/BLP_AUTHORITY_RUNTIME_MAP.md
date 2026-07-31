# BLP Authority and Runtime Map

## Source binding

- Assessment Source Anchor SHA:
  `1a13d81a43f667d80d3da2eaffe8aae8e48b45f8`
- Current Master Revalidated SHA:
  `44219c30f560f07d90048f601b83cd785bae8b91`
- Active runtime authority: `JSON_INTERNAL_ONLY`
- BLP runtime status: `UNKNOWN_NOT_PROVEN_ACTIVE`

The current-master delta adds C2/C3 product capabilities but no BLP/PyBLP
runtime, ModelVersion writer, settlement writer, or Replay writer.

## Proven authority map

| Object or capability    | Current reader                                             | Current writer                                                  | Persistence or authority               | Classification                          |
| ----------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------- | --------------------------------------- |
| ParameterSetVersion     | Formal runtime resolver and binding services               | `ParameterSetCommandService` through `ParameterSetRegistryPort` | Append-only JSON formal authority      | `ACTIVE_RUNTIME`                        |
| ScenarioPackageVersion  | Formal runtime resolver and binding services               | `ScenarioPackageCommandService`                                 | Append-only JSON formal authority      | `ACTIVE_RUNTIME`                        |
| FormalRunRuntimeBinding | Runtime resolver and Replay evidence                       | Formal run binding service/store                                | JSON private binding store             | `ACTIVE_RUNTIME`                        |
| SettlementResult        | Teacher/Admin/Student-safe projections and Replay evidence | Existing settlement command path only                           | JSON repository provider/facade        | `ACTIVE_RUNTIME`                        |
| Replay hash             | Result projections and Replay evidence                     | `calculateSettlement` / existing settlement path                | SettlementResult and Round persistence | `ACTIVE_RUNTIME`                        |
| Model version reference | Formal binding and replay manifest metadata                | Copied from approved ParameterSetVersion                        | String reference only                  | `REFERENCE`                             |
| ModelVersion lifecycle  | No proven reader                                           | No proven sole writer                                           | No proven registry                     | `UNKNOWN`                               |
| BLP runtime adapter     | No proven reader                                           | No writer                                                       | No proven adapter or provider          | `UNKNOWN`                               |
| BLP model artifact      | No proven resolver                                         | No writer                                                       | No digest-addressed artifact registry  | `UNKNOWN`                               |
| ModelCallLog            | Contract consumers only                                    | No proven active writer                                         | Schema/fixture only                    | `FIXTURE` / `REFERENCE`                 |
| CoachOutput             | Shared type consumers only                                 | No proven active writer                                         | Type-level contract                    | `REFERENCE`                             |
| BLP Shadow Replay       | Design and test descriptions                               | No proven runtime writer                                        | No proven route/pipeline               | `SHADOW` description; runtime `UNKNOWN` |

## Default runtime composition proof

`services/api/src/server.ts:createApiRuntime` creates JSON formal authority
and defaults the repository provider to `createJsonRepositoryProvider`.
`services/api/src/formal-runtime-input-resolver.ts` materializes exact
ParameterSet and ScenarioPackage inputs without a legacy fallback. The
materialized ParameterSet admits only `model_family: "toy_logit"`.

That fail-closed resolver is used only when a
`FormalRunRuntimeBinding` exists. The active API wrapper
`server.ts:resolveRunRuntimeInputs` retains an ID-based repository fallback
for legacy unbound runs. Settlement and Replay evidence both consume this
wrapper. The fallback does not activate BLP, but it means exact formal
identity is not universal across every active historical Run path.

The active settlement implementation imports and calls
`createToyLogitEngine`. No BLP adapter is selected by `model_version_ref`.

Therefore:

```text
runtime_authority = JSON_INTERNAL_ONLY
active_market_engine = toy_logit_wellness_v1
blp_active_runtime = NOT_PROVEN
postgresql_active_runtime = false
```

## Write boundary

BLP, any future BLP adapter, model artifacts, AI, and model-governance
surfaces must not write:

- `state_true`
- `SettlementResult`
- score
- rank
- `replay_hash`
- `canonical_evidence_digest`
- official ParameterSet versions
- official Run or Round state

The current formal write chain remains:

```text
validated canonical Decision
  -> existing simulation core
  -> existing settlement command
  -> repository facade/provider
  -> JSON SettlementResult and Round state
```

A future BLP implementation may only enter this chain through a separately
approved engine/solver boundary and exact, immutable formal references. It
must not create a second settlement writer.

## Model reference versus ModelVersion authority

Current source proves:

1. `ParameterSetVersion.model_version_ref` is a required nonblank string.
2. A formal Run copies that value into
   `FormalRunRuntimeBinding.model_version_references`.
3. The resolver verifies exact ParameterSet and ScenarioPackage references.
4. The current runtime does not resolve `model_version_ref` through a
   ModelVersion registry.

Consequently, a string such as
`toy_logit_wellness_v1@0.1.0` is an exact reference value but is not, by
itself, proof of a governed ModelVersion entity.

## Future authority gate

Any formal BLP activation requires a separate T4 decision that names:

- ModelVersion sole writer and lifecycle;
- model artifact registry and immutable digest;
- calibration artifact provenance;
- exact ParameterSet-to-ModelVersion compatibility;
- engine adapter and rollback boundary;
- Golden Solver and deterministic forward-solve evidence;
- Shadow Replay non-overwrite evidence;
- tenant and role visibility;
- performance and resource limits;
- failure mode and fail-closed behavior;
- invalidation triggers.

No item in this document grants that authorization.

## External candidate authority model

The external Program M V2.0 document is a lower-priority
`FORMAL ENGINEERING BASELINE CANDIDATE / OWNER REVIEW`. Its proposed authority
model is retained as a future constraint, not described as current:

| Candidate object                | Candidate writer                                        | Current source status                                     | Hard boundary                                                                       |
| ------------------------------- | ------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `BLPModelVersion`               | Model Governance Service                                | `UNKNOWN`                                                 | Agent, Teacher, Student, PyBLP direct, and frontend writes forbidden.               |
| CalibrationArtifact             | PyBLP Adapter / Model Engineering Service               | `UNKNOWN`                                                 | Must remain offline evidence; cannot write official truth.                          |
| CohortRuntimePreferenceState    | Approved deterministic Runtime Preference State Adapter | `UNKNOWN`                                                 | Agent cannot write directly; must be bounded, versioned, expiring, and exact-bound. |
| `DemandEstimate` candidate      | Future SimWar BLP runtime                               | `UNKNOWN`                                                 | Candidate only; Simulation Core L1 remains the acceptance and truth boundary.       |
| Truth L1                        | Simulation Core                                         | Existing current simulation-core path is `ACTIVE_RUNTIME` | BLP, Resolver, Agent, Plugin, UI, and PyBLP cannot commit official truth.           |
| Truth L2                        | Simulation Core                                         | Existing operations path is `ACTIVE_RUNTIME`              | BLP and Stage 4B cannot write operations/capacity truth.                            |
| SettlementResult / Score / Rank | Simulation Core settlement path                         | `ACTIVE_RUNTIME`                                          | Model, Agent, Resolver, Teacher, and AI writes forbidden.                           |

The proposed Stage 4B bridge:

```text
Agent proposal
  -> deterministic Resolver
  -> bounded Runtime Preference State
  -> future BLP DemandEstimate candidate
  -> Simulation Core L1 acceptance
```

is not present in current source and remains `REFERENCE`.

## C2 independence

C2 owns CourseBlueprint orchestration, Teacher BFF/UI, and C2 tests. M0 owns
only this documentation directory. M0 does not require or reserve
CourseBlueprint, Teacher BFF, Teacher App, shared-contract, Run, Replay, or
Settlement write locks.
