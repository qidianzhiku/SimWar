# ADR-DATA-005C: ScenarioPackage Metadata, Artifact, Digest and Plugin Dependency

Status: PROPOSED

Parent: `ADR-DATA-005`

All recommendations are RECOMMENDED_NOT_ACCEPTED.

## Current Active Authority

JSON stores `scenarios`; the JSON adapter resolves ScenarioPackage by tenant and
package id. Courses and runs carry `scenario_package_id`. PostgreSQL stores
references but has no accepted ScenarioPackage authority, digest policy, or
plugin mapping.

## Open Authority Boundary

ScenarioPackage controls teaching context and may carry immutable payloads. It
can affect Replay and plugin compatibility but must not move truth writing
outside Core Simulation Engine.

## Candidate Target Direction

RECOMMENDED_NOT_ACCEPTED: PostgreSQL should own ScenarioPackage metadata, tenant
scope, version, status, schema version, digest, approval state, artifact
reference, and PluginPackage dependency if the parent ADR accepts Option A.

Large payloads may live behind immutable artifact boundary. PostgreSQL would
reference artifacts, not necessarily store them inline.

## Human Decisions Required

- Is ScenarioPackage immutable after publication?
- Are semantic version and content hash both required?
- Does it depend on PluginPackage version and compatibility rules?
- Are metadata and payload separated?
- What owns URI, digest, status, approval, withdrawal, deprecation, rollback?
- Does a bound Run permanently reference the historical version?
- Do deprecated or retired packages remain replayable?

## Non-Goals

No object storage deployment, schema, SQL, migration, adapter implementation,
or Plugin runtime is decided here.

## Stop Condition

Do not design ScenarioPackage schema or replace JSON scenario reads before
human acceptance.
