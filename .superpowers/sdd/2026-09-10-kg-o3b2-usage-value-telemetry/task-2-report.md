# Task 2 — KG-O3B2 usage/value telemetry

Status: `IMPLEMENTED_WITH_LIMITS`

## Scope

Implemented only the external usage telemetry/value-review seam requested for
Task 2. The implementation does not add a Product-repository store, controller,
formal writer, settlement writer, or Product Truth mutation.

## Result

- Added `scripts/kg-usage-telemetry.mjs` with:
  - `createUsageEvent` (external `STAGED` artifact, secret policy, path/symlink safety);
  - `finalizeUsageEvent` (`COMPLETE` write, immutable SHA-256, exclusive `FINALIZED` artifact);
  - `compileUsageReceipt` (hash verification, deterministic parent-first topological order,
    explicit unresolved parents/cycles, deterministic receipt hash);
  - `sealPreReviewDecision` (receipt-bound pre-review seal with approval and Product writes
    explicitly denied);
  - `reconcileValue` (source → judgement → changed artifact → actual action →
    counterfactual chain; recommendation/shadow-only inputs remain not proven);
  - `buildGraphSupportEnvelopeV12` (bounded derived-evidence summary, external DAG metadata,
    and non-goals).
- Added `tests/unit/kg-usage-telemetry.test.ts` with EV-001..EV-010 plus receipt
  determinism, pre-review sealing, value reconciliation, and V1.2 envelope coverage.
- Added the three requested development contracts:
  - `docs/development/kg-usage-event-v2.json`
  - `docs/development/kg-usage-receipt-v2.json`
  - `docs/development/graph-support-envelope-v1-2.json`

## TDD and validation evidence

1. RED first: the focused Vitest run failed with `ERR_MODULE_NOT_FOUND` for the
   not-yet-created `scripts/kg-usage-telemetry.mjs` module.
2. `node --check scripts/kg-usage-telemetry.mjs` — PASS.
3. Focused unit run, using the already-installed primary-workspace Vitest binary
   and config because this worktree dependency install was incomplete:

   `vitest run tests/unit/kg-usage-telemetry.test.ts --reporter=verbose` — PASS,
   1 file / 15 tests.

4. The three JSON development contracts were parsed during the final validation
   pass — PASS.
5. Existing Graph Companion suites were run with the same primary-workspace
   toolchain: 84/85 assertions passed. One pre-existing/parallel-worktree
   `graph-o3b1` assertion failed in `scripts/graph-companion.mjs` (expected
   `READY`, observed `SOURCE_FALLBACK` for non-applicable Graphify). That file
   is outside Task 2 and was not modified or staged here.
6. Prettier check/write was applied to the scoped script, test, contracts, and
   report — PASS after formatting.
7. Worktree-local ESLint could not load its incomplete dependency tree
   (`@eslint/js` missing after the install failure). A primary-workspace lint
   attempt emitted only “File ignored because outside of base path” warnings;
   no lint proof is claimed.

## Blockers and limits

- `npm.cmd ci --ignore-scripts --no-audit --no-fund` could not complete in this
  Windows environment because native dependency files were held by another
  process (`EPERM`); the worktree-local `node_modules` is therefore not a valid
  clean-install proof. The focused test was run through the existing primary
  workspace toolchain and is recorded as such.
- External event roots must be supplied explicitly and must resolve outside the
  Product repository. Symlink/reparse components are rejected fail-closed.
- A pre-review seal is evidence for human review only; it does not grant merge,
  Product acceptance, production readiness, settlement authority, or value proof.
- `DEVELOPMENT_VALUE_PROVEN` requires the full evidence chain including an actual
  action, changed artifact, and counterfactual. Counts, recommendations, and
  shadow observations remain `DEVELOPMENT_VALUE_NOT_PROVEN`.

## Worktree hygiene

The worktree also contained unrelated edits from parallel workers (including
`scripts/graph-companion.mjs` and other KG-O3B2 files). They were not modified,
staged, or included in the Task 2 commit.
