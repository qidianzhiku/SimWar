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

The API surface is Teacher/Admin only:

- `GET /api/v1/bff/{teacher|admin}/transfer-research-designs`
- `POST /api/v1/bff/{teacher|admin}/transfer-research-designs/preview`
- `POST /api/v1/bff/{teacher|admin}/transfer-research-designs/freeze`
- `GET /api/v1/bff/{teacher|admin}/transfer-research-designs/{studyId}/synthetic-preview`

The active runtime remains `JSON_INTERNAL_ONLY`. D6 is not an Event Store,
LearningGoal/Rubric authority, Replay authority, Teacher Confirmation, final
grade, HR/talent decision, Pilot, or Production capability.
