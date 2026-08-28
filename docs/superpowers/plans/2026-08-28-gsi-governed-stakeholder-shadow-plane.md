# Governed Stakeholder Shadow Plane Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with TDD and verification gates. It is bound to fresh master `60b52d9d8734af6a809f52c7a8617a39dadddcb2`, tree `e4edc87dfd0ee6826d2399532ce2737e7a07bb3f`, and the mission ZIP SHA-256 `C328D0C86AC7C0B0D1455D349A52B96CD24AF8D783935ACDCD8D6A491EFCCDCA`.

**Goal:** Build one reproducible Provider-OFF Governed Stakeholder Intelligence product journey in which bounded stakeholder proposals become deterministic shadow signals and role-safe diagnostics without entering official simulation truth.

**Architecture:** Reuse W020's deterministic Agent Gateway, role-workflow context reader, JSON repository/store authority, W5/BFF route conventions, and existing Teacher/Student/Admin boundaries. Add one GSI contract, one deterministic application service, one route adapter, and role-safe UI projections over the same JSON store; do not add a writer, store, registry, provider, settlement path, or replay-truth input.

**Tech Stack:** TypeScript, npm workspaces, Node HTTP routes, shared-contracts, JSON Schema, Vitest, Playwright, Vite React, deterministic mock gateway.

**Spec:** `C:\Users\Marshall\Downloads\SimWar_MAIN_主线牵引优先并行_多宏任务开发包_V1.0_20260828.zip`, macro `MAIN-GSI-O1-GOVERNED-STAKEHOLDER-SHADOW-PLANE`, plus the current Owner preauthorization.

## Global Constraints

- One active GSI macro, one dedicated branch/worktree, and at most one Product PR.
- `PROVIDER=OFF`; deterministic TypeScript is the only executable path.
- `formal_writer_mutations=0`; GSI records are advisory/candidate evidence and never write official state, settlement, score, rank, canonical Decision, or replay truth.
- Reuse the existing role-workflow reader, W020 gateway, JSON store, W5 BFF conventions, and current role boundaries.
- Every public request, stored candidate, and projection has a closed TypeScript/JSON Schema/fixture contract with exact tenant, course, run, round, team, scenario, parameter-set, model-version, and model-artifact references.
- Reject implicit `latest`/`default`, cross-tenant/team contexts, private proposals in Student projections, and pre-publish or official-result fields.
- Failures follow reproduce → root cause → RED → minimal fix → GREEN → affected validation.
- Remote mutation is limited to one non-force push and one Product PR; merge only after machine gates and exact-head evidence are green.
- No force push, history rewrite, branch-protection bypass, automatic successor, Pilot, or Production action.

---

### Task 1: Freeze fresh source map and admission evidence

**Files:**

- External evidence directory: `C:\Temp\simwar-main-gsi-o1-admission-20260828`
- Read: `AGENTS.md`, `DEVELOPMENT_PLAN.md`, required architecture/contract docs, W020 source, repository ports, JSON adapter, and server.
- Write external receipts: `00-current-reality.json`, `01-source-map.json`, `02-admission-card.json`, `03-codegraph.json`, `04-graphify.json`, `05-vault.json`.

**Interfaces:**

- Consumes exact `origin/master` SHA/tree, current PR metadata, source files, package manifest, and the read-only ZIP.
- Produces a fresh admission bound to the exact current SHA/tree with `product_mutation_authorized=true`, `one_product_pr_authorized=true`, `provider=OFF`, and an explicit file allowlist.

- [ ] **Step 1: Confirm baseline and workspace boundary.** Run `git rev-parse origin/master`, `git rev-parse "origin/master^{tree}"`, `git status --short --branch`, and `git worktree list --porcelain`. Expected: isolated branch is clean at the exact master/tree; the primary inherited changes are untouched.
- [ ] **Step 2: Attempt both graph paths.** Run `codegraph explore "GSI W020 Agent Gateway role workflow repository route projection"` when `.codegraph` exists, otherwise record no index; run `graphify --help`. Report unavailable/stale/incomplete rather than claiming current graph truth.
- [ ] **Step 3: Write admission.** Record exact SHA/tree, source-map paths, no-second-writer/store/registry/provider predicates, fresh baseline, allowed files, and stop conditions in `02-admission-card.json`.

### Task 2: Define the GSI shared contract and schema

**Files:**

- Create `packages/shared-contracts/src/gsi-governed-stakeholder-shadow-plane.ts`
- Modify `packages/shared-contracts/src/index.ts`
- Create `contracts/schemas/gsi-governed-stakeholder-shadow-plane.v1.json`
- Create `contracts/fixtures/gsi-governed-stakeholder-shadow-plane.valid.json`
- Create `docs/contracts/gsi-governed-stakeholder-shadow-plane.md`
- Test `tests/contract/gsi-governed-stakeholder-shadow-plane-contract.test.ts`

**Interfaces:** Export `GSI_STAKEHOLDER_SHADOW_SCHEMA_VERSION = "gsi.governed.stakeholder.shadow.v1"`, `GSIProposal`, `GSIStakeholderType`, `GSIPlaneMode`, `GSIRequest`, `GSISignal`, `GSIResolverResult`, `GSIProjection`, `GSIReceipt`, `GSIRecord`, and runtime guards. A request requires exact IDs/versions, `plane_mode: "OFF" | "SHADOW"`, 1–5 bounded proposals, and an idempotency key. Proposals are restricted to customer/regulator/bank/employee/media, bounded intents, finite priority [0,1], and finite signed influence [-1,1]. Receipts include `formal_truth_write:false`, `provider:"OFF"`, `writes_official_truth:false`, stable digests, abstentions, and known limits.

- [ ] **Step 1: Write tests first.** Cover valid fixture, closed object keys, exact references, proposal count, numeric bounds, explicit plane mode, and rejection of `latest`, `default`, `state_true`, `SettlementResult`, `score`, `rank`, and `canonical_decision`.
- [ ] **Step 2: Verify RED.** Run `cmd.exe /d /s /c "npx vitest run tests/contract/gsi-governed-stakeholder-shadow-plane-contract.test.ts"`; expected failure is missing GSI contract/schema.
- [ ] **Step 3: Implement minimum shared types/schema** with `additionalProperties:false` at every public object boundary.
- [ ] **Step 4: Verify GREEN.** Run the focused test and `cmd.exe /d /s /c "npm run build -w @simwar/shared-contracts"`.

### Task 3: Add deterministic resolver and bounded signal adapter

**Files:**

- Create `services/api/src/gsi-stakeholder-shadow-plane-service.ts`
- Test `tests/unit/gsi-stakeholder-shadow-plane-service.test.ts`

**Interfaces:** Export `resolveGSIProposal(input): GSIResolverResult` and `createGSIStakeholderCandidate(actor, request, requestId): Promise<GSIReceipt>`. The resolver lexically orders proposals, clamps finite influence, emits bounded `GSISignal[]`, records abstentions, and returns a stable candidate digest. The service uses the existing W020 gateway only for role-safe advisory text.

- [ ] **Step 1: Write tests** for stable ordering, duplicate stakeholder proposals, clamp/abstain, zero-proposal rejection, explicit outside option, OFF/SHADOW parity, repeated digest equality, and no official truth fields.
- [ ] **Step 2: Verify RED** with `cmd.exe /d /s /c "npx vitest run tests/unit/gsi-stakeholder-shadow-plane-service.test.ts"`.
- [ ] **Step 3: Implement minimal deterministic behavior.** OFF and SHADOW candidate values are byte-equivalent; requested mode is metadata only. Do not use provider, randomness, or unbounded free-form source in calculation.
- [ ] **Step 4: Verify GREEN** and add property-style bound/order cases without changing product scope.

### Task 4: Persist GSI candidates through the existing JSON authority

**Files:**

- Modify `services/api/src/repository-ports.ts`, `services/api/src/store.ts`, `services/api/src/json-repository-adapter.ts`, `services/api/src/server.ts`, and the GSI service.
- Test `tests/unit/gsi-stakeholder-shadow-plane-persistence.test.ts`

**Interfaces:** Add one GSI candidate collection/port backed by the same `SimWarStore` and `persist()` boundary. Provide `list(tenantId)`, `get(tenantId,candidateId)`, and `append(record)` for advisory/candidate records only. Existing W020 records remain unchanged.

- [ ] **Step 1: Write tests** for round-trip, idempotent reuse, changed-digest conflict, cross-tenant denial, persist rollback, unchanged official collections, and `writes_official_truth:false`.
- [ ] **Step 2: Verify RED** with `cmd.exe /d /s /c "npx vitest run tests/unit/gsi-stakeholder-shadow-plane-persistence.test.ts"`.
- [ ] **Step 3: Wire the existing JSON adapter** with the same rollback pattern as W020; do not add migrations, Postgres activation, second provider, or second writer.
- [ ] **Step 4: Verify GREEN** plus `npx vitest run tests/unit/w020-advisory-service.test.ts tests/unit/agent-gateway.test.ts`.

### Task 5: Expose role-safe BFF routes and integration behavior

**Files:**

- Create `services/api/src/routes/gsi-stakeholder-shadow-plane-routes.ts`
- Modify `services/api/src/server.ts`
- Create `tests/integration/gsi-stakeholder-shadow-plane-endpoint.test.ts`
- Create `contracts/openapi/gsi-governed-stakeholder-shadow-plane.openapi.yaml`

**Interfaces:**

- Teacher: `POST /api/v1/bff/teacher/gsi/candidates` creates; `GET /api/v1/bff/teacher/gsi/candidates/:id` returns diagnostics/provenance.
- Student: `GET /api/v1/bff/student/gsi/candidates/:id` returns only published role-safe bounded signal summaries and abstentions for the authenticated team/role; it omits raw proposals, private source IDs, tenant-wide audit, and official state.
- Admin: `GET /api/v1/bff/admin/gsi/audit?candidate_id=:id` returns tenant-safe provenance/audit without raw prompts/private payloads.

- [ ] **Step 1: Write integration/security tests** for real dispatch, role authorization, tenant/team checks, publication boundary, idempotency, protected-field omission, and method/path rejection.
- [ ] **Step 2: Verify RED** with `cmd.exe /d /s /c "npx vitest run tests/integration/gsi-stakeholder-shadow-plane-endpoint.test.ts"`.
- [ ] **Step 3: Implement route adapter** limited to parsing, authorization, service calls, envelopes, and error mapping.
- [ ] **Step 4: Verify GREEN** with focused integration, schema contract, typecheck, and existing contract suite.

### Task 6: Add the visible Teacher/Admin/Student product journey

**Files:**

- Create `apps/teacher/src/GovernedIntelligenceWorkspace.tsx` and `apps/admin/src/GovernedIntelligenceAuditPanel.tsx`
- Modify the three app entry surfaces and relevant stylesheets.
- Create `tests/unit/gsi-governed-intelligence-workspace.test.tsx` and `tests/e2e-ui/gsi-governed-stakeholder-shadow-plane.spec.ts`

**Interfaces:** Teacher submits one bounded proposal set using exact context and displays candidate digest, signals, abstentions, Provider OFF, and known limits. Admin displays tenant-safe provenance, plane mode, and zero official writes. Student shows only the published role-safe explanation. All use real BFF endpoints, existing workbench/layout primitives, and explicit loading/error/recovery states.

- [ ] **Step 1: Write component tests first** for controls, pending/error/recovery, digest/provenance, limits, and protected-field absence.
- [ ] **Step 2: Verify RED** with `cmd.exe /d /s /c "npx vitest run tests/unit/gsi-governed-intelligence-workspace.test.tsx"`.
- [ ] **Step 3: Implement the smallest responsive surfaces** with no client-side truth calculation or new persistence.
- [ ] **Step 4: Verify GREEN/build/browser** with focused Vitest, teacher/admin builds, and `npx playwright test tests/e2e-ui/gsi-governed-stakeholder-shadow-plane.spec.ts`; target route mocks must be zero.

### Task 7: Run full local gates and same-mission rework

**Files:** Only exact source-map files affected by a reproduced GSI failure; external evidence under `C:\Temp\simwar-main-gsi-o1-validation-20260828`.

- [ ] Run focused unit/contract/integration/browser suites, hidden-Unicode, direct-store boundary, typecheck, build, and security audit.
- [ ] Run `npm run check:hidden-unicode`, `npm run check:direct-store-boundaries`, `npm run lint`, `npm run typecheck`, `npm run test:contract`, `npm test`, `npm run build`, and `npm run security:audit` through `cmd.exe /d /s /c`.
- [ ] For every finding, preserve failure output, add a RED regression test, make the minimal fix, rerun the affected gate, and update evidence; do not create a separate remediation mission or weaken a gate.

### Task 8: Commit, push, Product PR, and remote machine-gate rework

**Files:** Git metadata and external evidence under `C:\Temp\simwar-main-gsi-o1-pr-20260828`.

- [ ] Verify `git status --short`, `git diff --stat`, `git diff --check`, and explicit changed-file allowlist; stage named files only.
- [ ] Commit one coherent Conventional Commit with Summary, Validation, Scope Notes, Known Limits, and exact file list.
- [ ] Perform one non-force push to the dedicated branch and create/update one Product PR.
- [ ] Reproduce and repair any CI/review/browser/bundle/contract finding inside this macro; use only the remaining push budget.

### Task 9: Independent H2, exact-head L5, merge, post-merge H3/L6, and closure

**Files:** External evidence under `C:\Temp\simwar-main-gsi-o1-h2-20260828`, `C:\Temp\simwar-main-gsi-o1-l5-20260828`, and `C:\Temp\simwar-main-gsi-o1-postmerge-20260828`; final archive `C:\Users\Marshall\Downloads\SIMWAR-MAIN-GSI-O1-GOVERNED-STAKEHOLDER-SHADOW-PLANE-20260828-FINAL-results.zip`.

- [ ] Create a clean detached H2 checkout at the Product PR head with fresh fixtures/isolated ports; record SHA/tree, clean status, route mocks `0`, and limits.
- [ ] Run exact-head L5 including tests, contracts, browser/accessibility assertions, bundle measurements, security, direct-store boundary, and evidence packaging.
- [ ] Read PR/checks fresh and perform one normal non-force merge only when the machine merge gate is proven; record actual merge SHA and protected-master reachability.
- [ ] Run fresh post-merge H3/L6 at the actual merge SHA/tree; update capability tombstone/carrier, validation freshness, mission memory/latest handoff, and all known limits.
- [ ] Build and independently audit a final ZIP containing receipts, changed files, PR/merge/H2/L5/H3 evidence, graph/Vault status, known limits, efficiency ledger, `FINAL-REPORT.md`, `HANDOFF.md`, `HANDOFF.json`, `RESULT_MANIFEST.json`, `SHA256SUMS.txt`, and `ARCHIVE-VERIFICATION.json`.

## Self-Review

- Spec coverage: Tasks 1–2 cover fresh reality, admission, contract, graph, and Vault limits; Tasks 3–6 cover proposal → resolver → signal → candidate → role-safe projection; Tasks 7–9 cover TDD rework, remote gates, H2/L5, merge, H3/L6, closure, and portable evidence.
- Placeholder scan: no step relies on TBD/TODO, vague handling, or an undefined neighboring interface.
- Type consistency: all service/route outputs use named GSI shared-contract types; persistence remains inside one JSON store boundary; W020 remains a separate discriminator.
- Scope check: this is one integrated GSI product capability. N+2 and N+3 remain lookahead only and are not started automatically.
