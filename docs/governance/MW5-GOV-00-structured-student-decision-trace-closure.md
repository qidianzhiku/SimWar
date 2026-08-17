# SimWar MW5 Governance Closure

## Document control

| Field                 | Value                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| Document ID           | MW5-GOV-00                                                                  |
| Version               | 1.0                                                                         |
| Date                  | 2026-08-17                                                                  |
| Repository            | qidianzhiku/SimWar                                                          |
| Default branch        | master                                                                      |
| Product PR            | #387                                                                        |
| Product candidate SHA | `2d29d062ce110f55fdd7ef51e5bd240189032104`                                  |
| Product merge SHA     | `30dac8b60603bab63aa1682061cd6917d24d772d`                                  |
| Product merge tree    | `6ed1805681d844980c45a2e7aa9ebc6218ee0da4`                                  |
| Governance PR         | #388                                                                        |
| Governance merge SHA  | PENDING_UNTIL_GOVERNANCE_MERGES                                             |
| Implementation claim  | Bounded, read-only Student DecisionTrace projection implemented with limits |
| Human validation      | NOT_PERFORMED                                                               |
| Pilot / production    | NOT_AUTHORIZED                                                              |
| Repository mutation   | This document and planning-carrier updates only                             |
| automatic_next_start  | false                                                                       |

## Closure outcome

MW5's one Product Mainline outcome is complete with declared limits:

> Student can read a server-authoritative, tenant/run/round/team/role-scoped DecisionTrace that shows safe process milestones without exposing private role payloads, actor identifiers, outcome truth, replay evidence, or learning evidence.

The product implementation is additive and read-only at the projection boundary. It reuses the existing RoleWorkflow repository port and does not create a second formal writer, persistent DecisionTrace aggregate, settlement input, replay truth input, or frontend authority.

## Product merge evidence

PR #387 was the one authorized Product PR. It merged only after the exact candidate head `2d29d062ce110f55fdd7ef51e5bd240189032104` was re-read as open, mergeable, and clean with all required checks passing:

- `quality`: pass
- `browser-smoke`: pass
- `Analyze JavaScript and TypeScript`: pass
- CodeQL: pass

The merge produced `30dac8b60603bab63aa1682061cd6917d24d772d`. A fresh clone was detached at that SHA and verified clean with tree `6ed1805681d844980c45a2e7aa9ebc6218ee0da4`.

## Changed product surface

The merged Product PR contains 13 files across the following bounded surfaces:

- `packages/shared-contracts/src/role-workflow.ts`
- `contracts/schemas/student-decision-trace.v1.json`
- `contracts/fixtures/student-decision-trace.valid.json`
- `contracts/fixtures/student-decision-trace-private.invalid.json`
- `contracts/openapi/p0-api.openapi.yaml`
- `services/api/src/role-workflow.ts`
- `services/api/src/server.ts`
- `apps/student/src/StudentRoleWorkflowPanel.tsx`
- role workflow contract, unit, integration, and browser tests

The route is `GET /api/v1/bff/student/role-workspace/decision-trace`. Its closed object contains scope identity, safe stage milestones, current stage, completeness, and known limits. It does not contain contribution payloads, private peer data, actor IDs, state truth, settlement result, replay hash, or learning evidence.

## Authority and safety closure

The formal command chain remains unchanged:

`Student UI -> Student BFF route -> RoleWorkflowCommandService read projection -> RoleWorkflowRepositoryPort`

The Student surface does not calculate readiness, canonical state, settlement state, score, rank, or result truth. The product service performs exact tenant/run/round/team checks. It additionally fails closed when a repository snapshot returns a round whose run or tenant identity does not match the requested scope, covering the bounded PostgreSQL read-shape risk without changing the PostgreSQL adapter or adding a migration.

The Student request for the trace is non-blocking relative to the existing workspace refresh. Invalid response shape, aborted response, or stale request identity clears only the trace projection and does not replace the already-read workspace with client-inferred state.

## Evidence and validation

Local Product evidence:

- contract gate: 20 files, 49 tests passed;
- role workflow unit/integration focus: 36 tests passed;
- Student UI unit focus: 12 tests passed;
- `npm run typecheck`: pass;
- `npm run build`: pass for all workspaces;
- hidden Unicode: pass;
- lint: pass;
- direct-store boundary: 0 new unapproved runtime direct-store accesses;
- real Role Workflow browser journey: 1 passed in 40.2 seconds;
- default Chromium viewport journey: 1 passed, 1 existing project-condition skip;
- changed-scope Prettier: all changed files pass;
- security audit command: pass at the repository's critical threshold, with inherited 2 low / 7 high dependency advisories;
- bounded PostgreSQL replay: not executed because `SIMWAR_TEST_DATABASE_URL` is absent.

The full local `npm test` run completed 204 test files / 1,302 tests with 198 files / 1,296 tests passing. Six unrelated baseline or concurrent harness failures remain classified rather than rewritten: bad-port fetch setup, three five-second subprocess timeout cases, and the existing PR4 visual baseline timeout. The full repository format gate reports 56 existing files outside this changed scope; all MW5 changed files pass scoped formatting.

The fresh detached post-merge clone reproduced the contract gate (20/49), backend role workflow focus (24/24), Student UI focus (12/12 after building the existing `@simwar/ui` workspace prerequisite), and all-workspace build. The initial UI resolution failure in that clean clone was a missing generated workspace build artifact, not a source failure; it passed after the declared prerequisite.

## Tombstone / no-rebuild rule

The following MW5 capability is now closed and must not be reimplemented under another name:

`MW5-STRUCTURED-STUDENT-DECISION-TRACE` — `CLOSED_AND_CURRENT_WITH_LIMITS`

Future work may extend the projection only through a fresh Product Value Gate and a new owner-authorized wave. It must not create a parallel Student timeline, alternate BFF truth, client-side milestone calculator, or second role-workflow read authority.

This closure does not claim completion of private judgment, separate role position, divergence, resolution, preserved dissent, six-role expansion, publication gate, selected-round repair, BLP, Shanghai, Small Model, Multi-Agent, general PostgreSQL, RLS, human validation, pilot, or production.

## Planning carrier reconciliation

`docs/planning/current-cycle.yaml` and `docs/planning/l1-plus-portfolio-register.yaml` now carry MW5's product merge, current master, closed capability, released Product ownership, explicit limits, and no-automatic-successor rule. Governance PR #388 is recorded; its governance merge SHA remains pending until this exact candidate is merged and is not invented in advance.

## Governance disposition

This is the single MW5 Governance Closure PR. It is documentation/planning-only and must contain no product source, test, contract, migration, branch, runtime, or database mutation. After its exact-head checks and expected-head merge, a fresh detached master readback must bind the final governance merge SHA and tree to the external MW5 evidence receipt.

No successor mission starts automatically. The next legal action after governance merge is owner direction plus a fresh current-reality read, not an automatic PX-J0 or support-lane start.
