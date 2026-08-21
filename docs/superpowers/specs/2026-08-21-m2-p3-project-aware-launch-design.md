# M2-P3 Project-Aware Course Launch — Design Specification

**Mission:** `SIMWAR-SH-M2-P3-PROJECT-AWARE-LAUNCH-V5.14-20260821`

**Date:** 2026-08-21

**Status:** implementation-ready after current-source, graph, design and baseline verification

## 1. Objective and non-goals

M2-P3 closes the project-aware launch gap between the existing Project Library assignment surface and the existing formal Course/Run/Team/Role/W4 authorities. A teacher must be able to prepare exact project assignments for multiple teams, see a single readiness projection, and open a Formal Run through the existing run authority. Students then receive only their own project, role and run context. Admins receive a tenant-scoped launch/lineage audit projection.

This is an orchestration and projection layer. It is not a new simulation runtime, project registry, EnterpriseState writer, role authority, settlement path, AI provider, release environment, or human-acceptance claim.

Out of scope: Production, Pilot, W6, provider/model activation, Human Validation, PostgreSQL/RLS, merge beyond the one Product PR and one docs-only Governance PR, and closure of unrelated issue #418.

## 2. Existing authority and reuse gap map

| Capability                                    | Current authority                                                                       | M2-P3 decision                                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ProjectProfile / ProjectAssignment exact refs | `ProjectLibraryService` and its existing repository/store                               | REUSE; add read-only scoped accessors only if needed by readiness. Preserve exact `profile_ref`, version and digest.              |
| Teacher project library authoring             | Existing teacher project-library BFF and `ProjectLibraryPanel`                          | EXTEND; add a project-aware assignment/readiness/launch control surface without changing import/validate/retire semantics.        |
| Course formal binding                         | `FormalCourseAuthorityBindingStore` and teacher formal-course binding service           | REUSE; do not let launch override course-bound scenario/parameter/engine/plugin refs.                                             |
| Formal Run creation                           | Existing course-run route plus `createFormalBoundRun` and `FormalRunRuntimeBindingPort` | REUSE through a shared application helper extracted from the existing route. No second Run writer.                                |
| Role assignment/workspace                     | `RoleWorkflowCommandService` and `getStudentWorkspace`                                  | REUSE; readiness reads its existing repository projection and student context composes the safe result. No second role authority. |
| W4 EnterpriseState                            | Existing W4 state service / initial-state writer                                        | REUSE once per team; same ProjectProfileRef does not imply shared state.                                                          |
| Student project brief                         | Existing student `/project-brief` route and `ProjectBriefPanel`                         | EXTEND safe response with role/run/project context, preserving forbidden-field filtering.                                         |
| Admin audit                                   | Existing tenant-scoped project-library audit route                                      | EXTEND with launch/lineage entries; read only.                                                                                    |
| Course/team/run readiness                     | No unified project-aware projection exists                                              | ADD one read model and pure evaluator.                                                                                            |
| Project-aware launch command                  | No command exists                                                                       | ADD one command service that gates the existing Run authority.                                                                    |
| Figma patterns                                | Read-only reference file                                                                | REUSE visual hierarchy/tokens only; Figma is not product truth.                                                                   |

## 3. Authority topology

```text
Teacher BFF command
        |
        v
ProjectAwareCourseLaunchService
  | exact Course/Run/Team scope
  | exact ProjectAssignment/Profile refs
  | existing RoleWorkflow read authority
  | existing FormalCourse binding authority
  | readiness evaluator
  | idempotent launch receipt
        |
        +--> existing formal Run creation application helper
        |       +--> createFormalBoundRun
        |       +--> existing Run/Round persistence
        |       +--> existing formal runtime binding store
        |
        +--> existing W4 initial-state writer, once per team
        +--> existing audit ledger

Student BFF --> existing role workspace + exact project brief --> safe projection only
Admin BFF   --> tenant-scoped launch/lineage audit projection --> read only
```

The project-aware layer may decide whether a launch is admissible, but it does not become the source of truth for settlement, role assignment, W4 transitions, or formal runtime binding.

## 4. Domain contract

Add a focused shared contract module, exported from `packages/shared-contracts/src/index.ts`, using existing `Course`, `Run`, `Team`, `RoleContext`, `ProjectAssignment` and `ProjectProfile` reference types rather than redefining them.

### 4.1 Readiness state

The public readiness state is one of:

```text
BLOCKED | STALE | DEGRADED | READY | UNKNOWN_VERIFYING
```

`RETIRED`, `HISTORICAL`, `MISSING_ASSIGNMENT`, `CONFLICTING_ASSIGNMENT`, `MISSING_ROLE`, `UNKNOWN_FORMAL_STATUS` and similar values are blocker categories, not silent fallback states. A retired or digest-mismatched dependency produces `STALE`; missing, conflicting or scope-invalid input produces `BLOCKED`; an unavailable authoritative status produces `UNKNOWN_VERIFYING`. `DEGRADED` is reserved for an explicit documented non-critical degradation and is not emitted by the default implementation.

### 4.2 Readiness projection

The projection contains:

- exact tenant, course, run and team identifiers;
- required project/profile references and exact `profile_ref`, version and digest;
- per-team readiness and a course-level aggregate;
- blocker code, owner and required action for every non-ready condition;
- formal binding status and exact binding refs/digest when known;
- whether a successor exists, without changing the assigned reference;
- a stable projection version and `generated_at` timestamp.

Course readiness is `READY` only when every required team has a valid exact assignment, every existing team member has an existing role assignment, the course/run scope is exact, and formal runtime inputs are authoritatively bound. The implementation does not invent a fixed five-role minimum; it evaluates all role seats currently declared by the existing Team members, allowing the existing one-member fixtures to remain valid while still catching missing role assignments.

### 4.3 Launch command and receipt

The teacher command accepts an explicit course scope and an idempotency key. It may accept an explicit list of team IDs for a matched arena, but it must not accept replacement scenario, parameter, engine, plugin or ProjectProfile refs as a hidden override. The command returns a durable receipt containing:

- command idempotency key and command status;
- exact tenant/course/team scope;
- readiness snapshot identity and state;
- created run/round identifiers when accepted;
- formal runtime binding identity/digest when available;
- per-team W4 initialization receipts;
- audit event identity and timestamp.

An identical command key and exact scope returns the original receipt without creating a second formal Run, Round, binding or W4 state. Reuse of the key with a different scope is rejected as a conflict. The receipt is governance/audit metadata, not settlement truth.

The receipt must be persisted through the existing repository/audit boundary or a narrowly scoped launch-receipt port; it must not be implemented as a second Run or EnterpriseState registry.

## 5. Readiness rules

The evaluator is pure with respect to a collected snapshot. It checks, in order:

1. Actor has the teacher capability and the requested Course is in the requested tenant.
2. Course, Run and Team references are exact and mutually scoped.
3. Every required team has exactly one assignment; missing assignment is `BLOCKED`.
4. Assignment `profile_ref`, version, digest and MarketWorldRef match the existing validated ProjectProfile and Course binding; wrong scope, stale digest/version and retired profile are explicit blockers.
5. An available successor is informational unless the assigned profile is retired/stale; no implicit latest/current/default or automatic rebind occurs.
6. Every declared team member has an existing role assignment in the existing RoleWorkflow authority; missing role is `BLOCKED`.
7. Formal Course binding and runtime status are known and compatible; unknown status is `UNKNOWN_VERIFYING`.
8. All required team projections are ready before aggregate Course readiness becomes `READY`.

The evaluator never reads or copies `state_true`, other-team data, score, rank, settlement result, private coefficients, raw source paths or hidden calibration into a student projection.

## 6. Matched-arena and isolation semantics

Multiple teams may intentionally reference the same exact ProjectProfileRef/version/digest in one Course/Run. This is a matched arena, not shared state. Each team receives its own existing W4 initial state keyed by its own tenant/course/run/team scope. The launch receipt records the common profile ref and separate team state/initialization receipts. Any cross-team state read or mutation is denied by the existing scope checks and covered by tests.

## 7. API and UI surfaces

### Teacher

Add a scoped readiness read and launch command under the existing teacher BFF namespace. The UI extends the existing Project Library surface with:

- assignment matrix for all required teams;
- exact profile ref/version/digest badges;
- per-team and aggregate readiness;
- explicit blocker owner/action;
- successor/retired/stale visibility;
- a single launch control disabled unless the authoritative aggregate is `READY`;
- exact command receipt and readback after launch.

### Student

Extend the existing project brief response/panel to compose the existing safe RoleWorkflow workspace with the exact project brief. The server derives the student’s team/role from existing authority and rejects cross-team or cross-course reads. The client does not calculate readiness or supply authoritative role/team context.

### Admin

Extend the existing tenant-scoped audit projection to include assignment lineage, readiness transition, launch command/receipt and formal binding references. Admin remains read-only and receives no other-tenant or private simulation state.

## 8. Test-first acceptance matrix

Write failing tests before implementation for:

- missing assignment;
- wrong tenant/course/run/team scope;
- stale digest/version;
- retired profile;
- successor available without explicit rebind (assignment remains unchanged);
- conflicting team assignment;
- missing role assignment;
- unknown formal status;
- student cross-team read;
- alias `latest` / `current` / `default` or implicit rebind;
- duplicate formal command/retry;
- matched-arena per-team state isolation;
- exact command receipt/readback;
- contract response shape and forbidden-field exclusion.

The dedicated browser journey must use the real BFF with mocks disabled: teacher opens the MarketWorld course, sees a blocked team, assigns exact refs, uses the same exact ref for two teams, observes readiness become `READY`, launches through formal authority, sees Student A/B own contexts, observes cross-team denial, and reads the Admin audit. Existing M2-P2 browser coverage remains regression evidence.

## 9. Compatibility and rollback

Existing Project Library import/validate/assign, direct course-run creation, role workflow, W4 and student brief routes remain backward compatible. The shared formal-run helper must be covered by the existing route tests and the new launch tests. Rollback is a single Product PR revert; no database migration or external dependency is introduced.

## 10. Explicit exclusions

No changes to settlement logic, replay hash inputs, canonical decision selection, API provider activation, AI actor/provider/model, PostgreSQL/RLS, W6, Human Validation, Pilot, Production, automatic successor, or unrelated governance issue closure.
