# STK Authority Boundary

## Decision

At source SHA `1a13d81a43f667d80d3da2eaffe8aae8e48b45f8`,
Stakeholder Plane authority is `NONE`. Stage 4B is OFF and no current resolver,
proposal store, signal store, runtime-state adapter, provider, route, or product
surface is proven.

S0 is documentation-only. It neither grants future write authority nor reserves
an implementation path.

## Sole-Writer Matrix

| Formal object                  | Current writer                                       | STK permission                     | Classification    |
| ------------------------------ | ---------------------------------------------------- | ---------------------------------- | ----------------- |
| CourseBlueprintVersion         | `CourseBlueprintCommandService`                      | read safe exact reference only     | `SOURCE_PROVEN`   |
| ParameterSetVersion            | `ParameterSetCommandService`                         | none                               | `SOURCE_PROVEN`   |
| ScenarioPackageVersion         | `ScenarioPackageCommandService`                      | none                               | `SOURCE_PROVEN`   |
| Formal Course/Run binding      | formal binding services                              | none                               | `SOURCE_PROVEN`   |
| canonical Decision             | authorized decision command path                     | none                               | `SOURCE_PROVEN`   |
| `state_true`                   | Simulation Core L1-L3                                | none                               | `SOURCE_PROVEN`   |
| `SettlementResult`             | Simulation Core L3 / settlement persistence boundary | none                               | `SOURCE_PROVEN`   |
| Score / Rank                   | Simulation Core L3                                   | none                               | `SOURCE_PROVEN`   |
| Replay evidence/report         | Replay service, read-only relative to formal results | read only if separately authorized | `SOURCE_PROVEN`   |
| Learning Evidence confirmation | future Teacher Confirmation service                  | none in S0                         | `DOCUMENTED_ONLY` |
| Stakeholder proposal/signal    | no current writer                                    | none in S0                         | `UNKNOWN`         |

## Absolute Prohibitions

Stakeholder code, Agent output, resolver output, model output, private memory,
and future runtime state must not:

- submit or amend a canonical Decision;
- change `state_true`;
- write or overwrite `SettlementResult`, Score, or Rank;
- create, mutate, approve, or retire `ParameterSet` or `ModelVersion`;
- change CourseBlueprint, ScenarioPackage, formal Course, or formal Run binding;
- alter replay hash inputs, replay evidence, or historical official results;
- use a provider during official Replay;
- bypass tenant, course, team, or role scope;
- silently fall back from OFF/SHADOW to an active mode.

## Future Candidate Writers

The external Program M extract proposes, but does not implement:

```text
Stakeholder Agent -> StakeholderProposal
Deterministic Resolver -> ResolvedStakeholderSignal
approved adapter -> bounded Runtime Preference State
```

All three remain `BASELINE_CANDIDATE / DOCUMENTED_ONLY`. A future gate must
prove one writer for each object, append-only storage, exact binding, expiry,
bounds, lag/decay, auditability, plane-off parity, and zero official writes.

The resolver may only produce a bounded candidate state. It may not produce
market share, occupancy, revenue, profit, score, rank, or model coefficients.

## Separation From AI

Current source defines `CoachOutput` and `ModelCallLog` with
`advisory_only: true`. Those contracts are not an STK authority. A future Agent
may be a proposal producer only; deterministic validation and resolution must
remain outside provider output. Provider failure must not affect formal
settlement.

## Separation From Learning Evidence

Stakeholder observations or narratives are not formal learning evidence. They
may become candidate evidence only after a separately authorized Program D
workflow and Teacher confirmation. They cannot write a formal grade or alter
business score.

## Required Negative Gates Before S1/S2

1. No import or call path from STK modules to formal writer methods.
2. No forbidden fields in STK request/response schemas.
3. Plane OFF and zero-signal exact parity for Run, Golden, Replay digest,
   Settlement, Score, and Rank.
4. Cross-tenant, cross-team, wrong-role, and missing-scope rejection.
5. Provider-call counter is zero for formal settlement and official Replay.
6. ModelVersion and ParameterSet digests remain unchanged.
7. No silent latest, default, fallback, or second store.
8. Historical proposals/signals/state are append-only and non-overwriting.

## Unknowns

- exact S1 service and port names;
- exact proposal/signal/runtime-state schemas;
- store provider and retention implementation;
- resolver algorithm and compatibility profile;
- feature-flag control plane;
- product projection owner;
- whether shared contracts can remain internal or require public types;
- test and CI command names.

These unknowns block implementation claims, not S0 documentation.
