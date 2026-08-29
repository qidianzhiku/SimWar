# M6 Living Scenario Refresh, Drift, and Rollback Candidate

## Scope

M6 packages the candidate-only lifecycle around the Shanghai support chain:

`refresh -> diff -> impact -> requalification -> rollback-candidate dry run`

The pack is a support artifact for later MAIN/MOD/FE binding. It does not add a
Shanghai kernel, runtime, registry, formal ParameterSet writer, settlement
writer, or Product Truth writer.

## State transition and reuse

`buildM6LivingScenarioLifecyclePack()` produces a deterministic `STATE_A` to
`STATE_B` candidate pack. It invokes the M5 builder once and binds the exact M5
pack digest into the M6 requalification and chain summary. M1 through M5 are
represented by capability tombstones with `REUSED` status; M6 does not
regenerate or fork their capabilities.

The current reference source is the exact M5 support pack. Its transport source
expires on `2027-12-31`, while this pack is validated as of `2026-08-29`, so the
refresh candidate records `EXPIRY_NOT_REACHED`, `NO_REFRESH_REQUIRED`, and
`NOT_APPLICABLE`. Once the explicit as-of date reaches the expiry, the same
branch emits `EXPIRY_DETECTED`, `CANDIDATE_REFRESH_ONLY`, and
`NOT_RETRIEVED`. The diff records this comparison as reference-only evidence,
preserving the boundary between an unsupported claim and a fact.

## Drift and requalification

The impact graph makes the dependency path visible from source to feature, MOD
diagnostics, MAIN scenario evolution, and the frontend known-limits consumer.
Requalification reuses the M5 gate input and must remain `NOT_ELIGIBLE` while
source retrieval, calibrated domains, and a proven C0 consumer seam are absent.
No `MODEL_CALIBRATED` or official truth claim is emitted.

## Rollback and historical resolution

Rollback is an exact-version, candidate-only dry run. It records active,
candidate, and rollback versions, but never executes a runtime write, formal
rollback, retire, or deletion. Historical resolution is derived from the exact
rollback version and rejects the implicit `latest` selector. These guards are
checked by both the TypeScript validator and the JSON Schema contract. The
requalification object also carries and validates the same reused M5 digest.

## Role and authority boundary

Teacher and internal research views receive lifecycle diagnostics; student
projection contains only safe direction and known-limit fields and explicitly
forbids private truth, official calibration, formal settlement, rollback
execution, and restricted-source fields. Provider remains `OFF`, runtime
authority is JSON-internal, and `formal_join` remains false until the exact C0
consumer contract is available.

## Verification

The M6 unit tests cover the full lifecycle sequence, M5 reuse, digest tamper
detection, rollback deletion rejection, exact-version resolution, role safety,
and schema rejection of null events and `latest` history selectors.
