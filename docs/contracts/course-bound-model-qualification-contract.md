# Course-bound Model Qualification Contract

## Scope

`course-bound-model-qualification.v1` is an isolated MOD support contract for
the MQ1 mission
`SIMWAR-MOD-ECF-MQ1-COURSE-BOUND-MODEL-QUALIFICATION-V2.0-20260830`.
It is a deterministic semantic candidate compiler, not a CourseFactory route,
formal model-governance writer, simulation runtime, registry, store, or UI
journey. The current MAIN Product Clock is still governed by the fresh state of
the CourseFactory work, so this contract does not manufacture an integration
lease or a product-consumption receipt.

## State transition

The candidate describes `STATE_A -> STATE_B` only when its structured input can
be evaluated. State B evaluates this closed binding:

```text
CoursePackage
  -> exact ScenarioPackage reference
  -> exact ParameterSet reference
ScenarioPackage
  -> exact ParameterSet reference
  -> model-family / feature-mapper / parameter-schema compatibility
ParameterSet
  -> exact lifecycle/version/digest and compatibility metadata
ModelVersion
  -> exact version/digest and compatibility metadata
source evidence
  -> exact course/tenant/feature-schema binding, rights, freshness, expiry
```

The five output references are immutable `(resource_id, resource_type,
version, content_digest)` tuples. No `latest`, `current`, `default`,
`fallback`, `next`, `unresolved`, wildcard, or version range is accepted.

## Qualification states

- `ELIGIBLE_FOR_SHADOW_WITH_LIMITS`: all exact cross-references, compatibility,
  tenant scope, model lifecycle, source rights, freshness, and expiry checks are
  admissible for a shadow candidate. This is not calibration proof or formal
  activation eligibility.
- `NOT_ELIGIBLE`: the input is exact and computable, but rights, freshness,
  expiry, tenant scope, or an otherwise disqualifying lifecycle condition fails.
- `NOT_COMPUTABLE`: required evidence is unknown or cannot be evaluated without
  inventing a value. The compiler fails closed.
- `REBASE_REQUIRED`: exact bindings are structurally present but the course,
  scenario, parameter, model, or feature/schema compatibility graph conflicts.
  The consumer must provide a coherent exact base before retrying.

Every state has stable reason codes and a deterministic candidate digest. The
compiler never maps a failed check to a successful candidate by extrapolation.

## Authority boundary

The only writer named by this contract is the candidate compiler. Its output
always declares:

```text
formal_writer = NONE
official_truth_write = false
settlement_write = false
parameter_set_formal_write = false
replay_truth_write = false
provider = OFF
runtime_authority = JSON_INTERNAL_ONLY
formal_binding_eligible = false
activation_permitted = false
```

It does not write `EnterpriseState`, `SettlementResult`, official occupancy,
revenue, score, rank, replay truth, a formal ParameterSet, a ModelVersion
activation, or any official Product Truth. A future MAIN consumer must perform
its own contract, permission, role, and official-writer checks.

## MJP and evidence

The minimum MJP is four fixtures. Each fixture is evaluated by the same pure
classifier and records recomputed input/result digests, expected/observed
status, and `executed: true`. The checked-in fixture set covers a coherent
eligible bundle, cross-reference drift, stale/expired evidence, and model
compatibility drift. If fixtures are absent or incomplete, MJP is `SKIP` and
`MJP_PASS_NOT_PROVEN` remains a known limit; a candidate is never made to look
verified by a placeholder fixture.

Evidence is source-backed metadata only. Restricted/raw source data remains
owned by the SH source/observation/rights/freshness lane. This MOD contract
consumes exact source references and declared metadata and does not copy or
adjudicate the raw source.

## Role projections

Teacher-only output may expose qualification state, reason codes, and declared
compatibility. Admin research output may expose exact evidence and authority
metadata. Student-safe output contains only bounded compatibility/status fields;
it excludes source provenance, digests, tenant identifiers, raw/private data,
formal/settlement fields, score, and rank.

## Reuse, tombstone, and non-duplication

The existing generic R2 model qualification plane and current MOD compiler are
reused for exact-reference validation, stable digests, rights/freshness
fail-closed behavior, MJP patterns, role-safe projection, Provider OFF, and
candidate-only authority. They do not contain the MQ1 five-way course-bound
reference graph, so they are not falsely promoted as State B completion.

The implementation does not rebuild or fork active MAIN CourseFactory paths
(#476), ESL finance/capital (#468), CAN service feasibility (#471), or the
merged regional-transfer lifecycle tombstone (#475). It does not modify the
shared contract index, API/BFF/UI, simulation-core, formal writer, or any
second store/registry/runtime.

## Current integration limit

This is a C1 support carrier until fresh MAIN evidence proves that the exact
current CourseFactory/Model Control seam consumes this candidate as
`CONSUMED_SHADOW` or `CONSUMED_DIAGNOSTIC`. Without that receipt and a fresh
MAIN integration lease, the result remains `JOIN_WITH_LIMITS`/
`INTEGRATION_READY` at the program level and cannot be called
`PRODUCT_COMPLETE`. MQ2 and MQ3 are not started when this gate fails.
