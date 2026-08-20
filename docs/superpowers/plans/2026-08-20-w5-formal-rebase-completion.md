# W5 Formal Rebase Completion & Model Baseline Freeze

## Goal

Complete the V5.8 mission from the current `master` baseline by turning the
W5 model-governance claims into executable, lineage-addressed evidence. The
product change will provide a complete M-RB1 authority census, an M-RB2
reproduction runner covering golden/differential/replay/fallback/drift cases,
and an M-RB3 exact current baseline freeze. Missing BLP/RCNL/Lancaster/Ideal
Point implementations will be classified truthfully and will not be invented
to make the gates green. The teacher projection will expose the resulting
readiness classifications rather than implying unsupported active engines.

## Architecture and constraints

- The existing `Simulation Core` eldercare evaluator remains the only official
  realized producer; the new evidence module is governance/read-only and must
  never write settlement truth, EnterpriseState, score, or rank.
- Exact runtime identity is `ModelVersion + Scenario + Parameter + seed`; no
  implicit latest resolution is allowed.
- M-RB1 has no `UNKNOWN`, unowned feature, or double producer outcome.
- M-RB2 records must include mission lineage, source HEAD/tree, command,
  environment fingerprint, input/output digests, exit code, result, and a
  timestamp at or after the current mission start.
- The current WANT remains a synthetic heuristic; System Dynamics remains
  shadow-only; Shanghai remains synthetic/assumption and not calibrated.
- Product work is limited to the new W5 model readiness/evidence capability;
  no Pilot, Production, PostgreSQL/RLS, provider, or W6 work is introduced.

## Implementation tasks

### 1. Establish the executable contract with failing tests first

Files:

- `packages/shared-contracts/src/w5-formal-rebase.ts`
- `tests/unit/w5-formal-rebase.test.ts`
- `tests/simulation/w5-formal-rebase-reproduction.test.ts`

Red phase:

1. Add tests for the classification union, complete family census, zero
   UNKNOWN/unowned/double-producer counts, exact runtime identity, and
   fail-closed evidence metadata.
2. Add tests for core/WANT/CAN/REALIZED golden output, bounded differential
   change, Standard/Advanced parity, Shanghai assumption-vs-stress output,
   replay digest/non-overwrite, unavailable-plane fallback, and drift labels.
3. Run the focused tests and confirm they fail because the new exports do not
   exist yet.

Green implementation:

1. Define the immutable data shapes for model-family census entries,
   reproduction records/manifests, and the formal current baseline.
2. Keep the shapes explicit about classification, units, producer, consumer,
   formal writer, fallback, visibility, provenance, and known limits.

### 2. Implement M-RB1/M-RB2/M-RB3 evidence and claim correction

Files:

- `services/api/src/w5-formal-rebase.ts`
- `services/simulation-core/src/index.ts`
- `packages/shared-contracts/src/index.ts`
- `services/api/src/w5-governed-model-service.ts`
- `contracts/schemas/w5-governed-model.v1.json`
- `apps/teacher/src/W5GovernedModelStudio.tsx`
- `scripts/run-w5-formal-rebase.ts`
- `package.json`

Implementation:

1. Build a bounded census from the current source authority. Mark Core,
   capacity, workforce, quality/risk, and finance as current only where the
   actual evaluator invocation and output are proven; mark WANT synthetic,
   SD shadow, and BLP/RCNL/Lancaster/Ideal Point as research/missing/deferred
   with explicit non-activation reasons.
2. Provide a deterministic runner that executes all required M-RB2 scenarios
   through existing pure simulation functions and records the mandatory
   lineage/source/environment/input/output fields.
3. Freeze the exact model version, scenario, parameter digest, seed, ownership,
   fallback, replay, Shanghai provenance, parity, and known limits into an
   M-RB3 baseline object. Reject incomplete or future-facing active claims.
4. Expose model-family readiness on the teacher projection and UI; change the
   current unsupported feature ownership entries from approved views to
   truthful shadow/research/missing dispositions.
5. Export the runner from package entry points and add a real npm command so
   the evidence is reproducible in a clean checkout.

### 3. Generate current-mission product evidence

Files:

- `docs/evidence/w5-formal-rebase/2026-08-20-w5-formal-rebase-product-manifest.json`
- `docs/evidence/w5-formal-rebase/2026-08-20-w5-formal-rebase-rb1.json`
- `docs/evidence/w5-formal-rebase/2026-08-20-w5-formal-rebase-rb2.json`
- `docs/evidence/w5-formal-rebase/2026-08-20-w5-formal-rebase-rb3.json`

Run the new command with the current mission lineage and exact Product head,
then verify the committed evidence is generated from this mission rather than
copied from #402/#404. Keep the repository evidence machine-readable and keep
the external control receipts under the mission-specific `C:\Temp` root.

### 4. Validate and publish the Product PR

Run, as applicable, the focused W5 tests, contract tests, typecheck, lint,
build, full unit/integration suite, hidden-unicode/direct-store/security
checks, and the existing W5 browser test. Verify only the planned files are
staged, create exactly one substantive Product PR, read back exact head and
required checks, remediate ordinary failures on the same PR, and perform one
ordinary merge. No force push, admin bypass, or auto-merge.

### 5. Fresh detached and Governance Delta

Create one detached checkout at the exact Product merge SHA. Re-run M-RB1,
M-RB2, M-RB3 and the required applicable gates, writing fresh evidence after
the mission start. Then create one docs-only Governance Delta containing the
mission lineage, Product PR/merge, receipts, exact baseline, classifications,
fresh detached result, HV-B readiness, and Human Model Validation B
`NOT_PERFORMED`. Merge it with exact-head ordinary merge and perform final
external readback before releasing the mission lock.

## Verification and acceptance

- M-RB1: `PASS_WITH_LIMITS`, with zero UNKNOWN/unowned/double-producer counts.
- M-RB2: `PASS_WITH_LIMITS`, with all required reproduction families and
  mission-start timestamps.
- M-RB3: `PASS_WITH_LIMITS`, with exact identity and truthful missing/shadow
  classifications.
- Product PR and Governance Delta are both new, lineage-addressed, and merged.
- Fresh detached verification passes with explicit limits.
- Final master differs from the mission start and contains both mission merges.
- HV-B is ready; Human Validation B, Pilot, Production, PG RLS, and W6 remain
  not performed/authorized.
