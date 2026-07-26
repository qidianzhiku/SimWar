# ADR-DATA-005C: ScenarioPackage Metadata, Artifact, Digest and Plugin Dependency

Status: ACCEPTED

Parent: `ADR-DATA-005`

Decision: `HUMAN_DECISION_SIMWAR_SCENARIOPACKAGE_AUTHORITY_043A_001` accepted
Option A on 2026-07-26.

## Accepted Authority

`ScenarioPackageVersion` is the canonical aggregate. Its identity is the exact
combination of `tenant_id`, `scenario_package_id`, `version`, and
`content_digest`.

`ScenarioPackageCommandService` is the sole formal writer through
`ScenarioPackageRegistryPort`. The current foundation uses a JSON-compatible
in-memory registry; it does not activate a route, Store composition, or
PostgreSQL authority.

The Authority exposes an inactive, provider-neutral read seam for deterministic,
tenant-scoped `APPROVED` projections. Each projection preserves the exact
ScenarioPackage reference, ParameterSet reference, artifact policy,
compatibility metadata, and plugin dependency references, while excluding
scenario content and metadata. This seam is not wired into `SimWarRepositoryPorts`,
the JSON Store, API routes, Teacher UI, or server bootstrap. Legacy Store
scenario records must not be mapped into Authority references. PostgreSQL
declares this formal read capability as an explicit gap until separately
authorized.

The canonical content lifecycle is:

```text
DRAFT -> VALIDATED -> FROZEN -> APPROVED -> RETIRED
```

Lifecycle snapshots and approval records are append-only. Approval atomically
appends the `APPROVED` snapshot and its approval record. `APPROVED` content is
immutable. `RETIRED` versions remain historically readable but cannot be used
for new binding.

## Content Digest

The stable SHA-256 `content_digest` includes:

- tenant, package, and exact version identity;
- schema version and generic scenario content;
- immutable metadata and artifact policy;
- compatibility metadata;
- exact `ParameterSetReference`;
- PluginPackage compatibility references.

The digest excludes lifecycle status, approval metadata, actors, timestamps,
runtime correlation state, Store state, Replay results, and settlement results.
Object-key insertion order cannot change the digest.

ScenarioPackage digest is not a Replay hash, truth hash, or settlement proof.

## ParameterSet Boundary

ScenarioPackage directly reuses the existing `ParameterSetReference` contract.
Only an exact, currently bindable approved ParameterSet reference may be
accepted for a new package or final approval.

ScenarioPackage does not embed ParameterSet business values, calculate a
ParameterSet digest, mutate ParameterSet, or introduce a second ParameterSet
writer.

## Metadata, Artifact, and Plugin Boundary

Generic scenario content remains industry-neutral so a later deep eldercare
scenario can be represented without hard-coding eldercare fields into the
authority service.

Inline content and immutable artifact references share the same identity
policy. An immutable artifact reference requires a lowercase SHA-256 digest.
Plugin dependencies are compatibility references only. PluginPackage lifecycle
and runtime authority remain deferred.

## Run, Replay, and Truth Boundary

This decision reserves only an exact historical reference seam. It does not
bind a Run, change Run lifecycle, execute Replay, change Replay hash semantics,
or overwrite an official result.

Core Simulation Engine remains the only L1-L3 truth authority. ScenarioPackage
cannot write `state_true`, `SettlementResult`, score, rank, or a finance ledger.

## Explicit Non-Goals

- no HTTP or BFF mutation route;
- no active Store or RepositoryFacade composition;
- no Scenario Factory runtime activation;
- no Run binding or Replay execution;
- no Plugin runtime;
- no object storage deployment;
- no PostgreSQL, SQL, migration, or RLS;
- no deep eldercare scenario content;
- no Human Validation, Pilot, or Production authorization.
