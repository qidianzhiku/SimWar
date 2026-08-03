# L1+ D1 LearningGoal / RubricVersion

Status: IMPLEMENTED_IN_WAVE_005_PENDING_SERIAL_CLOSURE

Primary outcome: a Teacher can create, validate, publish, inspect, and revise
immutable LearningGoalVersion and RubricVersion records against an exact
AVAILABLE CoursePackageVersion.

## Authority

`LearningDesignCommandService` is the sole D1 writer. Its JSON registry stores
append-only lifecycle snapshots. Published versions are immutable; a revision
creates a new version with `supersedes_ref` and does not overwrite history.

## Lifecycle

Both objects use:

```text
DRAFT -> VALIDATED -> PUBLISHED
  \-> REJECTED
```

References require an exact tenant, id, version, and SHA-256 content digest.
`latest`, wildcard, fallback, and unresolved references are rejected. Rubric
publication requires every referenced LearningGoalVersion to be PUBLISHED.

## Product Surface

Teacher BFF routes are under `/api/v1/bff/teacher/learning-*`. The Teacher D1
Workbench consumes only those routes and does not access a store or repository.
The projection includes explicit non-proofs and keeps `scoring_policy` at
`NOT_ACTIVE_D1`; D1 does not calculate or write a final grade, business score,
rank, Truth, SettlementResult, EvidenceArtifact, or LearningConfirmation.

## Evidence

- Contract: `contracts/schemas/learning-design.v1.json`
- Fixtures: `contracts/fixtures/learning-design.valid.json` and
  `contracts/fixtures/learning-design.invalid.json`
- Shared types: `packages/shared-contracts/src/learning-design.ts`
- Unit: `tests/unit/learning-design.test.ts`
- Integration: `tests/integration/learning-design-endpoint.test.ts`
- Browser: `tests/e2e-ui/d1-learning-design-workbench.spec.ts`

## Known Limits

The runtime remains `JSON_INTERNAL_ONLY`. D2 EvidenceArtifact, D3 Teacher
Confirmation, D4 Student Learning Report, AI final grade, PostgreSQL,
durable recovery, Human Validation, Pilot, and Production are out of scope.
