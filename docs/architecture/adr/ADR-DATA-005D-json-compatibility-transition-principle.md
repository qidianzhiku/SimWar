# ADR-DATA-005D: JSON Compatibility, Import / Export and Transition Principle

Status: PROPOSED

Parent: `ADR-DATA-005`

All recommendations are RECOMMENDED_NOT_ACCEPTED.

## Current Active Authority

JSON is current active default runtime and may write M1 teaching-flow data.
PostgreSQL is not default active runtime and must not be introduced by this ADR.

## Candidate Target Direction

RECOMMENDED_NOT_ACCEPTED: if the parent ADR accepts Option A, JSON should move
toward fixture, seed, demo, import/export, compatibility, or transition roles.

JSON should not remain independent authority for Team, ScenarioPackage, or
ParameterSet after PostgreSQL authority is accepted and implemented.

## Minimum Principles

- JSON fixture/demo data should be isolated from formal business data.
- Manual JSON editing must not become production governance path unless allowed
  by a separate decision.
- Long-term dual-write should be avoided.
- Future migration should define source revision, digest, and audit evidence.
- JSON export/import must not create two writers for one formal fact.
- Compatibility period and exit require later JSON Transition Design.

## Human Decisions Required

- Does JSON remain seed/demo only after PostgreSQL activation?
- Is JSON a historical import source?
- Is JSON a long-term export format?
- Is a compatibility period required?
- What ends compatibility?
- Is JSON ever allowed to write formal business paths after transition?

## Non-Goals

No data migration, import script, dual-write, rollback, schema, migration, or
runtime activation is decided here.

## Stop Condition

Do not implement JSON migration or dual-read/dual-write before human acceptance
and a later JSON Transition Design.
