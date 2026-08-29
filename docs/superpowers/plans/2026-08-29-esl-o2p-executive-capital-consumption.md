# ESL O2P Executive Capital Feasibility Product Consumption Plan

## Exact objective

Convert the locatable historical ESL O2P finance candidate into one current-source,
candidate-only capability consumed by the existing MAIN-ESL-O1 Executive Strategy
Lab journey. The output must expose deterministic capital feasibility, liquidity,
debt-service/DSCR, covenant, budget-utilization, and bounded stress evidence for
Teacher, role-safe tradeoffs for Student, and exact provenance/no-write audit data
for Admin. It must remain a read-only composition over the existing W4 official
state and M4 non-official paths, use exact binding, and never write formal truth.

## Global constraints

- Work only in the isolated branch `codex/esl-o2p-executive-capital-20260829-r2`.
- The canonical checkout and all unrelated worktrees are protected; stage only the
  files listed by the active task when committing.
- Preserve One Kernel, One Truth Engine, One Settlement Authority, and the existing
  W4 sole writer. No second store, registry, runtime, or formal writer.
- The finance capability is `official: false`, candidate/advisory/diagnostic only.
  It cannot write EnterpriseState, SettlementResult, score, rank, replay truth,
  canonical Decision, official ParameterSet, revenue, or realized values.
- Provider remains OFF. Do not inspect or use API credentials, activate a model,
  change Postgres/RLS, or use restricted data.
- Every source, scenario, parameter, model, artifact, path, and state reference is
  exact and explicit. Missing, stale, nonfinite, unit-inconsistent, or
  currency/time-inconsistent values fail closed to UNKNOWN; never substitute
  zero/current/default/latest/fallback values.
- `path_cash_delta` is consumed exactly once as an observed M4 differential. The
  finance projection must not become a second cash writer or double-count existing
  W4 capital state.
- MAIN integration is serial and must be exercised through the current real BFF
  route. The final package must distinguish local branch proof from master/remote
  integration proof.

## Task 1 — Freeze current contracts and create a failing finance-core test

1. Re-read the current `W4EnterpriseStateData`, `W4CapitalPosition`,
   `W4CapitalAction`, `M4TeacherPathProjection`, and MAIN-ESL types in:
   `packages/shared-contracts/src/w4-enterprise-state.ts`,
   `packages/shared-contracts/src/m4-multipath-counterfactual-transfer.ts`, and
   `packages/shared-contracts/src/executive-strategy-lab.ts`.
2. Add the finance capability contract in
   `packages/shared-contracts/src/executive-strategy-lab-finance.ts` and export it
   from `packages/shared-contracts/src/index.ts`. Keep the contract explicit about
   units, currency, time period, source refs, model identity, UNKNOWN reasons,
   feasibility, covenant, DSCR numerator/denominator, and role-safe projection.
3. Add `tests/unit/executive-strategy-lab-finance.test.ts` before implementation.
   The RED cases must cover: known capital arithmetic and DSCR identities,
   missing accounting basis -> UNKNOWN, nonfinite input -> UNKNOWN, invalid exact
   refs/model identity -> fail closed, stress regime determinism, covenant breach,
   and no official-write flags.
4. Run only the new test to capture the expected RED state, then implement the
   smallest pure function in
   `services/api/src/executive-strategy-lab-finance.ts` and rerun it GREEN.

## Task 2 — Bind the finance projection into the existing MAIN-ESL service

1. Update `services/api/src/executive-strategy-lab-service.ts` so each M4 Teacher
   path is projected from the already verified exact W4 source state, exact M4
   terminal evidence, current capital actions, and the request's model identity.
   Reject absent official state/refs instead of manufacturing a synthetic state ref.
2. Add finance projections to the shared Teacher response and expose only the
   reduced finance student view in `ESLStudentProjection`.
3. Extend the Admin projection with per-path model identity, input digest, and
   exact source refs; retain `no_write: true` and deterministic recovery.
4. Preserve the existing MAIN route and `ExecutiveStrategyLabServiceDependencies`;
   the new capability must be consumed through the existing
   `/api/v1/bff/teacher/esl/strategy-lab` BFF rather than a parallel route.
5. Extend the existing unit, integration, route, and contract tests to prove the
   response composition, tenant/run/round binding, idempotent candidate behavior,
   role redaction, and unchanged official state before/after candidate creation.

## Task 3 — Freeze machine-readable schema and fixtures

1. Update `contracts/schemas/executive-strategy-lab.v1.json` to the new explicit
   O2P response shape without weakening existing exact-id, officiality, authority,
   or no-write validation.
2. Update the valid and invalid fixtures in
   `contracts/fixtures/executive-strategy-lab.valid.json` and
   `contracts/fixtures/executive-strategy-lab.invalid.json` with at least one
   known finance result and one UNKNOWN/fail-closed result.
3. Extend `tests/contract/executive-strategy-lab-contract.test.ts` and
   `tests/contract/executive-strategy-lab-route.test.ts` to validate schema/fixture
   parity, banned implicit identifiers, exact source refs, student redaction, and
   authority flags.

## Task 4 — Complete the real Teacher/Student/Admin consumption journey

1. Update `apps/teacher/src/ExecutiveStrategyLabWorkspace.tsx` to render finance
   feasibility, cash flow, liquidity headroom, DSCR numerator/denominator/status,
   covenant status, binding constraints, and the three bounded stress regimes.
   Render UNKNOWN and known limits explicitly; do not imply officiality.
2. Update `apps/student/src/ExecutiveStrategyLabProjection.tsx` to render only
   role-safe business-language capital tradeoffs and status summaries. Do not show
   raw debt/private source refs, decision ids, state refs, or teacher/admin
   provenance.
3. Update `apps/admin/src/ExecutiveStrategyLabAuditPanel.tsx` to render exact
   tenant/run/round/path/model/artifact/input/calculation provenance and no-write
   recovery status.
4. Extend `tests/e2e-ui/executive-strategy-lab.spec.ts` or the existing ESL browser
   config with a real BFF consumption assertion, role visibility checks, a
   no-write check, and a recovery/UNKNOWN display check. If a browser binary or
   server prerequisite is unavailable, record the exact limitation and retain
   lower-level evidence.

## Task 5 — Review, repair, and validation ladder

Run in order, retaining separate evidence for focused scope and pre-existing full
repository failures:

1. L0: current branch/tree/status and exact source/consumer binding readback.
2. L1: `npm run typecheck`, schema/fixture contract checks, unit identities, units,
   currency, time-period, finite-number, and exact-ref guards.
3. L2: focused ESL unit/contract/integration tests, property/differential/stress/
   negative tests, and direct-store boundary checks.
4. L3: build prerequisites, ESL BFF integration, tenant isolation, role-safe
   projections, and official-state-before/after no-write assertions.
5. L4: real Teacher/Student/Admin browser journey and recovery/UNKNOWN state when
   the configured browser environment is available.
6. Review the full diff for duplicate authority, implicit latest/default, raw
   finance leakage, schema drift, and overclaiming. Repair and rerun affected gates.
7. Run the repository's relevant lint/format/build gates. Report full-suite or CI
   failures as pre-existing or unverified when the evidence proves that distinction.

## Task 6 — Product handoff and result archive

1. Assemble current-reality, authenticity, reuse/tombstone, tool-contribution,
   model-contract, MJP, full-pack, MAIN join, method delta, known-limits,
   changelog, validation, and handoff receipts under `artifacts/`.
2. Attempt the required read-only Hugging Face/OpenAI developer tool contribution
   within the Provider-OFF boundary; if unavailable or zero-yield, record
   `LOW_YIELD_STOP`/unavailable rather than blocking the product capability.
3. Before any remote mutation, re-read repository policy, branch status, and exact
   diff; use only ordinary non-force branch/PR/merge operations covered by the
   bounded mission authorization. Never admin-bypass or force push. If live remote
   or merge policy is not provable, retain local proof and mark remote integration
   unproven.
4. Generate exactly one canonical archive named
   `SIMWAR-MOD-ESL-O2P-EXECUTIVE-CAPITAL-FEASIBILITY-PRODUCT-CONSUMPTION-MACRO-01-20260829-FINAL-results.zip`.
5. Independently validate member count/names, duplicate/unsafe entries, parse all
   JSON, verify every manifest hash, verify the archive SHA-256, and ensure there
   is no unexpected temporary artifact. The final status must be truthful
   `JOIN`, `JOIN_WITH_LIMITS`, `REWORK`, `HOLD`, or `EVIDENCE_INSUFFICIENT`; never
   claim `PRODUCT_COMPLETE` for the MOD candidate lane.

## Expected changed-file set

- `packages/shared-contracts/src/executive-strategy-lab-finance.ts`
- `packages/shared-contracts/src/executive-strategy-lab.ts`
- `packages/shared-contracts/src/index.ts`
- `services/api/src/executive-strategy-lab-finance.ts`
- `services/api/src/executive-strategy-lab-service.ts`
- `contracts/schemas/executive-strategy-lab.v1.json`
- `contracts/fixtures/executive-strategy-lab.valid.json`
- `contracts/fixtures/executive-strategy-lab.invalid.json`
- `apps/teacher/src/ExecutiveStrategyLabWorkspace.tsx`
- `apps/student/src/ExecutiveStrategyLabProjection.tsx`
- `apps/admin/src/ExecutiveStrategyLabAuditPanel.tsx`
- Focused ESL unit, contract, integration, and browser tests
- Mission plan and final evidence files under `docs/superpowers/plans/` and `artifacts/`

## Self-review checklist

- [ ] The current MAIN-ESL route consumes the finance projection in the real
      Teacher/Student/Admin path.
- [ ] Every financial value has an explicit status, unit, currency/time basis, and
      exact source refs; missing inputs remain UNKNOWN.
- [ ] DSCR exposes and tests numerator/denominator; no path cash delta is reused.
- [ ] No official state, settlement, replay, score, rank, canonical decision, or
      formal writer is mutated.
- [ ] Student and Admin redaction/provenance are both tested.
- [ ] Current master/branch/tree, PR/merge, tool availability, known limits, and
      final ZIP checks are independently evidenced.
