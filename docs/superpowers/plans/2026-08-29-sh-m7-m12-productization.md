# SH M7–M12 Scenario Productization and Enterprise Delivery

## Goal

Execute the uploaded V6 mission as a single bounded productization chain on the
fresh `origin/master` head. Deliver a generic, candidate-only productization
spine that carries exact Scenario references through catalog, authoring,
qualification-aware model evidence, course package assembly, enterprise
rights/delivery, and portfolio lifecycle operations. Shanghai fixtures are
consumer examples; Shanghai-specific constants do not enter the reusable
contracts.

## Current reality and authority boundaries

- Start head: `ac92f29dc925b0714a7b21bf7b7dfb3789be3dda` (PR #466 merged).
- Worktree: `D:\codex\worktrees\simwar-sh-m7-m12-20260829`.
- V5 M1–M6 is a tombstone/reuse baseline; M5/M6 remain `NOT_ELIGIBLE` and
  `MODEL_CALIBRATED` is never inferred.
- The current source has no exact CodeGraph index for the fresh worktree and
  Graphify has no usable graph JSON; source/test readback is the accepted
  fallback. The Local Reference Vault tunnel is unavailable; record one
  bounded failure and use the uploaded reference pack plus current source.
- No second Truth/Settlement/Enterprise-State/Model writer, runtime, registry,
  Shanghai App, Provider, PostgreSQL cutover, Pilot, Production, Human
  Validation, or actual release is in scope.

## Productization spine

Use a generic shared contract module plus an API-side candidate service. The
service owns deterministic candidate compilation and in-memory/read-only
projections; it does not persist Course/Run/Settlement truth or activate a
formal registry. Exact references always carry tenant, identity, version, and
content digest. A canonical JSON representation plus SHA-256 is used for
candidate content and receipts. All mutating operations return new immutable
snapshots; no `latest` resolver exists.

### M7 — qualified catalog and selection

Add catalog, source, qualification, rights, freshness, compatibility, known
limit, and consumer-readiness types. Compile/filter/compare/select exact
entries with fail-closed status checks. Produce Teacher/Admin full metadata and
Student allowlisted projections. Cover Shanghai, Suzhou, and a synthetic stub;
keep NOT_ELIGIBLE/STALE/UNKNOWN visible and non-bindable.

### M8 — authoring/fork/compare

Create exact-base drafts, apply only SH-owned asset-reference edits, fork
without mutating the base, compare canonical structures, surface qualification
impact, validate, and freeze an immutable candidate. Draft/freeze are not
formal ScenarioPackage activation and cannot run or publish.

### M9 — qualification-aware model evidence

Bind exact Scenario, ModelVersion, ParameterSet, Feature, and Evidence
references into a candidate. Validate units, geography, period, source,
qualification, confidence/UQ/OOD, compatibility, and expiry. Return explicit
why-not-bind findings. Keep MOD model semantics, SH reality/scenario
ownership, MAIN formal activation, and AGT bounded-signal boundaries explicit.

### M10 — experiment course package

Assemble a generic candidate with at least two modules and three rounds,
role-safe views, exact Scenario/Parameter/Model refs, process/outcome/learning/
advisory/counterfactual partitions, What-if/Debrief/Transfer, and
Standard/Advanced experience profiles sharing one kernel. Validate deterministic
manifest/digest and produce a MAIN CoursePackage binding request without
activating the CoursePackage authority.

### M11 — enterprise catalog, rights, and delivery

Add tenant-scoped catalog entries, rights grants, territory/expiry/action
checks, immutable copy/fork lineage, delivery configuration, sponsor-safe
aggregate, and delivery receipts. Cross-tenant access, expired or missing
rights, withdrawn entries, secrets, raw restricted data, state_true, private
judgment, other-team data, and exact model coefficients fail closed.

### M12 — portfolio lifecycle and history

Add portfolio status/readiness/compatibility impact, release-candidate,
deprecate/withdraw transitions, deterministic rollback dry-run, and exact
historical resolution. Withdraw never deletes or rewrites history. Formal
release and rollback remain separate gates.

## Files and tests

Expected implementation files are deliberately bounded:

- `packages/shared-contracts/src/shanghai-productization.ts`
- `packages/shared-contracts/src/index.ts`
- `services/api/src/shanghai-productization-service.ts`
- `contracts/schemas/shanghai-productization.v1.json`
- `contracts/fixtures/shanghai-productization.valid.json`
- `tests/unit/shanghai-productization.test.ts`
- `tests/contract/shanghai-productization-contract.test.ts`
- this plan and one evidence/handoff document under `docs/quality/` or
  `docs/governance/`

Do not modify settlement, replay hash inputs, canonical decision selection,
Postgres adapters, formal authority writers, or the existing PR #466 route
files. Start with failing unit/contract tests, implement the smallest complete
spine, and then run focused tests followed by the repository gates appropriate
to shared contracts/API-side code.

## Verification and integration

Run focused Vitest tests first, then `npm run typecheck`, `npm run lint`,
`npm run test:contract`, `npm test`, and `npm run build` as feasible. Separate
focused green evidence from any pre-existing full-suite failures. Perform a
fresh exact-head check before commit/PR, use the repository PR template, read
back PR checks/CodeQL/review, remediate same-mission findings, merge only by
ordinary non-force merge when required checks are green, and perform detached
post-merge H3 verification. Generate exactly one canonical
`SIMWAR-SH-M7-M12-FINAL-results.zip` with independent member/hash/semantic
verification and a SHA-256 receipt.
