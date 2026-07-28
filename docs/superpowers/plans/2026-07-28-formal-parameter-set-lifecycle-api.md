# Formal ParameterSet Lifecycle API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the persisted formal ParameterSet lifecycle through a tenant-scoped, audited platform-admin HTTP API.

**Architecture:** `createApiRuntime` retains the persisted `ParameterSetCommandService` that it already composes for formal Run binding. The HTTP route parses a draft or immutable reference and delegates every state change to that exact service. Shared permissions and the OpenAPI document describe the ingress; no route accesses formal JSON collections directly.

**Tech Stack:** TypeScript, Node HTTP server, npm workspaces, Vitest, OpenAPI YAML.

## Global Constraints

- The JSON adapter remains the active runtime.
- `ParameterSetCommandService` remains the only formal writer.
- Exact references include tenant, id, version, and content digest.
- Only `platform_admin` receives `parameter_set:manage`.
- No ScenarioPackage, PluginRelease, Run, Replay, settlement, UI, PostgreSQL, dependency, lockfile, or workflow change.

---

### Task 1: Add the API permission and contract

**Files:**
- Modify: `packages/shared-contracts/src/index.ts`
- Modify: `contracts/openapi/p0-api.openapi.yaml`

**Interfaces:**
- Produces: `PermissionKey` value `parameter_set:manage` granted only to `platform_admin`.
- Produces: five documented lifecycle endpoints and their request/response schemas.

- [ ] **Step 1: Specify the API surface in the OpenAPI contract**

Add the draft and exact-reference lifecycle paths described in the design. The
transition body must require `tenant_id`, `parameter_set_id`, `version`, and
`content_digest`; approval must also require `approval_id`.

- [ ] **Step 2: Add the permission to shared contracts**

Add `parameter_set:manage` to `PermissionKey` and only the platform-admin
role permission matrix.

- [ ] **Step 3: Verify contract formatting and type surface**

Run: `npm run typecheck && npm run format:check`

Expected: both commands pass before route code is added.

### Task 2: Prove the missing HTTP lifecycle with a RED integration test

**Files:**
- Create: `tests/integration/formal-parameter-set-lifecycle-endpoint.test.ts`

**Interfaces:**
- Consumes: default API runtime and seeded platform/tenant administrator users.
- Produces: a regression suite for persisted draft-to-approved lifecycle, audit, role denial, and invalid transitions.

- [ ] **Step 1: Write failing lifecycle tests**

Exercise draft creation, validation, freezing, approval, and retirement over
HTTP. Assert the persisted authority registry contains the expected latest
snapshot and approval record. Add negative cases for tenant-admin access and
approving a draft before it is frozen.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/formal-parameter-set-lifecycle-endpoint.test.ts`

Expected: FAIL because lifecycle endpoints do not exist.

### Task 3: Implement the smallest audited command ingress

**Files:**
- Modify: `services/api/src/server.ts`
- Test: `tests/integration/formal-parameter-set-lifecycle-endpoint.test.ts`

**Interfaces:**
- Consumes: authenticated request context, `parameter_set:manage`, and `runtime.formalParameterSets`.
- Produces: audited POST lifecycle responses without direct formal-store writes.

- [ ] **Step 1: Retain the composed command service and parse structured request bodies**

Add `formalParameterSets` to `ApiRuntime`, assigned from the same
`formalAuthorityRuntime.parameterSets` instance used to construct formal Run
binding authorities. Create server-local parsers that reject missing, blank,
or non-object fields. Derive the command actor from `CurrentUser`, request
tenant, and correlation id; do not trust actor or tenant fields to select
another tenant.

- [ ] **Step 2: Delegate each transition to the command service**

Use `createDraft`, `validate`, `freeze`, `approve`, and `retire` exactly once
per route. Append a normal audit record only after the command completes.

- [ ] **Step 3: Run the red suite to verify it turns green**

Run: `npx vitest run tests/integration/formal-parameter-set-lifecycle-endpoint.test.ts`

Expected: PASS with lifecycle, authorization, invalid-transition, persistence,
and audit assertions satisfied.

### Task 4: Run the focused and affected validation set

**Files:**
- Test: `tests/integration/formal-parameter-set-lifecycle-endpoint.test.ts`
- Test: `tests/unit/parameter-set-authority-contract.test.ts`
- Test: `tests/unit/parameter-set-command-service.test.ts`

- [ ] **Step 1: Run focused authority checks**

Run: `npx vitest run tests/integration/formal-parameter-set-lifecycle-endpoint.test.ts tests/unit/parameter-set-authority-contract.test.ts tests/unit/parameter-set-command-service.test.ts`

Expected: PASS.

- [ ] **Step 2: Run repository gates**

Run: `npm run check:hidden-unicode && npm run check:direct-store-boundaries && npm run lint && npm run typecheck && npm test && npm run test:contract && npm run build && git diff --check`

Expected: PASS, except pre-existing failures must be reported without being
masked or repaired outside scope.

### Task 5: Commit and open one reviewable PR

**Files:**
- Modify only the files named in Tasks 1-3 plus these design records.

- [ ] **Step 1: Review the exact diff and clean status**

Run: `git diff --check && git status --short`

Expected: only the planned files are modified.

- [ ] **Step 2: Commit the focused increment**

Run: `git add <planned files> && git commit -m "feat: add formal ParameterSet lifecycle API"`

- [ ] **Step 3: Push once and create one non-draft PR**

Include Summary, Validation, and Scope Notes. State that the change creates
governance ingress only and does not activate scenario runtime behavior.

- [ ] **Step 4: Perform one immediate check readback**

Read the PR head and current check state once. If checks are pending, report
them and stop; do not rerun workflows or merge.
