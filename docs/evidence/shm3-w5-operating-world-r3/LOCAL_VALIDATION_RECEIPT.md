# Local Validation Receipt — SH-M3 W5 Operating World Consequence Replay R3

Receipt status: `PRODUCT_PR_REMEDIATION_READY_FOR_REMOTE_GATES_WITH_LIMITS`

This receipt records the local evidence for the R3 candidate after same-PR review remediation. The current Owner Envelope authorizes the bounded remote phase, but does not authorize Provider, production, release, Pilot, Human Validation, or a second truth/settlement writer.

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

- Product PR #444 has been created. Same-PR review remediation is committed locally at `cee74870763919f697f6c7e353c8a6a3b1b8d505`; final push, required-check rerun, review-thread resolution, ordinary merge, and detached post-merge verification remain pending.
- The current Owner Envelope explicitly authorizes those bounded actions for this single Mission; it does not authorize force push, branch-protection bypass, secrets/OAuth changes, Provider/model activation, PostgreSQL runtime/RLS cutover, Pilot, Production/release, Human Validation, a second truth/settlement writer, or an automatic successor Mission.

## NOT_PROVEN

- GitHub CI/CodeQL status, PR review closure, merge commit, and post-merge detached verification are remote-phase evidence still pending.
- The receipt remains candidate evidence only; it does not convert local validation into activation, Pilot, Production, or release readiness.
