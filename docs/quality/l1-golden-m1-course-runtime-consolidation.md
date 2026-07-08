# L1 Golden M1 Course Runtime Consolidation

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

PostgreSQL runtime:
NOT_AUTHORIZED
```

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

This document records Program 024's L1 Golden M1 Course Runtime
Consolidation artifact. It consumes the merged Course Runtime V3 and L1
Synthetic Internal Application Readiness evidence and turns them into a single
reviewable runtime-consolidation package.

The artifact is synthetic JSON-runtime evidence only. It does not activate
PostgreSQL runtime, SQL, migration, durable settlement, Pilot, Production, real
teacher rehearsal, real user data, real tenant data or real payment.

## Consolidated Runtime Chain

```text
Teacher Course Draft
→ Approved Frozen Scenario Asset
→ Approved ParameterSet / Plugin / Seed Binding
→ Course Publish
→ Synthetic Run
→ Two-Team Setup
→ Role Binding
→ Round Open
→ Student Decision Submit
→ Teacher Round Lock
→ Existing Kernel Settlement
→ Result Publish
→ Student Redacted Result
→ Three-Part Feedback
→ Teacher Evidence Workspace
→ Tenant Admin Scoped Summary
→ Replay / Shadow Replay
→ Learning Evidence Ledger
→ Audit and Provenance Package
```

## Evidence Source

- `services/api/src/course-runtime-v3.ts`
- `services/api/src/l1-synthetic-internal-application-readiness.ts`
- `services/api/src/l1-golden-m1-course-runtime-consolidation.ts`
- `tests/integration/course-runtime-v3-synthetic-execution.test.ts`
- `tests/integration/l1-golden-m1-course-runtime-consolidation.test.ts`
- `tests/e2e-ui/course-runtime-v3-smoke.spec.ts`
- `tests/e2e-ui/l1-golden-m1-course-runtime-consolidation.spec.ts`
- `docs/operations/r8-g1-l1-golden-m1-course-runtime-consolidation-draft.md`

## Guarded Assertions

The consolidation helper verifies:

- `G0 Status: EXCEPTION`, `G0 PASS: NOT_GRANTED`, and `L1 Status: NOT_READY`
  are preserved.
- Runtime evidence remains `direct_store_delta = NONE`.
- Course Blueprint and Scenario / ParameterSet / Plugin / Seed binding remain
  immutable synthetic evidence.
- Student projection exposes no protected truth, private replay or other-team
  markers.
- Tenant Admin scope remains one tenant, while Platform Admin authority remains
  explicit.
- Replay and Shadow Replay do not write formal results.
- Learning Evidence remains excluded from truth hash and formal truth.
- Duplicate decision, lock, settlement and publish observations remain stable
  without duplicate audit side effects.
- R8-G1 materials remain internal-only drafts.
- R4 Discovery remains read-only only.

## Explicit Non-Proofs

This package does not prove or authorize:

- `G0_PASS`
- `L1_READY`
- Pilot
- Production
- PostgreSQL runtime
- SQL
- migration
- durable settlement
- R4 Macro
- R9
- R10
- Issue closeout for #111, #114 or #115

## Validation Notes

Program 024 validation must include:

- `npm test -- tests/integration/l1-golden-m1-course-runtime-consolidation.test.ts`
- `npm run test:e2e:ui`
- existing Runtime V3 and L1 readiness integration tests
- `npm run check:direct-store-boundaries`
- `npm run security:audit`
- `npm audit --json`
- full repository quality gates available in `package.json`

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
