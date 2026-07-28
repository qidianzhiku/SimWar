# ADR-DATA-005G: Formal Authority Runtime Input Resolution

## Status

Accepted for the formal-authority foundation. Active Run runtime composition remains deferred.

## Context

`FormalRunRuntimeBinding` already freezes exact ScenarioPackage and ParameterSet
references for a Run, but those references need an exact PluginRelease identity
and a read-only way to materialize their source content. The legacy JSON runtime
still uses ID-only `Run` fields and is not a formal-authority persistence or
runtime-composition authority.

The Eldercare plugin asset is currently candidate-only. It must not become a
formal binding or runtime input merely because its source is present in the
repository.

## Decision

1. Plugin releases use an append-only lifecycle:
   `DRAFT -> VALIDATED -> APPROVED -> AVAILABLE -> RETIRED`.
2. A PluginRelease reference is exact: `plugin_package_id`, `version`, and
   `content_digest`.
3. A new formal Run binding resolves only `AVAILABLE` PluginRelease versions
   declared by the exact approved ScenarioPackage. Candidate, validated,
   approved-but-unavailable, and retired releases cannot create a new binding.
4. Historical formal reads may resolve exact `AVAILABLE` or `RETIRED` PluginRelease,
   ScenarioPackage, and ParameterSet versions. They never float to a latest version.
5. `resolveFormalRuntimeInputsForHistoricalRead` returns deep-frozen,
   digest-addressed ScenarioPackage content, ParameterSet values, and
   PluginRelease manifests. Lifecycle status is not exposed as executable input
   material and does not change the resolution digest after retirement.
6. The resolver is provider-neutral through `FormalRunBindingAuthorityPorts`.
   It does not read the legacy Store, compose API routes, activate a plugin,
   create or settle a Run, execute Replay, or mutate truth.

## Consequences

The formal-authority foundation can now prove exact immutable input material for
an already frozen binding. It does **not** make the current JSON runtime consume
those inputs. Any later active-runtime composition must be a separate small PR
with explicit persistence, route, tenant, truth, Replay, and zero-fallback
validation.

## Explicit Non-Goals

- PostgreSQL activation, SQL, migrations, or durable recovery.
- Scenario Factory UI, Teacher/Student/Admin UI, or route activation.
- Plugin runtime activation or direct plugin writes to `state_true`, settlement,
  score, rank, `SettlementResult`, or `FinanceLedger`.
- Legacy Store mapping, Run binding migration, Replay execution, or settlement
  logic changes.
- AI activation, Controlled Pilot, or Production authorization.
