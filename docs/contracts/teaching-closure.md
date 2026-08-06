# W019 Unified Teaching Closure Contract

The W019 teaching closure projection binds one teacher queue item to an exact
`Course`, `Run`, `Team`, `Role`, and `Activity` context. The projection is
read-only orchestration over the existing D2 evidence, D3 confirmation, D4
student-safe report, C5 course report, and D5 export surfaces.

## Authority Boundary

- D2 remains the sole EvidenceArtifact and ProvenanceEdge writer.
- D3 remains the sole TeacherConfirmationVersion writer and owns claim,
  draft, reject, revise, and confirm transitions.
- D4 remains a confirmed-only student-safe projection.
- C5 and D5 remain read-only report and export projections.
- JSON_INTERNAL_ONLY remains the active runtime authority.

The W019 BFF route does not expose raw event payloads, teacher-private fields,
Truth, canonical Decision, SettlementResult, Score, Rank, or Replay internals.
It also rejects fallback references such as `latest`, `default`, and
`unresolved` before any projection is called.

## Route

`GET /api/v1/bff/teacher/teaching-closure`

Required query parameters are `course_id`, `run_id`, `team_id`, `role_key`, and
`activity_id`. The response reports eligible event/evidence readiness, the
existing D3 claim status and expiry, confirmation status, student-safe outcome
status, and whether a teacher course report is available.

Known limits remain explicit: claims are process-local, durable recovery is
not proven, PostgreSQL is not active runtime authority, Human Validation has
not been performed, and Pilot/Production are not authorized.
