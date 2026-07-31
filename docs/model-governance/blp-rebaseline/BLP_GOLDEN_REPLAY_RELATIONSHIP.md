# BLP, Golden, and Replay Relationship

## Source binding

- Repository: `qidianzhiku/SimWar`
- Assessment Source Anchor SHA:
  `1a13d81a43f667d80d3da2eaffe8aae8e48b45f8`
- Current Master Revalidated SHA:
  `44219c30f560f07d90048f601b83cd785bae8b91`
- Runtime authority: `JSON_INTERNAL_ONLY`
- BLP runtime: `UNKNOWN_NOT_PROVEN_ACTIVE`

The current-master C2/C3 delta does not add BLP/PyBLP to Golden inputs,
official Replay inputs, settlement truth, or runtime selection.

## Current Golden relationship

The current Golden path uses:

1. exact, approved JSON formal ParameterSet and ScenarioPackage references;
2. an exact `FormalRunRuntimeBinding`;
3. `resolveFormalRuntimeInputsForActiveRun`;
4. `calculateSettlement`;
5. `createToyLogitEngine`;
6. the existing market, operations, finance, and score modules.

Current Golden tests identify `model_family: "toy_logit"` and
`model_version_ref: "toy_logit_wellness_v1@0.1.0"`. They do not load a BLP
artifact or resolve a BLP ModelVersion registry.

Therefore:

```text
Golden M1 proves current toy-logit behavior.
Golden M1 does not prove BLP behavior.
```

## Current Replay relationship

`services/api/src/simulation.ts:buildReplayHash` hashes:

- `parameter_set_id`;
- `scenario_package_id`;
- `run_id`;
- `round_no`;
- Run seed;
- decision team, version, and payload;
- resulting `state_true` values.

`services/api/src/run-manifest-replay-evidence.ts` additionally records formal
binding metadata, including model version references and the formal
resolution digest. Replay evidence compares a new preview against the
persisted `SettlementResult` and sets:

```text
replay_writes_formal_results = false
```

The legacy `replay_hash` input does not explicitly include
`model_version_ref`. This is a current compatibility fact, not an
authorization to omit model identity from a future formal BLP evidence
contract.

## BLP relationship

No source-proven BLP adapter participates in settlement, Golden M1, Replay
preview, or Replay hash generation at this SHA. BLP references in model
contracts and architecture documents describe a target model position, not a
current executable relationship.

The safe current classification is:

| Relationship                  | Status                                 |
| ----------------------------- | -------------------------------------- |
| BLP -> Golden M1              | `UNKNOWN_NOT_IMPLEMENTED`              |
| BLP -> Replay hash            | `UNKNOWN_NOT_IMPLEMENTED`              |
| BLP -> Settlement truth       | `NO_PROVEN_CALL_PATH`                  |
| BLP -> ModelVersion authority | `UNKNOWN_NOT_IMPLEMENTED`              |
| BLP -> ParameterSet           | `REFERENCE_ONLY_NOT_FORMALLY_RESOLVED` |
| BLP -> Shadow Replay          | `UNKNOWN_NOT_IMPLEMENTED`              |

## Required future proof

Before a BLP candidate can be compared with or replace any current model
path, a separate T4 mission must prove:

1. an immutable, digest-addressed BLP artifact;
2. a formal ModelVersion lifecycle and sole writer;
3. exact ParameterSet and feature-mapper compatibility;
4. deterministic forward solve using frozen inputs;
5. Golden Solver fixtures and numeric tolerance policy;
6. Shadow Replay that cannot overwrite official results;
7. explicit Replay/canonical evidence identity semantics;
8. tenant-safe and role-safe diagnostics;
9. failure isolation and rollback to the current approved engine;
10. no second SettlementResult, score, rank, or replay-hash writer.

## External candidate target

The external Program M V2.0 plan proposes two future differential
relationships:

```text
PyBLP Reference Engine
  <-> Differential Golden
  <-> future deterministic SimWar BLP runtime
```

and:

```text
locked Stakeholder Proposal / Resolved Signal / Runtime State
  -> future BLP DemandEstimate candidate
  -> Simulation Core L1 acceptance
```

These are `REFERENCE` relationships. Current source does not prove the
Reference Adapter, independent BLP runtime, Differential Golden suite,
Deterministic Social Signal Resolver, or Runtime Preference State.

Future acceptance must include:

- Plane OFF exact parity;
- zero-signal exact parity;
- unchanged ParameterSet and ModelVersion digests;
- official Replay provider-call count of zero;
- locked proposal, signal, resolver, state, and binding references;
- no historical official-result overwrite;
- Simulation Core L1-L3 sole-writer preservation.

Agent or Resolver output must never modify ModelVersion, ParameterSet, beta,
sigma, pi, rho, share, occupancy, revenue, profit, score, rank, or official
Replay evidence. A future BLP result remains a `DemandEstimate` candidate
until accepted by Simulation Core L1.

## Non-overwrite rule

BLP and any future model evaluation may produce:

- candidate demand projections;
- calibration diagnostics;
- elasticity diagnostics;
- counterfactual reports;
- Shadow Replay diffs;
- approval evidence.

It must not directly write:

- official `state_true`;
- `SettlementResult`;
- score;
- rank;
- official `replay_hash`;
- historical Golden results.

## Explicit non-proofs

This document does not prove BLP calibration, predictive validity, Model
Registry readiness, Shadow Replay readiness, durable recovery, PostgreSQL
activation, Pilot readiness, or Production readiness.
