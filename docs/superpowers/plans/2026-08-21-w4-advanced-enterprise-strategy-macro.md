# W4 Advanced Enterprise Strategy Product Macro

## Authority and execution boundary

The owner-selected goal is the uploaded W4 Prompt, with the uploaded W4
Macro Development Plan as its implementation design. The two DOCX files are
requirements and design inputs; their historical claims about repository
state are not current-reality evidence. Current source, exact `origin/master`,
runtime behavior, contracts, tests, and fresh GitHub readback take precedence.

Execution is isolated to branch `codex/w4-aes-p-a-20260821` in
`D:\codex\worktrees\simwar-w4-aes-20260821`. The pre-existing dirty worktree
`D:\codex\SimWar-p1-012-deep-snapshot-entity-validation` is out of scope and
must remain byte-for-byte untouched. Product implementation is MAIN-only;
PAR may produce read-only analysis or tests but does not write shared truth.

## Current-reuse gap matrix

The existing repository already provides the following reusable authority:

- `services/api/src/w4-enterprise-state.ts` owns W4 state transition,
  admission validation, Commitment/Effect/Initiative compilation, exact state
  references, replay bindings, and non-writing policy seams.
- `services/simulation-core/src/enterprise-state.ts` is the sole W4 state
  transition calculation.
- `services/api/src/canonical-decision-admission.ts` resolves the formal
  RoleWorkflow -> merge -> TeamConfirmation -> canonical Decision path.
- Project-aware launch and Project Library services bind a course/run to an
  exact ProjectProfile and assignment.
- Student, Teacher, and Admin W4 BFF routes already provide role-scoped
  projections and path evidence, with the Student projection omitting cash.

The first verified gap is P-A admission binding: the W4 route resolves the
formal canonical Decision identity, but its current `admitStrategicDecision`
callback only compares team/round identity and then stamps the submitted
payload digest onto a new W4 canonical record. A direct Student W4 request can
therefore present a different strategic payload while claiming the formal
admission. P-A starts with a RED integration test proving that the submitted
typed action must match the formal canonical Decision payload, kind, and
version, or fail closed without writing W4 records.

Remaining gaps are staged and must not be solved by a second truth writer:

| Epoch | Reuse                                                | Gap to close                                                                              | Authority boundary                                        |
| ----- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| P-A   | W4 service + RoleWorkflow admission                  | Typed strategic action envelope, exact payload binding, commitment/effect/lead-time UI    | Existing W4 service + canonical admission                 |
| P-B   | ProjectProfile/Assignment + W4 portfolio             | Multi-project lifecycle, OperatingUnit activation, M&A transaction state machine          | Existing repository/application ports; MAIN integrates    |
| P-C   | Existing run runtime inputs + W4 cash projection     | Capital constraints and cross-round capital action, or explicit fail-closed dependency    | No second finance/ledger writer                           |
| P-D   | State refs, replay manifests, W3 comparison evidence | Matched arena and non-writing counterfactual with exact lineage                           | Existing official settlement and shadow replay boundaries |
| P-E   | Existing BFF surfaces and frontend workbenches       | Strategy Studio, role-safe student portfolio/capital/timeline, admin audit and G4 journey | Existing BFF projections; no client truth computation     |

## TDD sequence

1. Add the P-A RED integration test for a formal-run strategic payload mismatch
   and assert `W4_DECISION_PAYLOAD_BINDING_CONFLICT`, unchanged W4 repository
   state, and no second canonical writer.
2. Implement the smallest admission fix: compare submitted kind/version/payload
   digest with the exact formal canonical Decision before compiling W4 state.
3. Add RED/GREEN coverage for the four typed action kinds, unknown keys,
   stable error codes, and digest determinism. Keep `new_project` validation
   compatible with existing fixtures; extend schemas only with explicit
   closed payload contracts.
4. Add Student role-source/confirmation/cost/lead/reversibility/dependency/KPI
   hypothesis projection fields without exposing restricted truth fields.
5. Run the focused W4 and canonical-admission suites serially. Treat the
   existing full parallel `npm test` failure as a baseline resource limitation
   until a controlled full gate is repeated.
6. Commit only the P-A product scope, run review, exact-head checks and heavy
   gate once, then open a Product PR. Continue P-B only from the fresh merged
   head and a new current-reality readback.

## Macro exit gates

The final macro may be `MACRO_PASS` or `MACRO_PASS_WITH_LIMITS` only when the
Prompt's P-A through P-E/G4 evidence pack is complete: at least four Product
PRs unless an explicit scope collapse is accepted, formal project-aware
governed action admission, lifecycle/capital consequence or explicit
fail-closed dependency, exact state lineage, matched arena, non-writing
counterfactual, real Student/Teacher/Admin BFF evidence, one writer, exact
head/check/replay evidence, and unchanged Human/Pilot/Production status.

The evidence pack must be written outside the source repository under
`D:\DcodexSimWar-reference\_vault-reports\SIMWAR-PRODUCT-MACRO-AES-01-20260821`.
