# R2 Candidate Port Map — SH-M3 W5 Operating World R3

Status: `CANDIDATE_EVIDENCE_ONLY`

This receipt maps the R2 Operating World candidate into the existing R3 path. It is evidence for local implementation review, not an activation, production, Provider, or remote-delivery authorization.

## Exact baseline

- R2 candidate commit: `5e378cb6707ba033e5d9e0552b3a2c53287f6dc2`
- R3 candidate branch: `codex/simwar-shm3-w5-operating-world-r3-20260823`
- R3 source baseline: the current branch head shown in `LOCAL_VALIDATION_RECEIPT.md`; historical checkout/index claims are not treated as current truth.
- Raw Shanghai data: not copied into this repository.

## Port classifications

| R2 surface                                                                       | Classification                  | R3 disposition                                                                                                                   | Authority boundary                                                                |
| -------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `OperatingWorldService` draft lifecycle                                          | `PORT_AS_IS`                    | Keep `DRAFT → VALIDATED → FROZEN → BOUND` in the existing service/store.                                                         | Single Operating World lifecycle; no parallel registry.                           |
| Existing W4 capital-action consumer bridge                                       | `PORT_PATCH`                    | Carry the exact `operating-world:<digest>` source into the existing W4 replay manifest only when the current action is admitted. | W4 remains the official EnterpriseState/replay authority.                         |
| `operating_world_binding_digest` in `W4ReplayInputManifest`                      | `NESTED_VALUE_OBJECT`           | Add one optional digest property to the existing manifest value object.                                                          | It is an exact binding fact, not a new state or writer.                           |
| `OperatingWorldConsequenceTrace`                                                 | `PROJECTION_ONLY`               | Derive the bounded trace after official W4 evidence is present; project teacher/student views from the same trace.               | Cannot write `SettlementResult`, replay truth, score, rank, or publication truth. |
| Duplicate W5/W4/settlement lifecycle or store                                    | `DROP_DUPLICATE`                | No new store, settlement engine, replay registry, publication writer, or W5 state machine.                                       | Existing JSON runtime and current services remain authoritative.                  |
| Raw source paths, private coefficients, hidden shock timing, and other-team data | `DROP_DUPLICATE`                | Excluded from role-safe trace projections.                                                                                       | Student projection is fail-closed and bounded.                                    |
| Real Shanghai local data ingestion                                               | `NOT_PROVEN`                    | No local data is imported or asserted as repository evidence in this candidate.                                                  | Requires a separately bounded source/evidence task.                               |
| Remote push, Product PR, required-check readback, merge, and post-merge proof    | `NOT_PROVEN` / `NOT_AUTHORIZED` | Local-only candidate worktree and commit.                                                                                        | Requires the current Owner Envelope; absent in this turn.                         |

## Allowed carry-forward

The R2 candidate contributes its exact binding identity, lifecycle guards, role-safe projections, and existing W5 governed-model surface. R3 only joins those facts to the existing W4 action/manifest/outcome path and W3 learning projection. It does not create a second truth path.
