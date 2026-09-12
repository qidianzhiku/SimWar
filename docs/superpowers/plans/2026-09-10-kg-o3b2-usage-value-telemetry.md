# KG-O3B2 Usage Telemetry and Value Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Harden Router admission, add external KG usage telemetry/receipts, QF-11 identity semantics, Envelope V1.2, and HC-07 evidence without Product mutation or merge.

**Architecture:** Keep the existing Graph Companion as the only controller. Derive qualified CodeGraph admission from target-bound observations, write immutable usage events outside the repository, compile deterministic receipts, and keep historical calibration read-only.

**Tech Stack:** Node.js ESM scripts, Vitest, JSON contracts, Markdown runbooks, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-10-kg-o3b2-usage-telemetry-design.md`

## Global Constraints

- One KG engineering branch and one PR; no merge or auto-merge.
- No Product feature, DB/provider runtime, settlement, score, rank, Graphify Precision, P2, or successor mutation.
- Graph evidence remains `DERIVED_ENGINEERING_EVIDENCE_ONLY`.
- External evidence/events only; no credentials or unrestricted raw command payloads.
- Fresh exact SHA/tree binding; historical evidence cannot promote current admission.
- G2/G3 `READY` requires observed CodeGraph `PASS/RELEVANT/COMPLETE`, exact SHA/tree match, and resolved source readback.

### Task 1: Router trust hardening and QF-11 analyzer

**Files:**
- Modify: `scripts/graph-companion.mjs` (canonical admission helper and QF-11 export)
- Create: `tests/unit/graph-o3b2-router-qf11.test.ts`
- Create: `docs/development/kg-o3b2-qf11.json`

**Interfaces:**
- Produce `deriveCodeGraphAdmission(input) -> { observed, admitted, reason }`.
- Produce `analyzeIdentityDigestSemantics(input) -> bounded finding list`.

- [ ] Write RT-001..RT-012 and QF-11 failing tests.
- [ ] Run the focused test file and confirm the direct-admitted bypass fails.
- [ ] Implement the derived admission helper and route all G2/G3 decisions through it.
- [ ] Implement QF-11 checks for scope-too-narrow/broad, static-as-runtime, invocation-not-bound, conflation, and semantic-name mismatch.
- [ ] Run focused tests and existing Graph Companion/O3B1 tests.
- [ ] Commit with `fix: harden graph admission and add qf11 semantics`.

### Task 2: External usage events, receipts, and Envelope V1.2

**Files:**
- Create: `scripts/kg-usage-telemetry.mjs`
- Create: `tests/unit/kg-usage-telemetry.test.ts`
- Create: `docs/development/kg-usage-event-v2.json`
- Create: `docs/development/kg-usage-receipt-v2.json`
- Create: `docs/development/graph-support-envelope-v1-2.json`

**Interfaces:**
- `createUsageEvent(input) -> immutable event with event_hash`.
- `finalizeUsageEvent({ evidenceRoot, event }) -> receipt path`.
- `compileUsageReceipt({ evidenceRoot, traceId }) -> deterministic receipt`.
- `sealPreReviewDecision(input) -> immutable pre-review receipt`.
- `reconcileValue({ preReview, review }) -> separate reconciliation`.
- `buildGraphSupportEnvelopeV12(input) -> bounded Envelope V1.2`.

- [ ] Write EV-001..EV-010 and receipt/pre-review failing tests.
- [ ] Run focused tests and confirm missing writer behavior.
- [ ] Implement staging, exclusive finalization, hash verification, unsafe-path and secret policy checks.
- [ ] Implement deterministic DAG compilation and pre/post-review separation.
- [ ] Implement Envelope V1.2 as an extension of V1.1.
- [ ] Run focused tests and existing Graph Companion tests.
- [ ] Commit with `feat: add immutable kg usage telemetry v2`.

### Task 3: Shadow preamble and historical/forward evidence

**Files:**
- Create: `docs/development/kg-shadow-support-preamble-v1.md`
- Create: `docs/development/kg-o3b2-hc07-runbook.md`
- Create: `scripts/kg-o3b2-evidence.mjs`
- Create: `tests/unit/kg-o3b2-evidence.test.ts`

- [ ] Add tests for exact historical target isolation, blind-cell sealing, HC-07 comparison, and forward selector states.
- [ ] Implement bounded evidence helpers that never reveal answer keys before both cells seal.
- [ ] Fresh-read PR #509 first material-review commit and produce HC-07 receipts externally.
- [ ] Fresh-read current open Product tasks and record forward selector without inventing a task.
- [ ] Commit with `docs: define kg shadow support and hc07 evidence`.

### Task 4: Validation, reviews, PR, and atomic delivery

**Files:**
- Create: external result staging directory and result ZIP only; do not commit evidence.

- [ ] Re-read exact branch/base/head and run all affected tests and quality commands.
- [ ] Run independent H2 and H3 exact-head reviews; repair only in-scope findings.
- [ ] Push one branch and create one non-merged PR only if GitHub auth is available.
- [ ] Generate `DELIVERY_SIMWAR_KG_O3B2_<UTCSTAMP>_<HEADSHORT>.zip` with all required sections and detached `OUTER_VERIFY.json`.
- [ ] Independently verify CRC, SHA256SUMS, duplicates, unsafe paths, JSON parsing, and secret scan.
- [ ] Hard stop with `AUTOMATIC_NEXT_START=false`.
