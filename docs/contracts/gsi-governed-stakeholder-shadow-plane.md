# GSI Governed Stakeholder Shadow Plane

The GSI product capability is a bounded, deterministic, Provider-OFF candidate path:

`Proposal -> Deterministic Resolver -> bounded Signal -> candidate digest -> role-safe projection`.

The request binds tenant, course, run, round, team, ScenarioPackage, ParameterSet,
ModelVersion, and ModelArtifact by explicit identifiers and versions. `latest` and
`default` are invalid. Proposals are limited to five stakeholder records and finite
influence values in [-1, 1].

`GSIExactBinding` also requires the stored `round_no`, `activity_id`, and `role_key`.
The server verifies round identity/number and the active role against its existing
role-workflow snapshot. Student reads never rewrite the stored role to the requester;
pair selection must match the stored activity and role on both candidates. Older
records without these bindings are unavailable until explicitly recreated.

The OpenAPI objects bind the canonical `GSIRequest`, `GSIReceipt`, `GSIExactBinding`,
`GSITeacherProjection`, and `GSICrossRoundPairOptions` contracts. Pair-options GET
success uses the actual `{ code, data, message, request_id }` envelope. Its required
course/run/team/activity/role identifiers must be nonempty and already trimmed;
the whole tokens latest/current/default/fallback/first/last/newest are rejected
case-insensitively. Internal whitespace and non-reserved compound tokens remain
accepted by this runtime seam; it is not the stricter DDT ASCII identifier grammar.

DDT maps GSI's `context_status` (Student) or `context.status` (Teacher/Admin)
directly, preserving AVAILABLE, CONTEXT_UNAVAILABLE and REBASE_REQUIRED. Existing
DDT error/status mapping retains STALE and LIMITED where a source supports them.
GSI currently emits neither STALE nor LIMITED as context status.

The OFF and SHADOW modes share the same deterministic candidate calculation. SHADOW
is a governance-plane label, not a second runtime or provider. The candidate is
advisory/candidate evidence only. It cannot write official state, settlement, score,
rank, canonical Decision, or replay truth. Student output is published only through
the role-safe projection; raw proposals and private source data remain unavailable.

Known limits: Provider remains OFF; the deterministic mock is not evidence of AI
effectiveness; no durable external-provider memory or formal truth influence is
activated; JSON remains the active runtime authority.

## Cross-round comparison

The same GSI route family also exposes the read-only comparison path:

`GET /api/v1/bff/{teacher|student|admin}/gsi/candidates/compare`

Callers must supply the exact `from_candidate_id`, `to_candidate_id`, `activity_id`,
and `role_key`. The pair is accepted only when both candidates have the same
tenant, course, run, and team, distinct round identity/number, and identical
ScenarioPackage, ParameterSet, ModelVersion, and ModelArtifact lineage. There is
no latest/current/default/first/last/newest selector or array-position fallback.

Signals are compared by the stable `(stakeholder_type, intent)` key. A signal that
exists on only one side is `NEW` or `REMOVED` and has no invented zero value. A
matched signal is `INCREASED`, `DECREASED`, or `STABLE` with a bounded delta. The
comparison digest is a deterministic read-side digest; a caller-provided stale
digest returns `REBASE_REQUIRED`.

W3 and M2-P5 are consumed only as exact, published, read-only contextual anchors.
Missing or unpublished context remains `CONTEXT_UNAVAILABLE`; context movement
returns `REBASE_REQUIRED`. The comparison always carries `non_causal=true` and
`causal_proof=false` and never recomputes or writes official outcome, Decision,
Settlement, Score, Rank, or replay truth. Teacher and Admin receive exact pair
provenance; Student receives only the allowlisted movement summary, status,
limits, and recovery guidance, without candidate IDs, comparison digests, or
privileged context references.
