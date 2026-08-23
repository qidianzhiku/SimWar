# SH-M3 W5 Operating World R2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for implementation checkpoints, `superpowers:test-driven-development` for every behavior change, and `superpowers:verification-before-completion` before claiming completion.

**Goal:** Deliver the Shanghai SH-16~19 Operating World product loop by extending the existing W5 governed-model lifecycle and MOD-06/W4 official-consumer boundaries: Teacher configures and freezes an exact versioned environment, Student receives a role-safe exact-context brief, Admin audits binding/readiness/effects, and at least one deterministic capital/construction input reaches the existing W4 sole-writer seam without creating a second truth engine.

**Architecture:** `EXTEND_CURRENT_W5`. Add versioned Operating World descriptors, family-specific validation, non-official deterministic previews, immutable `DRAFT -> VALIDATED -> FROZEN -> BOUND` lifecycle, and exact runtime binding to the existing W5 governed-model service/store. Reuse the existing W4 capital-action/New Project admission seam as the only official consumer. Expose all new UI data through real BFF routes; keep frontend, previews, shadow effects, information-only effects, and AI advisory output outside settlement truth. Reuse the M2-P5 exact-context journey for Student projection and enforce tenant/role/team/round filtering server-side.

**Tech Stack:** TypeScript, npm workspaces, shared contracts, JSON Schema/OpenAPI conventions already in the repository, Vitest, React/Vite, native HTTP BFF routes, existing JSON/memory repositories, and Playwright real-BFF browser tests.

**Spec:** Primary source is `SIMWAR-SH-M3-W5-OPERATING-WORLD-MACRO-R2-20260823` from `C:/Users/Marshall/Downloads/SimWar_SHM3_W5_OperatingWorld_Macro_R2_Cleanroom_Codex宏任务提示词_V2.0_20260823.docx`. The second DOCX is routing/acceptance context, not a separate deliverable. Current source, contracts, tests, and exact Git head outrank both documents when they conflict.

## Global Constraints

---

- Preserve the single simulation kernel, MOD-06 governance plane, W5 model studio, W4 sole writer, canonical decision path, settlement, replay truth hash, and no-implicit-latest binding.
- Shanghai is a vertical reference package, not a second runtime, registry, settlement authority, or standalone application.
- Operating World preview is never a formal `PREVIEWED` lifecycle state; preview receipts are non-official and must prove zero official writes.
- Frozen descriptors and bindings are immutable; conflicting rebinding fails closed and idempotent repeat binding returns the same identity.
- Valid effects are classified as `OFFICIAL_CONSUMER_ELIGIBLE`, `SHADOW_ONLY`, `INFORMATION_ONLY`, or `BLOCKED`. Only a proven W4 capital/construction consumer may enter official admission.
- Student responses must exclude state truth, private coefficients/manifests, teacher previews, other teams, unpublished outcomes, score/rank/settlement, and private governance metadata.
- Use only explicitly scoped files; never use `git add -A`; do not touch the original dirty worktree.
- Local branch/commit is in scope. Push, PR creation, remote merge, production, provider/connector authorization, and sensitive-state mutation are out of scope unless separately authorized by the user.

## Work Packages

### 1. Current-reality and baseline audit

- Read the current W5 governed-model contracts/service/routes/store wiring, W4 enterprise-state/capital-action/New Project seam, M2-P5 exact-context contracts/service/routes, and their focused tests.
- Verify current Git head and identify the smallest compatible extension points; record CodeGraph as unavailable/stale when no active-worktree index exists.
- Run focused existing tests before changing behavior and capture baseline failures/limits.

### 2. Contract-first Operating World model

- Add shared typed descriptors for SH-16, SH-17, SH-18, SH-19, source provenance/freshness/confidence/Known Limits, effect classification, preview receipt, exact binding, and role-safe projections.
- Use versioned references and bounded fields; reject arbitrary runtime key/value mutation, invalid units, invalid ranges, missing provenance, stale/conflicting source, and incomplete family payloads.
- Add contract fixtures/schema tests following the repository's existing W5 conventions.

### 3. Lifecycle, preview, freeze, and bind

- Add service behavior for draft creation/update, validation, deterministic LOW/BASE/HIGH preview with explicit seed and digest, freeze, exact Course/Run/Round/ParameterSet/ScenarioPackage/ModelVersion binding, idempotency, and fail-closed conflict handling.
- Prove preview has no official writes, does not create a new lifecycle state, and cannot mutate settlement/replay/score/rank/canonical decision truth.
- Prove frozen data and exact binding are immutable and do not resolve implicit latest versions.

### 4. W4 official consumer boundary

- Map deterministic capital and/or construction inputs into the existing W4 admission/consumer seam only after the existing MOD-06 and canonical admission checks.
- Reject or retain shadow/information/blocked effects without official mutation; prove no second Finance/Project/EnterpriseState writer and unchanged replay identity when Operating World is not in the truth manifest.
- Add focused unit/integration/security-style tests for sole-writer count, effect classification, admission failures, and safe official effect.

### 5. Teacher, Student, and Admin BFF/UI loop

- Teacher: configure each family, show provenance and Known Limits, validate, preview, freeze, and exact-bind through the real BFF.
- Student: reuse exact tenant/course/activity/role/run/team/round context and expose only the safe Operating World Brief projection.
- Admin: read-only exact binding/readiness/effect/model/parameter/scenario/freshness/stale/conflict/digest audit with tenant isolation.
- Add browser tests against a real local BFF with mocks disabled, covering happy path, negative validation/authorization/stale/conflict cases, and recovery/reload.

### 6. Verification and handoff

- Run targeted contract/unit/integration tests first, then relevant `npm run typecheck`, `npm test`, `npm run test:contract`, `npm run build`, formatting/hidden-unicode/lint gates that exist in `package.json`, and real-BFF Playwright tests.
- Perform exact-head `git diff --check`, inspect the final diff and status, and request/perform code review before any local commit.
- Create one focused local Conventional Commit only if all locally verifiable acceptance criteria pass. Report external PR/merge/post-merge as `NOT_AUTHORIZED` rather than implying completion.

## Acceptance Criteria

1. `DRAFT -> VALIDATED -> FROZEN -> BOUND` is executable and covered by deterministic tests.
2. SH-16~19 valid/invalid payloads, provenance, freshness, confidence, Known Limits, and effect classes are contract-tested.
3. Preview receipts include input digest, variant, seed, classification, predicted/diagnostic outputs, uncertainty, Known Limits, `no_official_write=true`, and receipt digest.
4. Frozen/bound exact references are immutable, no-implicit-latest, idempotent on repeat, and fail closed on conflict.
5. At least one capital/construction input is consumed through the existing W4 sole-writer seam; no second writer or settlement bypass exists.
6. Teacher/Student/Admin real-BFF flows enforce role and tenant boundaries; Student receives only the allowed projection.
7. Negative and recovery behavior is tested, and browser evidence uses mocks=0.
8. Final report distinguishes `VERIFIED`, `NOT_PROVEN`, `BLOCKED`, `NOT_AUTHORIZED`, and structural-only results; no automatic successor task starts.
