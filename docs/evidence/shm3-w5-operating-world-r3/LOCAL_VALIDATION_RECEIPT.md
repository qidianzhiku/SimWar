# Local Validation Receipt — SH-M3 W5 Operating World Consequence Replay R3

Receipt status: `PRODUCT_MERGED_WITH_LIMITS_GOVERNANCE_CLOSURE_PENDING`

This receipt records the local evidence for the R3 candidate after same-PR review remediation. The remote Product PR and exact merge readback are now complete. The separate docs-only Governance Closure is recorded in `docs/governance/shm3-w5-operating-world-r3-governance-closure-20260826.md`. Provider, production, release, Pilot, Human Validation, and a second truth/settlement writer remain outside scope.

## Identity and scope

- Worktree: `D:\codex\worktrees\simwar-shm3-w5-operating-world-r3-20260823`
- Branch: `codex/simwar-shm3-w5-operating-world-r3-20260823`
- Verified source head for this receipt: `cee74870763919f697f6c7e353c8a6a3b1b8d505`
- Prior R3 implementation commit: `066bc0fd2a17d5457244c3ef6242fc93be26efd2`
- R2 candidate baseline carried forward: `5e378cb6707ba033e5d9e0552b3a2c53287f6dc2`
- Original primary objective: `SimWar_SHM3_W5_OperatingWorld_Consequence_Replay_R3_Codex产品级宏任务提示词_V1.0_20260823.docx`
- Execution route: `SimWar_SHM3_W5_OperatingWorld_Consequence_Replay_R3_产品级宏任务开发方案_V1.0_20260823 (2).docx`
- Raw Shanghai source data: not copied into the repository.

## VERIFIED

### Implementation and contracts

- Existing Operating World lifecycle remains the single `DRAFT → VALIDATED → FROZEN → BOUND` service/store path.
- Existing W4 settlement admission can add only the optional nested `operating_world_binding_digest` when the exact current W4 capital action contains a valid `operating-world:<64 lowercase hex>` source.
- Existing `SettlementResult` shape, `replay_hash` generation, `buildReplayHash` inputs, canonical decision selection, W4 official outcome writer, and round publication writer were not replaced by R3.
- The Operating World → W4 bridge now validates exact official consumer values already present in the canonical capital decision and returns the same decision object; it no longer rewrites canonical decision payload fields.
- Exact-scope Operating World consumer resolution now derives the unique `BOUND` draft server-side for tenant/course/run/round and fails closed when there is zero or more than one match; a learner-supplied draft ID is only an expected-ID consistency check.
- W3 consequence trace joins a W4 capital action through the W4 decision admission's `canonical_decision_id`, while preserving exact scope and replay/payload digest checks.
- Operating World lifecycle transitions restore the prior in-memory draft when validation, freeze, or bind persistence fails; failed persistence cannot leave a partial lifecycle mutation.
- Admin audit `runId`/`roundNo` query scope is validated as an exact pair against the bound draft and fails closed on mismatch; `w4_replay` is declared in the Operating World JSON Schema and the admin OpenAPI query surface.
- `OperatingWorldConsequenceTrace` is a deterministic post-result projection. It carries bounded effect buckets and explicit `writes_official_state:false`, `causal_authority:DETERMINISTIC_SYSTEM_FACTS`, and `ai_generated:false`.
- The canonical W3 record field is `operating_world_consequence_trace`. Student projections remove W4 action and private manifest references; Teacher projections retain governed references.
- M2-P5 inherits the W3 trace and validates exact scope without creating a second writer.
- Admin audit can perform an exact read-only digest → W4 manifest → official outcome/settlement lookup when `runId` and `roundNo` are supplied.
- Teacher `OperatingWorldStudio` is lazy-loaded behind `Suspense`, preserving runtime reachability while keeping the initial Teacher bundle within the existing PR4 budget.
- Port map and control-plane reconciliation evidence classify `PORT_AS_IS`, `PORT_PATCH`, `NESTED_VALUE_OBJECT`, `PROJECTION_ONLY`, `DROP_DUPLICATE`, and `NOT_PROVEN`.

### Passing verification commands

| Command                                                                                                                                                                                                                                                                                                       | Result                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run --reporter=dot --maxWorkers=2 --testTimeout=60000`                                                                                                                                                                                                                                            | PASS — 260 test files, 1512 tests; verification-only worker/timeout overrides used for Windows resource contention                    |
| R3 focused Vitest set: 9 contract/unit/integration files                                                                                                                                                                                                                                                      | PASS — 20 tests                                                                                                                       |
| Review-remediation focused Vitest set                                                                                                                                                                                                                                                                         | PASS — W3/corridor 2 files/4 tests; Operating World service/consumer/endpoint coverage includes the unique-binding and rollback cases |
| `npx vitest run tests/integration/operating-world-endpoint.test.ts --reporter=dot`                                                                                                                                                                                                                            | PASS — 1 file, 2 tests; learner selection among multiple bound drafts returns `OW_EXACT_BINDING_REQUIRED`                             |
| `npm run test:contract`                                                                                                                                                                                                                                                                                       | PASS — 35 files, 82 tests                                                                                                             |
| `node scripts/check-contracts.mjs`                                                                                                                                                                                                                                                                            | PASS — 20 baseline files, 38 M1 files, 32 schema/fixture groups                                                                       |
| `npm run typecheck`                                                                                                                                                                                                                                                                                           | PASS                                                                                                                                  |
| `npm run lint`                                                                                                                                                                                                                                                                                                | PASS                                                                                                                                  |
| `npm run build`                                                                                                                                                                                                                                                                                               | PASS — shared-contracts, agent-gateway, simulation-core, api, ui, admin, teacher, student                                             |
| `npm run check:hidden-unicode`                                                                                                                                                                                                                                                                                | PASS — no hidden Unicode control characters                                                                                           |
| `npm run check:direct-store-boundaries`                                                                                                                                                                                                                                                                       | PASS — new unapproved runtime direct-store access `0`, stale/broad/duplicate/unsupported `0`                                          |
| `npm run security:audit`                                                                                                                                                                                                                                                                                      | PASS at `--audit-level=critical`; report contains 9 non-critical vulnerabilities (2 low, 7 high)                                      |
| `npm run measure:frontend:budgets -- --dist-root . --base-sha da6ce87562faaca00a15e6001ea2bdd8ce6b96a6 --head-sha cee74870763919f697f6c7e353c8a6a3b1b8d505`                                                                                                                                                   | PASS — Teacher initial JS 421.61 kB / 120.64 kB gzip; all Admin/Teacher/Student budgets within 10%                                    |
| `$env:SIMWAR_PLAYWRIGHT_API_PORT='38100'; $env:SIMWAR_PLAYWRIGHT_ADMIN_PORT='38103'; $env:SIMWAR_PLAYWRIGHT_TEACHER_PORT='38101'; $env:SIMWAR_PLAYWRIGHT_STUDENT_PORT='38102'; npx playwright test tests/e2e-ui/d1-learning-design-workbench.spec.ts tests/e2e-ui/operating-world.spec.ts --project=chromium` | PASS — 2/2 real UI/BFF journeys, no mocked target routes; D1 and Operating World validated                                            |
| `npx prettier --check <current worktree diff files>`                                                                                                                                                                                                                                                          | PASS — all current modified files use Prettier style                                                                                  |
| `git diff --check` and staged commit checks                                                                                                                                                                                                                                                                   | PASS                                                                                                                                  |

The real HTTP evidence includes exact Operating World bind → W4 capital action → W4 settle → replay manifest digest, real W3 Student/Teacher BFF trace projection, Admin replay audit, mismatch fail-closed behavior, cross-tenant denial, and SettlementResult non-mutation.

## CURRENT LIMITS

- Full Vitest is green at `260/260` files and `1512/1512` tests with verification-only `--maxWorkers=2 --testTimeout=60000`; the candidate also adds Windows-safe readiness/test budgets for the ESM startup and PR4 visual diff cases. These budgets do not change production behavior or assertions.
- The first PR quality run caught a Teacher initial-JS budget overage (`426.45 kB > 423.83 kB`); same-PR commit `d7d4a1e` lazy-loaded `OperatingWorldStudio`, and the exact budget command now passes.
- `npm run format:check` remains red at repository scope because Prettier reports 79 files untouched by this candidate relative to `origin/master`. Every currently modified file in this worktree passes `npx prettier --check`; no unrelated baseline formatting rewrite was included.
- The default Playwright port `127.0.0.1:3100` was not usable in this Windows session (`listen EACCES`); the same real-BFF test was rerun on isolated high ports and passed. The default-port failure is retained as an environment note, not as a product failure.
- CodeGraph was not available in the isolated R3 worktree; no stale graph result is used as current source evidence.
- Real local Shanghai data provenance, PostgreSQL runtime, Pilot, Production, Provider/model activation, and Human Validation are outside this candidate and remain unproven.

## REMOTE PHASE STATUS

- Product PR #444 was the single Product PR. Its final head was `2b8d4c0a726780c4d68fb8a0b093a579a9e2f87a`, and it merged normally into `master` at `af86a57090d37e71f133d6017539fdec698c7c7e` on `2026-08-24T07:16:52Z`.
- The required PR checks were successful: `quality` and `browser-smoke` in CI run `32699797409`, `Analyze JavaScript and TypeScript` in CodeQL run `32699797468`, and the CodeQL check run `97349276415`.
- All four historical Codex review threads are resolved; one is outdated and all are marked `isResolved=true`. No blocking review thread remains.
- Exact merge detached verification at `af86a57090d37e71f133d6017539fdec698c7c7e` passed `npm ci`, prerequisite builds, the nine-file R3 focused suite (20/20), `@simwar/ui` build, and the real-BFF Operating World Playwright journey (1/1) on isolated high ports.
- Fresh latest-master verification at `89d3c852f538dfe421a5c150113f182a96b2c770` passed full build, contract gate (35 files/82 tests), typecheck, lint, hidden-Unicode, direct-store boundary, critical security audit, full bounded Vitest (261 files/1518 tests), and the real-BFF Operating World journey (1/1).
- This update is documentation-only and does not change Product Truth, Settlement, replay hash semantics, or runtime authority. The current Owner Envelope does not authorize force push, branch-protection/admin bypass, secrets/OAuth changes, Provider/model activation, PostgreSQL runtime/RLS cutover, Pilot, Production/release, Human Validation, a second truth/settlement writer, or an automatic successor Mission.

## NOT_PROVEN

- The two user-referenced R3 DOCX files were not present at their supplied paths or in the searched local attachment/download roots; exact DOCX-governed acceptance remains `NOT_PROVEN`. This closure is source-backed by the repository plan, current code, tests, and Git readback.
- Repository-wide `npm run format:check` remains red on 79 pre-existing files; no unrelated formatting rewrite was included.
- The dependency audit still reports 9 inherited non-critical vulnerabilities (2 low, 7 high); the critical-threshold command passes.
- CodeGraph was unavailable in the isolated R3 worktrees. No graph result is used as current source proof.
- Real Shanghai data provenance/calibration, PostgreSQL runtime/RLS, Provider/model activation, Human Validation, Pilot, Production, and release readiness remain unproven and unauthorized.
- The receipt remains bounded evidence; the separate docs-only Governance Closure must merge before governance closure is final.
