# SH Next Six Macro Chain V5.0 — Implementation Plan

## Scope and authority

This plan implements the six Shanghai support macros enumerated by
`SimWar_SH_下一阶段自主连续6宏任务开发方案_V5.0_20260828` and its companion
target-mode prompt. The work is candidate/support scope only. It may create
Shanghai specialization, scenario content, source/observation/feature/transfer
evidence, deterministic compilers, role-safe projections, and integration-ready
handoffs. It must not write official Truth, Settlement, formal ParameterSet,
Shanghai Kernel/Runtime/Registry/App, or activate a Provider, PostgreSQL/RLS,
Pilot, Production, or Human Validation.

All output is exact-reference-bound, deterministic, replayable, and marked with
the data type, privacy class, confidence, expiry, and evidence status. Where a
current consumer seam is absent, the package uses the V5 C1/C2 forward-consumer
contract and records `JOIN_WITH_LIMITS`; it never claims the current MAIN
runtime consumes the candidate.

## Architecture

Add one lane-owned npm workspace package, `@simwar/sh-next-support`, with no
runtime route or persistence dependency. The package is the isolated source of
truth for this support pack, but it is not the product Truth writer. Its
public surface is a pure deterministic compiler and validators:

- `source-freeze.ts`: exact source records, observations, conflicts, quality,
  privacy, rights, expiry, and digest validation.
- `m1-executive-season.ts`: four Shanghai executive episodes with a complete
  Decision → Outcome → Debrief → What-if → Transfer loop.
- `m2-capital-sequencing.ts`: five-city/multi-region accessibility and project
  pipeline candidates with a nonofficial sequencing optimizer and golden
  variants.
- `m3-operating-stress.ts`: WANT/CAN/REALIZED/Finance/Policy/Stakeholder
  separated layers, deterministic shock matrix, diagnostics, and replay-safe
  evidence.
- `m4-portability.ts`: automatic public-safe second-city selection, generic
  transfer contract, same-schema compiler parity, compatibility diff, and
  rights/expiry fail-closed behavior.
- `m5-qualification.ts`: quality/freshness/eligibility/holdout/RealityGap
  qualification with explicit `READY`, `LIMITED`, and `NOT_ELIGIBLE`; no fake
  calibration.
- `m6-living-ops.ts`: refresh/diff/impact/requalification/rollback/retire
  candidate loop with immutable historical resolution and final-chain assembly.
- `pack.ts`: chain-level manifest and handoff projections; no formal writer.

All modules share canonical stable JSON hashing and an explicit forbidden-write
validator. Existing `shared-contracts` are referenced by exact file/line refs
in evidence, but are not changed unless a later consumer contract is proven.

## Test-first execution order

Each macro follows RED → GREEN → refactor and is delivered as at most one
lane-capability PR:

1. M1: write failing tests for four episodes, exact refs, role separation,
   Student-safe projection, AI-off run, no truth writes, and MJP/full-pack
   assembly. Implement and verify, then open one PR, remediate review/CI, merge
   normally, and record H2/H3.
2. M2: write failing tests for five cities, CRS/period/unit provenance,
   accessibility, project slots, deterministic nonofficial optimizer, golden
   variants, and generic second-city schema. Implement, verify, PR, review,
   merge, H2/H3.
3. M3: write failing tests for separated layers, single/double/recovery
   stress corridors, GSI shadow binding with Provider OFF, deterministic
   replay, tenant/role negatives, and no official overwrite. Implement,
   verify, PR, review, merge, H2/H3.
4. M4: write failing tests for automatic public-safe city selection, transfer
   bounds/rights/expiry, same compiler/schema/digest parity, compatibility
   diff, reverse portability, and fail-closed implicit-latest/history-delete
   guards. Implement, verify, PR, review, merge, H2/H3.
5. M5: write failing tests for conflict preservation, quality/freshness,
   quarantine, eligibility, holdout leakage zero, deterministic Golden/Stress/
   Replay, and honest `NOT_ELIGIBLE` output without real evidence. Implement,
   verify, PR, review, merge, H2/H3.
6. M6: write failing tests for cadence/expiry, semantic diff, impact graph,
   requalification, candidate-only recalibration, immutable rollback/retire,
   exact old-Run resolution, role-safe readiness, and final archive contract.
   Implement, verify, PR, review, merge, H2/H3.

## Verification and evidence

For each Macro, run the smallest failing test first, then focused tests, package
typecheck/build, relevant contract tests, lint/format/security checks, and one
full exact-head L5 after M6. Current baseline failures remain separately
recorded. CI/CodeQL readback and branch-protection state are collected from the
actual PR, never inferred. The final archive is generated only once after M6,
contains the required root files plus `evidence/M1/` through `evidence/M6/`,
then is independently checked for ZIP readability, duplicate/unsafe entries,
JSON parseability, manifest ghosts, SHA mismatches, forbidden raw/restricted/
secret entries, and a separately computed SHA-256.

## Explicit limits to preserve

- Local Reference Vault is read-only and currently unavailable through its
  tunnel; source fallback is allowed and will be recorded once.
- CodeGraph and Graphify have no current exact-head indexes in the fresh
  worktree; source readback is authoritative and graph contribution is marked
  unavailable, not fabricated.
- No current MAIN-ESL/MAIN-RT consumer seam is assumed. M1 is C1 and M2–M6
  remain C1/C2 until a current source/contract seam is proven.
- Public/synthetic evidence may prove deterministic support-pack behavior but
  cannot prove model calibration. M5 therefore remains `NOT_ELIGIBLE` or
  `LIMITED` unless an allowed public evidence basis is actually sufficient.
- Missing optional spatial/optimization libraries use a deterministic TS
  fallback and are recorded as `TOOL_NOT_RUN`, not as an unavailable product
  capability.
