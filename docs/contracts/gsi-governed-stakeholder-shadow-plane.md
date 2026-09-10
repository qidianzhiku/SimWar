# GSI Governed Stakeholder Shadow Plane

The GSI product capability is a bounded, deterministic, Provider-OFF candidate path:

`Proposal -> Deterministic Resolver -> bounded Signal -> candidate digest -> role-safe projection`.

The request binds tenant, course, run, round, team, ScenarioPackage, ParameterSet,
ModelVersion, and ModelArtifact by explicit identifiers and versions. `latest` and
`default` are invalid. Proposals are limited to five stakeholder records and finite
influence values in [-1, 1].

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
