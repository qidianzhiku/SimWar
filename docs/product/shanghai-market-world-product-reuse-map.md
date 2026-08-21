# Shanghai Market World Product REUSE_MAP

Mission: `SIMWAR-SH-M2-P1-MARKET-WORLD-PRODUCT-JOIN-20260820`

Fresh source: `origin/master=6608ff44c99eb185444150b54512653453f29655`.

| Required object                                  | Decision           | Current owner / target                                                     | Boundary                                                                                                    |
| ------------------------------------------------ | ------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Teacher course/scenario workspace                | `REUSE_AS_IS`      | `apps/teacher/src/App.tsx`, `TeacherCourseWorkspace`                       | Add one bounded market-world panel in the existing readiness/course surface.                                |
| Course configuration writer                      | `EXTEND`           | `RepositoryFacade.courses.saveCourse`                                      | Add optional `Course.market_world_reference`; no second course writer.                                      |
| Scenario/Course exact-reference semantics        | `EXTEND`           | `packages/shared-contracts/src/market-world.ts` and course projection      | Exact id/version/digest; no `latest`; tenant comes from the scoped Course.                                  |
| Teacher BFF                                      | `EXTEND`           | `services/api/src/server.ts`                                               | Add scoped read/bind routes that call the existing Course repository port and audit writer.                 |
| Teacher readiness/limits pattern                 | `REUSE_AS_IS`      | `apps/teacher/src/scenario-readiness.ts`, `StatePanel`, `KnownLimitBanner` | Reuse loading, stale, conflict, recovery, and known-limit language.                                         |
| Student P2-A role mission / private judgment     | `REUSE_AS_IS`      | `StudentRoleWorkflowPanel`, `/bff/student/role-workspace`                  | Add a role-safe brief to the existing workspace response; no new decision path.                             |
| Student BFF projection                           | `EXTEND`           | `StudentRoleWorkflowWorkspaceDTO`                                          | Add visible brief only after published/active Course visibility; pre-visibility returns no brief content.   |
| Admin readiness pattern                          | `REUSE_AS_IS`      | `admin-bff.ts`, `AdminDeliveryTrustWorkspace`                              | Add one read-only list of tenant-scoped binding projections.                                                |
| Admin BFF                                        | `EXTEND`           | `services/api/src/server.ts`                                               | Add bounded tenant-scoped audit projection; never return safe asset internals beyond source-class metadata. |
| Existing Design System                           | `REUSE_AS_IS`      | `@simwar/ui` panels/badges/receipts                                        | No new visual system or Shanghai app.                                                                       |
| Product-safe M2 asset                            | `NEW_MINIMAL`      | `services/api/src/market-world-product.ts`                                 | Materialize only a de-identified projection derived from M2 role-safe content; no raw source paths/rows.    |
| Market World registry/writer                     | `REJECT_DUPLICATE` | Existing Course repository remains sole writer                             | The immutable product asset is a read-only module, not a second registry or lifecycle authority.            |
| Scenario Factory / ParameterSet / model provider | `REJECT_DUPLICATE` | Not in this PR                                                             | No M3, model activation, ParameterSet freeze, Scenario publish, provider, or Postgres activation.           |

## Data productization receipt

| Field                   | Value                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source asset            | M2 `23-role-safe-market-world-content.json`, with gate/readiness metadata from `26-m2-gate-receipt.json` and `27-integration-manifest.json`                                                                                                                         |
| Source digest           | `23-role-safe-market-world-content.json=01797e5ddcb4f8798d309c6f495006a5a11bbbdfaa111ec21228a2750597af0f`; the authoritative pack manifest self-digest is `D4DF9955198A9B3F271694F7045F181E0DC78CBE131152F814460B68F5A5510A`                                        |
| Product-safe projection | `MARKET_WORLD_PRODUCT_PROJECTION` with district counts, bounded synthetic cohort/service/outside-option summaries, archetype lifecycle, freshness, confidence, uncertainty, and known limits                                                                        |
| Repository target       | `services/api/src/market-world-product.ts`                                                                                                                                                                                                                          |
| Visibility              | Teacher full readiness; Student role-safe brief after Course visibility; Admin bounded audit; no raw restricted source data                                                                                                                                         |
| Known limits            | No Shanghai occupancy/pricing/customer sample; travel/medical values remain unbound; source-date completeness for image tables is limited; `INSURANCE_CAPITAL` and `AI_NATIVE_OPERATOR` remain draft/non-bindable; product context does not affect settlement truth |

The raw M1/M2 source roots and the external evidence pack remain outside the repository. `RAW_PROJECT_DATA_REPO_COPY=0` is a release check, not a claim that the product asset is raw.
