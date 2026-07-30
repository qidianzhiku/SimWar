# STK-S0 ADR: Keep the Stakeholder Plane Off and Candidate-Only

## Status

`ACCEPTED_FOR_S0_DISCOVERY_ONLY`

This ADR is bound to source SHA
`1a13d81a43f667d80d3da2eaffe8aae8e48b45f8`. It does not authorize S1, S2,
runtime activation, shared-contract mutation, a provider, real data, or a
product surface.

## Context

Repository governance recognizes Stage 4B as a non-blocking support line that
must remain OFF/inactive and must not write formal state. Current exact-source
and dual-graph review found no named Stakeholder Plane runtime under product
code, contracts, or tests.

Current source already provides reusable boundaries:

- exact CourseBlueprint identity and a sole lifecycle writer;
- authenticated tenant/course/team/role scoping;
- Teacher, Student, and Admin projection builders;
- Student-safe settlement projections without `state_true`;
- advisory-only `CoachOutput`, `ModelCallLog`, and Learning Report types;
- Replay evidence that does not write formal results.

The external Program M / Stage 4B extract proposes a deterministic resolver and
bounded Runtime Preference State. It is
`BASELINE_CANDIDATE / DOCUMENTED_ONLY`, not current implementation.

## Decision

1. Keep the Stakeholder Plane OFF.
2. Treat STK-S0 as read-only impact analysis and contract candidate design.
3. Do not create or modify runtime, shared contracts, product code, tests,
   dependencies, workflows, registries, stores, providers, or formal
   authorities.
4. Preserve Simulation Core L1-L3 as the sole Truth/Settlement/Score/Rank
   writer.
5. Preserve the canonical Decision path as the sole formal decision path.
6. If a future lane is authorized, require:
   `safe context -> proposal -> deterministic resolver -> bounded shadow state`.
7. Permit future writes only to separately governed append-only shadow objects;
   never to Decision, Truth, Settlement, Score, Rank, ParameterSet,
   ModelVersion, Replay, or formal bindings.
8. Require Plane OFF exact parity and zero provider calls in official Replay.
9. Serialize future shared-contract, CourseBlueprint, Teacher BFF/App, Golden,
   and model-adapter work with their current owners.
10. Require independent gates for S1 and S2. S0 does not imply either gate.

## Consequences

### Positive

- C2 can proceed without STK file or authority conflict.
- Current product runtime and JSON authority remain unchanged.
- Privacy, tenant, and Student visibility constraints are explicit before schema
  or route work begins.
- Future contract design has a bounded vocabulary and negative field list.
- Program M integration can be assessed after formal rebase without reopening
  the demand model or creating a second Truth writer.

### Costs

- No stakeholder simulation capability is delivered.
- No Plane OFF executable parity test exists yet.
- Contract shape, store, resolver, provider, retention, and product surfaces
  remain unresolved.
- A future S1 must repeat current-reality and graph delta checks.

## Rejected Alternatives

| Alternative                                          | Reason                                            |
| ---------------------------------------------------- | ------------------------------------------------- |
| Agent writes canonical Decision                      | creates a second decision authority               |
| Agent or resolver writes market share/occupancy      | creates a hidden Truth writer                     |
| Agent adjusts beta/sigma/pi/rho                      | mutates model authority and defeats replayability |
| Reuse ParameterSet or ModelVersion as runtime state  | turns short-lived state into a second model       |
| Reuse CourseBlueprint authority/store                | violates C1 sole-writer and immutable lifecycle   |
| Invoke provider during settlement or official Replay | makes formal results nondeterministic             |
| Always-on feature with fallback                      | breaks Plane OFF parity and fail-closed behavior  |
| Reuse Replay as a stakeholder executor               | confuses evidence with formal writes              |
| Expose raw memory to Teacher/Student                 | violates privacy and least privilege              |
| Start S1/S2 in this lane                             | exceeds docs-only authorization                   |

## Gate to Revisit

Revisit only after:

1. current master and dual graphs are refreshed;
2. C2 releases conflicting files and locks;
3. S1 receives a separate owner authorization and exact allowlist;
4. privacy, tenant, retention, revocation, and contract owners are named;
5. Plane OFF parity and forbidden-writer tests are specified;
6. Program M formal rebase establishes the actual model/runtime seam;
7. S2 receives an independent authorization;
8. any limited or official influence receives a T4 Owner decision.

## Explicit Non-Proofs

This ADR does not prove:

- Stakeholder Plane implementation;
- deterministic resolver correctness;
- behavioral fidelity or human likeness;
- BLP/RCNL active runtime or calibration;
- Model Registry or bounded state storage;
- shared-contract readiness;
- Replay compatibility;
- CourseBlueprint integration;
- Learning Evidence integration;
- AI/provider readiness;
- PostgreSQL, durable recovery, Pilot, or Production readiness.

## Evidence

- CodeGraph: `CG-009`, `CG-010`, exact symbol readbacks.
- Graphify: `GF-007`, `GF-008`, with documented static limits.
- File ownership and resource lock matrices in the launch evidence root.
- Current source symbols:
  `CourseBlueprintVersion`, `CourseBlueprintRegistryPort`,
  `createTeacherBffWorkspaceDto`, `createStudentBffCockpitDto`,
  `createTenantAdminSummaryDto`, `CoachOutput`, `ModelCallLog`,
  `RunReplayEvidence`.
- Governance:
  `L1_DEFINITION_OF_DONE.md`,
  `CODEX_TARGET_MODE_AUTHORITY_MATRIX.md`,
  `L1_TARGET_MODE_EXECUTION_SPEC.md`.
- External Program M extract digest
  `EFA1A1C5B6498EA22170468DE056CDB1B1BC3B4ACFDC55CD7E0B163EBB20E33A`,
  classified `BASELINE_CANDIDATE / DOCUMENTED_ONLY`.
