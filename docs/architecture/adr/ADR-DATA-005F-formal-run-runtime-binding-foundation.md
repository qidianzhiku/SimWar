# ADR-DATA-005F: Formal Run RuntimeBinding Foundation

## Status

Accepted for the bounded `048A` foundation.

## Context

The current JSON runtime creates `Run` records from legacy Course, ScenarioPackage,
and ParameterSet IDs. Formal ParameterSet and ScenarioPackage authorities already
provide exact references and lifecycle checks, but they are not yet composed into
the active JSON runtime or a source-to-simulation-input resolver.

Attaching an Authority-looking reference to the current ID-only runtime would be
misleading: settlement and replay still resolve their actual inputs through the
legacy JSON Store. A formal binding is only meaningful when the bound Authority
content is also the verified source of the runtime inputs.

## Decision

Introduce a standalone `FormalRunRuntimeBinding` contract and service that can
create a deeply immutable, digest-addressed binding from:

- an exact tenant-scoped ScenarioPackage reference;
- the exact ParameterSet reference embedded by that ScenarioPackage;
- the ScenarioPackage plugin compatibility references;
- the ParameterSet model-version reference;
- both Authority schema references;
- an exact engine reference, `EXACT_RUN_SEED` policy, seed, tenant, and Run id.

Creation calls both existing `assertBindable` Authority checks. It rejects a
digest mismatch, tenant mismatch, unapproved or retired new-binding reference,
and a ScenarioPackage-to-ParameterSet reference mismatch. The resulting binding
has a canonical SHA-256 digest and is deeply frozen.

Historical readback resolves only the exact stored references. It permits an
already-bound `APPROVED` or `RETIRED` version, verifies every captured identity,
and never selects a newer version as a fallback.

An ID-only `Run` is explicitly classified as `LEGACY_ID_ONLY`; no helper infers,
creates, or persists a formal binding from legacy Store data.

## Runtime Boundary

This foundation does not attach a binding to the active `Run` object, change the
Run creation route, alter settlement inputs, modify replay manifests, or activate
Scenario Factory runtime composition. That is deliberate: there is currently no
provider-neutral resolver that proves a formal ScenarioPackage and ParameterSet
produce the exact ScenarioPackage and ParameterSet consumed by the JSON runtime.

The next runtime-composition mission must first introduce that resolver and prove:

1. the resolved simulation inputs originate from the exact Authority references;
2. the resolver fails closed on content, tenant, version, or digest drift;
3. the frozen binding, not an ID lookup, reaches Run creation, settlement input,
   internal replay evidence, and historical resolution;
4. Student projections never disclose private binding digests or Authority metadata.

## Consequences

- A future active binding path has an exact, testable contract instead of an
  ad-hoc collection of IDs.
- Retired versions remain readable only through their exact historical identity;
  they cannot seed a new Run binding.
- Current JSON-runtime Runs remain accurately classified as legacy and retain
  their existing settlement and Replay behavior.
- This decision is not PostgreSQL persistence, durable recovery, Scenario Factory
  activation, Plugin runtime activation, Human Validation, Pilot, or Production.
