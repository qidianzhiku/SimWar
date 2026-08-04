# D6 Transfer Research Design Contract

The D6 contract is a synthetic-only research-design surface. It binds exact,
immutable D1-D5 references to a descriptive or associational study definition,
instrument, observation windows, outcome measures, provenance policy, and
analysis plan. `TransferResearchDesignCommandService` is the sole writer for
D6 study, instrument, and analysis-plan versions in the JSON runtime.

The service can preview or freeze a design and return a synthetic
`TransferEvidenceRecordCandidate`. It does not accept real participants,
external HRIS/LMS/LRS data, arbitrary private payloads, causal claims,
business Score/Rank/Settlement/Truth writes, formal transfer claims, or
Student routes. Missing data is not treated as a negative outcome; small-cell
suppression, consent/participation status, retention/deletion policy, and
observer conflicts remain explicit research-design inputs or known limits.

Each design is scoped by exact Course/Run/Team/Role/Activity identifiers and
must include at least one research question and one context factor. Frozen
designs may be revised only by creating a new immutable study reference with a
`supersedes_ref`; retirement is an explicit lifecycle transition. The JSON
registry appends one audit entry for each created freeze, revision, or
retirement and atomically rolls back a bundle if its study, synthetic preview,
instrument, or audit append fails.

The API surface is Teacher/Admin only:

- `GET /api/v1/bff/{teacher|admin}/transfer-research-designs`
- `POST /api/v1/bff/{teacher|admin}/transfer-research-designs/preview`
- `POST /api/v1/bff/{teacher|admin}/transfer-research-designs/freeze`
- `GET /api/v1/bff/{teacher|admin}/transfer-research-designs/{studyId}/synthetic-preview`
- `POST /api/v1/bff/{teacher|admin}/transfer-research-designs/{studyId}/revise`
- `POST /api/v1/bff/{teacher|admin}/transfer-research-designs/{studyId}/retire`

The active runtime remains `JSON_INTERNAL_ONLY`. D6 is not an Event Store,
LearningGoal/Rubric authority, Replay authority, Teacher Confirmation, final
grade, HR/talent decision, Pilot, or Production capability. Formal
EvidenceArtifact creation remains owned by the existing D2
`EvidenceCaptureCommandService`; D6 synthetic previews cannot enter formal
truth, settlement, score, rank, replay, or student projections.
