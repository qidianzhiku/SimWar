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
