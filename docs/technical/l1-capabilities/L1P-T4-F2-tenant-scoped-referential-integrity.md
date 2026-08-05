# L1P-T4-F2: Tenant-Scoped Referential Integrity

**Status:** `CLOSED_AND_CURRENT_WITH_LIMITS`

**Product PR:** `#344` / `f04e8c0a1ad8a0d8346c768440c006066c887ad8`

**Authorized base:** `e05052c85d5962af6e0ba83c551b280925d776c5`

**Runtime authority:** `JSON_INTERNAL_ONLY`

## Outcome

The forward-only `0005_tenant_scoped_referential_integrity.sql` migration
adds tenant-scoped parent keys and no-action foreign keys for the current
Course, Run, Round, Decision, SettlementResult and Replay model. Fail-closed
preflight checks reject orphan, cross-tenant, cross-run, duplicate-key and
invalid nullable-reference states without repairing or rewriting data.

The migration is inactive PostgreSQL support only. It does not activate a
provider, add RLS, create a Team authority, change JSON runtime behavior, or
alter Truth, SettlementResult, Score, Rank, Replay hash, or business formulas.
Existing migrations `0001` through `0004` remain byte-identical.

## Evidence

- Product merge: ordinary merge `f04e8c0a1ad8a0d8346c768440c006066c887ad8`,
  parents `e05052c85d5962af6e0ba83c551b280925d776c5` and
  `4cf8e4201c2c9e7200f246a411306b0cd7c03ee1`.
- Post-merge fresh detached clone:
  `D:/codex/fresh-clones/simwar-w015-postmerge-f04e8c0`, clean at the merge
  SHA and equal to `origin/master` at finish.
- W015 PostgreSQL verification: 6/6 passed.
- Existing PostgreSQL replay compatibility: 20/20 passed.
- Contract gate: 14 files / 37 tests passed.
- Browser-smoke exact-head rerun: passed.
- Direct-store boundary, hidden Unicode, typecheck, lint and build passed.
- Independent review: BLOCKING=0, MUST_FIX=0.

## Explicit Limits

- The default full Vitest run remains limited by the unchanged
  `store-snapshot-persistence` child-process `status=null` anomaly:
  158/159 files and 1025/1026 tests passed. The focused control passed
  147/147. This is recorded as an inherited environment/load limit and is
  not a W015 regression.
- `JSON_INTERNAL_ONLY` remains the active runtime authority; PostgreSQL is
  not active runtime.
- RLS and canonical Team referential integrity are not implemented because
  the current schema has no canonical Team parent.
- Durable recovery, backup/restore, PITR, crash-safe compensating atomicity,
  Human Validation, Pilot, Production and successor work are not proven or
  authorized.
- Issue #111 remains `OPEN_KNOWN_LIMIT`; Issue #113 remains open because the
  current-schema Team relationship is not enforceable; Issue #118 remains
  open and blocked. No GitHub Issue mutation is part of this closure.

`automatic_next_start: false`
