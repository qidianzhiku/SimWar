# ADR-DATA-005A: Team / TeamMember Authority, Membership Lifecycle, and Historical Run Interpretation

Status: ACCEPTED_WITH_DEFERRED_DETAILS

accepted_by: Project Owner

accepted_at: 2026-06-26

Parent: `ADR-DATA-005`

OMD link: `OMD-002`

Decision evidence: `docs/decisions/HUMAN_DECISION_ADR-DATA-005A.md`

This annex records the accepted Team / TeamMember authority principle for
Option C. Deferred details remain explicitly unresolved. This acceptance does not
change the parent ADR, implement code, define storage schema, or activate
PostgreSQL.

## 1. Decision Question

This proposal answers only the Team / TeamMember domain question deferred by
`OMD-002`:

```text
How should Team and TeamMember define tenant ownership, membership lifecycle,
team-scoped roles, decision submission eligibility, and historical Run
interpretation while JSON remains the current active runtime and PostgreSQL is
the accepted target durable authority for governance control-plane metadata?
```

The answer must preserve three boundaries:

- current JSON active runtime behavior remains a source fact, not a final domain
  policy;
- PostgreSQL target durable authority is an accepted principle, not an
  implemented runtime;
- historical official Run results, audit, and replay must not be rewritten by
  later TeamMember edits.

## 2. Classification Legend

This annex uses these labels to prevent mixing evidence and proposal:

| Label                       | Meaning                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| CURRENT_SOURCE_FACT         | Current repository behavior or current route-level evidence.                                  |
| ACCEPTED_PRINCIPLE          | Accepted by `ADR-DATA-005`, `HUMAN_DECISION_ADR-DATA-005`, or `HUMAN_DECISION_ADR-DATA-005A`. |
| PROPOSED_DOMAIN_DESIGN      | Recommended but not accepted Team / TeamMember policy.                                        |
| UNRESOLVED_FOLLOW_UP        | Design detail that still needs a later task or human decision.                                |
| FUTURE_EVIDENCE_REQUIREMENT | Tests, contracts, or implementation proof required before relying on the design.              |

## 3. CURRENT_SOURCE_FACT

The following facts are current evidence only:

- JSON is the current active runtime.
- PostgreSQL is not the active runtime.
- Current users may carry `team_id`.
- `getActorFromUser(...)` exposes `tenant_id`, role permissions, and optional
  `team_id` to active route handlers.
- Current `Team` includes `tenant_id`, `course_id`, `captain_user_id`, and
  embedded members with `user_id` and `role_slot`.
- Current `TeamMember.role_slot` includes `CEO`, `CFO`, `CMO`, `COO`, and
  `risk`.
- Current decision submission uses `actor.team_id` as the effective ownership
  guard.
- Current wrong-team decision submission is rejected with `TEAM-403-001`.
- Current learner result projection filters by `actor.team_id` and redacts
  `state_true`.
- Current teacher / tenant-admin / platform-admin result projection can include
  `state_true` inside tenant scope.
- The JSON repository adapter has a `getTeamForUser(...)` helper that resolves a
  user team by tenant, run, and course context, but current decision submission
  route evidence still relies on `actor.team_id` plus tenant-scoped team lookup.
- P0-AUTH-01 route-level evidence found current tenant, identity, permission,
  and wrong-team guards for the selected active routes, but that evidence does
  not complete TeamMember lifecycle, role history, or future durable authority
  design.

CURRENT_SOURCE_FACT must not be read as a final product permission policy.

## 4. ACCEPTED_PRINCIPLE

The following principles are already accepted by `ADR-DATA-005` and
`HUMAN_DECISION_ADR-DATA-005`:

- PostgreSQL is the target durable authority for Team / TeamMember governance
  control-plane metadata.
- JSON remains the current active runtime until an explicit later decision and
  implementation changes that runtime.
- Future JSON roles should be limited to fixture, seed, demo, import/export, or
  controlled compatibility data.
- JSON and PostgreSQL must not become unmanaged long-term dual write authorities
  for the same formal domain object.
- Core Simulation Engine L1-L3 remains the sole writer of official simulation
  truth, official settlement, score, and rank.
- AI remains advisory-only and must not write formal truth.
- The accepted principle does not authorize storage schema, runtime activation,
  database connections, transactions, locks, cross-process behavior, production
  migration, or closure of #111, #114, or #115.

The following additional principles are accepted by
`HUMAN_DECISION_ADR-DATA-005A`:

- Option C is accepted with deferred details:

  ```text
  live membership for current authorization +
  immutable Run membership reference for formal historical interpretation
  ```

- Team must belong to exactly one tenant.
- Cross-tenant Team membership, Team transfer, decision submission, result
  visibility, and formal Run operation are forbidden.
- Current authorization in the active runtime may continue to use
  `actor.team_id`, tenant context, permission guards, and route-level ownership
  guards.
- Formal Run history must not be rewritten by later TeamMember changes.
- Formal history, audit, result interpretation, and replay must reference an
  immutable Run membership reference or equivalent immutable roster reference.
- Minimum decision submit eligibility requires authenticated identity, tenant
  match, required permission, active TeamMember eligibility, and target Team /
  Run / Round match.
- Wrong-team decision submit must be rejected. Current `TEAM-403-001` behavior
  is evidence of current implementation, not evidence that full TeamMember
  lifecycle is implemented.
- Learners default to their Team projection. Truth view is limited to same-tenant
  teacher, admin, or formally authorized platform roles.
- Core Simulation Engine remains the sole writer for formal simulation truth,
  formal settlement, score, and rank.
- JSON remains current active runtime. The long-term goal is to converge JSON to
  fixture, seed, demo, import/export, or controlled compatibility use and avoid
  unmanaged long-term dual authority.

## 5. DOMAIN DESIGN DETAILS

The sections below retain the design detail from the proposal. They must be read
through the acceptance boundary above: Option C and the listed minimum
principles are accepted, while exact timing, lifecycle edge cases, role
contracts, transition details, and implementation evidence remain deferred.

### 5.1 Team Identity and Tenant Boundary

ACCEPTED_PRINCIPLE:

- A Team belongs to exactly one tenant.
- A Team must never span tenants.
- Cross-tenant Team membership, Team transfer, or decision submission is
  forbidden.
- A Team belongs to one Course context.
- A Run may reference Teams through the Course / Run participation boundary.
- A Team may participate in multiple Runs only when the Course policy allows it
  and each Run stores or references its own historical membership boundary.
- Team identity is stable for audit and history. Human-facing display names may
  change, but the historical Team reference used by official Runs must remain
  interpretable.

UNRESOLVED_FOLLOW_UP:

- Whether Courses later introduce Cohorts or class sections as a separate
  grouping concept.
- Whether one Team can participate in parallel active Runs in the same Course.

FUTURE_EVIDENCE_REQUIREMENT:

- Contract tests must prove tenant-scoped Team lookup before future
  implementation can rely on durable Team authority.

### 5.2 TeamMember Identity and Lifecycle

PROPOSED_DOMAIN_DESIGN_DETAIL:

A TeamMember represents a user membership in a tenant-scoped Team. The
membership lifecycle should be explicit and audit-relevant.

Recommended membership states:

| State       | Meaning                                                   | Decision submit                                                 | Result visibility                                                                      |
| ----------- | --------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| invited     | User was invited but has not joined.                      | No.                                                             | No learner team projection unless separately allowed by teacher/admin policy.          |
| active      | User is an active team member.                            | Yes, if Run/Round eligibility also permits.                     | Yes, for own-team learner projection.                                                  |
| suspended   | Membership temporarily disabled.                          | No.                                                             | No learner projection for future views unless historical Run reference says otherwise. |
| exited      | User voluntarily left the Team.                           | No for future rounds.                                           | Historical visibility depends on Run membership reference.                             |
| removed     | Teacher/admin removed the user.                           | No for future rounds.                                           | Historical visibility depends on Run membership reference.                             |
| transferred | User moved to a different Team.                           | Only for the new Team after effective time and Run eligibility. | Historical visibility remains tied to each Run reference.                              |
| disabled    | User account or membership disabled by governance action. | No.                                                             | No current learner projection; historical audit remains preserved.                     |

Recommended lifecycle invariants:

- Membership state changes must be tenant-scoped.
- A user may belong to multiple Teams only if the Teams are in different Course
  or explicit Course policy permits multiple membership.
- Within one active Run, a user should have at most one effective Team for
  submission eligibility.
- Membership changes must be audit-relevant.
- Later membership changes must not rewrite submitted decisions, official
  results, audit records, or replay references.

UNRESOLVED_FOLLOW_UP:

- Whether multiple Team membership in one Course is allowed for observers,
  teaching assistants, or makeup teams.
- Exact effective-time model for member changes.

FUTURE_EVIDENCE_REQUIREMENT:

- Future implementation must test active, suspended, exited, removed, and
  transferred eligibility separately.

### 5.3 Role and Assignment Context

PROPOSED_DOMAIN_DESIGN_DETAIL:

- Platform roles and Team-scoped roles are separate concepts.
- Platform roles determine broad application permissions such as teacher,
  tenant admin, platform admin, learner, service actor, or equivalent.
- Team-scoped roles determine a user's role inside a Team, such as CEO, CFO, CMO,
  COO, or future extensions.
- Team-scoped role assignment must be tenant-scoped and Team-scoped.
- Team-scoped role changes should affect future editable surfaces only after
  their effective boundary.
- Role changes must not silently reinterpret historical official decisions.
- `ROLE_PERMISSION_MATRIX` should remain a platform permission matrix; it must
  not be overloaded as the full TeamMember lifecycle model.
- Current `role_slot` is a source fact and a useful seed for future role
  contracts, but it is not yet a complete durable Team role assignment policy.

UNRESOLVED_FOLLOW_UP:

- P2-002 should define role context and role assignment contracts before UI,
  API, or storage implementation begins.
- P2-002 should decide whether role assignment is per Course, per Team, per Run,
  or layered.

FUTURE_EVIDENCE_REQUIREMENT:

- Future contracts must distinguish platform role permission checks from
  Team-scoped role eligibility checks.

### 5.4 Submission Eligibility

ACCEPTED_PRINCIPLE:

Decision submission eligibility should require all of these invariants:

1. Actor is authenticated.
2. Actor belongs to the request tenant or is an explicitly allowed platform
   actor.
3. Actor has platform permission to submit decisions.
4. Actor has an active TeamMember eligibility reference for the target Team at
   the relevant Run/Round boundary.
5. Target Team belongs to the target Run's tenant and Course context.
6. Target Round accepts submissions.
7. Target Team is the actor's eligible Team for that Run/Round.

Recommended relationship to current source:

- Current `actor.team_id` guard is a compatibility shortcut.
- Future formal eligibility should derive from TeamMember / Run membership
  reference, not from a mutable user-level `team_id` alone.
- Current `TEAM-403-001` wrong-team rejection is consistent with the proposed
  future rule, but future implementation must define the TeamMember evidence
  behind that rejection.

Role and lifecycle effects:

- Active members may submit when the Round is open and Team / Run eligibility
  permits.
- Invited, suspended, exited, removed, transferred-away, or disabled members may
  not submit for the old Team in future rounds.
- A member transferred during an active Run should not gain authority to rewrite
  prior Team submissions.
- A member removed during an active Run should not erase historical
  contribution, audit, or result interpretation.

UNRESOLVED_FOLLOW_UP:

- Whether teacher/admin override can submit on behalf of a Team must be a
  distinct future decision, not implied by this proposal.
- Whether CEO-only final submit is required belongs to the role-decision
  workflow line, not this authority annex.

FUTURE_EVIDENCE_REQUIREMENT:

- Future implementation must test wrong-team, old-team-after-transfer,
  suspended-member, exited-member, and removed-member submission rejection.

### 5.5 Historical Run Interpretation

ACCEPTED_PRINCIPLE:

Historical Runs should use an immutable Run membership reference for formal
interpretation.

Recommended policy:

- At Run start, or at the first eligibility boundary before formal submission,
  the system should establish a Run membership reference.
- The reference should preserve the Team roster and Team-scoped role context
  relevant to that Run.
- Later TeamMember changes may affect future authorization, but must not rewrite
  the historical roster used to interpret already-started or completed Runs.
- Submitted decisions remain associated with the Team, Run, Round, actor, and
  historical membership reference available at submission time.
- Official results, audit, and replay should cite stable Team / Run references
  rather than live mutable TeamMember state.
- Run completion freezes the historical interpretation for results, audit, and
  replay.

Minimum invariants:

- A later member transfer must not move old official decisions to a new Team.
- A later member removal must not erase old audit evidence.
- A later role change must not recalculate official settlement or replay hash.
- Historical result visibility must be explainable from either the current
  actor authority plus historical Run membership reference, or a future accepted
  teacher/admin policy.

UNRESOLVED_FOLLOW_UP:

- Whether the Run membership reference is captured at Run creation, Run start,
  Round open, or first Team submission.
- Whether a Run membership reference allows teacher-approved mid-Run
  replacement and how that replacement is displayed historically.

FUTURE_EVIDENCE_REQUIREMENT:

- Future implementation must test that post-Run TeamMember changes do not
  rewrite historical results, audit, or replay interpretation.

### 5.6 Result Visibility

ACCEPTED_PRINCIPLE:

Result visibility should follow these principles:

- Tenant scope is mandatory for every result view.
- Learners see an own-team projection, not the full truth view.
- Teacher, tenant admin, and platform admin may see broader same-tenant views
  according to accepted platform permissions.
- `state_true` should remain hidden from learner own-team projection unless a
  future teaching product decision explicitly changes that surface.
- Learner result visibility for historical Runs should use the Run membership
  reference, not only live Team membership.
- A transferred or removed member may keep access to historical learning
  evidence only if a future accepted policy permits it.

CURRENT_SOURCE_FACT:

- Current learner result projection filters by `actor.team_id` and omits
  `state_true`.
- Current teacher result projection can include `state_true`.

UNRESOLVED_FOLLOW_UP:

- Whether exited or removed learners retain historical learning report access.
- Whether teacher/admin can grant or revoke historical report visibility.

FUTURE_EVIDENCE_REQUIREMENT:

- Future tests must cover learner own-team, other-team, transferred-member, and
  removed-member result visibility.

### 5.7 Transition and Compatibility

ACCEPTED_PRINCIPLE:

- JSON remains the current active runtime until a later explicit runtime
  decision.
- JSON data may continue as fixture, seed, demo, import/export, or controlled
  compatibility data.
- Future durable authority transition must avoid unmanaged dual writes.
- During transition, each command path must have a documented authoritative
  source.
- Import/export compatibility should preserve historical Run membership
  interpretation, not convert old Runs to live membership interpretation.
- This annex does not define transition sequence, migration execution, runtime
  provider activation, or database operations.

UNRESOLVED_FOLLOW_UP:

- JSON compatibility and exit strategy remain a separate design decision.
- ParameterSet and ScenarioPackage domain details remain separate OMD items.

## 6. Decision Options

### Option A: Run-start membership snapshot as formal historical reference

Summary:

- Capture the formal Team roster and Team-scoped role context at Run start.
- Use that reference for historical Run interpretation, replay, audit, and
  results.
- Current authorization for future actions may still read live membership, but
  official history uses the Run-start reference.

Evaluation:

| Dimension                          | Assessment                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| Tenant isolation                   | Strong if snapshot is tenant-scoped.                                                  |
| Submission eligibility             | Clear at Run start; less flexible for mid-Run joins.                                  |
| Auditability                       | Strong; historical roster is stable.                                                  |
| Replay consistency                 | Strong; replay does not depend on later membership edits.                             |
| Result visibility                  | Clear for participants at Run start; needs policy for replacements.                   |
| Current JSON compatibility         | Compatible as a future reference layer; current JSON does not yet capture it.         |
| Future PostgreSQL compatibility    | Strong target durable authority fit.                                                  |
| Implementation and governance risk | Moderate; requires snapshot capture timing and exceptions.                            |
| Rejected / deferred reasons        | Not rejected; may be too rigid for live course operations without replacement policy. |

### Option B: Live membership interpretation for active and historical Run

Summary:

- Always interpret submission eligibility and historical visibility from current
  live TeamMember state.

Evaluation:

| Dimension                          | Assessment                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Tenant isolation                   | Can be enforced, but live changes increase accidental exposure risk.       |
| Submission eligibility             | Simple for current actions.                                                |
| Auditability                       | Weak; old events can be reinterpreted by later edits.                      |
| Replay consistency                 | Weak; replay context changes when membership changes.                      |
| Result visibility                  | Risky; transfers/removals can expose or hide old results unexpectedly.     |
| Current JSON compatibility         | Closest to current `actor.team_id` shortcut.                               |
| Future PostgreSQL compatibility    | Poor for governance history unless versioning is added later.              |
| Implementation and governance risk | High; likely creates historical ambiguity.                                 |
| Rejected / deferred reasons        | Rejected as final policy because it can rewrite historical interpretation. |

### Option C: Hybrid model: live membership for current authorization plus immutable Run membership reference for historical interpretation

Summary:

- Use live TeamMember state for current access checks before the Run/Round
  eligibility boundary.
- Establish an immutable Run membership reference for formal historical
  interpretation.
- Use the Run membership reference for submitted decisions, official results,
  audit explanation, and replay context.

Evaluation:

| Dimension                          | Assessment                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| Tenant isolation                   | Strong when both live membership and Run reference are tenant-scoped.                               |
| Submission eligibility             | Flexible for current operations while preserving Run-specific history.                              |
| Auditability                       | Strong; official history does not drift after membership changes.                                   |
| Replay consistency                 | Strong; replay can cite the Run membership reference.                                               |
| Result visibility                  | Supports current policy and historical policy separately.                                           |
| Current JSON compatibility         | Compatible with current `actor.team_id` as temporary active-route shortcut.                         |
| Future PostgreSQL compatibility    | Strong; maps to target durable governance authority without requiring immediate runtime activation. |
| Implementation and governance risk | Moderate; requires precise contract and evidence tests, but avoids Option B ambiguity.              |
| Rejected / deferred reasons        | Recommended, not accepted. Exact capture timing remains deferred.                                   |

## 7. Accepted Option

ACCEPTED_PRINCIPLE:

Option C is accepted with deferred details:

```text
live membership for current authorization +
immutable Run membership reference for historical interpretation
```

Rationale:

- It respects current JSON active runtime while allowing a durable future model.
- It preserves wrong-team rejection and tenant guard principles.
- It avoids live membership rewriting historical Run meaning.
- It supports replay and audit consistency.
- It keeps implementation details deferred until human acceptance and a later
  task card.

Status is ACCEPTED_WITH_DEFERRED_DETAILS. Implementation work still requires a
separate exact task card and must respect all deferred items and non-goals.

## 8. Explicit Non-Goals

This annex does not decide, design, or implement:

- PostgreSQL schema;
- storage tables, indexes, or foreign keys;
- SQL;
- migration ownership or migration execution;
- runtime provider selection;
- database transaction, row lock, or uniqueness behavior;
- cross-process membership consistency;
- API request or response implementation;
- OpenAPI changes;
- shared contract implementation;
- frontend role configuration or UI;
- P2-002 code or contract implementation;
- #111, #114, or #115 closeout;
- complete RBAC system;
- complete organization, Course, or Cohort product model;
- actual Team / TeamMember data migration;
- teacher/admin override implementation;
- CEO final-submit product workflow;
- settlement math or replay hash changes.

## 9. UNRESOLVED_FOLLOW_UP

- Human decision on whether Option C is accepted, rejected, or accepted with
  deferred details.
- Exact Run membership reference capture timing.
- Course / Cohort relationship, if Cohort becomes a product object.
- Whether active Run allows teacher-approved member replacement.
- Historical result visibility for exited, removed, suspended, or transferred
  learners.
- Team-scoped role assignment contract for P2-002.
- JSON transition and import/export compatibility rules.

## 10. FUTURE_EVIDENCE_REQUIREMENT

Before implementation can claim this policy is enforced, later tasks must add
evidence for:

- tenant-scoped Team lookup;
- TeamMember lifecycle state transitions;
- platform role versus Team-scoped role separation;
- active, suspended, exited, removed, transferred, and disabled submission
  eligibility;
- wrong-team submit rejection backed by TeamMember evidence;
- historical Run membership reference immutability;
- learner own-team and other-team result visibility;
- teacher/admin same-tenant result visibility;
- historical result visibility after membership changes;
- audit references for TeamMember changes and Run membership reference;
- replay consistency after post-Run membership edits.

## 11. Stop Condition

Do not implement Team / TeamMember storage, routes, contracts, UI, migrations,
runtime provider activation, or data transition work from this proposed annex
alone. Stop for human decision before any implementation task depends on this
policy.
