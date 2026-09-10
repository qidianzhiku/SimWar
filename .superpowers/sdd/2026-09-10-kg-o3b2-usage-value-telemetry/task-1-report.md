# Task 1 Report — Router Trust Hardening and QF-11

## Scope

- Worktree: `D:\codex\worktrees\simwar-kg-o3b2-usage-value-telemetry-20260910`
- Task: derive canonical CodeGraph admission for the existing Graph Companion
  router and add the bounded QF-11 identity/digest semantics analyzer.
- Product/runtime, settlement, persistence, telemetry writer, and evidence
  controller code were not changed by this task.

## Result

- Added `deriveCodeGraphAdmission(input)` to `scripts/graph-companion.mjs`.
  The helper ignores caller-supplied `codegraph_admitted`; it derives
  `observed`, `admitted`, and a stable reason from observed status/relevance/
  coverage plus exact target SHA/tree binding.
- Routed `routeGraphSupportQuestion()` through that helper. G2/G3 can reach
  `READY` only after qualified observed CodeGraph evidence and resolved source
  readback; G0/G1 remain seam-local source-only paths when graph tooling is not
  needed.
- Added `analyzeIdentityDigestSemantics(input)`, returning a deterministic list
  capped at ten source/contract-anchored findings for scope-too-narrow,
  scope-too-broad, static-as-runtime, invocation-not-bound,
  identity/digest conflation, and semantic-name mismatch.
- Added RT-001..RT-012 and QF-11 semantic tests.
- Added `docs/development/kg-o3b2-qf11.json` documenting the input, finding
  codes, bounded output, and authority limits.

## Files changed

- `scripts/graph-companion.mjs`
- `tests/unit/graph-o3b2-router-qf11.test.ts`
- `docs/development/kg-o3b2-qf11.json`
- `.superpowers/sdd/2026-09-10-kg-o3b2-usage-value-telemetry/task-1-report.md`

## Checks actually run

1. Required RED attempt:
   `npx vitest run tests/unit/graph-o3b2-router-qf11.test.ts`
   reached Vitest but could not start assertions because the worktree's
   interrupted dependency install lacked `tinyrainbow`; this was an
   environment/dependency failure, not a test assertion result.
2. `node --check scripts/graph-companion.mjs` — PASS.
3. Focused test via the available primary-worktree Vitest binary with an
   ignored local dependency junction:
   `tests/unit/graph-o3b2-router-qf11.test.ts` — PASS, 20/20 tests.
4. Combined graph suite:
   `tests/unit/graph-companion.test.ts tests/unit/graph-o3b1.test.ts
   tests/unit/graph-o3b2-router-qf11.test.ts` — 104/105 tests passed.
   The single failure is the pre-O3B2 O3B1 case “treats non-applicable
   Graphify as neutral when CodeGraph and source are ready”; it supplies no
   target SHA/tree, so the new exact-binding rule correctly returns
   `SOURCE_FALLBACK` while that historical test still expects `READY`.
5. `git diff --check` — PASS.
6. Direct Node smoke checks covered a fully bound positive route, caller
   `codegraph_admitted` bypass, SHA/tree mismatch, unbound target, and all six
   QF-11 finding codes.

## Blockers and remaining risks

- The worktree dependency tree remains incomplete because concurrent npm
  installation had an `EPERM`/native-file contention failure; the focused
  check used the available Vitest binary and ignored local dependency links.
- The existing O3B1 positive test needs its fixture updated with exact target
  SHA/tree fields in a follow-up compatibility/test-maintenance change. No
  O3B1 test file was modified because it is outside this task's allowed file
  boundary.
- The QF-11 analyzer is diagnostic evidence only; it does not grant Product,
  runtime, settlement, score, rank, writer, or replay authority.

`automatic_next_start: false`
