# R8-G1 L1 Internal Validation Rehearsal Gate Draft

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

PostgreSQL runtime:
NOT_AUTHORIZED

Durable Settlement:
NOT_PROVEN
```

```text
INTERNAL_ONLY_DRAFT
NOT_RELEASED
NOT_REAL_TEACHER_REHEARSAL
NOT_PILOT
NOT_PRODUCTION
```

This draft is the operator-facing companion for Program 030. It may be used only
to prepare independent evidence review of the L1 internal validation rehearsal
gate. It is not a classroom runbook for real users and does not authorize Pilot
or Production activity.

## Rehearsal Preparation Checklist

1. Confirm PR #213 is merged and current `master` contains the merge commit used
   by Program 030.
2. Confirm Program 030 branch starts from that post-merge `master`.
3. Confirm the changed-file scope remains limited to the rehearsal gate test,
   evidence documentation, R8-G1 draft, G0-G7 ledger and R4 Discovery update.
4. Confirm the harness uses real HTTP API routes and not helper-only mutation,
   direct store writes, fake settlement or fake replay reports.
5. Confirm Student-visible evidence omits `state_true`, other-team data,
   other-tenant data, private replay markers and `canonical_evidence_digest`.
6. Confirm Teacher-visible evidence includes replay evidence only after the
   result is published.
7. Confirm Tenant Admin evidence is tenant scoped.
8. Confirm Platform Admin evidence requires explicit tenant scope.
9. Confirm duplicate decision, lock, settlement and publish requests are stable
   and do not create duplicate audit side effects.
10. Confirm all Go / No-Go rows preserve:
    - `INTERNAL_ONLY_DRAFT`
    - `NOT_RELEASED`
    - `NOT_REAL_TEACHER_REHEARSAL`
    - `NOT_PILOT`
    - `NOT_PRODUCTION`
    - `POSTGRESQL_NOT_AUTHORIZED`
    - `DURABLE_SETTLEMENT_NOT_PROVEN`
    - `G0_EXCEPTION`
    - `L1_NOT_READY`

## Synthetic Session Runbook Draft

The Program 030 synthetic session is allowed to use only the current JSON
runtime test server and synthetic identities. It must execute:

1. Teacher login.
2. Tenant Admin login.
3. Student Alpha login.
4. Platform Admin login.
5. Synthetic Student Beta creation by Tenant Admin.
6. Teacher course draft creation.
7. Teacher two-team setup.
8. Denied Student team bind.
9. Course publish and duplicate publish check.
10. Run creation.
11. Round start.
12. Denied Student lock.
13. Denied truth-field decision payload.
14. Denied cross-team decision payload.
15. Student Alpha and Student Beta decision submit.
16. Duplicate decision submit idempotency.
17. Teacher round lock and duplicate lock idempotency.
18. Internal service-kernel settlement and duplicate settlement idempotency.
19. Teacher publish and duplicate publish idempotency.
20. Student redacted result read.
21. Teacher evidence read.
22. Tenant Admin scoped status read.
23. Platform Admin explicit tenant audit read.
24. Cross-tenant denial.
25. Gate matrix creation and non-proof preservation.

## Data Reset and Abort Draft

The rehearsal uses a fresh in-memory JSON store created by the test server. Abort
the rehearsal immediately if any of the following occurs:

- Student-visible result includes protected truth or other-team data.
- Cross-tenant read succeeds.
- Truth-field denial leaks private payload detail.
- Duplicate settlement changes the replay hash or official settlement id.
- Audit actions indicate duplicate side effects for idempotent calls.
- The run requires PostgreSQL, SQL, migration, real tenant data, Pilot or
  Production configuration.

No cleanup procedure may use a real database, migration, production data, real
payment, real customer account or protected main workspace.

## Replay Evidence Review Checklist

| Question                                                     | Required answer            |
| ------------------------------------------------------------ | -------------------------- |
| Did Teacher-visible replay evidence exist?                   | yes, after result publish  |
| Did Student-visible result include replay evidence?          | no                         |
| Did replay write a formal result?                            | no                         |
| Did duplicate settlement overwrite official result identity? | no                         |
| Is a dedicated shadow replay HTTP route proven?              | no, recorded as limitation |
| Does this prove durable recovery?                            | no                         |

## Issue Escalation Procedure

Escalate to Owner before any merge or release decision if:

- required checks fail or stay unavailable;
- source integrity, hidden Unicode or Bidi scan fails;
- Student projection, tenant scope, team scope or service-kernel authorization
  regresses;
- replay or repeated settlement overwrites official result;
- a security scan is required by a runtime implementation diff;
- any evidence is being used to claim `G0 PASS`, `L1 READY`, Pilot,
  Production, PostgreSQL runtime or durable settlement.

## Go / No-Go Checklist Draft

```text
GO_FOR_INDEPENDENT_EVIDENCE_REVIEW_ONLY
```

No merge, review, approval, Pilot, Production, PostgreSQL runtime, SQL,
migration, branch protection mutation, ruleset mutation, Issue mutation or
workflow dispatch is authorized by this draft.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
