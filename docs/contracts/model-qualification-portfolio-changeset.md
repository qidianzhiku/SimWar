# O10 portfolio supersession changeset request

O10 consumes one exact O9 `ModelQualificationCoursePortfolio` and one exact
`ModelQualificationPortfolioSupersessionPreview`. The Admin BFF endpoint
`POST /api/v1/bff/admin/model-qualification/course-portfolio/changeset-request`
recomputes those server-owned inputs from the canonical tenant Course Authority
and returns a deterministic, query-only `PortfolioChangeSetRequestEnvelope`.

The request binds the O9 portfolio digest, preview id/digest, selected course
state digests, current adoption references, and the versioned O10 changeset
policy digest. A stale O9 digest returns `status=REBASE_REQUIRED`; a blocked
preview returns `status=BLOCKED`. Neither status executes a mutation.

The response also contains one `PerCourseGovernedHandoff` per selected course.
Each available handoff points to an existing course-scoped O3-O8 inspection or
dry-run seam. It does not invoke that seam. `handoff_executed`, `apply`,
`bulk_apply`, `cross_course_transaction`, and formal-truth writes are always
false. There is no O10 Apply All or cross-course transaction.

Course membership remains owned by Course Authority. Model qualification data
cannot create a phantom course or replace the Course Registry. Existing
ModelQualification governance remains the only action authority, and O10 does
not add a Writer, Store, Registry, adoption, rollback, requalification, or
formal truth authority. Provider remains OFF.

The Admin UI displays the exact request/readback and handoff statuses, including
stale/rebase and recovery states. Teacher and Student surfaces do not receive
the tenant portfolio endpoint or O10 privileged identifiers.
