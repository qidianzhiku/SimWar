# Shanghai Eldercare Golden M1

## Status and reality level

Shanghai Eldercare Golden M1 productization is a JSON-runtime teaching baseline
bound to the existing formal authority and course-delivery chain. The source
R7A/R7B/R7C assets remain:

- `L0_SYNTHETIC`
- `SYNTHETIC_TEACHING_BASELINE`
- `REALITY_CALIBRATION_NOT_PROVEN`

This milestone does not claim Shanghai calibration, pilot validation,
production readiness, or human validation. Human Validation remains a separate
future operator mission.

## Reuse and adapter boundary

`services/api/src/eldercare-golden-m1.ts` is a pure adapter. It consumes the
existing compiled Shanghai asset plus explicit source/target tenant identity
and emits deterministic draft inputs for the existing command services:

1. ParameterSet;
2. ScenarioPackage;
3. PluginRelease;
4. CourseBlueprint;
5. CoursePackageVersion.

Formal command services calculate canonical `content_digest` values and own all
lifecycle/approval writes. R7 `asset_hash` and `compile_hash` are provenance
metadata only; they are not authority digests. The adapter rejects mismatched
tenants, malformed references, duplicate/out-of-order rounds, forbidden truth
or private fields, and unsafe source identity.

The runtime package `plugin_wellness_eldercare_v1@1.0.0` is a deterministic
registry alias of the existing `wellnessPluginV1` implementation. It does not
introduce a second settlement engine, change settlement formulas, change
`SettlementResult`, change replay-hash inputs, or write Truth. The alias is
registered in the existing JSON runtime plugin registry so formal runtime
resolution exercises the same production path as the HTTP journey.

## Golden M1 chain

The integration journey uses real authenticated HTTP routes:

```text
approved source authorities
  -> tenant-local baseline
  -> CoursePackage AVAILABLE
  -> Course
  -> Run / Team / Student
  -> canonical Decision
  -> official Settlement
  -> published Student-safe result
  -> Teacher debrief / report / export
```

Two fresh synthetic tenants are exercised with the same source, seed and
canonical decision. Tenant-local identities remain distinct. The official
team-state/result digest and teacher replay evidence are deterministic. The
legacy `SettlementResult.replay_hash` remains tenant-local because its existing
inputs include tenant-local parameter/scenario/run identifiers; this is an
inherited contract seam and is not rewritten by Golden M1.

Conflict paths cover missing, mixed source-scope, foreign embedded-reference
and unapproved source evidence, as well as incomplete approval history. They
return governed errors and leave formal authority counts/digests unchanged.
Tenant-baseline materialization invokes the audit append inside the same
compensation boundary; an audit persistence failure returns a governed 500 and
removes the newly-created formal target rather than leaving a partial pair.
Student projections exclude
`state_true`, `replay_hash`, private replay fields, source-tenant identifiers
and other tenant data. Teacher views retain the authorized classroom/debrief
surface.

## Truth, AI and persistence boundaries

The adapter, Admin, Teacher and Student surfaces do not write `state_true`,
canonical decisions, `SettlementResult`, FinanceLedger, score, rank, or replay
truth. Decisions still follow the existing canonical team-confirmation path.
R7 shadow/review evidence remains candidate-only and is not materialized as an
official result. W020 remains advisory-only and no external model or secret is
introduced.

The active runtime is `JSON_INTERNAL_ONLY`; PostgreSQL, RLS, PITR, crash-safe
cross-process recovery, Pilot, Production and Human Validation are not claimed.

## Verification contract

The evidence package records the exact source SHA, Graph Companion health,
adapter/unit results, HTTP Golden M1 result, browser result (or an explicit
`E4_PARTIAL_ONLY` boundary), determinism/replay observations, tenant-isolation
checks, truth non-write matrix, known limits, and `automatic_next_start:false`.
The primary implementation is intentionally small: no new registry, kernel
redesign, second authority, migration, frontend truth writer or unrelated
infrastructure is introduced.
