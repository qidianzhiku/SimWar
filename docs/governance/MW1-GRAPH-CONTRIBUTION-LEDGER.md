# SimWar MW1 | Graph Contribution Ledger

Document ID: MW1-GRAPH-CONTRIBUTION-LEDGER
Version: 1.0
Date: 2026-08-16
Status: GOVERNANCE EVIDENCE RECEIPT
Source SHA: `a6eaa93afe6ce8f37d8dbedcead592998745dbcb`
Repository Mutation: Docs-only record
automatic_next_start: false

## External Indexes

| Index                | Location                                                                  | Readback                                                                         |
| -------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Graphify post-merge  | External evidence root `graph/graphify-postmerge/graphify-out/graph.json` | 12,570 nodes; 22,974 raw edges; no clustering.                                   |
| CodeGraph post-merge | External evidence root `graph/codegraph-postmerge-source/.codegraph`      | 526 files; 8,395 nodes; 26,910 edges; pending changes 0; worktree mismatch null. |

Both indexes are outside the Product repository. CodeGraph retains `reindexRecommended=true` because the archive lacks extraction metadata. Graph output is a navigation aid and impact-discovery artifact only.

## Material Contributions

| ID  | Graph result                                                                         | Source confirmation                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Canonical resolver reaches lock, settlement, replay, and tests.                      | `services/api/src/canonical-decision-admission.ts:194-277`; `services/api/src/server.ts:951-1035,3150-3185,7599-7657`; `tests/integration/px1-ca-01-canonical-admission-safety.test.ts`. |
| G2  | `confirmTeamDecision` reaches the role-workflow commit path.                         | `services/api/src/role-workflow.ts:474-549`; `services/api/src/repository-ports.ts:349`; `services/api/src/server.ts:6012`.                                                              |
| G3  | Post-merge CodeGraph impact lists 9 affected symbols for canonical resolver changes. | Source readback confirms lock, replay, settlement, route, and test edges.                                                                                                                |
| G4  | Graphify dangling/collision and skipped-language diagnostics exist.                  | Classified as tool limitations; source/test fallback closed the relevant paths.                                                                                                          |
| G5  | CodeGraph type-coverage omission for `DecisionAdmissionPolicy`.                      | Classified false positive after reading `packages/shared-contracts/src/formal-run-runtime-binding.ts:19-34` and policy integration tests.                                                |

## Negative Space

The graph does not prove absence of hidden writers, hidden formal replay callers, or all tenant bypasses. Those assertions were verified with bounded `rg`, source readback, unit/integration tests, direct-store boundary check, and protected CI. No graph-only claim is promoted to repository truth.
