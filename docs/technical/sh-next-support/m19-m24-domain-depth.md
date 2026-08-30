# Shanghai M19–M24 domain-depth support pack

This document records the current implementation boundary for the M19–M24
mission. The implementation is a candidate-support pack in
`@simwar/sh-next-support`; it is not a second Shanghai kernel, runtime,
registry, Truth writer, Settlement writer, or formal ParameterSet writer.

## State B closure

The pack contains six deliberately different State B records, in mission order:

| Macro | State B                                      | Product delta                                                                                                                                                |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M19   | `OPERATING_CAPITAL_WORLD_REALIZED_CANDIDATE` | Typed workforce, quality, finance, policy, project, portfolio and shock assets with units, bounds, lag and deterministic stress corridors.                   |
| M20   | `QUALIFICATION_EVIDENCE_RESOLVED`            | Source package, rights/freshness, holdout, qualification, uncertainty/OOD, drift and requalification are resolved to a bounded `NOT_ELIGIBLE` outcome.       |
| M21   | `STRATEGY_EXPERIMENT_SEASON_REALIZED`        | Five exact-bound Situation → Tension → Decision → Consequence → Debrief → What-if → Transfer episodes.                                                       |
| M22   | `SECOND_CITY_TRANSFER_JOURNEY_REALIZED`      | A public-safe Hangzhou minimal package uses the same schema shape and records region/version/rights/expiry/compatibility/qualification/rollback constraints. |
| M23   | `LIVING_SCENARIO_OPERATIONS_REALIZED`        | Refresh, diff, impact, requalification, rollback candidate, exact historical resolution and withdraw-without-delete are represented as a dry run.            |
| M24   | `ENTERPRISE_DELIVERY_OPERABLE`               | Shanghai and Hangzhou package choice, sponsor-safe aggregate, role continuity and recovery are closed at `S8_OPERABLE` internal readiness.                   |

Every source-backed value is attached to an evidence row with source IDs,
temporal scope, geography, unit, bounds, confidence, lag and exact current
source references. Synthetic values are marked as such and are not presented
as official city or facility statistics.

## Authority and reuse

M19 consumes the merged M13–M18 C0 capability through its tombstone
`SH-M13-M18-C0-CONSUMPTION-SPINE`; it consumes domain evidence, not an opaque
string or a new C0 seam. The pack carries PR #473 and the current master
readback as the tombstone record. Open PR #468 and #471 are recorded as
non-current collision debt and are not consumed as current proof.

The M20 qualification state is intentionally `NOT_ELIGIBLE`, with calibration
evidence `NOT_PROVEN`, activation `NOT_AUTHORIZED`, and explicit reasons. No
provider call, production PostgreSQL/RLS cutover, Pilot, Production, or Human
Validation was performed.

## Role and runtime boundary

Teacher projections expose candidate configuration, comparison, provenance and
facilitation context. Student projections expose only role-safe consequence
direction, uncertainty, why-not and reflection context. Admin projections expose
tenant-safe lineage and writer boundaries. Enterprise sponsor projections expose
only public-safe package readiness and limits. Official Truth, Settlement,
Score, Rank, private source rows, raw model payloads and formal activation remain
excluded.

The JSON Schema is
`contracts/schemas/sh-domain-depth.v1.json`; the focused executable contract is
`tests/sh-next-support/m19-m24-domain-depth.test.ts`.
