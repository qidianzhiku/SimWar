# Local Validation Receipt — SH-M3 W5 Operating World Consequence Replay R3

Receipt status: `LOCAL_CANDIDATE_COMMITTED_WITH_LIMITS`

This receipt records the local evidence for the R3 candidate. It does not authorize Provider, production, remote, PR, merge, or post-merge actions.

## Identity and scope

- Worktree: `D:\codex\worktrees\simwar-shm3-w5-operating-world-r3-20260823`
- Branch: `codex/simwar-shm3-w5-operating-world-r3-20260823`
- Verified source head before this documentation-only receipt update: `0ec35a65c3b5a57433d923ab4d20232ad7cd6da8`
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

| Command | Result |
| --- | --- |
| `npx vitest run tests/integration/round-lock-publish-characterization.test.ts tests/integration/r7b-golden-m1-replay-compatibility.test.ts tests/integration/operating-world-consequence-corridor.test.ts tests/integration/operating-world-endpoint.test.ts tests/integration/w3-official-consequence-learning-endpoint.test.ts tests/unit/operating-world-r3-control-plane.test.ts tests/unit/m2p5-decision-learning-crossround.test.ts tests/unit/p2b-decision-learning.test.tsx tests/unit/p2b-teacher-debrief.test.tsx --reporter=dot` | 9 files, 28 tests passed |
| `npm run test:contract` | 35 files, 82 tests passed |
| `node scripts/check-contracts.mjs` | passed; 20 baseline files, 38 M1 files, 32 schema/fixture groups |
| `npm run typecheck` | passed |
| `npm run lint` | passed |
| `npm run build` | passed for shared-contracts, agent-gateway, simulation-core, api, ui, admin, teacher, student |
| `npm run check:hidden-unicode` | passed; no hidden Unicode control characters |
| `npm run check:direct-store-boundaries` | passed; new unapproved runtime direct store access `0`, stale/broad/duplicate/unsupported `0` |
| `npm run security:audit` | exit `0` at `--audit-level=critical`; report contains 9 existing vulnerabilities (2 low, 7 high) |
| `$env:SIMWAR_PLAYWRIGHT_API_PORT='38100'; $env:SIMWAR_PLAYWRIGHT_ADMIN_PORT='38103'; $env:SIMWAR_PLAYWRIGHT_TEACHER_PORT='38101'; $env:SIMWAR_PLAYWRIGHT_STUDENT_PORT='38102'; npx playwright test tests/e2e-ui/operating-world.spec.ts --project=chromium` | 1 test passed; real API/Admin/Teacher/Student web servers, no mocked target routes; 50.3 seconds |
| `git diff --cached --check` before commit | passed after removing evidence-file EOF whitespace |

The real HTTP evidence includes exact Operating World bind → W4 capital action → W4 settle → replay manifest digest, real W3 Student/Teacher BFF trace projection, Admin replay audit, mismatch fail-closed behavior, cross-tenant denial, and SettlementResult non-mutation.

## NOT_PROVEN

- The full `npm test -- --reporter=dot` aggregate was not green: 255 files passed and 5 files failed; 1499 tests passed and 11 failed. The failures were in `tests/integration/shared-contracts-built-esm-startup.test.ts`, three `tests/unit/pr4-visual-baseline-capture.test.ts` cases, three `tests/unit/store-snapshot-persistence.test.ts` cases, `tests/unit/ui-pr4-integration.test.tsx`, and `tests/unit/ui-teacher-refoundation.test.tsx`, involving 5000 ms timeouts or child-process `status=null`. No R3-focused test failed.
- `npm run format:check` was not green: Prettier reported 114 files, including pre-existing repository files and R3-touched files. No full-repository formatting rewrite was performed.
- The default Playwright port `127.0.0.1:3100` was not usable in this Windows session (`listen EACCES`); the same real-BFF test was rerun on isolated high ports and passed. The default-port failure is retained as an environment note, not as a product failure.
- CodeGraph was not available in the isolated R3 worktree; no stale graph result is used as current source evidence.
- Real local Shanghai data provenance, PostgreSQL runtime, Pilot, Production, Provider/model activation, and Human Validation are outside this candidate and remain unproven.

## NOT_AUTHORIZED

- No remote push, Product PR creation, required-check readback, merge, deployment, publication, external connector authorization, or post-merge verification was performed.
- The current user messages selected the uploaded documents as the objective but did not provide the required current top-level Owner Envelope for remote delivery.

## BLOCKED

- Remote delivery is blocked by the missing Owner Envelope, not by a local implementation failure. The local candidate remains reviewable and committed; this receipt intentionally does not convert local evidence into activation or production readiness.
