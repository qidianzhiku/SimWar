# P2-A Student / Team Decision Journey — Governance Closure

Date: 2026-08-20  
Mission: `SIMWAR-FE-P2A-STUDENT-TEAM-DECISION-JOURNEY-001`  
Product PR: [#408](https://github.com/qidianzhiku/SimWar/pull/408)  
Product merge SHA: `5287b85fbeed847afc58297cd5d30e5cc7b3ffc5`  
Product head before merge: `1aee8d63406d4f336eba91b10f84bcf37fc4fda5`  
Base SHA: `43e96368c71884c085700aad37479419bbc17127`

## Closure statement

P2-A is merged as a bounded frontend slice. The implementation keeps the existing
hash-based Student surface and server-controlled role workflow; it does not add a
route, a second canonical decision writer, a client-side permission source, or a
new truth/settlement path. This document records the post-merge evidence and the
remaining limits so the commercial handoff does not overstate what was verified.

## Figma and Product Design provenance

- Figma file: [`6ezOykmrZbMbFEYPfIkZ07`](https://www.figma.com/design/6ezOykmrZbMbFEYPfIkZ07)
- Read-only reference frames: `34:2` (Student / Ready / Desktop) and `36:2`
  (Prototype Flow / Desktop).
- No Figma node, component, variable, style, or prototype mutation was made.
- The relevant Figma structure is the Student portal flow plus the prototype
  journey lane: Enter → Observe → Draft → Validate → Confirm → Feedback. The
  existing file also contains the 26 local variables and the ActionButton,
  StateBadge, StatePanel, and FormField component sets recorded in the P2-A audit.
- Direct mappings are to the existing `AppShell`, `RoleNavigation`, `StatePanel`,
  W027 private-judgment surface, and `StudentRoleWorkflowPanel`; Figma remains a
  visual/interaction specification and is not an authority for tenant, role,
  permission, canonical decision, settlement, or replay truth.
- Product Design MCP had no callable operation in this run, so the critique and
  mapping were completed through the repository's structured fallback. Figma Code
  Connect remains blocked by the connected account's seat limitation. No paid-seat
  workaround or retry was attempted.

## FE-15 → FE-18 and route mapping

The journey remains on the existing Student root (`/`) with hash locations:

| Journey slice                | Existing location/code                                                                           | Governance boundary                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FE-15 role mission           | `#student-role-mission`, `App.tsx`, `StudentRoleWorkflowPanel.tsx`                               | Server-projected role, responsibility, roster, permissions, and trace stage; no client-authored authority.                                                               |
| FE-16 private judgment       | `#student-private-draft`, `#student-w027-decision-experience`, `W027DecisionExperiencePanel.tsx` | Private full text is self-only; safe role positions are server projections.                                                                                              |
| FE-17 divergence/dissent     | `#student-divergence` and W027 resolution/acknowledgement surfaces                               | Commands are server permission-gated; acknowledgement requirements are seeded from the active server roster and unioned with assignment/candidate/acknowledgement roles. |
| FE-18 merge/confirm/readback | `#student-confirmation`, `#student-submission`, `#student-results`                               | `StudentRoleWorkflowPanel` remains the only merge/confirm writer; published result/readback remains server-owned.                                                        |

The active-roster seed closes the duplicate-value divergence gap: a required role
cannot disappear merely because two active roles share the same candidate value,
and the UI does not assume an unassigned CHRO/CEO member exists.

## Implementation and safety scope

Product PR #408 changed only the bounded frontend/test/documentation surface for
this journey. It did not change services, API/BFF DTOs, contracts, schemas,
repositories, tenant filtering, permission policy, simulation-core, settlement,
canonical decision selection, replay hash inputs, or database code. The Student
frontend still submits only server-allowed role commands and keeps W027 private
judgment outside formal settlement truth. No Advisor/W020 source was changed.

## Validation receipt

### Remote merge validation

- GitHub PR #408 was merged with the exact head SHA above; protected checks were
  required and were not bypassed.
- Quality workflow run `32403044697` completed successfully, including the
  repository test/contract/Postgres-replay/build/budget gates recorded by the
  product workflow.
- CodeQL workflow run `32403044717` completed successfully.
- The first browser attempt hit an unchanged
  `tests/e2e-ui/instructor-intelligence.spec.ts:238` expectation mismatch
  (`run created` vs `round continued`). The failed browser job was rerun once;
  the rerun completed core E2E, PR4 E2E, BASE↔candidate visual comparison, and
  artifact cleanup successfully. This is recorded as a transient shared-state
  test-order failure, not as a product-code bypass.

### Post-merge exact worktree

Post-merge validation ran in the detached, clean worktree
`C:\Users\Marshall\AppData\Local\Temp\simwar-p2a-postmerge-5287b85` at
`5287b85fbeed847afc58297cd5d30e5cc7b3ffc5`:

- `npx vitest run tests/unit/student-team-decision-journey.test.tsx tests/unit/ui-student-refoundation.test.tsx --config vitest.config.ts --reporter=dot` — **2 files / 28 tests passed**.
- `npm run typecheck` — **passed**.
- `npm run build -w @simwar/student` — **passed**; Student CSS output was 28.59 kB and the production Vite build completed.
- `npx playwright test tests/e2e-ui/role-workflow-product-journey.spec.ts --config playwright.role-workflow.config.ts --project=role-workflow` — **1 passed** (real Teacher → Student role assignment/confirmation flow).
- `npx playwright test tests/e2e-ui/ui-refoundation-student.spec.ts --config playwright.config.ts --project=chromium` — **4 passed** across the 1440, 1280, 1024, and 390 width contracts.
- The post-merge worktree was clean after the checks and no owned application ports remained listening.

## Known limits and handoff conditions

- The focused and remote browser evidence is not a substitute for human visual
  approval, a full screen-reader review, or a complete WCAG audit. The P2-A audit
  did not claim complete contrast, keyboard-order, focus-return, 200% zoom, or
  production visual approval.
- The local React recovery test emits a non-failing `act(...)` warning; it does
  not change the 28/28 result.
- `npm ci` reports nine dependency advisories (two low, seven high) in the
  post-merge worktree. The repository security gate/critical threshold remained
  successful; dependency remediation is a separate supply-chain task.
- Figma Code Connect is still seat-blocked, Product Design MCP was unavailable,
  and CodeGraph was absent in the clean candidate worktrees. Source, tests, Git,
  and the existing Figma read-only receipt are the evidence sources used here.
- The existing route/state matrix deliberately retains source/not-captured and
  known-limit cells. This closure must not be read as universal route coverage,
  universal state coverage, or a claim that every Figma flow has a live open-round
  backend fixture.

## Status

`SPEC_COMPLIANCE=PASS_WITH_DECLARED_LIMITS`  
`ARCHITECTURE_SAFETY=PASS`  
`READY_FOR_PUBLICATION=PASS_WITH_DECLARED_LIMITS`

Publication is bounded by the explicit visual, human-validation, Figma seat,
Product Design MCP, CodeGraph, accessibility, and route/state limitations above.
