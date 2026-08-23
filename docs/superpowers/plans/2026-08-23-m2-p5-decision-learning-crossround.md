# M2-P5 project-aware decision learning cross-round closure

## Goal

Deliver the V5.22 macro outcome: after an exact published round result, the
existing W3/D3/D4 learning chain and W4 enterprise-state lineage must produce
an exact, read-only next-round entry projection for Teacher and the scoped
Student. The implementation must preserve the existing Decision, Settlement,
Round, Publication, Learning, and EnterpriseState authorities and must keep
counterfactuals non-official and non-persistent.

## Architecture

Add one thin M2-P5 composition boundary. It reads the exact
Course/Run/Round/Team scope, delegates the official consequence to the
existing W3 service, obtains the confirmed-only D4 projection, resolves the
assigned ProjectProfile through the existing Project Library, and verifies the
previous W4 closing reference against the existing W4 opening validator. It
does not persist learning, state, settlement, or round data. Existing W3
commands, D3 confirmation routes, D4 projection routes, W4 state commands, and
the existing Round continuation authority remain the only writers.

The new BFF projection is exposed at an exact scope path for both Teacher and
Student. Existing P2B workspaces consume that projection to show the project
context, learning gate, exact closing/opening lineage, and next-round entry
state. The existing round command remains the action authority; this change
does not create a second continuation writer or an implicit latest/current
reference.

## Tech Stack

- TypeScript/npm workspaces
- Existing Node HTTP API and JSON internal runtime
- Existing `@simwar/shared-contracts` exact-reference patterns
- Existing React Teacher/Student P2B workspaces
- Vitest integration/contract tests and Playwright real-BFF browser coverage

## Spec

1. Add `m2p5-decision-learning-crossround.v1` shared types and a JSON Schema.
   The response must carry exact scope, publication status, W3 consequence,
   confirmed-only D4 report reference, project context, learning gate, and
   cross-round lineage. Student output must be team-scoped and must not expose
   `state_true`, replay internals, teacher-only evidence, or other teams.
2. Add a read-only API composition service and route for
   `/api/v1/bff/{student|teacher}/m2p5/runs/:runId/rounds/:roundNo/decision-learning`.
   The route validates all identifiers and requires explicit `course_id`,
   `round_id`, and `team_id` query values. It must return a blocked projection
   with named reasons when publication, D3 confirmation, D4 report, W4 closing
   state, ProjectProfile, or next-round readiness is missing; it must not infer
   latest/current/default/fallback values.
3. Wire the service into `createApiRuntime` without adding a new repository or
   writer. Reuse the existing W3 service, D4 projection, Project Library,
   W4 service/repository, and Round facade.
4. Add Student and Teacher P2B client/projection cards using the new exact BFF
   response. Preserve the current W3/D3/D4 compatibility workbenches and keep
   all writes on their existing command routes. The UI must visibly distinguish
   `official`, `learning`, `counterfactual`, `closing`, and `next-round` data.
5. Add red/green tests for exact-scope validation, publication gating, student
   team isolation, confirmed-only D4, non-official counterfactual, exact W4
   Closing→Opening binding, project reference provenance, and next-round entry.
   Add contract parity and a real BFF two-round browser test with no route
   mocks, retries, or fabricated state.
6. Record current-source and bounded Vault retrieval evidence in mission-local
   receipts/docs. Historical material can guide wording only; it cannot prove
   current implementation.

## Global Constraints

- One Product PR and at most one remediation commit; no force push.
- One docs-only Governance Closure after Product merge; no W6, Human
  Validation, Pilot, Production, release approval, provider/model activation,
  PostgreSQL/RLS activation, or automatic successor.
- No second truth, settlement, enterprise-state, round, publication, teacher
  confirmation, or student learning-report authority.
- No direct writes to `state_true`, official settlement results, canonical
  decisions, replay hashes, or formal enterprise state from the new boundary.
- No new workflow/state-machine engine and no dependency expansion unless a
  current test requires it.
- Preserve unrelated dirty state in the protected original worktree; all
  development happens in the isolated M2-P5 worktree.
- Before each implementation slice: add one focused failing test and verify
  the expected failure. After each slice: run the focused test, then the
  relevant package/build/contract/browser gates.

## Implementation Steps

1. Add shared types/schema and contract test first; run the focused contract
   test and confirm it fails because the type/route is absent.
2. Add the composition service with pure exact-scope/read-only helpers; add
   service tests for each gate and run them red.
3. Add the BFF route and server wiring; make the integration flow pass without
   changing existing writer services.
4. Add the Student/Teacher projection client and cards; add component tests
   for official/learning/next-round boundaries.
5. Add the real two-round Playwright flow and run the focused red/green browser
   gate using the current BFF and test fixture setup.
6. Run focused quality gates, then the risk-based full local gate, inspect
   exact diff/scope, commit only allowed files, and perform the authorized
   Product PR/Governance workflow with fresh exact-head readback.

## Acceptance Criteria

- A published exact round produces a visible project-aware learning projection
  for Teacher and the authorized Student.
- Missing prerequisites remain explicitly blocked; no implicit reference is
  selected.
- Confirmed D3 evidence is the only source for D4; student output is scoped.
- W4 `source_closing_state_ref` and next-round `opening_state_ref` are exact and
  match; the prior Decision is not copied into the next round.
- Counterfactual output is `official: false` and creates no truth/state write.
- Existing M2P4 behavior stays green, and the new two-round BFF browser path
  passes without mocks/retries.
- Final result is reported with known limits: JSON internal runtime,
  Human Validation not performed, and no Pilot/Production activation.

## Status

READY_FOR_CODEX_EXECUTION
