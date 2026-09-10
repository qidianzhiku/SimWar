# SimWar KG-O3B2 Usage Telemetry and Trust Hardening Design

## Goal

Make Graph Companion support auditable and decision-useful without granting graph tooling Product Truth authority or starting any Product feature work.

## Boundaries

The implementation starts from `b53de10316b23ce620b1bf311c70feb3c9b971da` in a fresh worktree and changes only KG engineering-support code, contracts, documentation, and tests. It creates one branch and one non-merged PR. Product runtime, database/provider, settlement, score, rank, Graphify Precision, P2, and successor work remain out of scope.

## Architecture

`routeGraphSupportQuestion()` will consume a single derived CodeGraph admission result. Caller-supplied `codegraph_admitted` is treated as non-authoritative input and cannot produce `READY`; only an observed, target-bound, PASS/RELEVANT/COMPLETE receipt plus resolved source readback can do so.

Usage telemetry is an external append-only event DAG. Each event is written through staging, complete-write, hash, and exclusive finalization. A deterministic compiler reads finalized events only and emits `SIMWAR_KG_USAGE_RECEIPT_V2`; it never writes Product state. A separate immutable pre-review receipt is sealed before answer-key access, while post-review reconciliation references it without rewriting it.

QF-11 is a source/contract anchored identity-semantics analyzer. Envelope V1.2 extends the existing V1.1 shape with bounded references to telemetry, pre-review state, specialist gates, and value reconciliation. One lane-neutral shadow preamble documents selective routing for MAIN/SH/MOD/AGT/FE with no global gate or mandatory dual-graph call.

HC-07 uses PR #509's first material-review commit as a historical, blind source-only versus KG-assisted comparison. It cannot be used as a forward pilot. If no eligible pre-review Product task exists, the forward selector records `WAITING_FOR_NEXT_PRE_REVIEW_PRODUCT_TASK`.

## Safety and evidence rules

- `INSTALLED`, `AVAILABLE`, `CALLED`, `RELEVANT`, and `MATERIAL` remain distinct.
- Historical evidence never becomes current evidence without an exact target match.
- Graph evidence is navigation/diagnostic evidence only; source and contracts decide.
- Events are external to the Product repository and contain no credentials or raw unrestricted command payloads.
- A single event DAG has no global sequence requirement; sibling events can share parents.
- Unknown/unavailable graph tools produce explicit states and seam-local fallback, never global HOLD.

## Verification

TDD covers RT-001..RT-012, EV-001..EV-010, QF-11 semantic cases, receipt determinism, pre/post-review isolation, Envelope V1.2, and no-global-HOLD behavior. The branch then runs the affected suites, typecheck, lint, hidden Unicode, diff check, build, direct-store boundary, and security floor. H2 and H3 are exact-head read-only reviews; the new PR is not merged.
