# M2-P1 PR #410 Product and Governance Closure

## Closure scope

This document is the docs-only governance closure artifact for Product PR #410.
It records the exact merged product state, the remote required-check evidence,
the fresh detached validation, the explicit inherited local limits, and the
boundaries that remain closed.

This is a product/governance closure for the M2-P1 Market World join. It is not
an authorization for Pilot, Production, provider/model activation, PostgreSQL
RLS activation, a new successor wave, or a general release claim.

## Product merge identity

| Item                       | Verified value                                         |
| -------------------------- | ------------------------------------------------------ |
| Repository                 | `qidianzhiku/SimWar`                                   |
| Product PR                 | [#410](https://github.com/qidianzhiku/SimWar/pull/410) |
| Base branch                | `master`                                               |
| Base SHA before merge      | `6608ff44c99eb185444150b54512653453f29655`             |
| Product head before merge  | `9802d296c87fdd08ec45bcad11400702667de304`             |
| Product merge commit       | `b012b93130b4cb1a30e314c7cb9b933d2e060541`             |
| Product merge tree         | `1f7828fd9b71f13a2093c8cefcd9acd4eb85010b`             |
| GitHub merge state         | `MERGED`                                               |
| GitHub merged time         | `2026-08-21T00:49:01Z`                                 |
| Post-merge `origin/master` | `b012b93130b4cb1a30e314c7cb9b933d2e060541`             |

The product merge used one ordinary non-admin merge with an exact-head match.
No force push, administrator bypass, auto-merge, or merge-queue bypass was
used.

## Exact product reference and authority boundary

The product path is bound to this exact immutable `MarketWorldRef`:

```json
{
  "market_world_id": "shanghai-eldercare-market-world",
  "version": "2026-08-20.m2.1",
  "digest": "b979cedd73b1ee8a65f7744a4551f3793f4c78875ab7d66ee6cc0e2fe4abc8ca"
}
```

The existing Course writer remains the sole binding authority. Teacher binding,
Student visibility, and Admin audit consume role-safe projections of that
authority. The product path does not create a second Course or Scenario writer,
does not activate a model or provider, and does not write `ParameterSet`,
Scenario, settlement, canonical decision, replay truth, or other formal truth
state.

The product reference is product context only. It is not a settlement input,
pricing/occupancy estimate, production market claim, or replacement for a
future approved model/parameter workflow.

## Remote merge gates

The exact pre-merge head remained unchanged while the following remote gates
were read back:

| Gate                                | Result              | Evidence                                                                                                                |
| ----------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `quality`                           | `PASS`              | [workflow 32433464285, job 96629805339](https://github.com/qidianzhiku/SimWar/actions/runs/32433464285/job/96629805339) |
| `browser-smoke`                     | `PASS`              | [workflow 32433464285, job 96629805493](https://github.com/qidianzhiku/SimWar/actions/runs/32433464285/job/96629805493) |
| `Analyze JavaScript and TypeScript` | `PASS`              | [workflow 32433464296, job 96629804982](https://github.com/qidianzhiku/SimWar/actions/runs/32433464296/job/96629804982) |
| `CodeQL`                            | `PASS`              | [CodeQL run 96630197925](https://github.com/qidianzhiku/SimWar/runs/96630197925)                                        |
| Blocking review threads             | `0`                 | Fresh GraphQL review-thread readback                                                                                    |
| Reviews                             | `0`                 | Fresh GraphQL review readback                                                                                           |
| Mergeability                        | `MERGEABLE / CLEAN` | Fresh PR readback before merge                                                                                          |

The existing `browser-smoke` job now contains the dedicated M2 step. The remote
log records the generic core lane as `117 passed` and the dedicated
`@m2-p1-real` lane as `1 passed (10.9s)`. The generic lane remains allowed to
skip the M2 fixture when M2 mode is false; the dedicated lane explicitly sets
M2 true and W3 false. No existing assertion or test was deleted, weakened, or
made continue-on-error.

## Fresh detached validation

Validation was run from a newly created detached worktree at the exact product
merge commit `b012b93130b4cb1a30e314c7cb9b933d2e060541`. The worktree was clean
at both the start and the end of validation.

| Check                              | Result                                 | Evidence or limit                                                                                                                                                                                                                                              |
| ---------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                           | `PASS`                                 | Locked dependencies installed in the detached checkout                                                                                                                                                                                                         |
| `npm run check:hidden-unicode`     | `PASS`                                 | No hidden Unicode control characters found                                                                                                                                                                                                                     |
| `npm run typecheck`                | `PASS`                                 | Detached merge tree                                                                                                                                                                                                                                            |
| `npm run lint`                     | `PASS`                                 | Detached merge tree                                                                                                                                                                                                                                            |
| `npm run test:contract`            | `PASS`                                 | 28 files, 65 tests passed                                                                                                                                                                                                                                      |
| `npm run build`                    | `PASS`                                 | All workspace packages and all three applications built                                                                                                                                                                                                        |
| `npm run security:audit`           | `PASS` at critical threshold           | Audit reports 9 inherited advisories: 2 low and 7 high; no critical advisory caused a non-zero exit                                                                                                                                                            |
| `npm run format:check`             | `FAIL` (inherited limit)               | Prettier reports 74 existing files; no formatting rewrite was performed                                                                                                                                                                                        |
| `npm test`                         | `FAIL` (inherited/flaky Windows limit) | 224 files passed; 1391/1392 tests passed. The single full-suite failure was the existing shell-metacharacter snapshot-path child-process test returning `status=null` after its 4-second per-child deadline. The same test passed in a focused rerun in 991ms. |
| Generic UI browser core lane       | `PASS`                                 | 117 passed, 12 fixture-gated skips; M2 was intentionally skipped because the generic lane ran with M2 disabled.                                                                                                                                                |
| Role-workflow browser lane         | `FAIL` (inherited local limit)         | One existing test timed out on a disabled `创建 Run` button. The remote required `browser-smoke` job, which includes this lane, passed; this local failure remains visible rather than being folded into the core-lane result.                                 |
| Dedicated M2 real-BFF browser lane | `PASS`                                 | `@m2-p1-real`, M2=true, W3=false, one Chromium test passed in 26.8s, no mocks                                                                                                                                                                                  |
| Detached worktree integrity        | `PASS`                                 | `HEAD=b012b93130b4cb1a30e314c7cb9b933d2e060541`, tree=`1f7828fd9b71f13a2093c8cefcd9acd4eb85010b`, no tracked or untracked worktree changes                                                                                                                     |

The local format and full-suite limitations are explicitly inherited baseline
limits, not product acceptance claims. They were not repaired in this closure
because doing so would expand a merged Product PR's scope. The remote required
quality and browser-smoke gates are the merge gates for the product PR; the
dedicated detached M2 journey independently passed at the merged tree.

## Governance decision

This closure records the following bounded outcome:

1. Product PR #410 is merged into `master` at the exact merge commit above.
2. The exact M2 reference is reachable through the existing Course authority
   and is proven through the dedicated Teacher/Student/Admin real-BFF journey.
3. The remote required checks and CodeQL passed before merge, with no blocking
   review threads and no review records.
4. Fresh detached validation confirms the merged tree and the dedicated M2
   journey, while preserving the explicit local format, full-suite, and
   role-workflow baseline limits listed above.
5. The closure is documentation-only and does not alter runtime, contracts,
   tests, workflows, model/provider configuration, database activation, or
   formal settlement/replay truth.

No issue-closing keyword is used by this governance closure. A tracker or audit
issue, if later identified as applicable, must be updated with this merge SHA
and the evidence above rather than inferred closed by this document alone.

## Explicitly out of scope

The following remain closed and are not implied by this product/governance
closure:

- Pilot or Production deployment;
- general release approval or customer-facing market claims;
- provider, model, or real AI activation;
- PostgreSQL or PG-RLS runtime activation;
- ParameterSet, Scenario, SettlementResult, canonical Decision, or Replay truth
  writer changes;
- color-contrast remediation or a general accessibility/WCAG PASS;
- W4, Human Validation, or any automatic successor wave;
- merge of any other PR or mutation of the shared protected worktree.

## Closure evidence and cleanup

The product PR, remote checks, merge SHA, exact reference, detached validation,
and inherited limits are all recorded above. The temporary detached validation
worktree and this docs-only closure worktree are to be removed only after the
closure PR's ordinary merge and final external readback. The protected shared
workspace and the product worktree's pre-existing untracked generated artifacts
remain untouched.
