# Human Decision: ADR-DATA-005A

```yaml
decision_id: HUMAN_DECISION_ADR-DATA-005A
related_adr: ADR-DATA-005A-team-teammember-authority.md
status: accepted_with_deferred_details
accepted_by: Project Owner
accepted_at: 2026-06-26
scope: >
  Accept Option C for Team / TeamMember authority: live membership for
  current authorization plus immutable Run membership reference for formal
  historical interpretation.
non_goals: >
  This decision does not authorize SQL, schema, migration, PostgreSQL runtime,
  database connection, Docker, transaction, row lock, unique constraint,
  cross-process work, data migration, source code changes, test changes,
  contract changes, OpenAPI changes, frontend changes, P2-002,
  P0-DATA-IMPL-01, or closeout of #111, #114, or #115.
next_allowed_task: >
  Exact-path docs-only staging, commit, push, and PR creation of the accepted
  ADR-DATA-005A package, if separately authorized by a human.
```

## Decision

Accept `ADR-DATA-005A` with deferred details.

Accepted option:

```text
Hybrid Model:
live membership for current authorization
+
immutable Run membership reference for formal historical interpretation
```

## Accepted Principles

1. Team must belong to exactly one tenant. Cross-tenant Team membership, Team
   transfer, decision submission, result visibility, and formal Run operations
   are forbidden.

2. Current authorization in the active runtime may continue to use
   `actor.team_id`, tenant context, permission guard, and route-level ownership
   guard.

3. Formal Run history must not be rewritten by later TeamMember changes.
   Formal history, audit, result interpretation, and replay must reference an
   immutable Run membership reference or an equivalent immutable roster
   reference.

4. Minimum decision submit eligibility inside a Run requires authenticated
   identity, tenant match, required permission, active TeamMember eligibility,
   and target Team / Run / Round match.

5. Wrong-team decision submit must be rejected. Current `TEAM-403-001` behavior
   may be used as current implementation evidence, but it does not mean full
   TeamMember lifecycle has been implemented.

6. Learners default to reading only their Team projection. Truth view is allowed
   only for same-tenant teachers, admins, or formally authorized platform roles.

7. Core Simulation Engine remains the sole writer for formal simulation truth,
   formal settlement, score, and rank.

8. JSON remains the current active runtime. The long-term target is to converge
   JSON into fixture, seed, demo, import/export, or controlled compatibility
   use. Unmanaged long-term dual authority is not allowed.

## Deferred Details

These details remain deferred and do not authorize implementation or interface
changes:

1. Exact capture timing for the Run membership reference.
2. Mid-Run replacement, exit, transfer, and disablement rules.
3. Historical result visibility after role or membership changes.
4. Complete Team-scoped role contract.
5. P2-002 role context and role assignment contracts.
6. JSON import/export and transition strategy.
7. PostgreSQL schema, migration, runtime provider, transaction, locking, and
   cross-process consistency.
8. API request/response contract and frontend role-management implementation.
9. #111, #114, and #115 closeout.

## Explicit Non-Goals

This decision does not authorize:

```text
SQL
schema
migration
PostgreSQL runtime
database connection
Docker
transaction
row lock
unique constraint
cross-process
data migration
source code changes
test changes
contract changes
OpenAPI changes
frontend changes
P2-002
P0-DATA-IMPL-01
#111 closeout
#114 closeout
#115 closeout
```

## Next Allowed Task

```text
Human authorization for exact-path docs-only staging, commit, push, and PR
creation of the accepted ADR-DATA-005A package.
```
