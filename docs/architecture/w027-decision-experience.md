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

- `W027PrivateJudgment` is role-private process evidence and is returned only
  to its author in the Student projection. Teacher projections expose metadata
  only, not private statement text.
- `W027RolePosition` is a team-safe projection. It contains bounded summary,
  assumptions, evidence references, risk flags, and tradeoffs; it does not
  expose actor identity to other Students.
- `W027DivergenceSet` v2 compares value, assumption, evidence, risk, and
  tradeoff dimensions from ready team-safe positions.
- `W027ResolutionV2` records selected position references and preserved dissent;
  it does not rewrite canonical decision or settlement state.
- `W027DecisionTraceV2` records the visible process stages and known limits.

The current runtime is JSON-backed. Durable recovery, cross-process locking,
Human Validation, Pilot, Production, PostgreSQL application authority, and RLS
remain outside W027.
