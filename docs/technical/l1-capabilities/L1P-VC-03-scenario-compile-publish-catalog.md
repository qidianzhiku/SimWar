# L1P-VC-03: Scenario Compile, Explicit Publish, and Teacher Catalog

**Status:** `CLOSED_AND_CURRENT`
**Product Evidence Source SHA:** `19a6db737968c0840cbea488b91228ab2ce01a50`
**Product PR:** `#290`
**Runtime authority:** `JSON_INTERNAL_ONLY`

## Product Outcome

A generic Scenario Compiler request now produces a formal `ScenarioPackage` `DRAFT` through `ScenarioPackageCommandService`. A separate existing lifecycle path performs `VALIDATED -> FROZEN -> APPROVED`; only then does the existing Teacher catalog show the package. `RETIRED` packages disappear from that catalog while their lifecycle history remains readable to the authority path.

## Authority and Boundaries

- `ScenarioPackageCommandService` remains the sole formal writer.
- The compiler-to-draft orchestration does not auto-validate, freeze, approve, retire, bind, activate, publish a result, settle, or run Replay.
- Invalid compiler output returns a machine-readable report and produces no formal ScenarioPackage snapshot.
- A candidate with an unbindable exact `ParameterSet` reference is rejected before ScenarioPackage persistence.
- Teacher catalog access is a read-only projection; it does not create a Run or a formal binding.

## Evidence

- `tests/integration/scenario-compile-draft-endpoint.test.ts` covers successful DRAFT creation, zero-write invalid paths, explicit approval visibility, and retirement behavior.
- `tests/e2e-ui/zzzz-scenario-compile-draft-catalog.spec.ts` verifies the Teacher catalog surface and the absence of binding, activation, replay, publish, and settlement controls.
- PR #290 exact-head CI, CodeQL, and fresh detached-clone validation completed against the Product Evidence Source SHA.

## Explicit Non-Proofs

- No CourseBlueprint or Course binding.
- No Formal Run Runtime Binding or runtime activation.
- No Replay execution, durable settlement, recovery, PostgreSQL activation, Pilot, or Production readiness.
- No Human Validation was performed.

## Successor Boundary

`CAND-L1P-B5-TEACHER-SELECTION-FORMAL-BINDING` is a separate, not-yet-authorized mission. This capability card grants it no mutation authority.
