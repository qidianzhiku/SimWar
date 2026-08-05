# L1P-T4-F1: Durable Settlement Idempotency and No-Fork Boundary

**Status:** `CLOSED_AND_CURRENT_WITH_LIMITS`

**Product PRs:** `#341` / `f4ee308e9ea28d65d4aebcb39dd92848abfd9a3e`; `#342` /
`8811e936feface9b8286043c82c155c82b23b641`

**Runtime authority:** `JSON_INTERNAL_ONLY`

## Outcome

The active JSON route and the inactive PostgreSQL support path share the
business identity `tenant_id + run_id + round_no`. Replay-relevant inputs are
fingerprinted deterministically. An identical retry reuses the immutable
authoritative result; a different fingerprint returns a stable conflict without
overwriting the result or Round; a first success writes its success audit in the
same persistence transaction.

JSON uses an in-process keyed mutex. PostgreSQL support uses a forward-only
fingerprint migration, transaction-scoped advisory business-key locking, a
target Round row lock, and the existing business uniqueness constraint. The
PostgreSQL provider remains inactive and no dual runtime authority is created.

## Evidence

- Final detached clone: `8811e936feface9b8286043c82c155c82b23b641`, clean.
- Focused JSON settlement: 46 tests passed.
- Contract: 14 files / 37 tests passed.
- Real disposable PostgreSQL verification: 20 tests passed.
- Browser: 74 passed / 9 explicitly skipped by existing conditions; role-workflow
  config 1 passed.
- Direct-store guard: 0 new, stale, duplicate, or broad findings.
- Typecheck, lint, build, hidden Unicode, CI and CodeQL passed.

The default full Vitest run remains limited by the pre-existing untouched
`store-snapshot-persistence` child-process `status=null` load anomaly; its
focused control passes 147/147. This is recorded as an environment/baseline
limit and is not a T4/F1 product regression.

## Boundaries and non-proofs

- No Truth, SettlementResult formula, Score, Rank, Replay hash, or canonical
  Decision semantics changed.
- PostgreSQL activation, cross-process JSON safety, durable recovery,
  backup/restore, and crash-safe compensating atomicity are not proven.
- Human Validation was not performed.
- Issue #111 remains `OPEN_KNOWN_LIMIT`.
- Pilot, Production, billing, external providers, AI and successor work are
  not authorized.

`automatic_next_start: false`
