# Course-bound Model Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task, with a named Luna worker, isolated file scope, task review, and verification before completion.

**Goal:** Deliver the isolated MQ1 MOD support capability for deterministic, exact-bound, non-official qualification of a CoursePackage, ScenarioPackage, ParameterSet, ModelVersion, and source-evidence bundle. The capability must emit role-safe qualification states and evidence without formal activation, official truth writes, settlement writes, ParameterSet writes, replay-truth writes, a second registry/store/runtime, or provider calls.

**Architecture:** Add a pure compiler to `@simwar/mod-support`. It will accept immutable structured binding evidence, validate every reference and cross-package relationship, classify the candidate fail-closed, and produce deterministic digests plus MJP fixture evidence. The compiler is deliberately not connected to the existing CourseFactory service, API routes, shared-contract index, BFF, UI, formal model-governance writer, or simulation runtime because the fresh MAIN Product Clock (#476) has no explicit integration lease and its paths are active. Existing generic model qualification and MOD compiler behavior are reuse/tombstone evidence, not a substitute for the new five-way binding semantics.

**Tech Stack:** TypeScript ESM, Node `crypto` SHA-256, Vitest, Ajv 2020 JSON Schema validation, npm workspaces, Prettier/ESLint, existing `@simwar/mod-support` package.

**Spec:** `SIMWAR-MOD-ECF-MQ1-COURSE-BOUND-MODEL-QUALIFICATION-V2.0-20260830`; bounded package prompt `prompts/01_SIMWAR_MOD_MQ1_COURSE_BOUND_MODEL_QUALIFICATION.md`; result status is support-level unless current MAIN C0 consumption is independently proven.

## Global Constraints

- Work only in the clean worktree `D:\codex\worktrees\simwar-mod-ecf-mq1-20260830` on branch `codex/mod-ecf-mq1-course-qualification-20260830`.
- Do not modify `apps/**`, `services/api/**`, `contracts/openapi/**`, `packages/shared-contracts/**`, `services/simulation-core/**`, `plugins/**`, `#476` CourseFactory files, or the current formal model-governance writer.
- Do not read or execute the MQ2/MQ3 prompts unless MQ1 current MAIN consumption is proven by a fresh receipt or an explicit continuation token already present in current Control. The current plan ends at the MQ1 gate if that proof is absent.
- Provider remains OFF. The compiler has no network, model, filesystem, database, registry, settlement, replay-truth, or formal activation side effect.
- Every exact reference must contain a concrete id, resource type, semver, and lowercase SHA-256 digest. Reject `latest`, `current`, `default`, `fallback`, `next`, `unresolved`, `wildcard`, ranges, and missing fields before candidate computation.
- The output is candidate/support evidence only. `formal_binding_eligible`, `activation_permitted`, `official_truth_write`, `settlement_write`, `parameter_set_formal_write`, and `replay_truth_write` are always false; `formal_writer` is `NONE`.
- Student-safe projection must not contain provenance digests, raw source references, tenant identifiers, private/raw evidence, official truth fields, settlement fields, score, or rank.
- Preserve all inherited user changes in the controller worktree; never reset, clean, or overwrite unrelated files.

---

## 1. Freeze the implementation boundary and evidence surface

**Files:** no product-code changes; plan/evidence only.

1. Record current clean-worktree base and the fresh #476/#468/#471/#475 path sets in the MQ1 evidence pack. Treat package receipts as historical snapshots and the fresh GitHub/source readings as authority.
2. Record current generic reuse: `services/api/src/model-qualification-service.ts` and `packages/shared-contracts/src/model-qualification.ts` provide bounded diagnostic/no-write patterns, while `packages/mod-support/src/index.ts` and `next6-consumption.ts` provide stable digest/exact-ref/role-safe/MJP patterns. Explicitly record the missing five-way exact binding as the MQ1 delta.
3. Record the no-lease/no-current-consumption condition as an expected MQ1 join gate. Do not add a route or UI consumer to manufacture C0.

## 2. Add the pure course-bound qualification compiler

**File:** `packages/mod-support/src/course-bound-model-qualification.ts`

1. Define and export the exact input types:

   ```ts
   export type CourseBoundQualificationStatus =
     | "ELIGIBLE_FOR_SHADOW_WITH_LIMITS"
     | "NOT_ELIGIBLE"
     | "NOT_COMPUTABLE"
     | "REBASE_REQUIRED";

   export interface CourseBoundQualificationInput {
     readonly mission_id: string;
     readonly consumer_id: string;
     readonly tenant_id: string;
     readonly requested_at: string;
     readonly course_package: CoursePackageQualificationBinding;
     readonly scenario_package: ScenarioPackageQualificationBinding;
     readonly parameter_set: ParameterSetQualificationBinding;
     readonly model_version: ModelVersionQualificationBinding;
     readonly source_evidence: SourceEvidenceQualificationBinding;
     readonly mjp_fixtures: readonly CourseBoundQualificationFixtureInput[];
   }
   ```

   Each binding carries a closed `reference` (`resource_id`, `resource_type`, `version`, `content_digest`) plus only the semantic fields needed to test ownership and compatibility. Course references include exact scenario and parameter references; scenario references include its exact parameter reference and declared model family/schema; ParameterSet and ModelVersion include model family, feature-mapper version, solver/schema compatibility, and lifecycle status; source evidence includes course/tenant binding, feature schema digest, rights, freshness, observed/expiry timestamps, and no raw evidence payload.

2. Define an output that includes `schema_version = "course-bound-model-qualification.v1"`, deterministic `candidate_digest`, the five exact refs, `no_implicit_latest: true`, state transition `STATE_A -> STATE_B`, candidate status, stable reason codes, compatibility checks, `known_limits`, role-safe projections, MJP digests, and an authority map. Candidate fields must explicitly include `formal_binding_eligible: false`, `activation_permitted: false`, and `official_truth_write: false`.

3. Implement stable canonical serialization and SHA-256 helpers. Validate input before deriving any candidate:
   - nonblank mission/consumer/tenant identities and ISO UTC request time;
   - exact resource types and semver/digest format for all five refs;
   - rejection of floating/reserved reference tokens;
   - unique fixture ids and at least four fixtures for MJP PASS;
   - exact tenant agreement across all bindings;
   - course’s scenario/parameter refs equal the supplied scenario/parameter refs;
   - scenario’s parameter ref equals the supplied parameter ref;
   - ParameterSet and ModelVersion model family/feature mapper/schema versions are compatible;
   - source evidence belongs to the exact course/tenant and has an exact feature schema digest;
   - rights/freshness/expiry and model lifecycle state are classified fail-closed.

4. Use deterministic classification rules:
   - malformed/floating/missing evidence or impossible cross-reference state → `NOT_COMPUTABLE` or `REBASE_REQUIRED` with reason codes;
   - valid exact bindings with tenant/reference/compatibility/rights/freshness failures → `NOT_ELIGIBLE` with every applicable reason;
   - complete exact compatibility and admissible source/model evidence → `ELIGIBLE_FOR_SHADOW_WITH_LIMITS`, never formal activation.

5. Execute each fixture through the same evaluator, returning `input_digest`, `result_digest`, expected/observed status, and `executed: true`. If expected and observed status differ, throw an explicit MJP mismatch error. Do not accept fixture claims as evidence without recomputing them.

6. Export `assertCourseBoundQualificationResult` and a type guard. Verify candidate digest, exact refs, state, authority flags, role visibility, fixture count/id alignment, and no forbidden student fields. Freeze the returned object to prevent post-compilation mutation.

## 3. Expose only the MOD package entrypoint

**File:** `packages/mod-support/src/index.ts`

1. Add exactly one export: `export * from "./course-bound-model-qualification.js";`.
2. Do not change existing R1–R6 macro configuration or current generic compiler behavior. This keeps the new carrier isolated and avoids modifying shared hot files owned by active MAIN work.

## 4. Freeze the machine contract and fixtures

**Files:**

- `contracts/schemas/course-bound-model-qualification.v1.json`
- `contracts/fixtures/course-bound-model-qualification.valid.json`
- `contracts/fixtures/course-bound-model-qualification.invalid.json`

1. Write a closed Draft 2020-12 schema with `additionalProperties: false` at each structured boundary. Require the exact five refs, candidate status, reason codes, compatibility checks, authority map, role projections, MJP evidence, state transition, known limits, and SHA-256 digests.
2. The schema must prohibit `latest/current/default/fallback/next/unresolved/wildcard` via patterns or the compiler contract test; require `no_implicit_latest: true`; and require all official/formal/settlement/provider flags to remain false/OFF.
3. Add a valid fixture generated from a deterministic complete input. It must validate as `ELIGIBLE_FOR_SHADOW_WITH_LIMITS` and contain at least four recomputed fixtures covering eligible, tenant/reference mismatch, stale/expired evidence, and model compatibility failure.
4. Add an invalid fixture derived from the valid result with an authority violation and a floating exact reference; the contract test must prove both fail validation.

## 5. Add RED-first unit and contract tests

**Files:**

- `tests/unit/course-bound-model-qualification.test.ts`
- `tests/contract/course-bound-model-qualification-contract.test.ts`

1. Before implementation, add tests that fail because the new module/export does not exist. Use a deterministic base input with five concrete references.
2. Unit coverage must include:
   - complete exact bundle reaches `ELIGIBLE_FOR_SHADOW_WITH_LIMITS` with `STATE_A -> STATE_B`;
   - exact course/scenario/parameter/model/source refs are all emitted and `no_implicit_latest` is true;
   - same structured input and deep clone produce byte-equivalent result/digest;
   - course/scenario/parameter mismatch produces `NOT_ELIGIBLE` with precise reason codes;
   - tenant mismatch produces `NOT_ELIGIBLE` and no cross-tenant projection;
   - stale, expired, restricted, and missing source evidence fail closed;
   - model family/feature mapper/schema mismatch produces `REBASE_REQUIRED`;
   - floating `latest`/`current`/range reference throws before candidate compilation;
   - fewer than four or tampered MJP fixtures fail/withhold PASS truthfully;
   - authority flags remain false and no output contains formal truth/settlement/score/rank fields;
   - student-safe projection excludes all raw refs, digests, tenant data, and source provenance.

3. Contract coverage must validate the checked-in valid fixture using Ajv 2020, reject the invalid fixture, validate a generated result, and assert semantic consistency between status/reason codes/authority/MJP fields.

## 6. Document the carrier and reuse/tombstone boundary

**File:** `docs/contracts/course-bound-model-qualification-contract.md`

Document State A/State B, exact reference grammar, compatibility matrix, failure taxonomy, MJP fixture semantics, role visibility, authority/writer/store/runtime map, existing R2/MOD reuse, explicit non-duplication with #476/#468/#471/#475, and the C1/MJP-ready limitation until MAIN provides a real consumption receipt. State that the compiler is a candidate semantic carrier and cannot activate a ModelVersion or write official truth.

## 7. Review, repair, and verify

1. Use the named Luna worker `luna_mq1_course_bound_qualification` for the isolated implementation task and record the base commit, allowed files, validation commands, and report path in the progress ledger. The worker must not touch forbidden paths or spawn further agents.
2. Review the worker diff against this plan. Repair all Critical/Important findings in the same MQ1 task; do not create successor missions. If the worker is unavailable, execute the same bounded file plan locally and record the unavailable-worker limit.
3. Run focused tests first:

   ```powershell
   npx.cmd vitest run tests/unit/course-bound-model-qualification.test.ts tests/contract/course-bound-model-qualification-contract.test.ts
   npm.cmd run build -w @simwar/mod-support
   ```

4. Run related repository gates after focused tests pass:

   ```powershell
   npm.cmd run build:test-prerequisites
   npm.cmd run typecheck
   npm.cmd run lint -- --quiet
   npm.cmd run format:check
   npm.cmd run test:contract
   npm.cmd test
   ```

   Record exact failures and separate focused MQ1 evidence from unrelated repository baseline failures. Do not claim the whole repository is green unless every invoked gate passes.

## 8. Assemble the MQ1 evidence and apply the chain gate

Create a canonical MQ1 pack containing current reality, capability census/tombstone/reuse proof, demand/overlap/authority maps, model contract and exact refs, numerical/MJP evidence, MJP, full integration-ready pack, product consumption receipt or truthful missing receipt, integration debt, validation freshness, tool contribution, method delta, known limits, and handoff.

Re-read fresh current MAIN consumption state after implementation. If the new candidate was not consumed by the exact current CourseFactory/Model Control seam as `CONSUMED_SHADOW` or `CONSUMED_DIAGNOSTIC`, mark MQ1 `FULL_PACK_COMPLETE`/`JOIN_WITH_LIMITS` or `INTEGRATION_READY` as applicable, set MQ2 and MQ3 to `NOT_STARTED_BY_GATE`, create `PROGRAM_HANDOFF.md` and `PROGRAM_HANDOFF.json`, and stop. Do not read the MQ2 or MQ3 prompts, start a successor, or claim `PRODUCT_COMPLETE`.

Package exactly one:

`SIMWAR-MOD-ECF-MQ1-COURSE-BOUND-MODEL-QUALIFICATION-V2.0-20260830-FINAL-results.zip`

Independently verify ZIP readability (`testzip` equivalent), duplicate/unsafe paths, required member presence, all JSON parsing, manifest/checksum agreement, semantic consistency, and final SHA-256. Preserve the input package and all unrelated repository/download files.
