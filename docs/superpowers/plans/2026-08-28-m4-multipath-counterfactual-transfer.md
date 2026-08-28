# M4 Governed Multi-Path Counterfactual Transfer Implementation Plan

## Goal

Deliver `MAIN-DIV-O1-GOVERNED-MULTIPATH-COUNTERFACTUAL-TRANSFER` as one
reproducible product vertical slice on the exact post-M3 master. A teacher can
request two or three exact-history alternative paths from one published
official outcome; the system returns bounded non-official evidence, mechanism
and state/outcome differentials, preserves role dissent/team lineage, and gives
student-safe learning/transfer output. The official path and canonical truth
remain unchanged.

## Architecture

- Reuse `RoleWorkflowRepositoryPort.readRoleWorkflow` as the read-only source
  for role divergence, resolution, acknowledgements, and history.
- Reuse `createEnterpriseStateStrategicEvolutionService(...).counterfactual`
  for deterministic in-memory path execution. Do not add a writer, settlement
  authority, store, registry, provider, or frontend truth calculation.
- Add one M4 shared contract, JSON schema, fixture, pure service, BFF route,
  focused unit/contract/integration tests, and the smallest Teacher/Student
  projection needed to expose the product journey.
- Validate exact source state/outcome/runtime binding, two-to-three distinct
  alternative path inputs, scope, horizon, and role lineage before execution.
- Every generated path is explicitly `NON_OFFICIAL`; all official write,
  settlement write, state write, next-round application, publication, and
  formal replay write flags are literal `false`.
- Teacher receives bounded lineage and differential detail. Student receives
  role-safe comparison and transfer explanation without private role payloads,
  raw dissent notes, settlement authority, or unpublished truth.

## Tech Stack

TypeScript, npm workspaces, existing shared contracts and JSON schemas, native
Node HTTP BFF routes, Vitest, existing W4 TypeScript simulation-core boundary,
JSON runtime only. No package installation, provider activation, PostgreSQL/RLS,
or new external service.

## Spec Path

Governing source: `D:/DcodexSimWar-reference/_main-continuous-4macro-20260827/planning-pack/codex-prompt-extracted.txt`,
M4 sections for `MAIN-DIV-O1-GOVERNED-MULTIPATH-COUNTERFACTUAL-TRANSFER`.

## Global Constraints

- Base is exact post-M3 master `20ea61f70e93fe3154611f5e6fa0a2cc1cdd2027` with
  tree `247941d0acc949787fa922cab445044cb3317783`; re-read before mutation.
- Product mutation is admitted for exactly one Product PR and one normal
  non-force merge; stop after exact post-merge H3.
- Preserve `WANT != CAN != REALIZED`, one Kernel, one Truth Engine, one
  Settlement Authority, one formal writer, one Model Registry, and one store.
- Counterfactual evidence must never enter settlement, EnterpriseState,
  score/rank, canonical decision selection, publication, or next-round opening.
- Do not modify unrelated inherited worktree changes, force-push, rewrite
  history, enable auto-merge, or start a successor.

## Implementation Steps (TDD order)

### 1. Freeze admission and source map

- Record fresh exact master/tree, clean product worktree, source files, Vault
  receipt, CodeGraph unavailable receipt, Graphify unavailable receipt, and the
  explicit M4 Admission Card fields.
- Read back the exact W4 counterfactual, role workflow, route wiring, and UI
  boundaries used by the implementation.

### 2. Add failing contract and unit tests

- Define a fixture with one official source outcome, two distinct alternative
  decision sets, role divergence/resolution, and an untouched repository
  snapshot.
- Assert exact binding, two-to-three path bounds, distinct path identity,
  exact-history role lineage, non-official flags, differential fields, and
  no-write behavior.
- Assert rejection of source/runtime/team/tenant mismatch, fewer or more paths,
  duplicate paths, horizon violations, historical re-entry, and attempts to
  expose counterfactual truth to student output.
- Add contract/schema tests and BFF integration tests for teacher and student
  surfaces, including role-safe redaction and structured errors.

### 3. Implement the shared M4 contract and schema

- Add exact input, lineage, official baseline, path, differential, transfer,
  and response types under one versioned M4 schema.
- Add valid and invalid fixtures. Make non-official and no-write invariants
  structurally explicit rather than relying on prose.

### 4. Implement the pure M4 service

- Read exact W4 snapshot and exact RoleWorkflow snapshot without committing.
- Validate official source lineage and runtime manifest against the request.
- Validate alternative decision IDs against the same tenant/course/run/team and
  reject decisions that would re-enter official history or exceed the horizon.
- Run each alternative through the existing W4 counterfactual calculator in
  memory; aggregate deterministic mechanism/state/outcome differentials.
- Project teacher-safe lineage, student-safe comparison, and bounded transfer
  learning. Keep `next_opening_state_ref` informational only and set
  `apply_to_next_round:false`.

### 5. Expose one real BFF product journey

- Add a teacher/student BFF endpoint under the existing W4 route family.
- Reuse existing actor, tenant, team, course, run, and round guards.
- Wire the service through `ApiRuntime` without changing the formal writer.
- Extend the existing Teacher debrief and Student decision-learning surfaces
  only where needed to render the exact response; no client-side truth math.

### 6. Run focused verification, then full M4 gates

- Run targeted contract/unit/integration tests first and repair until green.
- Run `npm run check:hidden-unicode`, `npm run format:check`, `npm run lint`,
  `npm run typecheck`, `npm run test:contract`, `npm test`, and `npm run build`.
- Run existing browser/real-BFF validation with mocks=0 where configured,
  replay/non-write/security checks, H2 in a clean independent checkout, and
  L5 at the exact Product PR head. Record all baselines and limitations.

### 7. Product PR, merge gate, and post-merge H3

- Verify PR body, changed files, machine evidence, and checks are consistent;
  create/update exactly one M4 Product PR and keep it unmerged until the
  machine gate is satisfied.
- Perform one normal non-force merge only when all prompt gates are green and
  no protected-branch human-review requirement or remote ambiguity exists.
- Re-read the actual merge SHA and exact master/tree, then run fresh H3 in a
  clean independent checkout bound to that exact post-merge source.
- Finish with `PRODUCT_PR_READY_FOR_OWNER_MERGE_DECISION` before the merge step,
  and after the authorized normal merge record the chain completion state; do
  not start any successor.

## Self-Review Checklist

- [ ] Official path remains unchanged and is separately represented.
- [ ] Exactly two or three distinct `NON_OFFICIAL` paths are reproducible.
- [ ] Role dissent/team lineage is read and preserved without canonical rewrite.
- [ ] No counterfactual result reaches settlement, score/rank, publication, or
  next-round truth.
- [ ] Teacher and Student projections are role-safe and do not calculate truth.
- [ ] Exact SHA/tree, worktree cleanliness, tests, browser evidence, H2/L5,
  PR checks, and known limits are recorded truthfully.
