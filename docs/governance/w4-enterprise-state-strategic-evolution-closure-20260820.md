# W4 Enterprise State & Strategic Evolution Closure

## Scope

This document records the bounded W4 closeout for the SimWar Enterprise State
and Strategic Evolution loop. It is documentation-only governance evidence. It
does not add a runtime writer, change a product contract, alter a test, or grant
authorization for Pilot or Production.

| Item | Verified value |
| --- | --- |
| Product PR | [#396](https://github.com/qidianzhiku/SimWar/pull/396) |
| Product head before merge | `fab7c4b388dffd07ead05bb4d66b9c9648d15604` |
| Product merge commit | `f6d147cbdbeac3c1294a49281f1b27a174ee9b3a` |
| Product base before merge | `baa6af5f918711a28c018b135cc68f768b063b70` |
| Post-merge `origin/master` at validation start | `f6d147cbdbeac3c1294a49281f1b27a174ee9b3a` |
| Product PR state | `MERGED` |
| Product merge mode | Ordinary merge; no force push, squash, or branch deletion |

## Authoritative runtime boundaries

The merged product implementation preserves these authorities:

- Enterprise State transitions are calculated by the Simulation Core
  `settleEnterpriseState` path and committed through the W4 service boundary.
- A strategic decision is admitted by the server. Formal runs require the
  existing role-workflow canonical decision set, including merge and team
  confirmation evidence. The explicit legacy direct path is synthetic and
  separately identified; it is not a client-supplied canonical admission.
- Settlement resolves the exact runtime round and requires the round to be
  locked, settled, or published before an official outcome can be written.
- The official outcome and closing state are committed atomically with the
  replay input manifest. The manifest retains the exact opening reference,
  admitted decision IDs, scenario, parameter set, engine, plugins, seed, and
  team scope.
- The next opening state consumes the exact prior closing reference. State,
  outcome, initiative, projection, replay, and shadow-replay identities remain
  tenant/course/run/team/round scoped as applicable.
- Student, Teacher, and Admin projections remain role-safe and tenant-scoped;
  Student projections do not expose enterprise cash or other private fields.
- Tier B generic strategic-evolution seams remain typed and reusable. Tier C
  M&A, ABS, IPO, project sale, and closure seams remain policy seams only; no
  unsupported product controls or fake operational buttons were added.

## Product review and required checks

Before the ordinary merge, the exact product head was reauthenticated against
the current base and all five review threads were resolved after the boundary
fixes were pushed. Branch protection was read back as strict, with required
contexts exactly `quality`, `browser-smoke`, and `Analyze JavaScript and
TypeScript`.

The exact product head passed:

| Check | Result | Evidence |
| --- | --- | --- |
| `quality` | `PASS` | CI run `32350269184`, job `96367712525` |
| `browser-smoke` | `PASS` | CI run `32350269184`, job `96367712142` |
| `Analyze JavaScript and TypeScript` | `PASS` | CodeQL run `32350269250`, job `96367712789` |
| CodeQL status check | `PASS` | check run `96368204680` |

The product PR was `OPEN / NON_DRAFT / MERGEABLE / CLEAN` immediately before
merge, with no unresolved review threads. The merge was then performed through
the normal PR path.

## Fresh detached post-merge validation

Validation was run in a new detached worktree at the exact merge commit:

```text
D:\codex\fresh-clones\simwar-w4-post-merge-f6d147c
HEAD: f6d147cbdbeac3c1294a49281f1b27a174ee9b3a
status: clean, detached HEAD
```

| Validation | Result | Notes |
| --- | --- | --- |
| `npm ci` | `PASS` | 287 packages installed; npm reported 9 advisories (2 low, 7 high) |
| W4 unit/integration/contract target | `PASS` | 3 files, 12 tests |
| `npm run test:contract` | `PASS` | 25 files, 58 tests; contract conformance gate passed |
| `npm run typecheck` | `PASS` | TypeScript build graph completed |
| `npm run build` | `PASS` | Shared contracts, services, API, UI, Admin, Teacher, Student |
| `npm run check:hidden-unicode` | `PASS` | No hidden Unicode control characters |
| `npm run check:direct-store-boundaries` | `PASS` | 0 new unapproved accesses; alias/indirect access remains a stated static limitation |
| `npm run test:e2e:ui:w4` | `PASS` | 1 Chromium test passed in 32.1s using the controlled external store and isolated ports |
| Full fresh detached `npm test` | `NOT RUN` | Product PR `quality` already passed the repository full test step; this fresh run focused on the W4 acceptance surface |
| Fresh detached `npm run security:audit` | `NOT RUN` | No new security claim is made here; product CI and the pre-merge security gate are the applicable evidence |

The first local W4 test invocation before the prerequisite build was
`ENV BLOCKED` by unresolved workspace package `dist` entry points. The required
build prerequisite was then run successfully, and the same W4 target passed
12/12. The first browser invocation was rejected during configuration because
its manually supplied store was outside the repository's controlled temporary
root; the retry used the repository-defined controlled root and passed. Neither
event was a product assertion failure.

## Security and known limits

- W4 route-level actor, tenant, course, run, team, round, role, and activity
  binding was exercised by the security proof gate and negative-path tests.
- The W3 role-activity receipt limitation
  `W3-SECURITY-LIMIT-ROLE-ACTIVITY-RECEIPT` was not consumed by W4 and remains
  `NOT_CONSUMED_PRESERVED`.
- The direct-store guard reports no new unapproved runtime direct-store access,
  while retaining its documented alias/indirect static-analysis limitation.
- npm audit advisories reported during installation remain visible; no audit
  fix or dependency mutation was performed as part of W4.
- Human Validation was not performed. This closeout does not claim a WCAG or
  full accessibility PASS.
- Pilot and Production are not authorized. General PostgreSQL/RLS rollout is
  outside this W4 scope; JSON remains the default runtime.
- No automatic successor, next execution, or unlisted release action is
  started by this closeout.

## Governance decision

The W4 implementation and its post-merge evidence are sufficient to create a
governance record with limits. This document is not a declaration that every
future security, accessibility, migration, or production-readiness concern is
closed. Any future work must receive its own scoped issue, branch, validation,
and authorization.

```text
MISSION_STATUS: W4_COMPLETE_WITH_LIMITS_PENDING_GOVERNANCE_MERGE
PRODUCT_PR: 396 MERGED
PRODUCT_MERGE: f6d147cbdbeac3c1294a49281f1b27a174ee9b3a
FRESH_DETACHED_VALIDATION: PASS_WITH_LIMITS
ENTERPRISE_STATE_AUTHORITY: SINGLE
SETTLEMENT_AUTHORITY: SINGLE
CLOSING_TO_NEXT_OPENING: PASS
NEW_PROJECT_VERTICAL: PASS
PATH_DEPENDENCE: PASS
W3_ROLE_ACTIVITY_LIMIT: NOT_CONSUMED_PRESERVED
HUMAN_VALIDATION: NOT_PERFORMED
PILOT: NOT_AUTHORIZED
PRODUCTION: NOT_AUTHORIZED
AUTOMATIC_SUCCESSOR: NOT_STARTED
```
