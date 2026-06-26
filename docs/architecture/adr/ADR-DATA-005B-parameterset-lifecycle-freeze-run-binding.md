# ADR-DATA-005B: ParameterSet Lifecycle, Approval, Freeze and Run Binding

Status: PROPOSED

Parent: `ADR-DATA-005`

All recommendations are RECOMMENDED_NOT_ACCEPTED.

## Current Active Authority

JSON stores `parameterSets`; the active route checks tenant and approved status
before run creation, then binds the run to `parameter_set_id` and seed.
PostgreSQL stores references but has no accepted lifecycle authority.

## Open Authority Boundary

ParameterSet is a formal input, not the truth writer. Core Simulation Engine
remains the only L1-L3 truth writer. AI, UI, teachers, and providers must not
mutate a bound ParameterSet into official truth.

## Candidate Target Direction

RECOMMENDED_NOT_ACCEPTED: ParameterSet lifecycle should become PostgreSQL target
durable governance authority if the parent ADR accepts Option A.

The target model should preserve draft, candidate, approved, bound, and
deprecated semantics. Approved/bound sets should not be overwritten in place.
Changes should create a new version or clone/fork after policy acceptance.

## Human Decisions Required

- Are `draft`, `candidate`, `approved`, `bound`, and `deprecated` accepted?
- Who may create, submit, approve, clone, deprecate, or roll back?
- Is approved immutable, or can approval be revoked?
- Does Run bind `parameter_set_id`, ParameterSetVersion, or another reference?
- Does Shadow Replay become an approval gate?
- How are old versions retained for Replay?

## Non-Goals

No schema, SQL, migration, Shadow Replay runtime, or PostgreSQL activation is
decided here.

## Stop Condition

Do not design ParameterSet schema or route integration before human acceptance.
