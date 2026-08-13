# SimWar UI / Frontend Experience Refoundation Governance Closure

Date: 2026-08-14  
Final product master: `59bad25e093f99d81256511060194be865f057d7`  
Closure type: the one and only docs-only Governance Closure PR for this macro wave

## Product PR ledger

| Wave                     | Pull request                                               | Merge commit                               | Result |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------ | ------ |
| PR1 foundation           | #373 `feat(ui): establish frontend experience foundation`  | `8bb489c8f92d04919bcea98cc95fc3c4d4a18bc0` | Merged |
| PR2 Admin / Teacher      | #375 `feat(ui): migrate Admin and Teacher workspaces`      | `dc6ac079406f298f1b5f3f9a0b7f64fef8cb4b31` | Merged |
| PR3 Student / Enterprise | #376 `feat(ui): migrate Student and Enterprise workspaces` | `7387a4fb6a007f3a73d9b18aaafb0e58c2256b10` | Merged |
| PR4 integration gates    | #377 `feat: complete PR4 frontend quality gates`           | `59bad25e093f99d81256511060194be865f057d7` | Merged |

## Closure readback

- Design mode: `CODE_FIRST_FALLBACK`. Figma Starter-plan limits prevented a truthful writable final-screen / Code Connect closure; no paid upgrade or fabricated Figma completion was used.
- Figma file: `NOT_USED` for final authority. The repository design principles, tokens, component library, route/state inventory, screenshots, and exact-SHA manifests are the code-first source.
- Design system: PASS. `@simwar/ui` supplies AppShell, navigation, authority, state, limit, action, and workbench primitives; DesignSystemLab runs as a real browser surface on port 3004.
- Workspaces: Admin PASS; Teacher PASS; Student PASS; Enterprise `PASS_WITH_EXPLICIT_CURRENT_CONTRACT_LIMIT` as the existing Admin read-only logical projection, with no independent app, BFF, route, authority, command, or writer.
- Simplified Chinese UI: PASS for primary visible product copy. Immutable identifiers and bounded compatibility/a11y labels remain where required by existing contracts.
- Interaction / visual direction: Apple interaction principles PASS; business-school editorial visual identity PASS; Harvard/HBS/HBR brand asset usage `0`.
- Route coverage: `34/34 = 100%` current logical hash destinations (Admin 10, Teacher 12, Student 12). Enterprise is an Admin projection rather than a duplicate route.
- Page inventory: 39 classified rows.
- State classification: PASS as a rectangular classification artifact: 32 rows x 15 columns = 480 cells, 458 applicable after 22 N/A cells. This does not mislabel source-backed, not-captured, known-limit, contract-gap, or not-implemented cells as runtime observed.
- Accessibility: `WCAG_2_2_AA_PASS_WITH_AUTOMATED_EVIDENCE` for the automated contract: Axe serious/critical and WCAG-tagged moderate checks, keyboard skip path, focus, current location, target size, reduced motion, 200% text/overflow, and disabled-action explanations. The exact Teacher advisory-list `aria-prohibited-attr` node remains issue #365/W020-owned; its descendants and all other Axe rules remain scanned.
- Responsive: PASS at 1440x900, 1280x800, 1024x768, and 390x844.
- Visual regression: PASS. Remote run `31727399201` independently captured exact BASE `7387a4fb6a007f3a73d9b18aaafb0e58c2256b10` and compared 20/20 images with exact HEAD `8be563795fe8152981a99b3e1f6d8283bcb4ab34`; global threshold `0.01`, frozen Student-only active-navigation threshold `0.065`, zero failures.
- Runtime performance: PASS. 12/12 product rows and 4/4 DesignSystemLab rows were within first-usable, hash-navigation, and CLS budgets.
- Functional regression: PASS. Required GitHub checks `quality`, `browser-smoke`, JavaScript/TypeScript CodeQL analysis, and CodeQL status passed on the final product tree.
- Role journey: PASS for Admin, Teacher, Student fresh identity, role workflow, team decision, result/debrief, validation session, and permission/tenant negatives through the inherited and focused browser suites.
- Authority / visibility: PASS. Frontend direct-store new violations `0`; Student visibility widening `0`; tenant/role permission widening `0`; authority breach `0`; settlement, canonical decision, score/rank, Replay inputs, BFF contracts, and database adapters unchanged.

## Fresh-clone acceptance

A new detached clone of remote master at `59bad25e093f99d81256511060194be865f057d7` was created under the system temporary directory. Its tree exactly matched PR #377 head tree. The clone was clean and passed:

- `npm ci`
- `npm run check:hidden-unicode`
- `npm run check:direct-store-boundaries` (zero new unapproved/stale/duplicate/broad/ambiguous access)
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit:pr4` (4 files / 49 tests)
- `npm run test:contract` (20 files / 48 tests)
- full Vitest coverage (198 files / 1273 tests) with a local `--testTimeout=15000` budget after three default 5-second timeout attempts failed at different, individually passing tests
- `npm run build`
- core browser coverage: 108 passed, 11 conditionally skipped, and three 60-second cumulative-runtime timeouts; all three exact failed paths then passed in a bounded retry (3 passed / 1 role-only test skipped by the core config)
- real role-workflow browser: 1 / 1 passed
- focused PR4 browser: 4 / 4 passed on the warmed rerun after the first cold run exceeded Lab first-usable and Teacher hash timing budgets
- independent fresh BASE capture and visual comparison: 20 / 20 passed, zero failures, global `0.01` and frozen Student-only `0.065`
- runtime performance: 12 / 12 product rows and 4 / 4 DesignSystemLab rows within budget on the passing focused run
- `npm run security:audit` passed at the configured critical threshold

Fresh-clone evidence root: `C:/Users/Marshall/AppData/Local/Temp/simwar-ui-fresh-evidence-59bad25`.

- Visual manifest SHA-256: `F3C19D71D83895CC954A733B4A3A7A1C36882C71084CD24A85D4DB1E88F55951`
- BASE capture receipt SHA-256: `AB2ED4F35A32506D9E83C7CBB0BF8D106C05A44F95C51F8F188DCCD4AAF8A1AA`

The local Postgres replay command failed closed before execution because `SIMWAR_TEST_DATABASE_URL` was not configured; all 20 cases were skipped. The required remote product `quality` check executed that disposable-Postgres gate 20 / 20 on the identical product tree. The remote checks also ran the default, unrelaxed unit and browser commands successfully.

## Known limits retained

- Repository-wide `npm run format:check` remains red on 52 existing files outside this docs-only closure. Every product PR4-touched file and every closure-touched file passed scoped Prettier; this closure does not rewrite unrelated history.
- `npm run security:audit` passes the configured critical threshold while two low and seven high transitive findings remain for dedicated dependency maintenance.
- On this Windows host, the default 5-second Vitest budget produced one drifting timeout per full run; the failed tests all passed in isolation and the unchanged 198-file / 1273-test suite passed with a CLI-only 15-second budget. Remote default CI passed on the identical product tree.
- The first fresh focused PR4 run exposed cold-start timing only (Lab 4453.5ms and Teacher 103.2ms versus 100ms); the unchanged warmed rerun passed all 4 tests and all 16 runtime rows. Frozen budgets were not raised.
- The first broad browser pass had three cumulative 60-second timeouts; all three exact paths passed in a clean bounded retry. The remote broad browser gate passed without this local retry.
- The fresh clone had no disposable Postgres URL; local replay remained fail-closed and the exact-tree remote 20 / 20 result is the authoritative Postgres evidence.
- The state matrix is complete as classification, not universal browser observation of all 458 applicable state cells.
- The exact Teacher advisory-list ARIA container debt remains owned by #365/W020; no Advisor/W020 source was changed.
- Bundle baseline constants remain frozen repository evidence rather than a detached BASE rebuild in every bundle-budget invocation.
- Human validation: `NOT_PERFORMED`.
- Production deployment: `NOT_AUTHORIZED`.

## Resource and continuation state

- Product and BASE browser services were serial; no owned listeners remain on ports 3004 or 3100-3103.
- Evidence and Playwright stores were written outside product worktrees.
- No product, settlement, permission, visibility, tenant, database, or Replay locks remain held by this wave.
- `docs/planning/current-cycle.yaml` and `docs/planning/l1-plus-portfolio-register.yaml` now bind this macro wave, PRs #373/#375/#376/#377, product merge `59bad25e093f99d81256511060194be865f057d7`, and the one permitted governance PR #378.
- `automatic_next_start=false`.

## Final mission state

`SIMWAR_FRONTEND_EXPERIENCE_REFOUNDATION_COMPLETE_WITH_LIMITS`

This document closes governance for the completed macro wave. It does not authorize production deployment, claim human validation, or start a successor task.
