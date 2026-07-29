# SimWar L1目标模式执行技术规格书 V1.0

**Document ID:** `SIMWAR-L1-TARGET-MODE-TECH-SPEC-V1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Assessment Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Specification Status:** `READY_FOR_REPOSITORY_ADOPTION`<br>
**Normative Technical Contract:** `PASS_WITH_LIMITS`<br>
**Current Runtime Evidence Completeness:** `PARTIAL`<br>
**Repository Mutation:** `NONE`<br>
**Automatic Next Mission:** `FORBIDDEN`

---

## Current-Master Reconciliation Notice

The assessment source SHA and graph statistics in this specification remain historical architecture inputs. Current operational status is revalidated at `98206dff8ed747ad650d4bff82f5497fdfd3590c`: PR #286 merged the evidence assembler; the fresh-clone Phase 7 product path and Known Limits readback both passed; and the immutable closure pack has SHA-256 `8187d20f22a3500775bd2fc02439ef2620a554ebccbac0dc2bfe53b204e17cd9`.

This evidence closes the automated product/evidence route at its assessment source anchor, not the Owner-only final stage. The adoption merge requires one fresh-clone evidence rebase before current state may be `AUTOMATED_EVIDENCE_COMPLETE_OWNER_ACKNOWLEDGMENT_REQUIRED`; Human Validation remains `WAIVED_BY_OWNER_NOT_PERFORMED`. The historical B01–B04 references below are superseded for current Portfolio selection by their current closures: #112, #114, and #115 are closed, while #111 remains an explicit durable-runtime Known Limit.

---

## 1. Document Control

| Field                       | Value                                             |
| --------------------------- | ------------------------------------------------- |
| Version                     | V1.0                                              |
| Generated At                | 2026-07-28T10:55:00Z                              |
| Repository                  | qidianzhiku/SimWar                                |
| Default Branch              | master                                            |
| Assessment Source SHA       | a296f9032cf1d7fc921fa837d57e5c33e3cc4de2          |
| Graphify                    | CONNECTED v0.9.26 · 4,872 nodes · 7,805 edges     |
| CodeGraph                   | CONNECTED v1.2.0 · 3,559 symbols · 14,790 edges   |
| Recommended Repository Path | docs/technical/L1_TARGET_MODE_EXECUTION_SPEC.md   |
| Machine File                | docs/technical/l1-target-mode-execution-spec.yaml |
| Capability Cards            | docs/technical/l1-capabilities/\*.md              |

This specification is a repository-native engineering contract. It translates L1 target state and current graph/source facts into stable module, Authority, runtime path, contract, state-machine, test and Mission Compiler interfaces. It does not schedule the current Portfolio Cycle and does not authorize mutation.

### 1.1 Input Integrity

| Input              | SHA-256                                                          |
| ------------------ | ---------------------------------------------------------------- |
| gap_graph          | a32291be76f36f46488e141ab28f0243f8d9666b67a035dd49332bdb20c25eef |
| route_scorecard    | 944b999505c0c61ff9c9c4fd5078f5ce52c4886536516a37e45e52c5af89e087 |
| graph_manifest     | eccbfad2d5d00723d8246f1395dea460b2ca4d2073f3255f534c162bb0585c57 |
| graph_final_report | 3a963f60af3c3dd897b7de19a12bf76ebaaf0ccc7344ea7e27f4781fd0b54b9c |
| graph_viewer       | 0e9b4218bf0f0c99f61e9cb97053b0240c48754ac992d2c8b5cd4f1c068369b8 |
| dod                | 8e3177862e099e61d2f87efbfac0b5e9a4f62f7fd3e8d8ccaa23b1c3d918f065 |
| authority_matrix   | e53d3c8c9075f0524864c081ab55f6a69805132740e9f61dc2ff130a5378ac0e |
| ledger_md          | a2b257468f7e7f20f69263269b00578a8b3ef293aff9893fd84165f366996ec8 |
| ledger_yaml        | 0e8d75dab1530e35b47e4c07a6432665ba90125652068c63f61c5a382bfa67f0 |

## 2. Executive Technical Decision

At its assessment anchor, the Graphify/CodeGraph source SHA equaled the authenticated current master. Reauthenticate current repository facts before using this specification for a Mission. Authority Writer, Runtime Call, Product Journey and Test Coverage graphs are partial, and four critical L1 unknowns remain. The specification is suitable for repository adoption as a stable execution contract, but it must preserve `UNKNOWN` and `PARTIAL` instead of claiming L1 completion.

The selected provisional mainline remains `CAND-01 / L1-GAP-B01`: prove one default-server, persisted-formal-authority Golden chain from lifecycle creation through Publish and Replay. This is a routing recommendation only. It does not start a Mission.

| Decision                     | Value                             |
| ---------------------------- | --------------------------------- |
| Graph Freshness              | CURRENT_AT_SOURCE_SHA             |
| Cross-Tool Conflict Count    | 0 KNOWN; partial coverage remains |
| Critical Unknown Count       | 4                                 |
| Known Authority Breach Count | 0 in supplied graph manifest      |
| Recommended Mainline         | CAND-01 / L1-GAP-B01              |
| Recommended Support Code     | NONE                              |
| Automatic Start              | FORBIDDEN                         |

## 3. Purpose and Governance Position

| Asset                        | Question Answered                                                               | Change Frequency                         |
| ---------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| L1 Definition of Done        | What must L1 prove?                                                             | Target-state changes only                |
| L1 Value Chain Ledger        | What is currently implemented, evidenced, blocked or unknown?                   | Every material PR/merge/evidence change  |
| Target Mode Authority Matrix | What may Codex execute automatically and what requires T4 review?               | Policy changes                           |
| V3.0 Roadmap                 | Where does SimWar go after L1?                                                  | Long-term strategy changes               |
| This Technical Specification | How is each L1 capability implemented and verified in the current architecture? | Architecture/contract/source-map changes |
| Bounded Parallel Plan        | How are Mainline, support and Closure scheduled now?                            | Every Portfolio Cycle                    |

The specification must be loaded after the DoD, Ledger and Authority Matrix, and before a capability-specific Mission is compiled. It is not a substitute for current source readback or graphs.

## 4. Source and Graph Baseline

| Graph Asset            | Status           | Execution Use                                             |
| ---------------------- | ---------------- | --------------------------------------------------------- |
| Repository Fact Graph  | PASS_WITH_LIMITS | Module inventory, hotspots and dependency map             |
| Authority Writer Graph | PARTIAL          | Writer hypotheses; critical paths require source readback |
| Runtime Call Graph     | PARTIAL          | Candidate call chains and missing edges                   |
| Product Journey Graph  | PARTIAL          | Persona step coverage and gaps                            |
| Test Coverage Graph    | PARTIAL          | Source→test→script→CI traceability                        |
| Gap Graph              | PASS_WITH_LIMITS | Blocker/evidence-gap classification                       |
| Resource Lock Manifest | PASS_WITH_LIMITS | Candidate lock admission                                  |
| Candidate Route Graph  | PASS_WITH_LIMITS | Mainline route ranking                                    |

### 4.1 Freshness Rule

A graph is usable as `CURRENT` only while its `source_sha`, index scope and tracked source set match current master. Any master merge, Authority change, shared-contract change, runtime-provider change or governance-baseline change invalidates affected graph conclusions.

### 4.2 Knowledge Graph Boundary

Graphify and CodeGraph may identify modules, symbols, writers, callers, test relationships and candidate paths. They cannot prove runtime wiring, deterministic behavior, error handling, tenant isolation, browser behavior, CI enforcement, fresh-clone reproducibility or post-merge closure.

## 5. Current Reality

| Item                   | Current Conclusion                                              |
| ---------------------- | --------------------------------------------------------------- |
| Repository / branch    | qidianzhiku/SimWar / master                                     |
| Current master         | a296f9032cf1d7fc921fa837d57e5c33e3cc4de2                        |
| Latest merge           | PR #265 · adopt L1 governance baseline                          |
| Previous product merge | PR #264 · formal Course authority binding                       |
| Open PR count          | 0 at authentication readback                                    |
| Runtime authority      | JSON_INTERNAL_ONLY / active JSON repository provider            |
| Formal lifecycles      | ParameterSet, ScenarioPackage and PluginRelease ingress present |
| Formal Course binding  | Private append-only exact binding present                       |
| Formal Run binding     | Exact binding and runtime-input resolver present                |
| L1 overall             | NOT_ASSESSED                                                    |
| Pilot / Production     | NOT_AUTHORIZED                                                  |

Current issue state remains a signal, not proof that the historical issue body is current. Issues #112, #114 and #115 correspond to the current Gap Graph blockers for course visibility, repository boundary and executable contract parity; each must be revalidated against current source before mutation.

## 6. L1 End-to-End Technical Chain

```text
Authentication → Tenant/Role Scope
→ Formal ParameterSet Lifecycle → Formal PluginRelease Lifecycle
→ Formal ScenarioPackage Lifecycle → Teacher Readiness
→ Formal Course Authority Binding → Exact Formal Run Binding
→ Run/Round Start → Student Decision → Round Lock
→ Truth-L1 → Truth-L2 → SettlementResult/Score/Rank
→ Publish → Teacher Projection → Student Safe Projection
→ Three-Part Feedback / Learning Report → Official Replay Evidence
→ Abort / Reset / Cleanup → L1 Completion Evidence Pack
```

| Node     | Capability                                              | Current State                                             | Sole Writer / Authority                                                           | Locks                                                                                                             | Primary Gap                                                           |
| -------- | ------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| L1-VC-01 | Current Reality与工程基线                               | MERGED_NOT_CLOSED                                         | Repository governance / CI single writer                                          | CI workflow, package/lockfile, heavy validation slot                                                              | current-master post-merge fresh-clone receipt未在本规格生成任务中执行 |
| L1-VC-02 | Identity、RBAC、Tenant、Course与Team隔离                | BLOCKED                                                   | Identity/RBAC policy and API authorization guards                                 | Teacher/Student projection, tenant/course visibility                                                              | L1-GAP-B02 course membership visibility                               |
| L1-VC-03 | Synthetic Course与Run Entry                             | IMPLEMENTED_NOT_VERIFIED                                  | Course binding store for formal course configuration; Run writer for Run creation | Course formal authority binding, Run entry                                                                        | current capability requires integration into B01 full Golden receipt  |
| L1-VC-04 | Formal Authority Lifecycle与Exact Run Binding           | PARTIALLY_IMPLEMENTED                                     | Formal command services and append-only binding stores                            | ParameterSet Authority, ScenarioPackage Authority, PluginRelease Authority, Formal Run Binding, Run/Replay/Golden | L1-GAP-B01 default persisted authority full Golden chain              |
| L1-VC-05 | Run Lifecycle：Create→Open→Decision→Lock→Settle→Publish | IMPLEMENTED_NOT_VERIFIED                                  | Run/Round command path and settlement outcome port                                | Run lifecycle, Settlement, Run/Replay/Golden                                                                      | B01 must prove full default-server chain                              |
| L1-VC-06 | Student Whole-Team Decision Flow                        | PARTIALLY_IMPLEMENTED                                     | Decision command repository port / canonical decision writer                      | Decision lifecycle, Student BFF projection                                                                        | B02 visibility completion impacts safe decision scope                 |
| L1-VC-07 | Truth-L1—L3与L1范围Settlement                           | IMPLEMENTED_NOT_VERIFIED                                  | Simulation Core L1–L3 and atomic SettlementOutcomePersistencePort                 | Simulation Core Truth, Settlement, Score/Rank                                                                     | B01 evidence; Issue #111 remains high-risk current issue              |
| L1-VC-08 | Publish与Teacher/Student/Admin安全Projection            | BLOCKED                                                   | Projection builders are read-only; Settlement remains formal result writer        | Teacher/Student projection, Public contract                                                                       | L1-GAP-B02 course membership visibility                               |
| L1-VC-09 | Three-Part Feedback与Learning Report最小闭环            | IMPLEMENTED_NOT_VERIFIED                                  | Learning evidence writer; read-only consumer of official result                   | Learning Evidence, Student projection                                                                             | current-SHA full product journey proof missing                        |
| L1-VC-10 | Official Replay与Evidence Non-Overwrite                 | IMPLEMENTED_NOT_VERIFIED                                  | Replay evidence/report writer; no writer authority over official SettlementResult | Run/Replay/Golden                                                                                                 | B01 same default server proof                                         |
| L1-VC-11 | Abort、Reset、Cleanup与Failure Matrix                   | IMPLEMENTED_NOT_VERIFIED                                  | Synthetic lifecycle service within JSON_INTERNAL_ONLY L1 scope                    | Run lifecycle, Run/Replay/Golden                                                                                  | L1-GAP-E04 current failure matrix and zero-residue evidence           |
| L1-VC-12 | Known Limits与阶段声明边界                              | IMPLEMENTED_NOT_VERIFIED                                  | Known Limits policy owner                                                         | Known Limits policy                                                                                               | current-master browser disclosure receipt needed                      |
| L1-VC-13 | L1 Completion Evidence Pack                             | AUTOMATED_EVIDENCE_COMPLETE_OWNER_ACKNOWLEDGMENT_REQUIRED | Evidence pack assembler; read-only with respect to product Truth                  | Evidence Root, Closure lane                                                                                       | current immutable evidence pack at `98206df`                          |
| L1-VC-14 | Final L1 Gate与Owner Acknowledgment                     | AWAITING_OWNER_ACKNOWLEDGMENT                             | Project Owner / designated L1 gate authority                                      | Stage decision                                                                                                    | exact-source Owner-only decision                                      |

## 7. Repository Module Map

| Module ID            | Path                                                                             | Role                             | Responsibility                                                                                          | Authority                                              | Dependencies                                              | Critical Evidence                                                              |
| -------------------- | -------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| MOD-APP-TEACHER      | apps/teacher/src/App.tsx                                                         | Teacher product surface          | Teacher UI state, readiness, Run and round controls                                                     | read-only product consumer                             | Teacher BFF/API                                           | teacher-next-run-product-path.spec.ts; z-r7-teacher-scenario-readiness.spec.ts |
| MOD-APP-STUDENT      | apps/student/src/App.tsx                                                         | Student product surface          | Decision input, published result, feedback and safe copy                                                | no formal writer                                       | Student BFF/API                                           | student-smoke.spec.ts; teacher-student-frontend-bff-dto-consumption.spec.ts    |
| MOD-APP-ADMIN        | apps/admin/src/App.tsx                                                           | Admin product surface            | Tenant/platform summary and synthetic lifecycle controls                                                | no Truth writer                                        | Admin BFF/API                                             | admin-scope-authority.spec.ts; admin-lifecycle-controls.test.ts                |
| MOD-API-COMPOSITION  | services/api/src/server.ts                                                       | API composition root             | Routes, auth context, runtime composition, formal lifecycle ingress, Run/Decision/Settlement/Projection | delegates to designated services                       | all API modules                                           | large hotspot; multiple integration tests                                      |
| MOD-AUTH-PARAM       | services/api/src/parameter-set-authority.ts                                      | Formal ParameterSet authority    | Append-only lifecycle and exact reference                                                               | ParameterSetCommandService                             | JSON formal authority persistence                         | formal-parameter-set-lifecycle-endpoint.test.ts                                |
| MOD-AUTH-SCENARIO    | services/api/src/scenario-package-authority.ts                                   | Formal ScenarioPackage authority | Append-only lifecycle, ParameterSet binding and catalog projection                                      | ScenarioPackageCommandService                          | ParameterSet authority; Plugin dependencies               | formal-scenario-package-lifecycle-endpoint.test.ts                             |
| MOD-AUTH-PLUGIN      | services/api/src/plugin-release-authority.ts                                     | Formal PluginRelease authority   | Lifecycle and availability for binding                                                                  | PluginReleaseCommandService                            | Plugin registry                                           | formal-plugin-release-lifecycle-endpoint.test.ts                               |
| MOD-COURSE-BINDING   | services/api/src/formal-course-authority-binding.ts                              | Formal Course authority binding  | Freeze exact Scenario/Parameter/Engine references                                                       | createFormalCourseAuthorityBinding + append-only store | Formal authorities                                        | formal-run-runtime-binding-activation.test.ts                                  |
| MOD-RUN-BINDING      | services/api/src/formal-run-runtime-binding.ts                                   | Formal Run binding               | Freeze exact runtime inputs and seed                                                                    | createFormalRunRuntimeBinding                          | Formal Course binding or explicit legacy-compatible input | formal-run-runtime-binding.test.ts                                             |
| MOD-RUNTIME-RESOLVER | services/api/src/formal-runtime-input-resolver.ts                                | Formal runtime input resolution  | Materialize exact active/historical inputs and digest                                                   | read-only resolver                                     | Formal authorities and Run binding                        | formal-runtime-input-resolver.test.ts                                          |
| MOD-REPO-FACADE      | services/api/src/repository-facade.ts                                            | Repository boundary              | Typed command/read facades and atomic settlement outcome                                                | delegates to provider ports                            | JSON active; PG candidates                                | repository-facade-command-forwarding.test.ts                                   |
| MOD-REPO-JSON        | services/api/src/json-repository-adapter.ts                                      | Active JSON repository adapter   | JSON persistence and formal registries                                                                  | active JSON provider                                   | SimWarStore                                               | json-repository-adapter.test.ts                                                |
| MOD-REPO-PG          | services/api/src/postgres-repository-adapter.ts                                  | PostgreSQL candidate adapter     | Read/write candidates and replay verification                                                           | not active L1 authority                                | Program F / higher stage                                  | postgres-repository-adapter.test.ts; postgres-replay-verification.test.ts      |
| MOD-KERNEL           | services/simulation-core/src/simulation.ts                                       | Settlement orchestration         | Prepare/calculate official settlement and replay hash                                                   | Simulation Core L1–L3                                  | market, operations, finance, scoring                      | simulation-core.test.ts                                                        |
| MOD-PROJECTION       | services/api/src/teacher-student-bff-dto.ts                                      | Persona projections              | Teacher/Student/Admin DTO creation and forbidden-field filters                                          | read-only projection                                   | official result and audit refs                            | teacher-student-bff-dto-productization.test.ts                                 |
| MOD-REPLAY           | services/api/src/run-manifest-replay-evidence.ts                                 | Replay and evidence              | Canonical hashes, private/public evidence and Golden selection                                          | Replay evidence writer only                            | locked Run/Decision/Authority/Settlement                  | m1-run-manifest-replay-evidence.test.ts                                        |
| MOD-CLEANUP          | services/api/src/synthetic-run-lifecycle.ts                                      | L1 abort/reset/cleanup           | Synthetic JSON_INTERNAL_ONLY lifecycle controls                                                         | lifecycle service within bounded scope                 | Run/audit/store                                           | l1-session-abort-reset-recovery.test.ts                                        |
| MOD-CONTRACTS        | packages/shared-contracts/src/index.ts; contracts/openapi; contracts/json-schema | Shared contracts                 | TypeScript/OpenAPI/JSON Schema/BFF DTO contracts                                                        | contract owners                                        | API and apps                                              | m1-contract-conformance-gate.test.ts                                           |

### 7.1 Hotspots

- `services/api/src/server.ts` is the main API composition hotspot. Future Missions must use exact-file and exact-symbol discovery before expanding its allowlist.
- `packages/shared-contracts/src/index.ts` is a shared contract hotspot. It requires a single-writer lock when changed.
- `repository-facade.ts`, `repository-ports.ts`, active adapters and settlement paths form the write-boundary hotspot covered by L1-GAP-B03.
- `run-manifest-replay-evidence.ts`, formal binding and runtime resolver form a serial `Run/Replay/Golden` lock domain for B01.

## 8. Authority Writer Specification

| Authority Object             | Designated Writer                                        | Source                                                          | Legal Caller                            | Persistence                         | Forbidden Writer                                            |
| ---------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| ParameterSetVersion          | ParameterSetCommandService                               | services/api/src/parameter-set-authority.ts                     | platform_admin formal authority ingress | JSON formal registry                | Teacher/Student/AI/Plugin/legacy store direct writes        |
| ScenarioPackageVersion       | ScenarioPackageCommandService                            | services/api/src/scenario-package-authority.ts                  | platform_admin formal authority ingress | JSON formal registry                | Teacher/Student/AI/industry code direct writes              |
| PluginReleaseVersion         | PluginReleaseCommandService                              | services/api/src/plugin-release-authority.ts                    | platform_admin formal authority ingress | JSON formal registry                | runtime hot-swap and non-authorized providers               |
| FormalCourseAuthorityBinding | FormalCourseAuthorityBindingStore.append                 | services/api/src/formal-course-authority-binding-store.ts       | Course create formal path               | private append-only JSON collection | client override after creation                              |
| FormalRunRuntimeBinding      | FormalRunRuntimeBindingStore.append                      | services/api/src/formal-run-runtime-binding-store.ts            | Run create formal path                  | private append-only JSON collection | floating/latest resolution and override                     |
| Decision/Canonical Decision  | DecisionCommandRepositoryPort.saveCanonicalDecision      | services/api/src/repository-ports.ts                            | authorized Student team submission      | active repository provider          | wrong-team, AI or frontend direct write                     |
| Truth-L1/L2/L3               | Simulation Core settlement engine                        | services/simulation-core/src/simulation.ts                      | service-kernel settlement path          | SettlementResult/StateSnapshot      | AI, UI, Plugin direct formal write                          |
| SettlementResult/Score/Rank  | SettlementOutcomePersistencePort.commitSettlementOutcome | services/api/src/repository-ports.ts                            | runSettlement under run mutation lock   | active repository provider          | Replay overwrite, duplicate writer, non-atomic direct store |
| ReplayEvidence/ReplayReport  | run-manifest-replay-evidence + ReplayRepositoryPort      | services/api/src/run-manifest-replay-evidence.ts                | official replay/evidence path           | repository provider                 | write official result                                       |
| Learning Evidence            | course-delivery learning evidence builder                | services/api/src/course-delivery-productization.ts              | published-result-dependent product path | learning evidence ledger            | overwrite business outcome                                  |
| Stakeholder Proposal/Signal  | Stage 4B Resolver in SHADOW_ONLY                         | Stage 4B paths—current exact symbol requires future graph query | approved Stage 4B shadow path           | bounded shadow store                | Truth/Settlement/Score/Rank/ParameterSet write              |

### 8.1 Mandatory Writer Rules

1. Formal Authority versions are append-only and referenced by exact identity and digest.
2. Formal Course and Run bindings are private, append-only and not client-overridable after creation.
3. Simulation Core L1–L3 and the atomic settlement outcome path are the only writers of official Truth/Settlement/Score/Rank.
4. Projections, Replay, Learning Evidence, AI, Plugins and Stage 4B are consumers or bounded advisory/shadow producers; they cannot overwrite official result.
5. A second writer, direct Store bypass or floating/latest binding is a hard stop for the affected Mission.

## 9. Runtime Call Paths

| Path ID | Purpose                       | Call Chain                                                                                                                                      | Source                                                                          | Current Tests                                                                    | Unclosed Edge                            |
| ------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| PATH-01 | Authentication and scope      | POST login → signed session → createContext → requireActor/requirePermission → tenant/course/team guards                                        | services/api/src/auth.ts; services/api/src/server.ts                            | p1-auth-rbac.test.ts                                                             | B02 course membership negative matrix    |
| PATH-02 | Formal asset lifecycle        | platform_admin POST formal authority route → parser → command service → append-only registry → audit                                            | server.ts; \*-authority.ts; json-repository-adapter.ts                          | three formal lifecycle endpoint tests                                            | same-default-server chain not yet proven |
| PATH-03 | Formal Course and Run binding | Course create formal binding → validate exact authorities → append private Course binding → Run create with seed → derive Run binding → persist | formal-course-authority-binding*.ts; formal-run-runtime-binding*.ts; server.ts  | formal-run-runtime-binding-activation.test.ts                                    | B01 full chain                           |
| PATH-04 | Decision and lock             | Student submit → role/course/team guard → payload validation/idempotency → canonical decision → Teacher lock under run lock                     | server.ts; repository facade/ports                                              | decision-submit-characterization; round-lock-publish-characterization            | B02 and default formal chain             |
| PATH-05 | Settlement and publish        | locked round → resolve formal runtime inputs → prepare/calculate settlement → atomic commit → publish → projections                             | server.ts; formal-runtime-input-resolver.ts; simulation-core; repository facade | settlement-write-replay-hash-characterization; tenant-settlement-identity-matrix | B01; Issue #111 remains open             |
| PATH-06 | Replay evidence               | locked binding/decision/inputs/result → canonical manifest/hash → private evidence → safe public view → compare/non-overwrite                   | run-manifest-replay-evidence.ts; formal-runtime-input-resolver.ts               | m1-run-manifest-replay-evidence; formal-run-runtime-binding-activation           | B01 and E04 closure evidence             |
| PATH-07 | Abort/reset/cleanup           | Admin/authorized operator → synthetic lifecycle controls → audit-preserving state change → reset ephemeral allowlist → cleanup/readiness        | synthetic-run-lifecycle.ts; server.ts                                           | l1-session-abort-reset-recovery; lifecycle controls tests                        | E04 current zero-residue receipt         |

### 9.1 Forbidden Fallbacks

- Missing exact formal identity must fail closed; it cannot create a legacy Run silently.
- A formally bound Course cannot accept client-supplied authority-reference overrides.
- Active JSON and candidate PostgreSQL paths cannot dual-write or create dual authority.
- Replay cannot call live providers for official evidence or write a new formal result.
- Tenant/course/team identity cannot be selected from untrusted request fields when authenticated context already defines it.

## 10. Product Journey Technical Map

| Persona        | Journey                                                                                                                       | Current State            | Required Closure                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| Teacher        | Authenticate → readiness/catalog → formal Course/Run → start → monitor → lock → settle → publish → results → Replay → cleanup | PARTIAL                  | B01 full default chain; current browser receipt                               |
| Student        | Authenticate → course/team scope → decision form → submit → wait → published safe result → feedback/report                    | PARTIAL                  | B02 course membership visibility; B04 executable parity                       |
| Tenant Admin   | Authenticate → tenant summary → scoped controls → Known Limits → cleanup                                                      | IMPLEMENTED_NOT_VERIFIED | current browser and cross-tenant negative proof                               |
| Platform Admin | Authenticate → ParameterSet/ScenarioPackage/PluginRelease lifecycle → audit/status                                            | IMPLEMENTED_NOT_VERIFIED | current post-merge full lifecycle receipt and no runtime activation overclaim |

A route, schema, DTO or test fixture by itself is not a completed product step. A journey step becomes `CLOSED_AND_CURRENT` only after current-source product execution, expected negative behavior, CI/CodeQL as applicable, and post-merge/fresh evidence.

## 11. Contract Catalog

| Contract ID | Business Meaning                 | Route / Event                                                                            | Authority                                          | Actor / Scope                                               | Current Evidence                                      |
| ----------- | -------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| CON-01      | Formal ParameterSet lifecycle    | POST /api/v1/formal-authority/parameter-sets; exact-reference transition routes          | ParameterSetCommandService                         | platform_admin                                              | formal-parameter-set-lifecycle-endpoint.test.ts       |
| CON-02      | Formal ScenarioPackage lifecycle | POST /api/v1/formal-authority/scenario-packages; exact-reference transition routes       | ScenarioPackageCommandService                      | platform_admin                                              | formal-scenario-package-lifecycle-endpoint.test.ts    |
| CON-03      | Formal PluginRelease lifecycle   | POST /api/v1/formal-authority/plugin-releases; exact-reference transition routes         | PluginReleaseCommandService                        | platform_admin                                              | formal-plugin-release-lifecycle-endpoint.test.ts      |
| CON-04      | Formal Course create             | POST /api/v1/courses with optional formal_authority_binding                              | FormalCourseAuthorityBindingStore                  | authorized course creator; exact scope from request context | formal-run-runtime-binding-activation.test.ts         |
| CON-05      | Formal Run create                | POST /api/v1/courses/{courseId}/runs; formal course uses formal_runtime_seed             | Run + FormalRunRuntimeBindingStore                 | Teacher                                                     | formal-run-runtime-binding-activation.test.ts         |
| CON-06      | Round start                      | POST /api/v1/runs/{runId}/rounds/{roundNo}/start                                         | Run/Round writer                                   | Teacher                                                     | m1-teaching-loop.test.ts                              |
| CON-07      | Decision submit                  | POST /api/v1/runs/{runId}/rounds/{roundNo}/decisions                                     | Decision command port                              | Student within team/course/tenant                           | decision-submit-characterization.test.ts              |
| CON-08      | Round lock                       | POST /api/v1/runs/{runId}/rounds/{roundNo}/lock                                          | Round writer                                       | Teacher                                                     | round-lock-publish-characterization.test.ts           |
| CON-09      | Settlement                       | POST /api/v1/runs/{runId}/rounds/{roundNo}/settle                                        | SettlementOutcomePersistencePort                   | service-kernel/authorized Teacher path                      | settlement-write-replay-hash-characterization.test.ts |
| CON-10      | Publish                          | POST /api/v1/runs/{runId}/rounds/{roundNo}/publish                                       | Round writer after settlement                      | Teacher                                                     | round-lock-publish-characterization.test.ts           |
| CON-11      | Result read                      | GET /api/v1/runs/{runId}/rounds/{roundNo}/results                                        | persona projection builders                        | Teacher/Student/Admin by scope                              | teacher-student-bff-dto-productization.test.ts        |
| CON-12      | Replay evidence                  | Result/replay evidence projection resolved from current OpenAPI/server before mutation   | Replay evidence builder; no official result writer | Teacher/Admin private; Student safe public only             | m1-run-manifest-replay-evidence.test.ts               |
| CON-13      | Abort/reset/cleanup              | Admin lifecycle control route family—exact path must be read from current OpenAPI/server | SyntheticRunLifecycle service                      | authorized Admin                                            | synthetic-run-lifecycle-controls.test.ts              |
| CON-14      | Known Limits                     | Known Limits projection via BFF/product surfaces                                         | Known Limits policy                                | all product personas with role projection                   | known-limits-product-disclosure.spec.ts               |

### 11.1 Contract Parity Rule

For core L1 routes, compatibility requires executable parity across OpenAPI, JSON Schema where applicable, shared TypeScript types, handler parsing, response projection, BFF DTO and integration fixtures. Static declarations or contract-only draft files do not close L1-GAP-B04.

## 12. State Machine Catalog

| ID    | Aggregate           | Allowed Path                                                                                        | Writer                            | Mandatory Negative Cases                                    |
| ----- | ------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------- |
| SM-01 | ParameterSet        | DRAFT → VALIDATED → FROZEN → APPROVED → RETIRED                                                     | ParameterSetCommandService        | invalid transition, digest/reference mismatch, actor scope  |
| SM-02 | ScenarioPackage     | DRAFT → VALIDATED → FROZEN → APPROVED → RETIRED                                                     | ScenarioPackageCommandService     | unapproved ParameterSet, tenant mismatch, forbidden content |
| SM-03 | PluginRelease       | DRAFT → VALIDATED → APPROVED → AVAILABLE → RETIRED                                                  | PluginReleaseCommandService       | unapproved/unavailable release, digest conflict             |
| SM-04 | Course Binding      | ABSENT → APPENDED_EXACT_BINDING; no update                                                          | FormalCourseAuthorityBindingStore | second append, client override                              |
| SM-05 | Run/Round           | CREATED → OPEN/STARTED → LOCKED → SETTLED → PUBLISHED; bounded terminal/error states                | Run/Round command path            | illegal order, concurrency, duplicate settlement            |
| SM-06 | Decision            | DRAFT/VALIDATED/SUBMITTED or current equivalent → canonical whole-team decision                     | Decision command path             | late/wrong-team/duplicate conflict                          |
| SM-07 | Settlement          | NOT_COMMITTED → ATOMIC_COMMIT; idempotent replay/read                                               | SettlementOutcomePersistencePort  | duplicate business identity, partial commit                 |
| SM-08 | Replay              | PENDING → RUNNING → COMPLETED/MATCHED\|MISMATCHED\|FAILED                                           | Replay repository/evidence path   | official result write forbidden                             |
| SM-09 | Abort/Reset/Cleanup | current synthetic states → ABORTED/RESET/CLEANED with preserved audit and bounded ephemeral removal | SyntheticRunLifecycle             | cross-tenant action, formal authority mutation, residue     |

All state machines must explicitly define invalid transitions, idempotency, concurrency, audit effects, terminal behavior and historical non-overwrite. A retry may only return the same accepted outcome or a stable conflict; it cannot silently produce a second formal result.

## 13. Persistence and Repository Boundaries

### 13.1 Active L1 Persistence

The active L1 runtime is JSON-based. `createJsonRepositoryProvider`, JSON formal registries and append-only private binding stores are the current authority surfaces. PostgreSQL adapters, schemas and replay verification are candidate/higher-stage assets and must not be described as active L1 authority.

### 13.2 Command and Read Facades

- Commands that mutate Decisions, Rounds, Settlement outcomes, Replay records and audit must pass through typed ports/facades or an explicitly approved direct-store manifest entry.
- `scripts/check-direct-store-boundaries.mjs` is a guard, not proof that every route exception is justified. L1-GAP-B03 requires a current route-level review and closure manifest.
- Formal authority APIs must delegate to command services; route handlers cannot write formal collections directly.

### 13.3 PostgreSQL Boundary

PostgreSQL read/write providers, migrations and replay harnesses remain outside L1 active authority. Activating PostgreSQL, migrating authority or claiming durable settlement/recovery is T4 and requires a separate stage decision.

## 14. Tenant, Role and Student Visibility

The required access chain is `signed session → current user → tenant context → role permission → course membership → team membership → projection`. Each link requires positive and negative evidence.

| Protected Marker          | Teacher/Admin                           | Student                                       | Required Guard                                     |
| ------------------------- | --------------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| state_true                | Privileged result only where authorized | FORBIDDEN                                     | Projection schema + runtime serialization negative |
| canonical_evidence_digest | Teacher/Admin bounded evidence          | FORBIDDEN unless explicitly public-safe field | Public/private evidence projection                 |
| decision_batch_hash       | Private evidence only                   | FORBIDDEN                                     | Student envelope and log/export scan               |
| binding_digest            | Private audit/evidence                  | FORBIDDEN                                     | DTO/error/log/export negative                      |
| formal_resolution_digest  | Private evidence                        | FORBIDDEN                                     | DTO/error/log/export negative                      |
| private Manifest          | Privileged evidence store               | FORBIDDEN                                     | No BFF/UI/export reachability                      |

L1-GAP-B02 remains a blocker because course membership must be proven across API, BFF, browser, error, log and export paths—not only tenant or team checks.

## 15. Settlement, Projection and Replay

### 15.1 Settlement

`prepareSettlementOutcome` / `calculateSettlement` and the active atomic outcome persistence port form the official result path. Changes to finance, Score, Rank, settlement formula or writer authority are T4 and require human review. Evidence-only tests around the existing formula may remain T3.

### 15.2 Projection

Teacher/Admin projections may expose bounded private evidence needed for instruction and audit. Student projections must be deny-by-default for formal binding, Truth and private evidence. Error envelopes, logs and exports are part of the same projection boundary.

### 15.3 Replay

Official Replay uses frozen Run binding, exact authority records, locked Decisions and the source Settlement result. It creates evidence and comparison reports, never a replacement official result. Replay is not backup, restore or disaster recovery.

## 16. Test Coverage Specification

| Capability | DoD                                   | Representative Symbol                  | Representative Test                             | Coverage                     | Fresh Closure         |
| ---------- | ------------------------------------- | -------------------------------------- | ----------------------------------------------- | ---------------------------- | --------------------- |
| L1-VC-01   | L1-DOD-001—006                        | root npm scripts                       | npm run check:hidden-unicode                    | CI_ENFORCED_PARTIAL          | POST_MERGE_PROVEN: NO |
| L1-VC-02   | L1-DOD-007—011                        | createContext                          | tests/integration/p1-auth-rbac.test.ts          | NEGATIVE_COVERED_PARTIAL     | POST_MERGE_PROVEN: NO |
| L1-VC-03   | L1-DOD-012—013                        | CourseCreateBody                       | formal Course binding integration tests         | INTEGRATION_COVERED          | POST_MERGE_PROVEN: NO |
| L1-VC-04   | L1-DOD-021—022、029                   | ParameterSetCommandService             | formal-parameter-set-lifecycle-endpoint.test.ts | INTEGRATION_COVERED          | POST_MERGE_PROVEN: NO |
| L1-VC-05   | L1-DOD-012—017                        | routeRequest                           | round-lock-publish-characterization.test.ts     | INTEGRATION_COVERED          | POST_MERGE_PROVEN: NO |
| L1-VC-06   | L1-DOD-018—020                        | DecisionSubmitBody                     | decision-submit-characterization.test.ts        | INTEGRATION_COVERED          | POST_MERGE_PROVEN: NO |
| L1-VC-07   | L1-DOD-021、023—024                   | prepareSettlementOutcome               | simulation-core.test.ts                         | INTEGRATION_COVERED          | POST_MERGE_PROVEN: NO |
| L1-VC-08   | L1-DOD-025—027                        | createPublicResultView                 | teacher-student-bff-dto-productization.test.ts  | NEGATIVE_COVERED_PARTIAL     | POST_MERGE_PROVEN: NO |
| L1-VC-09   | Persona Acceptance / L1 product chain | buildCourseDeliveryThreePartFeedbackV1 | course-delivery-productization.test.ts          | INTEGRATION_COVERED          | POST_MERGE_PROVEN: NO |
| L1-VC-10   | L1-DOD-031—033                        | createM1RunReplayEvidence              | m1-run-manifest-replay-evidence.test.ts         | INTEGRATION_COVERED          | POST_MERGE_PROVEN: NO |
| L1-VC-11   | L1-DOD-034—037                        | executeSyntheticRunLifecycleOperation  | l1-session-abort-reset-recovery.test.ts         | INTEGRATION_COVERED          | POST_MERGE_PROVEN: NO |
| L1-VC-12   | L1-DOD-038—040                        | KNOWN_LIMITS_CATALOG                   | known-limits-product-disclosure.test.ts         | CI_ENFORCED_PARTIAL          | POST_MERGE_PROVEN: NO |
| L1-VC-13   | L1-DOD-041—042                        | createL1InternalValidationReadyPackage | l1-internal-validation-ready-package.test.ts    | INTEGRATION_COVERED          | POST_MERGE_PROVEN: NO |
| L1-VC-14   | L1-DOD-043                            | Owner Completion Approval record       | evidence checklist review                       | NO_RUNTIME_TEST / OWNER_GATE | POST_MERGE_PROVEN: NO |

### 16.1 Coverage Interpretation

- `UNIT_ONLY` or `INTEGRATION_COVERED` is not sufficient for product journey closure.
- A test file that is not invoked by an npm script or CI job must be classified as not CI-enforced.
- Injected-port full-chain tests and default-persisted-authority create-only tests do not jointly prove one default-server full chain; B01 exists specifically to close that gap.
- PR-head CI success is not post-merge proof. Fresh source identity and clean receipt remain mandatory.

## 17. Validation Command Catalog

| Tier                        | Purpose                      | Minimum Commands / Evidence                                                                                                                                        |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tier A — Focused RED        | Prove the intended gap       | One smallest failing test bound to exact target; failure reason must match gap                                                                                     |
| Tier B — Focused GREEN      | Prove minimal implementation | Focused test + directly affected unit/integration/contract tests                                                                                                   |
| Tier C — PR Candidate       | Repository candidate quality | check:hidden-unicode; check:direct-store-boundaries; lint; typecheck; affected/full tests; test:contract; build; security; Playwright when product surface changes |
| Tier D — Exact-Head Closure | Freeze reviewable state      | exact base/head/files; CI; CodeQL; unresolved threads=0; negative matrix; mergeability; scope/lock review                                                          |
| Tier E — Post-Merge         | Prove master state           | fresh clone; npm ci; targeted/full/build/browser as applicable; clean status; zero mission residue; merge receipt                                                  |

Commands must be selected from current `package.json` and workflow files at execution time. This catalog defines the evidence tiers, not a license to run stale commands blindly.

## 18. Graphify and CodeGraph Query Playbook

| Query ID     | Purpose                           | Graphify Intent                                                                 | CodeGraph Intent                                                                  | Expected Output                       | Stop Condition                        |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------- |
| Q-REPO-01    | Repository module and hotspot map | Map folders/modules, dependency fan-in/fan-out, cycles and duplicate registries | Trace imports/exports and public symbols                                          | Module map + collision candidates     | Graph SHA drift                       |
| Q-AUTH-01    | Sole writer audit                 | Connect Authority objects to adapters, routes and consumers                     | Find every definition/caller/mutation of command services and persistence methods | Writer table + second-writer findings | Any unresolved writer                 |
| Q-RUNTIME-01 | Formal Golden call path           | Map authority→Course→Run→Decision→Settlement→Projection→Replay                  | Trace route→handler→service→repo for exact symbols                                | Exact path and missing edges          | Fallback or unknown edge              |
| Q-STUDENT-01 | Student private-field exposure    | Map DTO/schema/BFF/UI/error/log/export consumers                                | Search protected markers and serialization paths                                  | Deny matrix and reachable paths       | Any reachable private marker          |
| Q-TEST-01    | Test traceability                 | Map capability/source/test/script/workflow relationships                        | Find references to symbols from test cases and npm/CI invocations                 | Coverage graph and orphan tests       | Critical capability has no test       |
| Q-CAND-01    | Candidate route comparison        | Compare file/Authority/lock/product impact for 2–5 routes                       | Resolve exact symbols and affected tests per route                                | Selected path + rejected paths        | Shared writer conflict or stale graph |

Every query output must include source SHA, exact paths/symbols, confidence and “Not a Proof Of” language. Graph query results never replace RED/GREEN or closure evidence.

## 19. Gap-to-Implementation Contracts

### 19.1 L1-GAP-B01 — Default persisted authority full Golden chain

```yaml
gap_id: L1-GAP-B01
current_state: Formal lifecycle, JSON composition, binding and split tests exist;
  one default-server HTTP lifecycle through Publish and Replay is not current-master
  proven.
target_state: Same default server; HTTP-created ParameterSet, ScenarioPackage and
  PluginRelease; Formal Run; Decision; Lock; Settle; Publish; Replay; boundary assertions.
classification: L1_BLOCKER
blocks_l1: true
primary_outcome: current-SHA default HTTP authority-to-Replay Golden proof
source_modules:
  - services/api/src/server.ts
  - services/api/src/formal-run-runtime-binding*.ts
  - services/api/src/*-authority.ts
  - tests/integration/**
  - tests/e2e-ui/**
sole_writer_or_authority: FORMAL_AUTHORITY_RUN_BINDING_GOLDEN
resource_locks:
  - Run/Replay/Golden/formal authority
risk_tier: T3
candidate_bundle: B5 Default Persisted Authority Golden Closure
expected_pr_count: 1
required_evidence:
  - current-SHA default HTTP authority-to-Replay Golden proof
missing_evidence:
  - one default-server full Golden receipt
parallel_classification: SERIAL_REQUIRED
automatic_next_start: false
```

### 19.2 L1-GAP-B02 — Course membership visibility

```yaml
gap_id: L1-GAP-B02
current_state: "Issue #112 remains open."
target_state: Course-scoped negative paths across API/BFF/browser/log/export.
classification: L1_BLOCKER
blocks_l1: true
primary_outcome: current-SHA tenant/course negative proof
source_modules:
  - services/api/src/**
  - apps/**
  - tests/**
sole_writer_or_authority: TENANT_COURSE_VISIBILITY
resource_locks:
  - Teacher/Student projection
risk_tier: T3
candidate_bundle: L1 Visibility Closure
expected_pr_count: 1
required_evidence:
  - current-SHA tenant/course negative proof
missing_evidence:
  - cross-course negative matrix
parallel_classification: SERIAL_REQUIRED
automatic_next_start: false
```

### 19.3 L1-GAP-B03 — Repository/direct-store authority boundary

```yaml
gap_id: L1-GAP-B03
current_state: "CI guard exists; Issue #114 remains open."
target_state: No unapproved command/truth direct Store bypass.
classification: L1_BLOCKER
blocks_l1: true
primary_outcome: approved direct store manifest and route review
source_modules:
  - services/api/src/server.ts
  - services/api/src/repository-*.ts
  - scripts/check-direct-store-boundaries.mjs
sole_writer_or_authority: REPOSITORY_FACADE
resource_locks:
  - Repository provider
risk_tier: T3
candidate_bundle: L1 Authority Boundary Closure
expected_pr_count: 1
required_evidence:
  - approved direct store manifest and route review
missing_evidence:
  - route exception closure
parallel_classification: SERIAL_REQUIRED
automatic_next_start: false
```

### 19.4 L1-GAP-B04 — Executable contract parity

```yaml
gap_id: L1-GAP-B04
current_state: "Issue #115 remains open; R7 BFF draft is contract-only and carries
  stale historical anchor."
target_state: OpenAPI, JSON Schema, shared types, handler and BFF parity for core
  L1 routes.
classification: L1_BLOCKER
blocks_l1: true
primary_outcome: route-contract-handler-BFF parity suite
source_modules:
  - contracts/**
  - packages/shared-contracts/**
  - services/api/**
  - tests/contract/**
sole_writer_or_authority: PUBLIC_CONTRACT
resource_locks:
  - Shared contracts
risk_tier: T2/T3
candidate_bundle: L1 Contract Parity Closure
expected_pr_count: 1
required_evidence:
  - route-contract-handler-BFF parity suite
missing_evidence:
  - executable parity map
parallel_classification: SERIAL_REQUIRED
automatic_next_start: false
```

### 19.5 L1-GAP-E04 — Abort reset cleanup zero residue

```yaml
gap_id: L1-GAP-E04
current_state: Static lifecycle implementation exists; no current-master failure matrix
  receipt from this audit.
target_state: Current-SHA failure matrix and zero-residue evidence.
classification: L1_EVIDENCE_GAP
blocks_l1: false
primary_outcome: zero residue evidence
source_modules:
  - services/api/src/synthetic-run-lifecycle.ts
  - tests/**
sole_writer_or_authority: RUN_LIFECYCLE
resource_locks:
  - Run/Replay/Golden
risk_tier: T3
candidate_bundle: B5 closure lane
expected_pr_count: 1
required_evidence:
  - zero residue evidence
missing_evidence:
  - current runtime failure receipt
parallel_classification: SERIAL_REQUIRED
automatic_next_start: false
```

These contracts are inputs to a Mission Compiler. They are not executable authorizations, exact allowlists or current-cycle selections.

## 20. Capability Cards

| Capability | Repository Card                      | Title                                                   | Current State                                             |
| ---------- | ------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------- |
| L1-VC-01   | L1-VC-01-engineering-baseline.md     | Current Reality与工程基线                               | MERGED_NOT_CLOSED                                         |
| L1-VC-02   | L1-VC-02-identity-tenant-role.md     | Identity、RBAC、Tenant、Course与Team隔离                | BLOCKED                                                   |
| L1-VC-03   | L1-VC-03-course-run-entry.md         | Synthetic Course与Run Entry                             | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-04   | L1-VC-04-formal-authority-binding.md | Formal Authority Lifecycle与Exact Run Binding           | PARTIALLY_IMPLEMENTED                                     |
| L1-VC-05   | L1-VC-05-run-lifecycle.md            | Run Lifecycle：Create→Open→Decision→Lock→Settle→Publish | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-06   | L1-VC-06-student-decision.md         | Student Whole-Team Decision Flow                        | PARTIALLY_IMPLEMENTED                                     |
| L1-VC-07   | L1-VC-07-truth-settlement.md         | Truth-L1—L3与L1范围Settlement                           | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-08   | L1-VC-08-projection-visibility.md    | Publish与Teacher/Student/Admin安全Projection            | BLOCKED                                                   |
| L1-VC-09   | L1-VC-09-feedback-learning-report.md | Three-Part Feedback与Learning Report最小闭环            | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-10   | L1-VC-10-replay-evidence.md          | Official Replay与Evidence Non-Overwrite                 | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-11   | L1-VC-11-abort-reset-cleanup.md      | Abort、Reset、Cleanup与Failure Matrix                   | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-12   | L1-VC-12-known-limits.md             | Known Limits与阶段声明边界                              | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-13   | L1-VC-13-evidence-pack.md            | L1 Completion Evidence Pack                             | AUTOMATED_EVIDENCE_COMPLETE_OWNER_ACKNOWLEDGMENT_REQUIRED |
| L1-VC-14   | L1-VC-14-final-gate-owner-ack.md     | Final L1 Gate与Owner Acknowledgment                     | AWAITING_OWNER_ACKNOWLEDGMENT                             |

Capability cards contain stable technical contracts only. Current PR numbers, exact heads and cycle scheduling belong in the Portfolio Register and Current Cycle files.

## 21. Mission Compiler Interface

A target-mode Mission must compile one capability and one gap into one Primary Outcome. The minimum machine interface is:

```yaml
capability_id:
ledger_id:
dod_reference:
gap_id:
current_state:
target_state:
primary_outcome:
source_anchor:
graph_manifest:
entry_contracts: []
exit_contracts: []
source_modules: []
entry_symbols: []
sole_writer:
exact_allowlist: []
reference_only: []
forbidden_modules: []
resource_locks: []
join_barriers: []
risk_tier:
parallel_classification:
graph_queries: []
focused_red: []
affected_tests: []
negative_tests: []
closure_tests: []
required_evidence: []
explicit_non_proofs: []
stop_condition:
automatic_next_start: false
```

Compilation must stop when source/graph freshness fails, a sole writer is ambiguous, the allowlist crosses a new Authority, a resource lock is unavailable or the task becomes T4 without required human review.

## 22. Evidence and Freshness

| Evidence           | Bind To                                           | Invalidation Trigger                        |
| ------------------ | ------------------------------------------------- | ------------------------------------------- |
| Source conclusion  | repository + master SHA                           | master change                               |
| Graph conclusion   | source SHA + index ID + scope                     | master, index scope or tracked files change |
| CI/CodeQL          | exact PR head                                     | head change                                 |
| Test result        | source + lockfile + environment + command         | any bound input change                      |
| Product journey    | source + browser/runtime config + persona fixture | source/config/fixture change                |
| Post-merge receipt | merge SHA + fresh clone                           | subsequent merge for current-state claim    |
| Capability card    | source paths/symbols + graph manifest             | architecture/contract/provider change       |

Evidence metadata must include producer, timestamp, source SHA, command or query, environment, status, digest, explicit non-proof and expiry/invalidating event. Secrets and connection strings cannot be stored in the technical spec or evidence catalog.

## 23. Known Limits and Non-Proofs

- Active L1 authority is JSON_INTERNAL_ONLY; PostgreSQL is not active authority.
- No durable settlement, disaster recovery, backup/restore or production persistence claim.
- No Human Validation, Controlled Teaching Pilot or Production claim.
- No real data, external provider active, billing, SLA or SLO claim.
- Program M/BLP and Stage 4B are not formal L1 writers and are not proven active.
- Graph outputs are static analysis and may be partial.
- Current capability statuses remain NOT_ASSESSED/PARTIAL until runtime and closure evidence is produced.
- This document does not authorize a branch, PR, merge or T4 state change.

## 24. Update and Invalidation Rules

Update this specification when any of the following changes: formal Authority lifecycle, Course/Run binding, simulation writer, projection contract, repository provider, shared contracts, critical test architecture, graph schema or L1 DoD. Do not update it for ordinary current-cycle scheduling alone.

Required process after a material change:

1. Authenticate current master and governance files.
2. Run Graphify/CodeGraph delta or full rebase according to scope.
3. Update affected module, writer, runtime path, contract, state-machine and capability-card records.
4. Update machine YAML and input digests.
5. Review contradictions and stale source anchors.
6. Adopt through a docs-only PR unless bundled with an explicitly authorized implementation closure.
7. Do not automatically start the next Mission.

## 25. Adoption Recommendation

This specification should be adopted as the stable technical execution layer between the L1 governance assets and the dynamic bounded-parallel Portfolio plan. Adoption does not change current L1 status. The first implementation candidate remains CAND-01, but a separate Current Cycle and target authorization instance must compile exact source, allowlist, resource locks, tests and stop conditions.

```text
Specification Status:
READY_FOR_REPOSITORY_ADOPTION

Normative Technical Contract:
PASS_WITH_LIMITS

Current Runtime Evidence Completeness:
PARTIAL

Repository: qidianzhiku/SimWar
Source SHA: a296f9032cf1d7fc921fa837d57e5c33e3cc4de2
Graphify Status: CONNECTED
CodeGraph Status: CONNECTED
Cross-Tool Conflict Count: 0 KNOWN
Critical Unknown Count: 4

Module Map: PASS_WITH_LIMITS
Authority Writer Spec: PARTIAL
Runtime Call Spec: PARTIAL
Product Journey Spec: PARTIAL
Test Traceability: PARTIAL
Capability Contracts: 14
L1 Blockers Mapped: 4
Evidence Gaps Mapped: 1 prioritized runtime/cleanup gap plus ledger-wide gaps
Machine-Readable YAML: GENERATED
Repository Mutation: NONE
Automatic Next Mission: FORBIDDEN
Recommended Owner Decision: ADOPT_L1_TARGET_MODE_EXECUTION_SPEC
```

## Appendix A — Module Inventory

| ID                   | Path                                                                             | Public Entry / Role              | Authority                                              |
| -------------------- | -------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| MOD-APP-TEACHER      | apps/teacher/src/App.tsx                                                         | Teacher product surface          | read-only product consumer                             |
| MOD-APP-STUDENT      | apps/student/src/App.tsx                                                         | Student product surface          | no formal writer                                       |
| MOD-APP-ADMIN        | apps/admin/src/App.tsx                                                           | Admin product surface            | no Truth writer                                        |
| MOD-API-COMPOSITION  | services/api/src/server.ts                                                       | API composition root             | delegates to designated services                       |
| MOD-AUTH-PARAM       | services/api/src/parameter-set-authority.ts                                      | Formal ParameterSet authority    | ParameterSetCommandService                             |
| MOD-AUTH-SCENARIO    | services/api/src/scenario-package-authority.ts                                   | Formal ScenarioPackage authority | ScenarioPackageCommandService                          |
| MOD-AUTH-PLUGIN      | services/api/src/plugin-release-authority.ts                                     | Formal PluginRelease authority   | PluginReleaseCommandService                            |
| MOD-COURSE-BINDING   | services/api/src/formal-course-authority-binding.ts                              | Formal Course authority binding  | createFormalCourseAuthorityBinding + append-only store |
| MOD-RUN-BINDING      | services/api/src/formal-run-runtime-binding.ts                                   | Formal Run binding               | createFormalRunRuntimeBinding                          |
| MOD-RUNTIME-RESOLVER | services/api/src/formal-runtime-input-resolver.ts                                | Formal runtime input resolution  | read-only resolver                                     |
| MOD-REPO-FACADE      | services/api/src/repository-facade.ts                                            | Repository boundary              | delegates to provider ports                            |
| MOD-REPO-JSON        | services/api/src/json-repository-adapter.ts                                      | Active JSON repository adapter   | active JSON provider                                   |
| MOD-REPO-PG          | services/api/src/postgres-repository-adapter.ts                                  | PostgreSQL candidate adapter     | not active L1 authority                                |
| MOD-KERNEL           | services/simulation-core/src/simulation.ts                                       | Settlement orchestration         | Simulation Core L1–L3                                  |
| MOD-PROJECTION       | services/api/src/teacher-student-bff-dto.ts                                      | Persona projections              | read-only projection                                   |
| MOD-REPLAY           | services/api/src/run-manifest-replay-evidence.ts                                 | Replay and evidence              | Replay evidence writer only                            |
| MOD-CLEANUP          | services/api/src/synthetic-run-lifecycle.ts                                      | L1 abort/reset/cleanup           | lifecycle service within bounded scope                 |
| MOD-CONTRACTS        | packages/shared-contracts/src/index.ts; contracts/openapi; contracts/json-schema | Shared contracts                 | contract owners                                        |

## Appendix B — Authority Writer Matrix

| Object                       | Writer                                                   | Source                                                          | Forbidden                                                   |
| ---------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| ParameterSetVersion          | ParameterSetCommandService                               | services/api/src/parameter-set-authority.ts                     | Teacher/Student/AI/Plugin/legacy store direct writes        |
| ScenarioPackageVersion       | ScenarioPackageCommandService                            | services/api/src/scenario-package-authority.ts                  | Teacher/Student/AI/industry code direct writes              |
| PluginReleaseVersion         | PluginReleaseCommandService                              | services/api/src/plugin-release-authority.ts                    | runtime hot-swap and non-authorized providers               |
| FormalCourseAuthorityBinding | FormalCourseAuthorityBindingStore.append                 | services/api/src/formal-course-authority-binding-store.ts       | client override after creation                              |
| FormalRunRuntimeBinding      | FormalRunRuntimeBindingStore.append                      | services/api/src/formal-run-runtime-binding-store.ts            | floating/latest resolution and override                     |
| Decision/Canonical Decision  | DecisionCommandRepositoryPort.saveCanonicalDecision      | services/api/src/repository-ports.ts                            | wrong-team, AI or frontend direct write                     |
| Truth-L1/L2/L3               | Simulation Core settlement engine                        | services/simulation-core/src/simulation.ts                      | AI, UI, Plugin direct formal write                          |
| SettlementResult/Score/Rank  | SettlementOutcomePersistencePort.commitSettlementOutcome | services/api/src/repository-ports.ts                            | Replay overwrite, duplicate writer, non-atomic direct store |
| ReplayEvidence/ReplayReport  | run-manifest-replay-evidence + ReplayRepositoryPort      | services/api/src/run-manifest-replay-evidence.ts                | write official result                                       |
| Learning Evidence            | course-delivery learning evidence builder                | services/api/src/course-delivery-productization.ts              | overwrite business outcome                                  |
| Stakeholder Proposal/Signal  | Stage 4B Resolver in SHADOW_ONLY                         | Stage 4B paths—current exact symbol requires future graph query | Truth/Settlement/Score/Rank/ParameterSet write              |

## Appendix C — Runtime Path Catalog

| ID      | Purpose                       | Source                                                                          | Gap                                      |
| ------- | ----------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| PATH-01 | Authentication and scope      | services/api/src/auth.ts; services/api/src/server.ts                            | B02 course membership negative matrix    |
| PATH-02 | Formal asset lifecycle        | server.ts; \*-authority.ts; json-repository-adapter.ts                          | same-default-server chain not yet proven |
| PATH-03 | Formal Course and Run binding | formal-course-authority-binding*.ts; formal-run-runtime-binding*.ts; server.ts  | B01 full chain                           |
| PATH-04 | Decision and lock             | server.ts; repository facade/ports                                              | B02 and default formal chain             |
| PATH-05 | Settlement and publish        | server.ts; formal-runtime-input-resolver.ts; simulation-core; repository facade | B01; Issue #111 remains open             |
| PATH-06 | Replay evidence               | run-manifest-replay-evidence.ts; formal-runtime-input-resolver.ts               | B01 and E04 closure evidence             |
| PATH-07 | Abort/reset/cleanup           | synthetic-run-lifecycle.ts; server.ts                                           | E04 current zero-residue receipt         |

## Appendix D — Contract and State Machine Catalog

| Contract | Meaning                          | Authority                                          |
| -------- | -------------------------------- | -------------------------------------------------- |
| CON-01   | Formal ParameterSet lifecycle    | ParameterSetCommandService                         |
| CON-02   | Formal ScenarioPackage lifecycle | ScenarioPackageCommandService                      |
| CON-03   | Formal PluginRelease lifecycle   | PluginReleaseCommandService                        |
| CON-04   | Formal Course create             | FormalCourseAuthorityBindingStore                  |
| CON-05   | Formal Run create                | Run + FormalRunRuntimeBindingStore                 |
| CON-06   | Round start                      | Run/Round writer                                   |
| CON-07   | Decision submit                  | Decision command port                              |
| CON-08   | Round lock                       | Round writer                                       |
| CON-09   | Settlement                       | SettlementOutcomePersistencePort                   |
| CON-10   | Publish                          | Round writer after settlement                      |
| CON-11   | Result read                      | persona projection builders                        |
| CON-12   | Replay evidence                  | Replay evidence builder; no official result writer |
| CON-13   | Abort/reset/cleanup              | SyntheticRunLifecycle service                      |
| CON-14   | Known Limits                     | Known Limits policy                                |

| State Machine | Aggregate           | Writer                            |
| ------------- | ------------------- | --------------------------------- |
| SM-01         | ParameterSet        | ParameterSetCommandService        |
| SM-02         | ScenarioPackage     | ScenarioPackageCommandService     |
| SM-03         | PluginRelease       | PluginReleaseCommandService       |
| SM-04         | Course Binding      | FormalCourseAuthorityBindingStore |
| SM-05         | Run/Round           | Run/Round command path            |
| SM-06         | Decision            | Decision command path             |
| SM-07         | Settlement          | SettlementOutcomePersistencePort  |
| SM-08         | Replay              | Replay repository/evidence path   |
| SM-09         | Abort/Reset/Cleanup | SyntheticRunLifecycle             |

## Appendix E — Test Traceability

| Capability | Focused/Affected                                                                                                                                                                                     | Closure                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| L1-VC-01   | npm run check:hidden-unicode; npm run check:direct-store-boundaries; npm run typecheck                                                                                                               | npm test; npm run test:contract; npm run build; npm run test:e2e:ui; npm run security:audit |
| L1-VC-02   | tests/integration/p1-auth-rbac.test.ts; tests/integration/decision-submit-characterization.test.ts                                                                                                   | cross-course API/BFF/browser/log/export negative matrix                                     |
| L1-VC-03   | formal Course binding integration tests; formal Run creation tests                                                                                                                                   | current-SHA default server Course→Run entry receipt                                         |
| L1-VC-04   | formal-parameter-set-lifecycle-endpoint.test.ts; formal-scenario-package-lifecycle-endpoint.test.ts; formal-plugin-release-lifecycle-endpoint.test.ts; formal-run-runtime-binding-activation.test.ts | same default server HTTP lifecycle→Course binding→Run→Publish→Replay                        |
| L1-VC-05   | round-lock-publish-characterization.test.ts; settlement-write-replay-hash-characterization.test.ts                                                                                                   | default formal Run full lifecycle receipt                                                   |
| L1-VC-06   | decision-submit-characterization.test.ts; decision-payload-contract-validation.test.ts                                                                                                               | wrong-team/wrong-course/late/duplicate matrix in default formal Run                         |
| L1-VC-07   | simulation-core.test.ts; settlement-outcome-persistence-port.test.ts; tenant-settlement-identity-matrix.test.ts                                                                                      | formal binding default chain settles once and persists one result                           |
| L1-VC-08   | teacher-student-bff-dto-productization.test.ts; r3-runtime-boundary.test.ts; teacher-student-frontend-bff-dto-consumption.spec.ts                                                                    | course/tenant negative projection matrix and executable contract parity                     |
| L1-VC-09   | course-delivery-productization.test.ts; r5-r6-course-delivery-learning-evidence.test.ts                                                                                                              | default formal Golden chain published result→feedback/report readback                       |
| L1-VC-10   | m1-run-manifest-replay-evidence.test.ts; formal-run-runtime-binding-activation.test.ts; settlement-write-replay-hash-characterization.test.ts                                                        | B01 full chain private/public replay evidence and historical non-overwrite                  |
| L1-VC-11   | l1-session-abort-reset-recovery.test.ts; synthetic-run-lifecycle-controls.test.ts                                                                                                                    | failure injection matrix and zero-residue receipt after B01                                 |
| L1-VC-12   | known-limits-product-disclosure.test.ts; known-limits-product-disclosure.spec.ts                                                                                                                     | all persona product disclosure on current master                                            |
| L1-VC-13   | l1-internal-validation-ready-package.test.ts; l1-internal-application-readiness.test.ts                                                                                                              | all blockers closed or explicitly accepted; no UNKNOWN; post-merge source receipt           |
| L1-VC-14   | evidence checklist review                                                                                                                                                                            | Owner acknowledgment bound to exact source and evidence pack                                |

## Appendix F — Capability Card Index

| Capability | File                                                                | Status                                                    |
| ---------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| L1-VC-01   | docs/technical/l1-capabilities/L1-VC-01-engineering-baseline.md     | MERGED_NOT_CLOSED                                         |
| L1-VC-02   | docs/technical/l1-capabilities/L1-VC-02-identity-tenant-role.md     | BLOCKED                                                   |
| L1-VC-03   | docs/technical/l1-capabilities/L1-VC-03-course-run-entry.md         | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-04   | docs/technical/l1-capabilities/L1-VC-04-formal-authority-binding.md | PARTIALLY_IMPLEMENTED                                     |
| L1-VC-05   | docs/technical/l1-capabilities/L1-VC-05-run-lifecycle.md            | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-06   | docs/technical/l1-capabilities/L1-VC-06-student-decision.md         | PARTIALLY_IMPLEMENTED                                     |
| L1-VC-07   | docs/technical/l1-capabilities/L1-VC-07-truth-settlement.md         | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-08   | docs/technical/l1-capabilities/L1-VC-08-projection-visibility.md    | BLOCKED                                                   |
| L1-VC-09   | docs/technical/l1-capabilities/L1-VC-09-feedback-learning-report.md | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-10   | docs/technical/l1-capabilities/L1-VC-10-replay-evidence.md          | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-11   | docs/technical/l1-capabilities/L1-VC-11-abort-reset-cleanup.md      | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-12   | docs/technical/l1-capabilities/L1-VC-12-known-limits.md             | IMPLEMENTED_NOT_VERIFIED                                  |
| L1-VC-13   | docs/technical/l1-capabilities/L1-VC-13-evidence-pack.md            | AUTOMATED_EVIDENCE_COMPLETE_OWNER_ACKNOWLEDGMENT_REQUIRED |
| L1-VC-14   | docs/technical/l1-capabilities/L1-VC-14-final-gate-owner-ack.md     | AWAITING_OWNER_ACKNOWLEDGMENT                             |

## Appendix G — Machine-Readable YAML

The canonical machine-readable representation is `docs/technical/l1-target-mode-execution-spec.yaml`. It is generated from the same source anchor and contains the module, Authority, runtime path, journey, contract, state-machine, capability, gap, validation and query-playbook records. It must not contain secrets.
