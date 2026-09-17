# D4 Student Learning Report Contract

`student-learning-report.v1` is the rich internal read-only projection of a
confirmed or amended D3 `TeacherConfirmationVersion`. It carries exact
CoursePackage, LearningGoal, Rubric, confirmation, and EvidenceArtifact
references plus a bounded provenance chain.

The projection never creates a D4 writer, command route, registry, store, or
second learning authority. Teacher feedback is omitted unless a future D3
contract explicitly marks it student-visible. Business outcomes remain a
separate safe section and do not include score, rank, `state_true`, settlement
payload, or replay material.

Public Student list and detail routes return `student-learning-report.public.v1`:
an explicit allowlist of report identity, course/run/team/role/round context,
confirmed criterion levels, and the separate-outcome notice. Exact references,
content/report/source-confirmation digests, teacher/admin references and provenance
are omitted. The existing role-workflow repository supplies the active assignment
and exact course/run/team/round binding; its round must be `published`. Missing
round bindings or inactive/wrong roles fail closed (empty list or detail 404).
There is no second publication authority. Rich reports remain internal to W3/M2P5
and existing privileged preview consumers.

Student routes are restricted to the authenticated learner's tenant and team.
Teacher and tenant-admin routes are read-only previews. The active runtime is
`JSON_INTERNAL_ONLY`; durable recovery, Human Validation, PostgreSQL, Pilot,
and Production remain non-proofs.
