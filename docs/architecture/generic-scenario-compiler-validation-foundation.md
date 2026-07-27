# Generic Scenario Compiler And Validation Foundation

## Status

Internal foundation only. This module is not a Scenario Factory runtime,
publication workflow, Teacher surface, Run binder, or Replay executor.

## Purpose

`compileGenericScenario` turns one exact, tenant-scoped source reference and
one generic template into a `ScenarioPackageDraftInput` candidate plus a
deterministic validation report. It uses the existing ScenarioPackage authority
validation without appending a lifecycle snapshot.

## Input Boundary

The compiler accepts only:

- `SYNTHETIC_INTERNAL` or `TEACHER_AUTHORED_DRAFT` source kinds;
- a `REGISTERED` source reference; a retired source cannot create a new candidate;
- lowercase SHA-256 source digests and exact semantic versions;
- a source reference whose tenant matches the candidate tenant;
- an exact ParameterSet reference, not ParameterSet values;
- generic template content and metadata;
- immutable artifact policy and exact plugin compatibility references.

The compiler rejects malformed source metadata, tenant mismatch, invalid
template references, provenance mismatch, non-finite values, and formal truth
keys already forbidden by ScenarioPackage authority validation.

## Output Boundary

The candidate contains generic source and template references, not industry
semantics. The report contains only reference-safe identifiers, input and
candidate digests, errors, and explicit non-proofs. It does not contain
ParameterSet values, a lifecycle snapshot, approval record, truth state, or
Replay data.

## Authority Boundary

`ScenarioPackageCommandService` remains the sole writer. A successful compiler
result is a non-persisted candidate that must still pass the existing
`DRAFT -> VALIDATED -> FROZEN -> APPROVED` lifecycle before it can become
bindable. Publication, catalog, Teacher readiness, Course or Run binding, and
Golden parity remain later Program B bundles.

## Explicit Non-Proofs

- A valid candidate is not a published ScenarioPackage.
- A valid candidate does not activate a route, Store, or runtime composition.
- A valid candidate does not bind a Run or execute Replay.
- A valid candidate does not prove durable settlement, recovery, Pilot, or
  Production readiness.
