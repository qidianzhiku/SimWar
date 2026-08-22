# MOD-06 Model Governance Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one contract-first Model Governance Plane that represents ModelSpec, immutable ModelVersion identity, experiment/calibration evidence, approval, activation intent, retirement, and rollback history without creating a runtime writer or provider activation.

**Architecture:** The new `model-governance-plane.v1` JSON Schema is the canonical structural contract for model-governance records. Shared TypeScript types and pure helpers enforce exact references, a closed ModelVersion lifecycle, immutable approved content, one authority identity, and forbidden writers; they do not persist records or invoke a model. Existing `ParameterSetCommandService`, formal runtime resolution, settlement, Replay truth, and provider configuration remain unchanged.

**Tech Stack:** JSON Schema Draft 2020-12, Ajv2020, TypeScript, Vitest, deterministic table/property-style tests, npm workspaces.

**Spec:** V1.0 plan `SIMWAR-MOD-AGT-DUAL-TRACK-PLAN-V1.0-20260820`, SHA-256 `EF2104E90C04A811697749388999E31AE27BCFC457D7804FB765A10C68120260`, section `MOD-06｜One Model Governance Plane 与 ModelVersion 生命周期`; current source baseline is `origin/master@0f2cdcb88c4c660f2a1ef6389dc38e90a853ef81`.

## Global Constraints

- The governance plane has one canonical authority ID: `SIMWAR-MODEL-GOVERNANCE-PLANE`.
- Every model reference requires exact `model_version_id`, semver `version`, and lowercase 64-character `content_digest`; `latest`, `*`, `^`, and `~` are rejected.
- `no_implicit_latest` is always `true`; no resolver, registry fork, automatic successor, or default/current selection is added.
- `APPROVED` ModelVersion content is immutable; a later version uses a new identity and may point to `supersedes`.
- The contract records activation intent only: `activation_policy=NOT_AUTHORIZED`, `provider_calls=0`, `official_truth_writer=false`, and `runtime_authority=JSON_INTERNAL_ONLY`.
- MAIN Model Governance is the sole declared writer; AGT, SH, FE, Teacher, Student, provider, Simulation Core, ParameterSet, and frontend paths are forbidden writers.
- No change to `ParameterSet`, `SettlementResult`, canonical Decision, `state_true`, score/rank, replay hash inputs, database, provider configuration, lockfile, runtime resolver, or API route is allowed.
- CodeGraph is unavailable because `.codegraph/` is absent; no graph result may be claimed.
- No new dependency is allowed; `fast-check` is not configured, so property coverage uses deterministic table-driven cases over the pure helpers.

---

### Task 1: Write RED tests for the governance contract and lifecycle helpers

**Files:**

- Create: `tests/unit/model-governance.test.ts`
- Create: `tests/contract/model-governance-plane-contract.test.ts`
- Read: `contracts/schemas/model-governance-plane.v1.json` (must be absent at RED)
- Read: `packages/shared-contracts/src/model-governance.ts` (must be absent at RED)

**Interfaces:**

- Desired helper API: `createModelVersionReference(input)`, `canTransitionModelVersionStatus(current,next)`, `transitionModelVersionStatus(version,next)`, and `assertModelGovernanceWriter(writer)`.
- Desired contract: valid fixture accepts; invalid fixture rejects; exact references reject floating versions; approved content cannot be changed; forbidden writers fail; all lifecycle transitions are explicitly enumerated.

- [x] **Step 1: Write the unit RED cases**

  Import the not-yet-created shared module and assert these behaviors:

  ```ts
  it("rejects floating model references", () => {
    expect(() =>
      createModelVersionReference({
        content_digest: "a".repeat(64),
        model_version_id: "toy_logit_wellness_v1",
        version: "latest"
      })
    ).toThrow("MODEL_VERSION_REFERENCE_INVALID");
  });

  it("allows only the closed lifecycle transitions", () => {
    expect(canTransitionModelVersionStatus("DRAFT", "VALIDATED")).toBe(true);
    expect(canTransitionModelVersionStatus("APPROVED", "DRAFT")).toBe(false);
    expect(canTransitionModelVersionStatus("RETIRED", "APPROVED")).toBe(false);
  });

  it("rejects every non-MAIN governance writer", () => {
    expect(() => assertModelGovernanceWriter("AGT")).toThrow("MODEL_GOVERNANCE_WRITER_FORBIDDEN");
    expect(() => assertModelGovernanceWriter("MAIN_MODEL_GOVERNANCE")).not.toThrow();
  });
  ```

- [x] **Step 2: Write the schema RED case**

  Load the not-yet-created schema and valid/invalid fixtures with Ajv2020. Assert that the valid fixture preserves the canonical authority, provider-off boundary, exact references, and all eight entity collections; assert the invalid fixture rejects a floating `latest` reference and an official-truth-writer claim.

- [x] **Step 3: Run RED**

  Run `npx vitest run tests/unit/model-governance.test.ts tests/contract/model-governance-plane-contract.test.ts`.

  Expected: fail because `packages/shared-contracts/src/model-governance.ts` and `contracts/schemas/model-governance-plane.v1.json` do not exist. This failure is the required pre-implementation evidence.

### Task 2: Implement the shared types, exact reference, and lifecycle boundary

**Files:**

- Create: `packages/shared-contracts/src/model-governance.ts`
- Test: `tests/unit/model-governance.test.ts`

**Interfaces:**

- `ModelVersionReference`, `ModelSpecReference`, `ModelVersionStatus`, `ModelGovernanceWriter`, and the eight entity interfaces are exported from `model-governance.ts`.
- `createModelVersionReference(input): ModelVersionReference` returns a frozen exact reference or throws `ModelGovernanceError` with `MODEL_VERSION_REFERENCE_INVALID`.
- `canTransitionModelVersionStatus(current,next): boolean` follows `DRAFT -> VALIDATED -> FROZEN -> APPROVED -> ACTIVE -> RETIRED` plus `APPROVED -> RETIRED`; no reverse or in-place content transition is allowed.
- `transitionModelVersionStatus(version,next): ModelVersion` changes only the lifecycle status and throws `MODEL_VERSION_INVALID_TRANSITION` otherwise.
- `assertModelGovernanceWriter(writer): void` permits only `MAIN_MODEL_GOVERNANCE` and rejects the forbidden writer set.

- [x] **Step 1: Add the minimum typed model and policy constants**

  Keep all fields structural and JSON-compatible. Use exact digest validation, semver validation, `no_implicit_latest: true`, and explicit runtime/provider boundary values. Do not add a registry class or persistence port.

- [x] **Step 2: Run the RED unit file again**

  Run `npx vitest run tests/unit/model-governance.test.ts` and confirm the failure moves from module-not-found to schema/fixture failures only.

- [x] **Step 3: Implement the pure helpers**

  Freeze returned references and transitioned versions. Preserve every non-status ModelVersion field byte-for-byte by structural equality; do not permit approved content replacement.

- [x] **Step 4: Run GREEN and deterministic property cases**

  Run `npx vitest run tests/unit/model-governance.test.ts`. The table-driven cases must cover every status pair, every forbidden writer, malformed digest/version, and a round-trip exact reference.

### Task 3: Add the JSON Schema, fixtures, and contract gate registration

**Files:**

- Create: `contracts/schemas/model-governance-plane.v1.json`
- Create: `contracts/fixtures/model-governance-plane.valid.json`
- Create: `contracts/fixtures/model-governance-plane.invalid.json`
- Modify: `tests/contract/model-governance-plane-contract.test.ts`
- Modify: `scripts/contract-validation-facade.mjs`
- Modify: `package.json`

**Interfaces:**

- Root schema title/id: `ModelGovernancePlane`, `$id=https://simwar.local/contracts/schemas/model-governance-plane.v1.json`.
- Root required fields: `schema_version`, `authority`, `model_specs`, `model_versions`, `experiments`, `calibration_runs`, `approvals`, `activations`, `retirements`, `rollbacks`.
- Authority constants: `authority_id=SIMWAR-MODEL-GOVERNANCE-PLANE`, `sole_writer=MAIN_MODEL_GOVERNANCE`, `no_implicit_latest=true`, `activation_policy=NOT_AUTHORIZED`, `provider_calls=0`, `official_truth_writer=false`, `runtime_authority=JSON_INTERNAL_ONLY`.
- Every reference object requires `model_version_id`, exact `version`, and `content_digest`.
- `model_versions` contain immutable identity, `model_spec_reference`, artifact digest, compatibility references, lifecycle status, and optional exact `supersedes` reference.
- The root covers `ModelSpec`, `ModelVersion`, `Experiment`, `CalibrationRun`, `Approval`, `Activation`, `Retirement`, and `Rollback` in `$defs`/arrays; activation and rollback are governance records and must carry `runtime_activation=false`.

- [x] **Step 1: Add the schema and valid fixture**

  Include two model versions with distinct exact digests, one approved current version and one retired historical version, an experiment, successful calibration receipt, approval receipts, activation intent, retirement record, and an executed non-runtime rollback from the historical version to the current exact reference. Ensure no array element uses `latest` or omitted digest.

- [x] **Step 2: Add the invalid fixture**

  Mutate only contract-forbidden authority values: set `provider_calls` to `1` and `official_truth_writer` to `true`. The deterministic unit cases cover floating `latest` references through the shared helper, while the schema reference definition excludes them for every populated record.

- [x] **Step 3: Make the contract test assert cross-record invariants**

  Assert valid schema validation, one authority ID, no duplicate `(model_version_id, version)` identities, exact ModelSpec and ModelVersion resolution for every cross-record reference, no implicit-latest values, `approved` content identity stability, and runtime/provider-off fields. Assert invalid fixture rejection.

- [x] **Step 4: Register the contract in the existing gates**

  Add the schema and both fixtures to `schemaCases` and required contract files in `scripts/contract-validation-facade.mjs`; add `tests/contract/model-governance-plane-contract.test.ts` to the `test:contract` script in `package.json`. Do not change OpenAPI routes.

- [x] **Step 5: Run GREEN contract checks**

  Run `npx vitest run tests/unit/model-governance.test.ts tests/contract/model-governance-plane-contract.test.ts` and `npm run check:hidden-unicode`.

### Task 4: Write the MOD-06 evidence receipt and perform final verification

**Files:**

- Create: `docs/governance/mod-06-model-governance-authority-20260822.md`
- Verify: all MOD-06 files above

**Interfaces:**

- Evidence receipt records current baseline SHA, plan ID/SHA, exact changed paths, `MODEL_AUTHORITY_PASS` scope, CodeGraph unavailable status, provider/runtime boundary, and explicit non-proofs.

- [x] **Step 1: Write the receipt from current source**

  State that this PR creates a contract/type/state-machine gate only; it does not create a registry writer, runtime resolver, provider activation, model call, ParameterSet mutation, settlement writer, Replay writer, Human Validation, Pilot, or Production capability.

- [x] **Step 2: Run focused and repository gates**

  Run `npx vitest run tests/unit/model-governance.test.ts tests/contract/model-governance-plane-contract.test.ts`, `npm run test:contract`, `npm run typecheck`, `npm run lint`, `npm run check:hidden-unicode`, and `npm run format:check`. If a broad gate fails outside the allowlist, record it as an exact pending/unrelated limitation and do not mask it.

- [x] **Step 3: Check scope and truth boundaries**

  Run `git diff --check`, `git diff --name-only origin/master...HEAD`, and `git status --short`. Expected changed paths are exactly the plan, shared contract, schema, two fixtures, two tests, contract facade, package script, and governance receipt; no runtime, settlement, replay, database, provider, frontend, or lockfile path is present.

- [x] **Step 4: Commit one small PR**

  Stage only the named MOD-06 files and commit with `feat: add model governance plane contract`. The PR body must include Summary, Validation, and Scope Notes and must retain exact current-source and no-activation language.

## Self-review checklist

- [x] All eight MOD-06 governance entities are represented and cross-references resolve by exact identity.
- [x] No implicit latest/current/default reference is accepted.
- [x] Approved ModelVersion content is immutable and new versions use new identity/digest.
- [x] Activation and rollback records are parseable but explicitly non-runtime.
- [x] One authority ID and one sole writer are declared; negative writer tests pass.
- [x] ParameterSet authority, runtime resolver, settlement, Replay truth, provider, database, frontend, and OpenAPI paths are unchanged.
- [x] CodeGraph absence is recorded, not fabricated.
