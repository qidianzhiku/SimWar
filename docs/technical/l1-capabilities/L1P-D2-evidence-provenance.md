# L1P-D2 Evidence Provenance

Status: CLOSED_AND_CURRENT_WITH_LIMITS

## Primary Outcome

A Teacher can select exact CoursePackageVersion, LearningGoalVersion and
RubricVersion references within a controlled Course/Run/Team/Role/Activity
scope, capture eligible role/activity evidence through the sole D2 writer,
and inspect a safe immutable artifact receipt with deterministic duplicate or
conflict semantics.

## Authority

`EvidenceCaptureCommandService` is the sole D2 writer. The JSON repository is
the active runtime provider. D2 does not write Truth, SettlementResult, Score,
Rank, canonical Decision, Replay evidence, or final grade.

## Product Surface

The Teacher Evidence Workbench uses the D2 BFF output and never reads a store
or repository. It displays exact references, artifact digest, source event
reference, provenance edges, visibility, generated/reused/duplicate/error and
stale states, and Known Limits. It does not expose arbitrary event payloads and
there is no Student Evidence route or surface.

## Contract and Evidence

- Contract: `contracts/schemas/evidence-provenance.v1.json`
- Fixtures: `contracts/fixtures/evidence-provenance.valid.json` and
  `contracts/fixtures/evidence-provenance.invalid.json`
- Shared types: `packages/shared-contracts/src/evidence-provenance.ts`
- Backend: `services/api/src/evidence-provenance.ts`
- Unit: `tests/unit/d2-evidence-provenance-service.test.ts`
- Integration: `tests/integration/d2-evidence-provenance-endpoint.test.ts`
- Contract: `tests/contract/d2-evidence-provenance-contract.test.ts`
- Browser: `tests/e2e-ui/d2-evidence-workbench.spec.ts`
- Backend PR #322 merge: `ca79e18d1a026fb979efd5c67370dc64ed824873`
- Frontend PR #323 merge/current product evidence: `291daab32c83e256270cca5fc6a5a407c680b7c9`
- Integrated fresh clone: `D:/codex/simwar-w006-d2-integrated-291daab`
- Evidence root: `C:/Users/Marshall/AppData/Local/Temp/E-SIMWAR-W006-D2-20260803T062317Z`

## Acceptance and Known Limits

A01-A25 are recorded in the mission-owned Product Acceptance receipt with no
UNKNOWN rows and no planned corrective product PR. The integrated fresh clone
passed 140 test files / 969 tests, the contract gate, direct-store boundary,
typecheck, lint, build, hidden-Unicode check and browser matrix.

The runtime remains `JSON_INTERNAL_ONLY`. Current RoleWorkflowEvent has no
native `activity_id`, so activity scope is request-bounded. D2 is not D3/D4,
does not confirm learning, does not assign a final grade, and does not prove
durable settlement, recovery, Human Validation, Pilot or Production. Issue
#111 remains an open known limit. Dependency audit findings (2 low, 6 high)
are pre-existing and were not changed by D2.

This closure does not authorize automatic successor work. The next candidate,
`CAND-L1P-D3-TEACHER-CONFIRMATION`, remains `RECOMMENDED_NOT_AUTHORIZED`.
