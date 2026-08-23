# SimWar M2-P5 decision-learning cross-round evidence index

Mission: `SIMWAR-SH-M2-P5-DECISION-LEARNING-CROSSROUND-V5.22-20260823`

Run: `SIMWAR-SH-M2-P5-20260823-DF70AC1765324884971399A09AF7806F`

Prompt SHA-256: `4F8F1C6AB46041F81D615B47472895D5D8BFA1AC45CDC346C4EAB970856EEB86`

Supporting Macro Plan SHA-256: `CE0BC31846932CBB470397376B5A49C1A345A526B758155DFC1E4367EC1CBDED`

## Authority and identity

| Item                   | Value                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| Repository             | `https://github.com/qidianzhiku/SimWar.git`                              |
| Product PR             | [#442](https://github.com/qidianzhiku/SimWar/pull/442)                   |
| Product base           | `6a5e4fcc563706de2acab81945588fbe8869213f`                               |
| Product head           | `e6134ce9a28d2546df514f4b2a728b2f524e1204`                               |
| Product merge          | `2fe9650ee7299cc5c506a75741bdeb97eda3e4b4`                               |
| Product merge tree     | `bbc0bb1d8fb8244219b3b03a0bd18d975a449d8d`                               |
| Product changed files  | 38                                                                       |
| Mission authority pack | `PENDING_ALLOWLIST_PACK_IDENTITY / NOT_FOUND_IN_USER_ATTACHED_DOWNLOADS` |
| Runtime authority      | `JSON_INTERNAL_ONLY`                                                     |
| Human Validation       | `NOT_PERFORMED`                                                          |
| Pilot / Production     | `NOT_AUTHORIZED`                                                         |

## Receipt map

- `PRODUCT_EXACT_HEAD_VALIDATION_RECEIPT.md` — Product head, checks, review
  closure, ordinary merge evidence and exact file-scope statement.
- `POST_MERGE_DETACHED_RECEIPT.md` — fresh detached checkout, dependency
  installation, contract/build and real-BFF browser evidence.
- External bootstrap and command receipts:
  `C:\Temp\simwar-m2p5-SIMWAR-SH-M2-P5-20260823-DF70AC1765324884971399A09AF7806F\`.

## Product file manifest

The Product PR manifest was computed as `git diff --name-only` from the exact
Product base to the exact Product head. It contains 38 paths:

```text
apps/student/src/App.tsx
apps/student/src/P2BDecisionLearningJourney.tsx
apps/student/src/p2b-decision-learning.css
apps/teacher/src/App.tsx
apps/teacher/src/EvidenceWorkbench.tsx
apps/teacher/src/P2BTeacherDebriefWorkspace.tsx
apps/teacher/src/TeacherConfirmationWorkbench.tsx
apps/teacher/src/p2b-teacher-debrief.css
apps/teacher/src/teacher-confirmation-client.ts
contracts/fixtures/m2p5-decision-learning-crossround.invalid.json
contracts/fixtures/m2p5-decision-learning-crossround.valid.json
contracts/openapi/p0-api.openapi.yaml
contracts/schemas/evidence-provenance.v1.json
contracts/schemas/m2p5-decision-learning-crossround.v1.json
contracts/schemas/student-learning-report.v1.json
contracts/schemas/teacher-confirmation.v1.json
docs/superpowers/plans/2026-08-23-m2-p5-decision-learning-crossround.md
package.json
packages/shared-contracts/src/evidence-provenance.ts
packages/shared-contracts/src/index.ts
packages/shared-contracts/src/m2p5-decision-learning-crossround.ts
packages/shared-contracts/src/student-learning-report.ts
packages/shared-contracts/src/teacher-confirmation.ts
playwright.config.ts
scripts/run-m2-p5-browser.mjs
services/api/src/evidence-provenance.ts
services/api/src/m2p5-decision-learning-crossround.ts
services/api/src/routes/m2p5-decision-learning-crossround-routes.ts
services/api/src/server.ts
services/api/src/teacher-confirmation-work-claim.ts
tests/contract/m2p5-decision-learning-crossround-contract.test.ts
tests/e2e-ui/m2-p5-decision-learning-crossround-fixture.ts
tests/e2e-ui/m2-p5-decision-learning-crossround.spec.ts
tests/e2e-ui/store-isolation.ts
tests/integration/d2-evidence-provenance-endpoint.test.ts
tests/integration/m2p5-decision-learning-crossround-http.test.ts
tests/integration/m2p5-decision-learning-crossround-route.test.ts
tests/unit/m2p5-decision-learning-crossround.test.ts
```

## Validation summary

| Gate                                          | Result      | Evidence                                                   |
| --------------------------------------------- | ----------- | ---------------------------------------------------------- |
| Product GitHub `quality`                      | PASS        | Exact Product head                                         |
| Product GitHub `browser-smoke`                | PASS        | Exact Product head                                         |
| Product GitHub TypeScript/JavaScript analysis | PASS        | Exact Product head                                         |
| Product GitHub CodeQL                         | PASS        | Exact Product head                                         |
| Product review conversations                  | PASS        | 4/4 resolved before merge                                  |
| Product typecheck                             | PASS        | Isolated Product worktree                                  |
| Product lint                                  | PASS        | Isolated Product worktree                                  |
| Product contract gate                         | PASS        | 33 files / 79 tests                                        |
| Detached `npm ci`                             | PASS        | No dependency mutation                                     |
| Detached contract gate                        | PASS        | 33 files / 79 tests                                        |
| Detached build chain                          | PASS        | Shared, agent, simulation, API and UI builds               |
| Detached real-BFF browser                     | PASS        | 1/1; ports 3320-3323; mocks=0; retries=0                   |
| Default browser ports                         | ENV BLOCKED | `127.0.0.1:3100 EACCES`; isolated rerun passed             |
| Local concurrent full `npm test`              | ENV LIMITED | Unrelated timeout-sensitive tests; remote `quality` passed |
| Full WCAG/Human Validation                    | NOT RUN     | Explicitly outside this mission                            |
| PostgreSQL/RLS runtime                        | NOT RUN     | Explicitly not activated                                   |

## Boundary statement

This evidence proves a bounded read projection over existing authorities. It
does not prove a new Truth writer, settlement authority, round writer,
publication writer, enterprise-state writer, provider, model, W6, Pilot,
Production or automatic successor.
