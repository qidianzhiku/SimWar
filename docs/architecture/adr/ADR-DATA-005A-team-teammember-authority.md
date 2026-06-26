# ADR-DATA-005A: Team / TeamMember Authority, Membership and Historical Interpretation

Status: PROPOSED

Parent: `ADR-DATA-005`

All recommendations are RECOMMENDED_NOT_ACCEPTED.

## Current Active Authority

JSON stores `teams` and user/team relationships. The JSON adapter resolves teams
by tenant, run, and course context. Settlement reads via provider ports and
RepositoryFacade. PostgreSQL still lists `teams.listTeamsForRun` as a gap.

## Open Authority Boundary

Team and TeamMember affect permissions, submission eligibility, historical Run
interpretation, and settlement input. JSON supports M1 flow but is not accepted
durable authority.

## Candidate Target Direction

RECOMMENDED_NOT_ACCEPTED: Team and TeamMember should become PostgreSQL target
durable control-plane objects if the parent ADR accepts Option A.

PostgreSQL would own tenant scope, course/run relation, team identity,
membership, role assignment, status, and audit-relevant history. JSON would
become fixture, seed, import/export, or compatibility data.

## Human Decisions Required

- Does Team become a PostgreSQL authoritative object?
- Does TeamMember become versioned or traceable?
- Do role/member changes affect historical Runs, decisions, permissions, audits?
- Does Team membership participate in submission eligibility?
- Is a run-time Team snapshot required?

## Non-Goals

No schema, table, migration, adapter, permission implementation, provider
wiring, or runtime activation is decided here.

## Stop Condition

Do not design Team schema or migration before human acceptance.
