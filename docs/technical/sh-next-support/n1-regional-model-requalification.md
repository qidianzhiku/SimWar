# N1 Regional Model Transfer Requalification Product

Status: `CANDIDATE_ONLY_REQUALIFICATION_REQUIRED`

## Product delta

RT-O1 already provides an exact Course/Run/Round/ParameterSet/ScenarioPackage
regional-transfer candidate and publishes a role-safe target-region context.
N1 adds a deterministic comparison envelope to that existing product. For both
the baseline and target region it records the exact model-version reference,
source identity/version/digest when available, rights, freshness, Reality Gap,
and OOD semantics.

The current reference fixture intentionally has incomplete target evidence. It
therefore emits `REQUALIFICATION_REQUIRED` with
`transfer_mode=CANDIDATE_ONLY`, `TARGET_SOURCE_NOT_RETRIEVED`,
`TARGET_RIGHTS_UNKNOWN`, `SOURCE_FRESHNESS_UNKNOWN`,
`REALITY_GAP_NOT_PROVEN`, `OOD_NOT_PROVEN`, and
`CALIBRATION_NOT_ELIGIBLE`. These are safety decisions, not calibrated model
claims.

## State transition

`STATE_A` is a regional candidate whose qualification is summarized by a
generic `READY_WITH_LIMITS` flag and a boolean requalification impact. `STATE_B`
is the same exact-bound candidate with a structured, auditable comparison and a
bounded requalification decision available through the existing RT-O1 preview,
validation, freeze, bind, Teacher, Student, and Admin journey.

## Evidence and authority

- Exact package references are resolved by the existing M4 compatibility pack.
- The M5 reality qualification pack is reused once by exact pack digest. Its
  public-reference-only, conflict-preserved, `NOT_RETRIEVED`,
  `NO_CURRENT_EVIDENCE`, and `NOT_ELIGIBLE` semantics are preserved.
- The model version is read from the exact formal ParameterSet source. Floating
  selectors and malformed semver references fail closed.
- The candidate is persisted only through the existing Regional Transfer
  candidate persistence port in `JSON_INTERNAL_ONLY`.
- `official_truth_write=false`, `settlement_write=false`,
  `replay_truth_write=false`, `no_official_truth_write=false`, and
  `transfer_mode=CANDIDATE_ONLY` are explicit.
- Student remains restricted to the existing target-region/context projection;
  source digests, source revisions, peer paths, and internal audit evidence are
  not returned.

## Validation contract

The unit, integration, contract, and browser tests cover exact model/package
binding, source absence, unknown rights/freshness, unknown Reality Gap/OOD,
floating model references, tenant/course scope, lifecycle transitions,
immediate source revalidation before bind, idempotent bind, role-safe Student
projection, and no official/replay writes. This product does not claim public
regional calibration, causal validity, full WCAG acceptance, Human Validation,
Pilot, Production, Provider activation, or PostgreSQL/RLS activation.
