# Local Validation Receipt — SH-M3 W5 Operating World Consequence Replay R3

Receipt status: `LOCAL_VALIDATION_READY_FOR_PRODUCT_PR_WITH_LIMITS`

This receipt records the local evidence for the R3 candidate before Product PR creation. The current Owner Envelope authorizes the bounded remote phase, but does not authorize Provider, production, release, Pilot, Human Validation, or a second truth/settlement writer.

## Identity and scope

- Worktree: `D:\codex\worktrees\simwar-shm3-w5-operating-world-r3-20260823`
- Branch: `codex/simwar-shm3-w5-operating-world-r3-20260823`
- Verified source head for this receipt: `617e0d3c9e7d8db93fba6f4c1e681b2b76ae83a7`
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
- `OperatingWorldConsequenceTrace` is a deterministic post-result projection. It carries bounded effect buckets and explicit `writes_official_state:false`, `causal_authority:DETERMINISTIC_SYSTEM_FACTS`, and `ai_generated:false`.
- The canonical W3 record field is `operating_world_consequence_trace`. Student projections remove W4 action and private manifest references; Teacher projections retain governed references.
- M2-P5 inherits the W3 trace and validates exact scope without creating a second writer.
- Admin audit can perform an exact read-only digest → W4 manifest → official outcome/settlement lookup when `runId` and `roundNo` are supplied.
- Port map and control-plane reconciliation evidence classify `PORT_AS_IS`, `PORT_PATCH`, `NESTED_VALUE_OBJECT`, `PROJECTION_ONLY`, `DROP_DUPLICATE`, and `NOT_PROVEN`.

### Passing verification commands

| Command                                                                                                                                                                                                                                                     | Result                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm test -- --reporter=dot`                                                                                                                                                                                                                                | PASS — 260 test files, 1510 tests                                                                |
| R3 focused Vitest set: 9 contract/unit/integration files                                                                                                                                                                                                    | PASS — 20 tests                                                                                  |
| `npm run test:contract`                                                                                                                                                                                                                                     | PASS — 35 files, 82 tests                                                                        |
| `node scripts/check-contracts.mjs`                                                                                                                                                                                                                          | PASS — 20 baseline files, 38 M1 files, 32 schema/fixture groups                                  |
| `npm run typecheck`                                                                                                                                                                                                                                         | PASS                                                                                             |
| `npm run lint`                                                                                                                                                                                                                                              | PASS                                                                                             |
| `npm run build`                                                                                                                                                                                                                                             | PASS — shared-contracts, agent-gateway, simulation-core, api, ui, admin, teacher, student        |
| `npm run check:hidden-unicode`                                                                                                                                                                                                                              | PASS — no hidden Unicode control characters                                                      |
| `npm run check:direct-store-boundaries`                                                                                                                                                                                                                     | PASS — new unapproved runtime direct-store access `0`, stale/broad/duplicate/unsupported `0`     |
| `npm run security:audit`                                                                                                                                                                                                                                    | PASS at `--audit-level=critical`; report contains 9 non-critical vulnerabilities (2 low, 7 high) |
| `$env:SIMWAR_PLAYWRIGHT_API_PORT='38100'; $env:SIMWAR_PLAYWRIGHT_ADMIN_PORT='38103'; $env:SIMWAR_PLAYWRIGHT_TEACHER_PORT='38101'; $env:SIMWAR_PLAYWRIGHT_STUDENT_PORT='38102'; npx playwright test tests/e2e-ui/operating-world.spec.ts --project=chromium` | PASS — 1/1 real API/Admin/Teacher/Student BFF journey, no mocked target routes, 48.9 seconds     |
| `npx prettier --check <current worktree diff files>`                                                                                                                                                                                                        | PASS — all current modified files use Prettier style                                             |
| `git diff --check` and staged commit checks                                                                                                                                                                                                                 | PASS                                                                                             |

The real HTTP evidence includes exact Operating World bind → W4 capital action → W4 settle → replay manifest digest, real W3 Student/Teacher BFF trace projection, Admin replay audit, mismatch fail-closed behavior, cross-tenant denial, and SettlementResult non-mutation.

## CURRENT LIMITS

- `npm test -- --reporter=dot` is green after adding explicit Windows-safe time budgets to six slow child-process/module-load tests; the budgets do not change production behavior or assertions.
- `npm run format:check` remains red at repository scope because Prettier reports 84 files untouched by this candidate relative to `origin/master`. Every currently modified file in this worktree passes `npx prettier --check`; no unrelated baseline formatting rewrite was included.
- The default Playwright port `127.0.0.1:3100` was not usable in this Windows session (`listen EACCES`); the same real-BFF test was rerun on isolated high ports and passed. The default-port failure is retained as an environment note, not as a product failure.
- CodeGraph was not available in the isolated R3 worktree; no stale graph result is used as current source evidence.
- Real local Shanghai data provenance, PostgreSQL runtime, Pilot, Production, Provider/model activation, and Human Validation are outside this candidate and remain unproven.

## REMOTE PHASE STATUS

- Product PR creation, push, required-check readback, ordinary merge, and detached post-merge verification have not yet been performed in this receipt.
- The current Owner Envelope explicitly authorizes those bounded actions for this single Mission; it does not authorize force push, branch-protection bypass, secrets/OAuth changes, Provider/model activation, PostgreSQL runtime/RLS cutover, Pilot, Production/release, Human Validation, a second truth/settlement writer, or an automatic successor Mission.

## NOT_PROVEN

- GitHub CI/CodeQL status, PR review closure, merge commit, and post-merge detached verification are remote-phase evidence still pending.
- The receipt remains candidate evidence only; it does not convert local validation into activation, Pilot, Production, or release readiness.
