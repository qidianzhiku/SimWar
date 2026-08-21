# P2-B Decision Learning and Teacher Debrief Governance Closure

## Decision

FE-19 and FE-20 are accepted as a bounded frontend/read-model product change. Product PR #415 was merged as `df36a45998939ba65d170a996413ee3485fd896c` after final head `c890d7f9b8223ca566453b565d71c748148bae90` passed the remote quality, browser-smoke, and CodeQL gates. This is not an authority expansion and is not a production-readiness declaration.

## Product and provenance

- Repository: `qidianzhiku/SimWar`
- Product PR: [#415](https://github.com/qidianzhiku/SimWar/pull/415)
- Product base: `298fcf1236734978501930071124d1f7818ad219`
- Final product head before merge: `c890d7f9b8223ca566453b565d71c748148bae90`
- Merge commit on `master`: `df36a45998939ba65d170a996413ee3485fd896c`
- Final product CI: [CI run 32452935253](https://github.com/qidianzhiku/SimWar/actions/runs/32452935253) — success
- Final product CodeQL: [CodeQL run 32452935171](https://github.com/qidianzhiku/SimWar/actions/runs/32452935171) — success

## Protected boundaries

- No `services/`, `contracts/`, `db/`, `packages/shared-contracts/`, settlement, replay truth, canonical Decision, permission, tenant, or model-provider files were changed for the product surface.
- Student visibility remains publication-gated by the existing redacted-result projection.
- Teacher What-if remains teacher-generated, non-official, one-change, exact-context, and read-only for the learner.
- Reflection and teacher notes remain advisory/local learning inputs. They cannot enter formal settlement truth. Reflection serialization uses a W3-safe non-control delimiter; the final review regression checks that no ASCII control character enters the request body.
- Existing W3 command controls remain server-authorized; the new P2-B surfaces do not invent a writer.
- The FE-20 blocker stage receives the existing computed teacher `blockerSummary` rather than a fixed all-clear message.
- Cohort progress does not fabricate Team A/Team B learning judgments. Until a teacher-safe cohort projection exists, the UI reports only the observed team count and states the limitation.

## Figma and design evidence

- Figma file: `6ezOykmrZbMbFEYPfIkZ07`
- Figma page: `39:2`
- P2-B top-level frames inspected: 24
- Recursive overflow validation: zero violations
- Design context read from node `40:28` before implementation
- Existing React/CSS and shared tokens were reused; no Tailwind or new design-system runtime was introduced.

## Evidence ledger

| Area                            | Evidence                                                                                                                                           | Result                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| FE-19 unit                      | `tests/unit/p2b-decision-learning.test.tsx`; publication firewall, six stages, safe W3 response, identity reset, control-character-free reflection | PASS                                                                              |
| FE-20 unit                      | `tests/unit/p2b-teacher-debrief.test.tsx`; five stages, teacher-safe copy, local note boundary, no fabricated cohort rows                          | PASS                                                                              |
| Review regression unit          | P2-B + Student refoundation + PR4 focused unit set                                                                                                 | PASS; P2-B final focused set 10/10, with the final remote quality gate also green |
| Existing Student regressions    | `tests/unit/ui-student-refoundation.test.tsx` including D4 publication firewall                                                                    | PASS                                                                              |
| Existing Teacher/W3 regressions | `tests/unit/ui-teacher-refoundation.test.tsx`, `tests/unit/w3-official-consequence-learning.test.ts`                                               | PASS in remote CI                                                                 |
| Browser-smoke                   | Core UI, M2 real-BFF journey, PR4 visual/a11y/performance evidence, P2-B real-BFF, and comparator                                                  | PASS in CI run 32452935253                                                        |
| Type/build                      | `npm run typecheck`, Student/Teacher builds, full repository build                                                                                 | PASS in local/remote gates                                                        |
| Full unit suite                 | `npm test`, contract, Postgres replay, typecheck, lint, build, direct-store and bundle gates                                                       | PASS in remote quality job `32452935253`                                          |

The local browser run used custom API/UI ports because port 3100 was occupied by an unrelated local process. That process was not stopped or modified. CI used detached exact-head worktrees, external Playwright stores/evidence roots, and exact SHA checks.

## Capability status

- Figma: `VERIFIED`; read-only page/frame/component/variable/design-system evidence available.
- Product Design connector: `BLOCKED`; no callable operation was available, so the structured fallback review remains the recorded evidence.
- CodeGraph: `FALLBACK_SOURCE_TEST_GIT`; no usable exact-worktree graph index was available.
- Graphify: `FALLBACK`; required graph artifact was absent.
- Amplitude: `NO_VALUE_THIS_WAVE`; no Amplitude SDK or tracking call was introduced.
- Codex code-audit connector: `BLOCKED` by transport; local source/test/diff evidence was used.

## Security and release posture

`npm run security:audit` reports existing dependency advisories (2 low, 7 high); no audit fix was applied in this frontend-only change. The product is `POST_MERGE_VERIFIED_NOT_PRODUCTION`: human usability validation, pilot evidence, production deployment approval, and closure of pre-existing dependency advisories remain outside this change.

Post-merge detached validation at `df36a459` performed fresh `npm ci`, typecheck, P2-B unit 10/10, and external-port real-BFF P2-B browser 2/2. The detached worktree was clean and removed after validation. Governance issue #416 was closed as completed.

This governance document is intentionally separate from the product PR and is the post-merge evidence closure for FE-19/FE-20. It does not change application authority, visibility, settlement, replay, tenant, or permission behavior.
