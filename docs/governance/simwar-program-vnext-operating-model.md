# SimWar Program VNext Operating Model

Status: ADOPTED_ON_CURRENT_EPOCH_WITH_LIMITS after the exact dual-MCP diagnostic and the merged GSI Student handoff Product Macro on protected master `c8733d6b6179fb438615d8d23eafb4abcc228a3a`. This record does not authorize Human Validation, Pilot, Production, or any product-source mutation outside a separately authorized macro.

## Authority

SimWar retains one Product Authority: MAIN owns product intent, the formal product consumer, admission of an integration seam, and product closure. Product truth remains in the existing kernel, writer, settlement, replay, and RBAC boundaries. A program coordination function cannot create a second truth, writer, settlement, replay, RBAC, runtime-store, or database authority.

The Program Controller is a coordination carrier only. It may register typed demand, lane status, evidence references, integration windows, validation receipts, and stop-loss decisions. It may not write formal product state or replace the existing Product Authority.

## Clocks and delivery states

Model B is adopted for the current program epoch without distributing product authority:

- Product Authority Clock: MAIN decides product intent and formal closure.
- Lane Delivery Clock: SH, MOD, AGT, and FE can prepare and deliver bounded capability packages against typed demand and an explicit consumer horizon.
- Integration Window: MAIN admits a bounded package during an explicit lease/window; a lane does not wait for an unrelated global clock.
- Shared Validation Clock: validation is layered and receipt-aware; unchanged layers are not rerun merely because an unrelated lane moved.

The common state taxonomy is `PREPARED`, `DELIVERED`, `ACKNOWLEDGED`, `DECIDED`, `INTEGRATED`, `CONSUMED`, `SUPERSEDED`, and `TOMBSTONED`. A state transition needs an evidence reference or remains unknown; null is not success and null is not zero.

## Demand, overlap, and integration

Every support-lane package requires a typed demand, one intended consumer, a source epoch, an overlap hash or explicit no-overlap decision, and a stop-loss condition. A lane may continue to N+1 without MAIN source mutation only when the objective is unchanged, the package has no hot-file or authority overlap, the consumer horizon remains valid, and no immediate integration dependency is open.

The integration lease is the synchronization boundary. It replaces the old global-one-clock wait for unrelated lane work and removes repeated whole-program revalidation when the changed seam does not reach that layer. It must not add an approval step without removing a corresponding waiting edge or repeated validation.

## Current live proof

The current authorized Product Macro was `GSI-STUDENT-HANDOFF-20260922` (PR #517). Its consumer was the existing Student role-safe GSI projection; its source-bound integration seam was the existing Teacher comparison handoff; it introduced no BFF route, store, writer, truth, settlement, replay, or RBAC authority. The PR merged normally at `c8733d6b6179fb438615d8d23eafb4abcc228a3a`, and the exact merged-master browser readback passed the focused real-BFF GSI journey with route mocks disabled.

The live proof demonstrates one removed synchronization edge: the Student handoff package could be validated and consumed through the bounded GSI integration window using its focused receipt, instead of waiting on an unrelated global product-clock revalidation. This is a scoped operational proof, not a statistical claim about all future cycles.

## Validation and evidence

Validation is layered:

1. lane-local contract and focused checks;
2. changed-seam integration checks;
3. consumer readback and role-safe runtime evidence;
4. MAIN admission and product closure;
5. heavier release-oriented gates only when the changed dependency graph requires them.

The event ledger validator rejects open cycles from the complete-cycle denominator. Metrics must publish a numerator, denominator, unknown count, included cycles, formula, and evidence references. Graph topology is analysis, not product truth.

## What changes and what does not

Removed synchronization mechanisms:

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

Adoption is bounded to the current source epoch and remains reversible. Rollback is to the prior serial governance carrier if a package creates authority ambiguity, consumer drift, unreconciled overlap, repeated validation amplification, or an unbounded integration debt. Stop-loss pauses the affected lane or window; it does not weaken truth, review, or protected-branch gates.

The adoption record does not authorize a second same-seam PR. It permits one successor Product Macro only when its demand, consumer, source epoch, overlap result, integration lease, and stop-loss are recorded before implementation.

## Non-proofs

This governance carrier does not prove Product Acceptance, Human Validation, teaching effectiveness, Pilot, Provider activation, Production readiness, or automatic continuation. Those remain separate gates; Human Validation, Pilot, and Production remain unauthorized in the current cycle.
