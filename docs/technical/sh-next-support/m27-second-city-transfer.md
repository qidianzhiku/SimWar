# M27 second-city public-source transfer requalification

M27 extends the M25 public-source evidence epoch to a reusable Hangzhou
regional-transfer candidate. It reuses the existing `regional-transfer.v1`
contract shape and M25's exact Shanghai→Hangzhou transfer rather than creating
a parallel transfer schema or writer.

## State transition

- State A: `SINGLE_CITY_TRANSFER_WITHOUT_SECOND_CITY_REQUALIFICATION`.
- State B: `SECOND_CITY_PUBLIC_SOURCE_TRANSFER_REQUALIFICATION_READY`.

The pack proves that Hangzhou coverage exists in official public-source
receipts and that the target is not synthetic-only. It preserves the source
rights and expiry boundary, records region/package/qualification differences,
and requires exact binding and requalification after any source or package
change.

The qualification is `LIMITED`: the values are labeled planning targets, not
calibrated outcome observations. `MODEL_CALIBRATED` is never emitted and
formal binding remains false.

## PR #475 reuse boundary

PR #475 is recorded as an open, review-blocked historical/current candidate
with its exact base and head SHAs. M27 absorbs its useful concepts—shared
schema, exact references, role-safe projections, expiry, rollback-candidate,
and requalification—without cherry-picking or introducing a competing shared
regional-transfer mutation. The integration stage is `LOOKAHEAD_READY` until
the current PR is independently resolved and merged.

The validator rechecks M25, the exact transfer identities, public-source
coverage, rights, expiry, compatibility digest, qualification boundary, and
authority closure. No official Truth, Settlement, Score, Rank, ParameterSet,
Provider, PostgreSQL/RLS, Pilot, Production, or Human Validation state is
written.
