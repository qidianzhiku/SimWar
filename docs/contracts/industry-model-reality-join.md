# Industry Model Reality Join

## Contract

industry-model-reality-join.v1 is a derived, query-only projection over the existing IM-O1 Model Qualification diagnostic readiness path and three read-only support packs:

- M4 portability compatibility is PORTABILITY_EVIDENCE_WITH_LIMITS; it is not external validity.
- M5 holdout and reality qualification remain NOT_ELIGIBLE.
- M29 Shanghai consumption remains LOOKAHEAD_READY, with LIMITED qualification, NOT_PROVEN calibration evidence, and formal_binding_eligible=false when an exact applicability binding is proven.

The support packs are not global fixtures. The service computes a request-context digest and includes the exact upstream M4/M5/M29 pack digests in the support lineage digest. Until a source-backed applicability match for the requested Course/Run/Round/Team/ScenarioPackage/ParameterSet/Qualification is proven, Teacher and Admin receive `support_evidence.availability=UNAVAILABLE` with reason `EXACT_SUPPORT_APPLICABILITY_NOT_PROVEN`; the pack summaries are not attached to that context. A future exact binding may return `BOUND` with the pack summaries.

The route requires an exact Course, Run, Team, Round, ScenarioPackage, ParameterSet, and Qualification selector. An expectedRealityJoinDigest may be supplied on a reload; a changed identity returns REBASE_REQUIRED. No latest, current, default, array position, or timestamp fallback is allowed.

## Role boundary

Teacher and Admin receive exact model, qualification, diagnostic, support-pack, and provenance references. Student receives only readiness class, evidence classes, bounded support statuses, recovery guidance, and known limits. Student never receives internal qualification/adoption/diagnostic/support identifiers through this projection.

The projection uses the existing ModelQualificationService and JSON authority. It does not add a Writer, Store, Registry, provider, formal runtime activation, or official REALIZED/Settlement/Score/Rank write.

## Route

GET /api/v1/bff/{teacher|admin|student}/model-qualification/reality-join

Required query parameters: courseId, runId, teamId, roundId, scenarioPackageId, parameterSetId, and qualificationId.

Optional query parameter: expectedRealityJoinDigest (64 lowercase hexadecimal characters).
