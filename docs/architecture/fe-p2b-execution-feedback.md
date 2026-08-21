# FE-19 / FE-20 implementation feedback contract

## Status

- `FIGMA_DISCOVERY=PASS`
- `FIGMA_DESIGN_FREEZE_RECEIPT=PASS`
- `DESIGN_GATE=PASS`
- `FIGMA_TO_CODE_MAP=PASS`
- `BFF_BROWSER_ACCEPTANCE=PASS` for the dedicated real-BFF FE-19/FE-20 journey
- `FINAL_RUNTIME_COMMIT=c890d7f9b8223ca566453b565d71c748148bae90`
- `FINAL_EVIDENCE_HEAD=c890d7f9b8223ca566453b565d71c748148bae90`
- `UNIT=PASS`
- `BUILD=PASS`
- `ROUTE_PERMISSION_BOUNDARY=PASS`
- `AXE=PASS_WITH_DECLARED_LIMITS`
- `HUMAN_VALIDATION=NOT_PERFORMED`
- `FE21/P3=NOT_STARTED`

## Evidence executed

- `npx vitest run tests/unit/p2b-decision-learning.test.tsx tests/unit/p2b-teacher-debrief.test.tsx` — 10/10 passed after the stale-GET-after-reflection regression fix.
- `npm run build:test-prerequisites` — passed.
- `npm run build -w @simwar/ui` — passed.
- `npm run build -w @simwar/student` — passed.
- `npm run build -w @simwar/teacher` — passed.
- `npx playwright test tests/e2e-ui/w3-official-consequence-learning.spec.ts` with alternate local ports — 1/1 passed against the real BFF.
- `npm run test:e2e:ui:p2b` with alternate local ports and the explicit W3 fixture config — 2/2 passed against the real BFF: Student six stages, reflection `201`, Teacher five stages/local note, blocked no-context state, real `422` error and recovery to `200`.
- Student/Teacher refoundation browser suite with alternate local ports — the final rerun passed the exercised tests; an earlier run exposed and then fixed a stale assertion caused by the new Figma-aligned prep card copy.
- Remote CI run `32452935253` — quality and browser-smoke passed; browser-smoke included exact-head, BASE capture, core E2E, M2 real-BFF, PR4 4/4 matrix, P2-B real-BFF, comparator, artifact upload and cleanup.
- Remote CodeQL run `32452935171` — passed.
- Exact BASE comparator — 20/20 pairs passed at the frozen `0.01` global threshold with Student `0.065` role exception; no failures and automatic threshold enforcement enabled.
- Post-merge detached validation at `df36a459` — fresh `npm ci`, typecheck, P2-B unit 10/10 and external-port P2-B browser 2/2 passed.

## Safety boundary

No service, API, DTO, contract, database, settlement, replay, permission, tenant, score, rank, or canonical decision implementation was added. The only network write remains the existing advisory-only student reflection endpoint. Teacher ask/show/listen buttons and stage CTAs are local UI navigation/facilitation state.

## Remaining limits

Product Design MCP was not callable, CodeGraph/Graphify indexes were unavailable, and Amplitude discovery returned no design-relevant value. The independent design review was completed with the structured fallback using the Figma screenshots, hierarchy, action, cognitive-load, responsive, authority, information-separation, accessibility, language, and precision checks. The clean PR4 matrix did execute Axe; the dedicated P2-B spec is intentionally functional/real-BFF rather than a second visual/Axe matrix. Human design approval, production deployment, pilot and FE21/P3 remain deferred. The Figma file is authoritative for design intent; runtime BFF responses remain authoritative for formal data.

The final focused evidence was rechecked against `c890d7f9b8223ca566453b565d71c748148bae90` with exact-head checks enabled. Product PR #415 merged as `df36a45998939ba65d170a996413ee3485fd896c`; the remote quality, browser-smoke and CodeQL gates are green, and the post-merge detached focused validation is complete.

## Remote CI recheck and context-gate remediation

The first remote run for branch tip `6f4064e40fff35ae10afe8d1b7f28199481ce6b2` completed the quality job and CodeQL successfully. Its browser-smoke job failed only in the second P2-B test: the CI W3 fixture supplied a default published record, while the URL contained `w3=true` without a complete Course / Run / Round / Team query context. The Student shell therefore inferred a fallback context instead of showing the required blocked state.

The follow-up fix adds a pure `isW3ContextAvailable` gate. Query-driven P2-B surfaces now require a complete explicit W3 context before they can publish or fetch the official learning projection; the existing explicit environment-enabled demo path remains supported. The regression was reproduced and fixed locally with an external store and alternate ports, then verified by remote CI run `32452935253`. The subsequent review fix invalidates older projection GET responses after a successful reflection POST, updates the cached record, and is covered by the final 10/10 focused unit suite.
