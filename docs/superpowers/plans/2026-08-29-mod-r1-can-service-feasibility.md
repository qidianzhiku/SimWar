# MOD R1 CAN / Service Feasibility Product Macro

## Goal

Turn the scattered capacity, workforce, service-quality, demand, and eligibility constraints already exposed by the governed Shanghai/W5 runtime into one deterministic, candidate-only CAN feasibility product. The product must let a Teacher inspect the exact bounded diagnosis, let a Student see only a role-safe why-not explanation for the enrolled team, and let an Admin inspect exact inputs, provenance, limits, and authority flags.

## State transition

- State A: capacity/workforce/quality/eligibility signals exist in separate W5 and operating-world projections, while no dedicated product contract composes them into an exact service-feasibility decision and reasoned constraint list.
- State B: an exact tenant/course/run/round-bound feasibility candidate is produced by a deterministic domain service, exposed through role-safe BFF projections, and verified by contract, integration, negative, recovery, and UI evidence. It remains NON_OFFICIAL and cannot write REALIZED, SettlementResult, score, rank, canonical Decision, or replay truth.

## Existing capability and reuse

- Reuse the current `W5GovernedModelService`/Shanghai full-vertical exact binding and current JSON repository as read-only inputs.
- Reuse the current `TeacherScenarioStudio`/Shanghai full-vertical Teacher, Student, and Admin entry surfaces without changing their writer authority.
- Treat existing W5 `can.eligible` and constraint summaries as upstream evidence, not as the new R1 product contract.
- Record a capability tombstone for reused W5/operating-world inputs in the result evidence; do not recreate a second model registry, store, runtime, or writer.

## Implementation work packages

### WP0 — Fresh reality and admission receipts

Record the exact source SHA, worktree, current PR/WIP state, resource lock, provider/DB mode, CodeGraph/Graphify/Vault contribution, selected R1 overlay, and no-overlap file boundary. Keep the open #468/#469/#470 branches untouched; R1 changes must not use their ESL/W4 hot files.

### WP1 — Contract-first red and negative tests

Add a shared R1 contract with exact binding, typed constraint evidence, deterministic status (`FEASIBLE`, `INFEASIBLE`, or `UNKNOWN`), bounded why-not reasons, provenance, authority flags, and role projections. Add failing unit/contract tests for malformed identities, implicit `latest`/`default` references, missing exact inputs, cross-tenant/run/round access, official-truth fields, and non-deterministic output.

### WP2 — Deterministic CAN domain capability

Implement the R1 feasibility evaluator in the simulation-core boundary or a narrowly scoped candidate-domain module. It may calculate service feasibility from exact numeric inputs and explicit semantic units only. Do not substitute zero/default values for missing inputs. Queue/waitlist claims are out of scope unless exact queue inputs are available; if queue stress is implemented, use a deterministic local harness and record that OR-Tools/SimPy were not activated unless their actual runtime contribution is proven.

### WP3 — Real API/BFF consumption

Add the minimum route/service wiring needed for Teacher/Student/Admin role-safe projections. Bind only to exact course/run/round and approved W5/operating-world inputs. Keep persistence candidate-only and use the existing JSON runtime. Update OpenAPI/schema/fixtures together and preserve one truth engine plus existing Simulation Core writer boundaries.

### WP4 — Product journey and validation

Expose an observable Teacher diagnosis, Student why-not projection, and Admin exact-input/limits audit. Add focused browser journey coverage and accessibility checks if the selected implementation changes UI. Add deterministic/property-style boundary tests, recovery tests for missing/insufficient inputs, and authority-leak tests. No provider/model call is allowed because the mission policy is Provider OFF.

### WP5 — MJP, H2, L5, review, and archive

Generate the R1 Model Join Pack before Full Pack. Run an independent H2 evidence check, then one exact-head L5 validation. Request code review, repair findings in the same mission, and create exactly one canonical `SIMWAR-MOD-R1-CAN-SERVICE-FEASIBILITY-20260829-FINAL-results.zip` only after the Machine Merge Gate. Ordinary merge is allowed only if repository policy and exact checks permit it; no force/admin bypass. Independently reopen the ZIP and verify entries, JSON parsing, manifest hashes, forbidden-path absence, and archive SHA-256.

## Allowed implementation files

- New R1 shared contract/domain/service/route/UI/test files under existing `packages/shared-contracts`, `services/simulation-core`, `services/api`, `apps`, `contracts`, and `tests` layouts.
- The R1 plan and mission evidence under `docs/superpowers/plans` and a separate output/evidence directory.
- Minimal existing route registration or app composition files only when required for the R1 C0 consumer; avoid files modified by PR #468/#469/#470 where a new seam is possible.

## Forbidden changes

- `SettlementResult`, `state_true`, canonical Decision selection, replay hash inputs, formal truth writers, billing/entitlement, Postgres/RLS, provider activation, secrets, production/pilot/human validation claims, or Git history bypass.
- Reuse or mutation of external PR branches; duplicate W4/ESL finance/capital lifecycle work; a second runtime/store/registry/kernel/writer.
- Implicit `latest`, `current`, `default`, fallback, or unresolved source selection.
- Claiming OR-Tools, SimPy, PyBLP, OpenAI, or Hugging Face contribution without an actual runnable contribution in this mission.

## Validation

- Focused contract/unit/integration/UI tests for the R1 path.
- Relevant repository gates from the current `package.json`, including typecheck, lint/format, contract tests, unit/integration tests, build, and browser-smoke as available.
- Fresh exact-head Git status/diff, merge policy/check evidence, H2/L5 receipts, and independent ZIP verification.

## Recovery

If the product cannot satisfy exact binding, role-safe BFF, or single-writer constraints, stop as `EVIDENCE_INSUFFICIENT` with compact receipts. Preserve the worktree and all source files; do not broaden scope or create a successor mission.
