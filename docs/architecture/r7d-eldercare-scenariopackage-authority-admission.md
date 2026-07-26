# R7-D Eldercare ScenarioPackage Authority Admission

## Purpose

R7-D maps the existing synthetic Beijing-Yanjiao eldercare scenario asset into
the `ScenarioPackageCommandService` lifecycle. It creates a provider-neutral,
test-only admission path that proves exact approved `ParameterSet` reference
binding and immutable ScenarioPackage content.

The source asset remains the R7-A deterministic compiler output. R7-D does
not create a new eldercare engine, change settlement behavior, or calibrate a
real operating model.

## Admission Flow

```text
synthetic R7-A asset
  -> synthetic ParameterSet DRAFT / VALIDATED / FROZEN / APPROVED
  -> ScenarioPackage DRAFT / VALIDATED / FROZEN / APPROVED
  -> tenant-scoped APPROVED projection
  -> RETIRED excludes new binding and projections
```

The `ParameterSet` exists only in the in-memory authority test harness. No
JSON Store, RepositoryFacade, route, BFF, UI, or server bootstrap path uses
the R7-D adapter.

## Scenario Content Boundary

The admitted ScenarioPackage preserves only synthetic scenario material:

- source asset identifier and stable asset hash;
- Beijing and Yanjiao region descriptors;
- the six teaching rounds;
- synthetic-data policy; and
- learner visibility exclusions.

It does not contain ParameterSet values, model previews, private plugin
traces, Replay artifacts, `state_true`, `SettlementResult`, score, rank,
truth hashes, or settlement inputs.

The `ParameterSet` values remain behind the exact approved
`ParameterSetReference`. The read projection intentionally excludes both
ScenarioPackage content and metadata.

## Runtime Boundary

```text
Scenario runtime activation = false
Run binding = false
Replay execution = false
Plugin runtime = false
Settlement mutation = false
PostgreSQL / SQL / migration = false
Pilot / Production = false
```

R7-D proves authority admission semantics for a synthetic scenario candidate.
It does not prove formal runtime availability, durable settlement, durable
recovery, Human Validation, Pilot readiness, or Production readiness.

Relates to #111. Relates to #114. Relates to #115.
