# SimWar Program VNext Operating Model

Status: conditional governance adoption (`ADOPTED_CONDITIONAL_ON_LIVE_MACRO_PROOF`), with diagnostic status `EVIDENCE_INSUFFICIENT`. No traceable source-bound diagnostic ledger proving six real complete cycles is available in this record. The historical source epoch is `c8733d6b6179fb438615d8d23eafb4abcc228a3a`; it is not current authorization. This record does not authorize a Product Macro, Human Validation, Pilot, Production, or any product-source mutation.

## Authority

SimWar retains one Product Authority: MAIN owns product intent, the formal product consumer, admission of an integration seam, and product closure. Product truth remains in the existing kernel, writer, settlement, replay, and RBAC boundaries. A program coordination function cannot create a second truth, writer, settlement, replay, RBAC, runtime-store, or database authority.

The Program Controller is a coordination carrier only. It may register typed demand, lane status, evidence references, integration windows, validation receipts, and stop-loss decisions. It may not write formal product state or replace the existing Product Authority.

## Clocks and delivery states

Model B proposes separate clocks without distributing product authority; operational adoption remains conditional:

- Product Authority Clock: MAIN decides product intent and formal closure.
- Lane Delivery Clock: SH, MOD, AGT, and FE can prepare and deliver bounded capability packages against typed demand and an explicit consumer horizon.
- Integration Window: MAIN admits a bounded package during an explicit lease/window; a lane does not wait for an unrelated global clock.
- Shared Validation Clock: validation is layered and receipt-aware; unchanged layers are not rerun merely because an unrelated lane moved.

The common state taxonomy is `PREPARED`, `DELIVERED`, `ACKNOWLEDGED`, `DECIDED`, `INTEGRATED`, `CONSUMED`, `SUPERSEDED`, and `TOMBSTONED`. A state transition needs an evidence reference or remains unknown; null is not success and null is not zero.

## Demand, overlap, and integration

Every support-lane package requires a typed demand, one intended consumer, a source epoch, an overlap hash or explicit no-overlap decision, and a stop-loss condition. A lane may continue to N+1 without MAIN source mutation only when the objective is unchanged, the package has no hot-file or authority overlap, the consumer horizon remains valid, and no immediate integration dependency is open.

The integration lease is the synchronization boundary. It replaces the old global-one-clock wait for unrelated lane work and removes repeated whole-program revalidation when the changed seam does not reach that layer. It must not add an approval step without removing a corresponding waiting edge or repeated validation.

## Historical Product Macro and current blockers

PR #517 (`GSI-STUDENT-HANDOFF-20260922`) merged at `c8733d6b6179fb438615d8d23eafb4abcc228a3a` ([merge record](https://github.com/qidianzhiku/SimWar/pull/517)). Its intended consumer was the existing Student role-safe GSI projection, through the existing Teacher comparison handoff. The merge is historical evidence only. The original receipt binding the focused real-BFF browser journey with route mocks disabled to that exact merged-master SHA has not been located; consumer readback is `UNVERIFIED`, and this record does not claim `CLOSED_CONSUMED_WITH_LIMITS` or a proven removed synchronization edge. PR-head test reports cannot substitute for an exact merged-master receipt.

At the 2026-09-30 readback, protected master was `e3fdf3844115f24b34713faeae1d087a9d7cfd8c`, tree `22d3b13a370cee66db084284ce5c76c02b75bbd1`. Under [L1 execution plan section 26](../planning/L1_MAINLINE_BOUNDED_PARALLEL_EXECUTION_PLAN.md#26-update-and-invalidation), the master change makes the current cycle `EXPIRED_REAUTH_REQUIRED`. These observed identities do not rebind historical diagnostic or browser evidence and do not renew authorization.

The proposed successor `GSI-STUDENT-HANDOFF-TARGET-CLOSURE-20260922` is `BLOCKED`: no source-bound Target Task Authorization Record is referenced. A future proposal requires fresh owner authorization and a complete record binding source, branch, exact file allowlist, locks, expiry, typed demand, consumer, overlap result, integration lease, stop-loss, and validation before implementation. This correction grants no successor execution authorization; automatic next-start remains false.

## Validation and evidence

Validation is layered:

1. lane-local contract and focused checks;
2. changed-seam integration checks;
3. consumer readback and role-safe runtime evidence;
4. MAIN admission and product closure;
5. heavier release-oriented gates only when the changed dependency graph requires them.

Diagnostic adoption requires a traceable source-bound ledger with at least six real complete cycles and an actual validator result. The schema, validator, synthetic unit-test fixture, and a single merged PR are not a diagnostic ledger. Missing process evidence and the verified complete-cycle count remain `null`, not zero or inferred success. The event ledger validator rejects open cycles from the complete-cycle denominator. Metrics must publish a numerator, denominator, unknown count, included cycles, formula, and evidence references. Graph topology is analysis, not product truth.

## What changes and what does not

Proposed synchronization removals, not yet evidenced as operational outcomes:

- the requirement that every support lane share one global delivery clock;
- repeated full validation caused only by unrelated lane movement;
- implicit waiting on MAIN when typed demand, consumer horizon, and integration lease are absent.

Retained safety mechanisms:

- one Product Authority and one formal truth chain;
- explicit MAIN integration admission;
- source-epoch and overlap checks;
- role-safe consumer proof;
- review, required-check, rollback, and stop-loss controls.

## Adoption and rollback

Adoption remains conditional on diagnostic evidence and live consumer proof; diagnostic status is `EVIDENCE_INSUFFICIENT`, and the historical cycle is `EXPIRED_REAUTH_REQUIRED`. Rollback is to the prior serial governance carrier if a package creates authority ambiguity, consumer drift, unreconciled overlap, repeated validation amplification, or an unbounded integration debt. Stop-loss pauses the affected lane or window; it does not weaken truth, review, or protected-branch gates.

The adoption record does not authorize a successor Product Macro or a second same-seam PR. Completing missing fields alone does not grant permission: fresh owner authorization and the complete source-bound admission record are required before any future implementation.

## Non-proofs

This governance carrier does not prove Product Acceptance, Human Validation, teaching effectiveness, Pilot, Provider activation, Production readiness, or automatic continuation. Those remain separate gates; Human Validation, Pilot, and Production remain unauthorized in the current cycle.
