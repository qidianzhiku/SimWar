# MOD Next6 Product Consumption Support Plan

## Goal

Execute the six-Macro MOD portfolio in the uploaded mission contract from M1
through M6, while keeping MOD candidate/support-only. The implementation must
produce deterministic, provenance-complete capability evidence and explicit
integration debt for any consumer that is not proven C0 on the current
`origin/master`.

## Current Reality and authority boundary

- Start point: `origin/master` at `3a1c52e246db117807af2a439972207a631b293e`,
  tree `b15d53a32c0b81498d43afd257d21b8162992db1`.
- The uploaded ZIP is the formal mission contract; its historical SHA/PR facts
  are evidence only. The latest Owner message explicitly authorizes the
  enumerated M1→M6 chain and overrides the embedded single-Macro default for
  this run.
- MAIN/KERNEL remains the only official Truth and Settlement authority.
  MOD writes no official Truth, SettlementResult, Score, Rank, Replay truth,
  formal ParameterSet, Provider state, or production database state.
- JSON/internal deterministic execution is the only runtime used here.
- Existing R1–R6 `@simwar/mod-support` capability is a tombstone/reuse input,
  not proof of M1–M6 completion.

## Architecture and scope

Add a small pure TypeScript module under `packages/mod-support/src/` with a
shared typed input/output contract for M1–M6. It will:

1. bind every input to explicit versioned digests;
2. transform input observations into bounded candidate evidence;
3. fail closed on missing units, ambiguous time/geography, stale/conflicting
   evidence, unsupported extrapolation, and implicit latest references;
4. generate role-safe projections and a non-official Consumer Receipt;
5. record State A→B, MJP fixture evidence, Method Delta, Tombstone/Reuse and
   C0/C1/NOT_READY classification; and
6. preserve `official_truth_write=false`, `settlement_write=false`,
   `parameter_set_formal_write=false`, and `provider=OFF` as machine-checked
   invariants.

No route, shared contract, simulation-core, settlement, replay hash, model
activation, or frontend file will be changed unless a current source audit
proves a narrowly-scoped consumer seam is required. The first implementation
is intentionally C1-support safe because the current Product Clock has active
MAIN PRs #468/#469 and no fresh proof of a MOD-owned C0 slot.

## Macro order and State A→B

1. **M1 `MOD-ESL-CAP-O1-EXECUTIVE-FINANCE-CAPITAL-CONSUMPTION`**
   - A: exact capital/finance evidence is referenced, bounded, and validated.
   - B: liquidity, budget utilization, DSCR/covenant and stress/transaction
     feasibility are deterministic candidate outputs with receipt and C1 debt
     unless a current executable C0 consumer is proven.
2. **M2 `MOD-GSI-TSS-O1-WANT-DEMAND-POSITIONING-CONSUMPTION`**
   - A: demand/cohort/positioning evidence is exact and role-safe.
   - B: fit, outside option, price, trust and positioning mechanisms plus
     why-not refs are emitted; no occupancy/revenue write.
3. **M3 `MOD-OPS-O1-CAN-SERVICE-FEASIBILITY-CONSUMPTION`**
   - A: workforce/capacity/quality constraints are bound to units and period.
   - B: feasible/infeasible/UNKNOWN, binding constraints, waitlist/lost
     demand, skill/quality bottlenecks and recovery candidates are emitted.
4. **M4 `MOD-CRR-O1-CROSS-ROUND-RESILIENCE-CONSUMPTION`**
   - A: stock/flow/lag/feedback history is explicitly selected.
   - B: future constraints, same-decision/different-history comparison,
     recovery corridors and replay-safe shadow evidence are emitted.
5. **M5 `MOD-DL-O1-EXPLAINABILITY-UQ-DECISION-TRANSFER-CONSUMPTION`**
   - A: official baseline and role scope are exact.
   - B: mechanisms, uncertainty, why-not, bounded what-if, reflection and
     transfer evidence are emitted without causal overclaim.
6. **M6 `MOD-RT-LC-O1-REGIONAL-QUALIFICATION-LIFECYCLE-REQUALIFICATION`**
   - A: exact model versions, rights, freshness, holdout, Reality Gap and OOD
     evidence are bound.
   - B: region/version differences, expiry/drift, requalification and rollback
     dry-run evidence are emitted; no activation or implicit latest.

## TDD and validation sequence

For each Macro:

1. add failing unit tests for deterministic output, invalid evidence,
   role-safety, truth-write prohibitions and the State A→B acceptance fields;
2. implement the smallest pure function needed to make those tests pass;
3. add contract/fixture JSON only if the existing package contract cannot
   express the required fields;
4. run the focused unit/contract test and TypeScript build;
5. generate evidence from deterministic synthetic fixtures only;
6. independently validate JSON parseability, digests, no forbidden paths or
   secrets, and archive member safety;
7. re-run the relevant existing MOD support regression tests.

## Expected files

Allowed product files are limited to:

- `packages/mod-support/src/next6-consumption.ts`
- `packages/mod-support/src/index.ts` (export only, if needed)
- `tests/unit/mod-next6-consumption.test.ts`
- `contracts/schemas/mod-next6-consumption.v1.json`
- `contracts/fixtures/mod-next6-consumption.valid.json`
- `docs/technical/mod-next6/` evidence and handoff documents
- `docs/superpowers/plans/2026-08-29-mod-next6-product-consumption.md`

The final results archive is generated outside the repository worktree, then
independently reopened and verified. Existing dirty worktrees and unrelated
files remain untouched.

## Exit criteria

The chain exits only after M1–M6 each have a machine-readable State A→B
evidence record, tests, validation, Method Delta, Known Limits and explicit
Tombstone/Reuse result. Final status is `TARGET_COMPLETE_WITH_LIMITS` unless
current source proves all required C0 consumption receipts; no C0 claim is
made from candidate-only or historical evidence.
