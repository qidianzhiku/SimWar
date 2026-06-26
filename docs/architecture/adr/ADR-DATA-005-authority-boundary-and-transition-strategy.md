---
adr_id: ADR-DATA-005
title: Authority Boundary and Transition Strategy for Team, ScenarioPackage, and ParameterSet
status: accepted
risk_tier: RISK_TIER_0
accepted_by: Project Owner
accepted_at: 2026-06-26
scope: >
  Accept PostgreSQL as the target durable authority for the operational
  control plane and governance assets of Team, TeamMember, ParameterSet,
  and ScenarioPackage metadata, while preserving Core Simulation Engine
  L1-L3 as the sole formal simulation truth writer.
non_goals: >
  This decision does not authorize SQL, schema design, migration,
  PostgreSQL runtime activation, database connections, transactions,
  row locks, unique constraints, cross-process implementation,
  production data migration, durable settlement implementation,
  or closure of #111, #114, or #115.
next_allowed_task: P0-GOV-EXEC-001
supersedes:
---

# ADR-DATA-005: Authority Boundary and Transition Strategy for Team, ScenarioPackage, and ParameterSet

## Status

ACCEPTED_TARGET_WITH_DEFERRED_DETAILS by Project Owner on 2026-06-26.
Acceptance evidence is recorded in
`docs/decisions/HUMAN_DECISION_ADR-DATA-005.md`.

Identifier warning: an accepted settlement ADR already uses `ADR-DATA-004`.
Before acceptance, resolve numbering. This draft does not modify that ADR.

## Context

Current code evidence: JSON is active default runtime; PostgreSQL is not. Team,
ScenarioPackage, and ParameterSet are read from JSON-backed provider paths.
PostgreSQL stores some references, but gaps still include
`teams.listTeamsForRun`, `scenarios.getScenarioPackage`, and
`parameterSets.getParameterSet`.

P0-Settlement-05C-1 and 05C-2 recommended Option A. Project Owner accepted
Option A with deferred details on 2026-06-26.

## Runtime Limitation

M1 Teaching-Official Result under Current JSON Active Runtime means JSON can
produce an official teaching workflow result. It does not prove durable
settlement. Not proven: transaction behavior, uniqueness, row locks,
cross-process idempotency, crash recovery, or commit / audit atomicity. #111
remains open.

## Terms

- Current Active Authority: source the active route reads/writes today.
- Target Durable Authority: intended long-term transaction authority after
  explicit acceptance and later implementation.
- Transition Authority: temporary source during migration or compatibility.
- Projection: read/search/reporting view, not business truth writer.
- Fixture / Seed: test, demo, or bootstrap data.

## Options

| Option | Summary | Evaluation |
| --- | --- | --- |
| A | PostgreSQL target authority for runtime control plane and governance assets; Core Simulation Engine remains truth writer; JSON becomes fixture, seed, import/export, or compatibility. | ACCEPTED_TARGET_WITH_DEFERRED_DETAILS. |
| B | JSON remains long-term authority; PostgreSQL only projection/search/reporting. | Not recommended. Keeps dual-authority risk. |
| C | PostgreSQL only covers settlement outcome / audit subset. | Not recommended. Leaves active read-side gaps. |
| D | No target model selected. | Safe fallback if humans require more product governance. |

## Accepted Decision

Choose Option A as the target architecture direction.

PostgreSQL would become target durable authority for Team / TeamMember,
ScenarioPackage metadata, ParameterSet lifecycle, tenant scope, approval state,
version references, and run binding. Core Simulation Engine remains sole writer
for L1-L3 truth, settlement, score, and rank. Artifact storage may hold
immutable payloads while PostgreSQL owns metadata, digest, version, status, and
references. AI remains advisory_only. JSON remains active until changed.

## Deferred Human Decisions

Acceptance does not settle detailed domain rules. Follow-up decisions must
resolve Team / TeamMember history and eligibility, ParameterSet lifecycle,
ScenarioPackage artifact policy, JSON transition details, and Official Run
Manifest layering.

## Consequences

Consequences: one target authority can reduce dual-authority risk, but schema
and migration work remain blocked until human acceptance. This does not
complete #111, #114, or #115.

## Explicit Non-Goals

This ADR does not authorize SQL, migration, PostgreSQL runtime activation,
provider selection, transaction, uniqueness, row lock, cross-process,
crash recovery, JSON migration, plugin runtime, AI runtime, or Issue closeout.

Next allowed task after acceptance: P0-GOV-EXEC-001.
