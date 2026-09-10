# Task 3 — KG-O3B2 shadow support and HC-07 evidence

Status: `IMPLEMENTED_WITH_LIMITS`

## Scope

Implemented only the lane-neutral shadow-support preamble, HC-07 historical
evidence runbook, and four pure/read-only historical/forward evidence helpers
requested for Task 3. No Product runtime, database/provider, settlement,
score, rank, Graph Companion authority, or Product source was changed by this
task.

## Result

- Added `docs/development/kg-shadow-support-preamble-v1.md` documenting
  selective G0-G3 routing, derived-evidence boundaries, exact historical
  target isolation, blind-cell sealing, and the no-global-HOLD/no-auto-start
  boundary across MAIN/SH/MOD/AGT/FE.
- Added `docs/development/kg-o3b2-hc07-runbook.md` documenting the read-only
  HC-07 workflow, PR509 locator use, control/treatment isolation, bounded
  comparison labels, and forward-selector stop behavior.
- Added `scripts/kg-o3b2-evidence.mjs` with:
  - `createHistoricalCell` — requires exact 40-character commit/tree SHAs,
    historical source provenance, and no answer-key fields; rejects current or
    repaired source snapshots and source/target mismatches;
  - `sealHistoricalCell` — returns an immutable-by-convention sealed copy and
    deterministic seal hash without adding or exposing the answer key;
  - `compareHistoricalCells` — withholds the answer key until both cells are
    sealed, validates shared target/task identity, and computes bounded HC-07
    `MATERIAL`/`CONFIRMATORY`/`NO_MATERIAL`/`FP`/`FN`/`NOT_COMPUTED` labels with
    `statistics: NOT_COMPUTED`;
  - `selectForwardPilot` — excludes HC-07/historical/shadow/completed and
    non-Product candidates, deterministically selects an explicit pre-review
    Product task, or returns
    `WAITING_FOR_NEXT_PRE_REVIEW_PRODUCT_TASK` when none is eligible.
- Added `tests/unit/kg-o3b2-evidence.test.ts` covering exact historical target
  isolation, short-SHA rejection, answer-key withholding before both seals,
  HC-07 comparison, historical-only forward exclusion, and deterministic
  forward selection.

The PR509 first material-review commit was inspected only as a locator:
`14e577bf9c8745e3b8694812efb88fe3f4188e4a`. Its Product test file was not
modified.

## TDD and validation evidence

1. RED first: before the implementation existed, a direct Node ESM import of
   `scripts/kg-o3b2-evidence.mjs` failed with `ERR_MODULE_NOT_FOUND` while the
   new Vitest file already imported the four desired helpers.
2. `node --check scripts/kg-o3b2-evidence.mjs` — PASS.
3. Direct Node manual harness covering cell creation, pre-seal answer-key
   withholding, one-seal withholding, two-seal HC-07 `MATERIAL` comparison,
   idempotent sealing, HC-07 forward exclusion, eligible-task selection, and
   current-source rejection — PASS (`manual checks passed`).
4. Targeted hidden-Unicode scan over the four Task-3 files — PASS (`clean`).
5. `git diff --check` over the four Task-3 files — PASS.

The focused Vitest run could not be completed in this shared Windows
environment. The worktree-local `node_modules` lost its `vitest` package while
parallel workers were running `npm ci`/browser jobs; repeated attempts either
hit `ERR_MODULE_NOT_FOUND` or timed out without a runner result. The parent
integration worker should rerun:

```text
npx vitest run tests/unit/kg-o3b2-evidence.test.ts
```

after the dependency tree is restored. This is an environment limitation, not
a claim that the focused Vitest suite passed.

## Blockers and limits

- The helper is intentionally read-only and does not resolve Git commits,
  inspect current Product source, or write external evidence. The runbook
  requires the owner/operator to resolve the exact historical tree and keep
  external cell artifacts isolated.
- The current repaired SHA may be recorded as exclusion provenance, but it is
  never accepted as a historical blind source. Manually assembled cells are
  revalidated by comparison as well as by creation/sealing.
- HC-07 is a historical calibration question only; it cannot serve as the
  forward pilot. No eligible current pre-review Product task was invented by
  this task.
- Small-cell labels are descriptive evidence only. They do not prove actual
  development value, production readiness, graph precision, or statistical
  significance.

## Worktree hygiene

The shared worktree contained unrelated parallel-worker changes, including
Task-1/Task-2 KG-O3B2 files and a modification to
`scripts/graph-companion.mjs`. They were not modified, staged, or included in
the Task-3 commit.
