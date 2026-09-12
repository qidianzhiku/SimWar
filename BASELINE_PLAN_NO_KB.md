# GSI-O3B Baseline Plan (No Local Knowledge)

Mission: `SIMWAR-LK-V4.2-MAIN-GSI-O3B-EXPLICIT-SELECTOR-HANDOFF-REACHABILITY-MACRO-07-20260911`

Baseline refreshed on 2026-09-12 against the clean feature worktree at PR #512 head `aac05c7b705d2e3a13a1b02243613935f3d1ea6a`, whose current GitHub base is `master` at `1e668f705c842e39486f46a93a9d14e0a970cb57`, before any Macro-07 Local Knowledge query.

## Current source reality

- The existing GSI backend already owns the compare seam at `/api/v1/bff/{teacher|student|admin}/gsi/candidates/compare`.
- The existing shared contract already defines `GSICrossRoundTeacherProjection` and the role-safe `GSICrossRoundStudentProjection`.
- Teacher currently renders `GovernedStakeholderIntelligenceWorkspace`, which creates a candidate; the existing cross-round panel can render a compare response only when exact selectors are already supplied.
- Student currently renders the existing cross-round panel in debrief, but exact selectors must already be supplied; the normal Teacher flow does not hand them off.
- Existing compare unit, route, BFF integration, contract, and backend service tests are present.
- No visible candidate-pair selector or Teacher-to-Student explicit handoff was found in either public app.

The existing candidate create/read projection and URL-only compare consumer are not equivalent to the requested normal-flow handoff because they do not expose an explicit pair selection in the Teacher debrief or a generated Student handoff.

## No-Knowledge implementation hypothesis

1. Propagate receipts from the existing Teacher candidate producer into the current exact run/team scope.
2. Add a small shared UI selector surface that accepts an explicitly selected candidate pair and exact activity/role context.
3. Reuse the existing compare endpoint and shared projection types; add no route, service, store, writer, or truth authority.
4. Keep the existing URL/prop selector path backward compatible and fail closed when exact selectors are absent or reserved.
5. Render the Teacher version in the existing debrief area with descriptive movement and context status, plus a generated Student handoff link only after explicit submission.
6. Render the Student version with only the role-safe movement fields returned by the Student BFF; no privileged candidate identity is added.
7. Add focused unit and browser coverage using the existing BFF route and a visible Teacher selection and handoff journey.

## Baseline judgement

Without Local Knowledge, the expected implementation is `EXTEND_EXISTING`: the backend compare capability and contracts are present, while the role-safe product consumers are absent. No new GSI backend should be built. The baseline does not claim that Local Knowledge caused this conclusion.

## Scope and truth guardrails

- Allowed: Teacher/Student UI consumer, candidate-receipt state handoff, focused tests, and minimal UI styling.
- Forbidden: simulation-core, settlement, replay truth, canonical decisions, database migrations, Provider activation, or a second GSI backend seam.
- Compare output remains descriptive/non-causal and cannot write official truth.
- Student output must not expose candidate IDs, comparison digest, raw proposals, or privileged provenance identifiers.
- Figma target is unresolved/non-blocking; no parity claim and no Figma writes.

## New-file justification and duplicate capability check

- `packages/ui/src/components/GsiCrossRoundInsightPanel.tsx` is required because no current public Teacher or Student component consumes the existing cross-round compare projection; the existing GSI components create or read one candidate and cannot render pair movement, context, and rebase states.
- The shared component is intentionally a consumer-only adapter with role-specific render branches. It reuses the existing compare BFF and shared projection types, so it does not create a second route, service, store, registry, writer, or truth authority.
- `tests/unit/gsi-cross-round-insight-panel.test.tsx` is required to protect explicit selector validation, Student field redaction, and error-state classification at the new consumer boundary.
- The browser test extension is limited to the existing GSI shadow-plane journey file because it is the current verified harness for Teacher/Student GSI BFF journeys; it adds no new fixture authority or product mutation path.

## Validation plan

- Existing GSI compare contract, route, service, and BFF tests.
- New component tests for explicit selectors, role-safe fields, and state classification.
- `npm run typecheck`.
- `npm run build`.
- Focused browser journey for Teacher and Student success/unavailable/rebase-safe states if the local UI harness is available.

## Value-proof baseline

`BEFORE_KNOWLEDGE_PLAN` records the judgement before any Macro-07 knowledge retrieval. A value event may only be recorded later when a knowledge card has source evidence, an accepted before/after delta, a changed task artifact, and an actual developer action. If retrieval only confirms this plan, the result is `CONFIRMATORY_ONLY`, not value proven.
