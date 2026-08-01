# D1 Role Activity Provenance Map

**Status:** `PROPOSED_NOT_ACQUIRED_READ_ONLY`

| Reference | Source | D1 interpretation | Privacy rule |
| --- | --- | --- | --- |
| Assignment identity | Role workflow snapshot | Participation context | Tenant/course/team scope |
| Role history | `RoleWorkflowEvent[]` | Activity reference only | No private payload |
| Section readiness | Teacher summary/student workspace | Completion, not quality | Student sees own role |
| Merge candidate | Student-safe merge DTO | Team-state reference | No other-role private data |
| Team confirmation | Existing Decision chain | Activity boundary | Not a grade |

Each provenance reference must retain course, run, round, team, role, actor
scope, event type, time, and available version identity. It must not copy an
arbitrary draft into a learning ledger. Teacher Confirmation is a future
separate writer, not a C3 capability.

Future tests: scope denial, Student private-field denial, idempotent ingestion
without official Decision/settlement mutation, historical non-overwrite, and
confirmation unable to alter a formal grade or Rank.

This is not evidence-capture implementation, a rubric, reflection, AoL export,
or a learning-grade declaration.
