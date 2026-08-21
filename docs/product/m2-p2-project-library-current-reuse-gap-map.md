# M2-P2 Project Library / Assignment — P0 Reuse and Gap Map

Date: 2026-08-21

This note records how the P0 reference set was applied to the M2-P2 implementation. The attached design and engineering documents are reference constraints; the execution target remains the M2P2 V5.11 prompt and its explicit negative boundaries.

## P0 decisions carried into the implementation

| P0 boundary                                           | Implementation consequence                                                                                                                                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One Kernel / One Truth / One Settlement Authority     | `ProjectProfile` and `ProjectAssignment` are orchestration and provenance records. They do not calculate settlement, score, rank, replay truth, or official outcomes.                                                       |
| Profile / Provenance is not Runtime Authority         | Every profile has a digest and provenance, but runtime behavior continues to come from the exact Course/Run configuration and existing W4 state authority. No `latest` or implicit fallback reference is accepted.          |
| Course → Project → Team → Role Seat                   | Assignment is scoped to exact tenant, Course, Run, Team and profile reference. Student receives only the assigned team projection.                                                                                          |
| Teacher is Course/Scenario Director, not Truth Editor | Teacher routes call the Project Library service and existing Course/MarketWorld authorities. They do not write W4 state directly.                                                                                           |
| W4 is Business State / Strategic Policy               | A successful Assignment command may orchestrate the existing W4 `createInitialState` writer for a missing opening state using only normalized safe profile values. The Project Library service itself has no W4 dependency. |
| History non-overwrite                                 | Lifecycle transitions are append-only snapshots. Successors point to an immutable source reference; existing assignments continue to resolve the historical digest.                                                         |
| Role-safe closed DTOs                                 | Student brief and Admin audit projections omit raw source paths, restricted source data, private coefficients, truth state, scores, ranks, settlement result and other-team data.                                           |
| Shanghai as thin vertical                             | The current Shanghai MarketWorld is an exact product reference used for the safe fixture. No Shanghai-only runtime fork or independent kernel was introduced.                                                               |
| P0 before P1/P2                                       | The implementation stays in the configuration/assignment seam. No raw data ingestion, model activation, Postgres/RLS, Human Validation, Pilot, Production, W6 or automatic successor was added.                             |

## Reuse map

| Capability                      | Reused current source                                                                 | M2-P2 extension                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Exact MarketWorld reference     | `services/api/src/market-world-product.ts`, `market-world-binding-service.ts`         | Profile input is checked against the existing exact Shanghai product reference.                            |
| Tenant/Course/Run/Team storage  | `services/api/src/store.ts`, repository provider/facade                               | Two append-only arrays are added to the existing snapshot; no second store or repository authority.        |
| Versioned closed-object pattern | Course Package command/registry and existing shared exact-reference types             | Project Profile identity, SHA-256 content digest, lifecycle, clone/import/successor and closed safe input. |
| Enterprise opening state        | `services/api/src/w4-enterprise-state.ts`                                             | Assignment route calls the existing W4 service; no duplicate writer.                                       |
| Role-safe BFF                   | Existing Teacher MarketWorld, Student role workspace and Admin audit routes           | Project Library Teacher commands/list, Student project brief, Admin tenant audit.                          |
| Product UI                      | Existing panel tokens and role shells in `apps/teacher`, `apps/student`, `apps/admin` | Three small role-specific panels; no new shell or design system.                                           |
| Quality                         | Vitest, contract validation, npm build, Playwright real-BFF fixture                   | Project Library unit/integration/contract tests and dedicated M2-P2 browser lane.                          |

## Explicit tool and evidence limits

- CodeGraph: unavailable with current Product worktree (`.codegraph/` is absent); an earlier shared-workspace result was stale historical output and was not used for implementation decisions.
- Graphify: unavailable because the expected `graphify-out/graph.json` is absent; no graph result is represented as a pass.
- Figma: authenticated identity was available, but no Figma file/node URL was supplied or found in current repository references; current UI reuse is based on source-level components and tokens.
- Current web competitor search: connection failed twice; no fresh web claim is made. Competitor adaptations are taken only from the supplied historical research reference and existing repository patterns.
- Historical P0 documents are not current repository truth. Git, current source, local tests and live endpoint behavior remain the implementation evidence.

## Non-collision statement

The shared protected worktree and the merged M2-P1 worktree were not modified. Product implementation is isolated in `codex/m2-p2-project-library-assignment-20260821`; only the files listed by the Product diff are in scope.
