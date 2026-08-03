# D4 Student Learning Report Contract

`student-learning-report.v1` is a read-only, student-safe projection of a
confirmed or amended D3 `TeacherConfirmationVersion`. It carries exact
CoursePackage, LearningGoal, Rubric, confirmation, and EvidenceArtifact
references plus a bounded provenance chain.

The projection never creates a D4 writer, command route, registry, store, or
second learning authority. Teacher feedback is omitted unless a future D3
contract explicitly marks it student-visible. Business outcomes remain a
separate safe section and do not include score, rank, `state_true`, settlement
payload, or replay material.

Student routes are restricted to the authenticated learner's tenant and team.
Teacher and tenant-admin routes are read-only previews. The active runtime is
`JSON_INTERNAL_ONLY`; durable recovery, Human Validation, PostgreSQL, Pilot,
and Production remain non-proofs.
