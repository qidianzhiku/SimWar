# W027 Decision Experience

W027 extends the existing role workflow with configurable decision-experience
evidence. It remains process evidence only: it cannot write canonical
Decision, SettlementResult, Score, Rank, Truth, or Replay authority.

## Corrected Role Topology

The formal configured roster has five roles:

`CEO`, `CFO`, `CMO`, `COO`, `CHRO`

`Quality & Risk` is not a formal sixth assignment. Its permissions and
operations are part of `COO`, including `quality_control` and `risk_register`.
The compatibility inputs `risk` and `Quality & Risk` normalize to `COO` at the
W027 boundary. They are never emitted as a standalone configured role.

## Evidence Boundaries

- `W027RoleRoster.decision_right_policies` is the server-resolved, auditable
  policy matrix for the exact tenant/course/run/team scope. It can assign
  resolution, merge, acknowledgement, and confirmation rights without
  creating a second canonical writer. When no roster override exists, the
  safe W027 defaults are used.
- `W027PrivateJudgment` is role-private process evidence and is returned only
  to its author in the Student projection. Teacher projections expose metadata
  only, not private statement text.
- A private judgment records the problem frame, assumptions, options,
  trade-offs, prediction, confidence, rationale, evidence references, and
  lifecycle status. Missing optional legacy inputs are normalized to bounded
  process evidence by the service.
- `W027RolePosition` is a deterministic, read-only team-safe projection of
  ready RoleWorkflow contribution plus bounded private-judgment metadata. It
  contains safe summary/category digests only; it does not expose actor
  identity, raw private reasoning, or a separate W027 position writer.
- `W027DivergenceSet` v2 compares value, assumption, evidence, risk, and
  tradeoff dimensions from ready team-safe positions.
- `W027ResolutionV2` records an observed candidate selection or an explicitly
  authorized team compromise, including the selected option, rationale,
  supporting evidence, trade-off, risk, affected divergence IDs, and the
  server-resolved authority role. Explicit compromise is fail-closed unless
  the configured policy includes the `explicit_team_compromise` capability.
  It does not rewrite canonical decision or settlement state.
- `W027DecisionTraceV2` records the visible process stages and known limits,
  including the existing RoleWorkflow merge, confirmation, and canonical
  Decision milestones.

## Existing Authority Reuse

- W027 `merge` and `confirm` BFF commands delegate to the existing
  `RoleWorkflowCommandService`; W027 does not add a second merge or canonical
  Decision writer.
- Configured W027 policy may grant merge, resolution, or confirmation rights
  to a non-default role for the exact scope. Without an explicit W027 policy,
  the legacy captain/CEO restrictions remain in force.
- `role-position` is a compatibility read endpoint only. It never appends a
  W027 role-position record; the projection is derived from ready role
  contributions and ready private-judgment categories.

The current runtime is JSON-backed. Durable recovery, cross-process locking,
Human Validation, Pilot, Production, PostgreSQL application authority, and RLS
remain outside W027.
