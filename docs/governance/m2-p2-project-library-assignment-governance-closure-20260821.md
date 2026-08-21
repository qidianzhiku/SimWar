# M2-P2 PR #414 Project Library / Assignment Governance Closure

## Closure scope

This document is the docs-only governance closure artifact for Product PR
[#414](https://github.com/qidianzhiku/SimWar/pull/414), tracked by
[#418](https://github.com/qidianzhiku/SimWar/issues/418). It records the exact
merged product state, the P0 authority alignment, the remote required-check
evidence, the fresh detached validation, and the explicit limits that remain
closed.

The attached P0 design, architecture, engineering, eldcare, and Shanghai
reference documents are treated as reference constraints. The M2-P2 V5.11
execution prompt is the implementation target. Neither document set is
treated as an unbounded authorization to activate a new truth source, runtime,
release environment, or governance phase.

This closure is documentation-only. It is not an authorization for raw-data
ingestion, provider/model activation, PostgreSQL/RLS activation, Human
Validation, Pilot, Production, W6, automatic successors, a general release,
or a full accessibility/WCAG PASS.

## Finding and tracker identity

| Item | Verified value |
| --- | --- |
| Finding ID | `M2-P2-PROJECT-LIBRARY-ASSIGNMENT-GOVERNANCE-CLOSURE` |
| Tracking Issue | [#418](https://github.com/qidianzhiku/SimWar/issues/418) |
| Tracking Issue state | `OPEN` |
| Product PR | [#414](https://github.com/qidianzhiku/SimWar/pull/414) |
| Governance PR | [#417](https://github.com/qidianzhiku/SimWar/pull/417) |

Issue #418 is the durable tracker for this P0 governance finding. It remains
open because this Product/Governance closure does not authorize or complete
the separately scoped release, Pilot, Production, Human Validation, W6,
provider/model, raw-data, PG/RLS, or full accessibility work.

## Product merge identity

| Item | Verified value |
| --- | --- |
| Repository | `qidianzhiku/SimWar` |
| Product PR | [#414](https://github.com/qidianzhiku/SimWar/pull/414) |
| Base branch | `master` |
| Base SHA before merge | `eb2314c6601779f720f399a003e623ac85119ef0` |
| Product head before merge | `eca32b6651ebcf55633257d03e534eabc9ddf429` |
| Product merge commit | `f64c9ce649eb7b8d5c25490e0aeb4a37d5e92a06` |
| Product merge tree | `a47fbcbb9f6bd6adc8fbda3ce17fad8fe06f510e` |
| GitHub merge state | `MERGED` |
| GitHub merged time | `2026-08-21T04:27:43Z` |
| Post-merge `origin/master` | `f64c9ce649eb7b8d5c25490e0aeb4a37d5e92a06` |

The Product PR was merged once with an ordinary non-force merge at the exact
expected head. No force push, administrator bypass, auto-merge, merge queue
bypass, or product-branch history rewrite was used.

## Exact product reference and authority boundary

The product fixture uses this exact immutable `MarketWorldRef`, produced by the
existing `getShanghaiMarketWorldReference()` path:

```json
{
  "market_world_id": "shanghai-eldercare-market-world",
  "version": "2026-08-20.m2.1",
  "digest": "b979cedd73b1ee8a65f7744a4551f3793f4c78875ab7d66ee6cc0e2fe4abc8ca"
}
```

The authority chain remains:

```text
MarketWorldRef
-> exact Course context
-> ProjectProfile provenance/configuration
-> exact ProjectAssignment(Course, Run, Team)
-> existing W4 createInitialState writer
-> existing Kernel / settlement / replay authorities
```

The implementation preserves the P0 boundaries:

- `ProjectProfile` and `ProjectAssignment` are provenance and orchestration
  records. They do not calculate settlement, score, rank, replay truth, or
  official outcomes.
- Profile provenance never overrides exact runtime binding. References require
  tenant, id, version, and SHA-256 digest; implicit aliases such as `latest`,
  `current`, `default`, `fallback`, `next`, and `any` are rejected.
- The existing Course/Run/Team/Role Seat path remains the runtime scope. The
  Project Library does not introduce a second Course writer, W4 writer,
  settlement authority, or Shanghai-only application shell.
- W4 Enterprise State remains the sole opening-state writer. Assignment may
  call the existing W4 service seam once for a missing opening state; the
  Project Library service itself has no direct W4 state writer.
- Teacher receives Course/Scenario Director commands and does not edit formal
  truth. Student receives only the current team's safe brief. Admin receives a
  tenant-scoped audit projection.
- Lifecycle changes are append-only. Historical profile references remain
  resolvable; successors are future-effective records and do not overwrite
  existing assignments or history.
- Student projections exclude raw source paths, restricted source data,
  private coefficients, truth state, score, rank, settlement result, and
  other-team data.

## Remote merge gates

The required remote checks were read for the exact Product head
`eca32b6651ebcf55633257d03e534eabc9ddf429` before merge:

| Gate | Result | Evidence |
| --- | --- | --- |
| `quality` | `PASS` | [CI workflow 32446477086](https://github.com/qidianzhiku/SimWar/actions/runs/32446477086), job `96666917674` |
| `browser-smoke` | `PASS` | [CI workflow 32446477086](https://github.com/qidianzhiku/SimWar/actions/runs/32446477086), job `96666917499` |
| `Analyze JavaScript and TypeScript` | `PASS` | [CodeQL workflow 32446477153](https://github.com/qidianzhiku/SimWar/actions/runs/32446477153), job `96666917938` |
| Blocking review threads | `0` after resolution | Fresh GraphQL review-thread readback; 6 addressed threads were resolved, with 4 outdated and 2 current-line comments covered by the merged behavior |
| Mergeability before merge | `MERGEABLE / CLEAN` | Fresh PR #414 readback immediately before merge |

The remote `browser-smoke` job included the generic core lane, the dedicated
M2 real-BFF journey, and the PR4 browser lane. All completed successfully at
the exact Product head. The one local PR4 performance observation at 136ms
was re-run and measured within budget (approximately 65–70ms, CLS 0); the
remote required PR4 lane also passed.

## Fresh detached post-merge validation

Validation used a newly created detached worktree at:

`D:\codex\worktrees\simwar-m2-p2-pr414-merged-20260821`

The worktree was fixed to
`f64c9ce649eb7b8d5c25490e0aeb4a37d5e92a06` and was clean at the start and
after validation. The bounded post-merge results are:

| Check | Result | Evidence or limit |
| --- | --- | --- |
| `npm ci` | `PASS` | Locked dependencies installed in the detached checkout |
| `npm run check:hidden-unicode` | `PASS` | No hidden Unicode control characters found |
| `npm run lint` | `PASS` | Detached merge tree |
| `npm run typecheck` | `PASS` | Detached merge tree |
| `npm run test:contract` | `PASS` | 29 files, 67 tests passed; contract conformance reported 20 baseline files, 37 M1 files, and 29 schema/fixture groups |
| `npm run build` | `PASS` | Shared contracts, agent gateway, simulation core, API, UI, Admin, Teacher, and Student built |
| `npm run security:audit` | `PASS` at critical threshold | Audit still reports 9 inherited advisories: 2 low and 7 high; no automatic fix was run |
| Dedicated `@m2-p2-real` browser lane | `PASS` | 1 Chromium test passed in 40.6s using independent store and ports 3210–3213 |
| Default-port M2 attempt | `ENV BLOCKED` | Existing listener on `127.0.0.1:3100` caused `EACCES`; no unrelated process was stopped; the alternate-port rerun passed |
| Detached `npm test` full suite | `NOT RUN` | Product head had a fresh full suite of 230 files / 1414 tests; remote `quality` also ran the full suite successfully |
| Full repository Prettier | `NOT RUN` | Existing repository-wide limitation is recorded in the Product PR; changed Product files passed targeted formatting |

The detached M2 browser run used `SIMWAR_PLAYWRIGHT_STORE_FILE` under the
controlled temporary root and did not use mocks. The default-port failure is
preserved as an environment limit rather than hidden behind the successful
alternate-port result.

## P0 evidence and tooling limits

The P0 reference alignment is recorded in:

- `docs/product/m2-p2-project-library-current-reuse-gap-map.md`
- `docs/evidence/m2-p2-authority-design-reuse-receipt.md`
- `docs/evidence/m2-p2-contract-receipt.md`

The following limits remain explicit:

- CodeGraph was unavailable in the isolated Product worktree because
  `.codegraph/` was absent. A stale shared-workspace result was not used as
  current evidence.
- Graphify was unavailable because `graphify-out/graph.json` was absent; no
  graph result is represented as a pass.
- Figma identity was available, but no Figma file/node URL was supplied or
  found in the repository; UI review therefore used current source components
  and tokens.
- No current web competitor claim is made. The available historical research
  reference was treated as background only, not as current external evidence.
- Git, current source, exact refs, local/remote tests, and live endpoint
  behavior remain the source of implementation truth.

## Governance decision

This closure records the following bounded outcome:

1. Product PR #414 is merged into `master` at
   `f64c9ce649eb7b8d5c25490e0aeb4a37d5e92a06`.
2. The exact Shanghai MarketWorld reference is reachable through the existing
   Course authority and is exercised by the dedicated Teacher/Student/Admin
   real-BFF journey.
3. Project Profile provenance, exact assignment scope, role-safe projections,
   append-only history, concurrency handling, and the W4 sole-writer boundary
   are present in the merged Product tree and covered by the recorded tests.
4. Required remote checks and CodeQL passed before merge, and the merged tree
   passed the bounded detached validation listed above.
5. This Governance Closure changes documentation only. It does not alter
   runtime code, contracts, tests, workflows, model/provider configuration,
   database activation, settlement, canonical decisions, or replay truth.

No issue-closing keyword is used by this Governance Closure. Issue #418 is
updated as the durable tracker and intentionally remains open; it must not be
inferred closed by this document or by the Product merge alone.

## Explicitly out of scope

The following remain closed and are not implied by this Product or Governance
Closure:

- raw-data ingestion or a new raw-data/PG/RLS runtime;
- provider, model, or real AI activation;
- ParameterSet, Scenario, SettlementResult, canonical Decision, or Replay truth
  writer changes;
- W4 redesign or any second Enterprise State writer;
- Human Validation, Pilot, Production, general release approval, or customer
  market claims;
- W6 or an automatic successor wave;
- full WCAG/accessibility acceptance or color-contrast remediation;
- merge of any other PR or mutation of the protected shared worktree.

## Closure evidence and cleanup

The tracking Issue, product PR, exact head, required checks, merge SHA, exact
MarketWorldRef, detached validation, inherited limits, and P0 boundary are
recorded above. After this Governance Closure is merged and read back, only
the two temporary worktrees created for this task may be removed; the
protected shared workspace and the Product worktree's pre-existing artifacts
remain untouched.
