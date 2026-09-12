# GSI-O3 Baseline Plan (No Local Knowledge)

Mission: `SIMWAR-LK-V4.2-MAIN-GSI-O3-CROSS-ROUND-INSIGHT-CONSUMER-ADOPTION-MACRO-06-20260911`

Baseline captured against the clean feature worktree at `origin/master` commit `1e668f705c842e39486f46a93a9d14e0a970cb57` before any Local Knowledge query.

## Current source reality

- The existing GSI backend already owns the compare seam at `/api/v1/bff/{teacher|student|admin}/gsi/candidates/compare`.
- The existing shared contract already defines `GSICrossRoundTeacherProjection` and the role-safe `GSICrossRoundStudentProjection`.
- Teacher currently renders `GovernedStakeholderIntelligenceWorkspace`, which creates a candidate; it does not render a cross-round compare response.
- Student currently renders `GovernedStakeholderIntelligenceProjection`, which reads one published candidate; it does not render a cross-round compare response.
- Existing compare unit, route, BFF integration, contract, and backend service tests are present.
- No exact `compareCandidates` or `/gsi/candidates/compare` consumer was found in either public `apps/teacher/src/App.tsx` or `apps/student/src/App.tsx`.

The existing candidate create/read projection is not equivalent to the requested cross-round consumer because it has no explicit pair selection, movement rendering, context status handling, or compare error recovery.

## No-Knowledge implementation hypothesis

1. Add a small shared UI component that accepts an explicitly selected candidate pair and the existing exact activity/role context.
2. Reuse the existing compare endpoint and shared projection types; add no route, service, store, writer, or truth authority.
3. Render the Teacher version in the existing result/debrief area with descriptive movement and context status.
4. Render the Student version in the existing result cockpit/debrief area with only the role-safe movement fields returned by the Student BFF.
5. Keep the feature dormant unless all exact selectors are supplied by the URL, so there is no implicit `latest`/`current`/`default` fallback and no invented candidate discovery.
6. Add explicit loading, success, unavailable, rebase-required, forbidden/error, and insufficient-context states.
7. Add focused unit and browser coverage using the existing BFF route and deterministic explicit selectors.

## Baseline judgement

Without Local Knowledge, the expected implementation is `EXTEND_EXISTING`: the backend compare capability and contracts are present, while the role-safe product consumers are absent. No new GSI backend should be built. The baseline does not claim that Local Knowledge caused this conclusion.

## Scope and truth guardrails

- Allowed: Teacher/Student UI consumer, focused tests, and minimal UI styling.
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

`BEFORE_KNOWLEDGE_PLAN` records the judgement before any knowledge retrieval. A value event may only be recorded later when a knowledge card has source evidence, an accepted before/after delta, a changed task artifact, and an actual developer action. If retrieval only confirms this plan, the result is `CONFIRMATORY_ONLY`, not value proven.
