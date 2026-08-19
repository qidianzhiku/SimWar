# W3 Official Consequence, Decision Learning

## Goal

Deliver one bounded W3 journey from the already-authorized W027 canonical
Decision and existing round lock, settlement, and publication authorities to a
role-safe consequence view, one-change bounded counterfactual, reflection,
evidence selection, Teacher Confirmation linkage, and a next-round hypothesis.

The W3 layer is an orchestration and learning-evidence surface. It does not
become a second Truth, SettlementResult, Replay, canonical Decision, D2
EvidenceArtifact, D3 Teacher Confirmation, or D4 StudentLearningReport writer.

## Current source contracts to reuse

- `services/api/src/server.ts` remains the sole route composition point for
  round start, decision admission, round lock, settlement, publication, and
  safe result projection.
- `services/api/src/canonical-decision-admission.ts` remains the canonical
  Decision gate used by settlement.
- `services/api/src/evidence-provenance.ts` remains the D2 EvidenceArtifact
  writer.
- `services/api/src/teacher-confirmation.ts` remains the D3 Teacher
  Confirmation writer.
- `services/api/src/student-learning-report-projection.ts` remains the D4
  read-only StudentLearningReport projection.
- Existing audit-log repository ports provide the append-only JSON runtime
  ledger for W3 lifecycle receipts; W3 records are never treated as formal
  settlement or learning-report authority.

## Contract and acceptance freeze

1. Add a shared W3 DTO and runtime validator for exact round context,
   official publication receipt, role-safe consequence layers, bounded
   counterfactual receipt, reflection, evidence selection, confirmation
   linkage, and next-round hypothesis.
2. Add JSON Schema, valid/invalid fixtures, OpenAPI entries, and contract
   tests. The schema must reject cross-tenant/context mismatches, raw private
   payload fields, official-result overwrite fields, multi-variable
   counterfactuals, and causal claims without model-conditioned labeling.
3. Freeze A01-A20 in the external W3 Evidence Root before product mutation.

## Backend implementation

1. Add a W3 orchestration service that reads the existing Run, Round,
   canonical-admission, SettlementResult, D2 artifacts, D3 confirmations, and
   D4 report projections through repository/service ports.
2. Add the Teacher and Student BFF routes:
   - Teacher preview and publication/consequence readback;
   - one-change counterfactual request;
   - reflection/evidence-selection lifecycle receipts;
   - next-round hypothesis readiness.
3. Route commands must enforce tenant, course, run, team, role and round
   scope; require a published official result for Student access and
   counterfactuals; and append audit receipts with deterministic idempotency.
4. Reuse the existing D3 confirmation command/query and D4 projection. W3
   only records links and learning trace metadata in the existing audit ledger.
5. Do not modify simulation-core semantics, Replay hash inputs, settlement
   result shape, canonical decision selection, database schema, or runtime
   provider selection.

## Frontend implementation

1. Add a Teacher W3 workbench consuming the BFF only. It must expose exact
   context, publication state, evidence/provenance, counterfactual guardrails,
   reflection and confirmation readiness.
2. Add a Student W3 consequence/debrief surface consuming the Student BFF
   only. It must render role-safe result, Decision Story, bounded causal
   labels, reflection, confirmed learning evidence and next-round hypothesis.
3. Add loading, empty, forbidden, stale, failed, unpublished and known-limit
   states. No Student component may read repository/store data or private raw
   event payloads.
4. Add browser coverage against the real BFF with zero route mocks.

## TDD and validation sequence

1. Add RED unit, integration, contract and browser characterization tests for
   all W3 firewall rules and the end-to-end lifecycle.
2. Run the focused tests and record the expected RED result.
3. Implement the shared contract, service, routes and UI.
4. Run GREEN focused tests, contract validation, direct-store boundary,
   hidden-Unicode, typecheck, lint, build, security audit and default full
   `npm test`.
5. Run real Chromium W3 Student and Teacher journeys, then the W019/W027
   regression floor.
6. Run current-source Graphify or repository-native graph fallback and record
   CodeGraph unavailable if no `.codegraph/` index is present.
7. Freeze one clean exact head, independently review it from zero, and create
   one integrated Product PR only after all gates are green.

## Integration and closure

1. Perform one ordinary merge attempt only under a new exact-head Owner
   decision bound to the actual base, head, manifest, checks and review state.
2. Validate the merge in one fresh detached clone using the default commands.
3. Create at most one docs-only Governance Closure after Product Acceptance
   is frozen. Record the actual product merge, fresh-clone and acceptance
   evidence digests.
4. Stop after closure; do not start a successor automatically.

## Explicit non-goals

- No second Truth, SettlementResult, Replay, canonical Decision, D2, D3 or D4
  authority.
- No AI final grade, Score/Rank mutation, Student visibility widening, raw
  private payload projection, PostgreSQL/RLS activation, Pilot, Production,
  Human Validation claim, or successor implementation.
