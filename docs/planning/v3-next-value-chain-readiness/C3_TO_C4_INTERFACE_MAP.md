# C3 To C4 Interface Map

**Package:** `V3_NEXT_VALUE_CHAIN_READINESS_PACK`
**Assessment source anchor:** `8e96e88955c2d5543eeadf83643f2e2e10dd4be4`
**Status:** `PROPOSED_NOT_ACQUIRED_READ_ONLY`

`RoleWorkflowCommandService` in `services/api/src/role-workflow.ts` and the
Teacher/Student DTOs in `packages/shared-contracts/src/role-workflow.ts` are
the current C3 facts. C3 proves a governed path from role assignment to a
canonical Decision; it does not provide briefing, discussion, debrief, FAQ,
export, or instructor-asset authority.

| C3 input | C4 read-only use | C4 forbidden use |
| --- | --- | --- |
| Role definitions and assignments | Version-bound briefing context | Alter assignment/state |
| `RoleWorkflowEvent[]` | Discussion/debrief provenance | Formal grading/truth write |
| Teacher summaries | Teacher-only progress prompts | Student private payload disclosure |
| Student safe workspace | Student-safe reflection context | Cross-role/team context access |
| Canonical Decision status | Debrief readiness indicator | Replace confirmation/lock |

Any C4 slice must consume a version-bound projection, never a repository port
or C3 writer. Entry evidence requires Teacher-only access, Student-safe
projection, historical read-only behavior, and a negative test that the kit
cannot write RoleWorkflow, Decision, SettlementResult, Score, Rank, or Replay.

This map does not authorize C4 code, instructor content, grades, exports, or a
new runtime authority.
