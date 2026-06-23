# SimWar Full System and Student Role Workflow Deep Audit

## 1. Baseline

- origin/master commit: `24238131177735dc4c9bda83436ffb678f81576f`
- branch/worktree: `codex/p2-001a-full-system-architecture-audit` at `D:\codex\SimWar-p2-001a-full-system-architecture-audit`
- audit date/time: `2026-06-23 07:27:58 +08:00`
- repository: `origin https://github.com/qidianzhiku/SimWar.git`
- PR #156: merged, `P2-000 post-persistence governance checkpoint`, merge commit `d4203e2c72197165985b19587da0b7640d62065f`
- PR #157: merged, `docs(product): audit student role decision workflow`, merge commit `8b940e5c0f9baf920026813075b4ff0ef72dc409`
- PR #158: merged on origin/master after P2-001, `contracts: define student role context and assignment`, merge commit `24238131177735dc4c9bda83436ffb678f81576f`
- #138: closed, `P1-013 Define multi-process JSON snapshot writer concurrency and CAS policy`
- #139: closed, `P1-014 Add JSON snapshot migration and recovery tooling`
- P2-000/P2-001 status: merged; P2-001 is now refined by this audit because P2-002 contracts already landed in PR #158.
- UA status: GitHub Understand Anything unavailable in this Codex environment; no callable UA tool or existing `.understand-anything/knowledge-graph.json` was found. Used CodeGraph CLI plus `rg`, source review, tests, and docs review as fallback.
- CodeGraph status: initialized and synced in this worktree; 72 files, 1,045 nodes, 5,791 edges, SQLite backend.

## 2. Methodology

- GitHub Understand Anything: searched available tools and local UA artifacts. No callable GitHub UA interface was available, so final findings do not claim UA-generated evidence.
- CodeGraph / MCP: CodeGraph MCP tools were not available through tool search. The CLI fallback was used with `codegraph status`, `codegraph init`, `codegraph sync`, and focused `codegraph explore` queries.
- AGENTS.md: reviewed as the governing repository instruction set, including read order, quality gates, worktree controls, truth protection, and role workflow guardrails.
- initial planning documents: reviewed `DEVELOPMENT_PLAN.md`, product requirements, feature refinement, user stories, architecture decision docs, student-role refactor docs, quality docs, frontend docs, API contract docs, and CodeGraph runbooks.
- rg/source review: searched apps, services, packages, contracts, tests, docs, db, scripts, and workflows for student, teacher, admin, role, permission, decision, settlement, replay, repository, Postgres, AI, plugin, and quality terms.
- tests review: reviewed unit, integration, contract, migration, Postgres replay, and CI quality evidence.
- docs review: reviewed current docs and identified stale planning claims where they no longer match current source.
- limitations: UA visual/global graph evidence was unavailable; CodeGraph MCP was unavailable; CodeGraph CLI and source-level cross-checks were used instead.

## 3. AGENTS.md Compliance Review

| Requirement                                                                                                    | Evidence                                                                                                           | Current compliance                                                                                                                                                                                                                                                                                              | Risk                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Read `AGENTS.md` and relevant architecture docs first                                                          | `AGENTS.md`, `DEVELOPMENT_PLAN.md`, `docs/architecture/student-role-based-decision-*.md`, `docs/quality/*`         | Compliant for this audit.                                                                                                                                                                                                                                                                                       | Low; future tasks must keep using the read order.                         |
| Use CodeGraph before grep when `.codegraph/` exists, and initialize if absent for high-risk architecture tasks | `codegraph status` initially not initialized; `codegraph init` and `codegraph sync` completed.                     | Compliant through CLI fallback; MCP unavailable.                                                                                                                                                                                                                                                                | Low; `.codegraph/` is an untracked local artifact and must not be staged. |
| Protect structured simulation core as truth source                                                             | `services/api/src/server.ts`, `services/api/src/simulation.ts`, `services/simulation-core/src/toy-logit-engine.ts` | Current runtime settles through structured core; this audit makes no runtime changes.                                                                                                                                                                                                                           | Medium if future role drafts bypass canonical decision.                   |
| Do not let role drafts, AI advisory, or UI state enter settlement truth                                        | `ReplayInputManifest`, `TRUTH_PROTECTED_FIELDS`, `calculateSettlement` replay input                                | Current runtime only consumes direct canonical team decisions.                                                                                                                                                                                                                                                  | Medium; future role workflow must preserve this boundary.                 |
| Use npm workspaces and real scripts only                                                                       | `package.json`, `.github/workflows/ci.yml`                                                                         | Compliant; npm scripts are real, planned pnpm scripts are not assumed.                                                                                                                                                                                                                                          | Low.                                                                      |
| Keep changes scoped and do not modify production code in audit tasks                                           | This PR adds only `docs/product-architecture/SIMWAR_FULL_SYSTEM_AND_STUDENT_ROLE_WORKFLOW_DEEP_AUDIT.md`.          | Compliant.                                                                                                                                                                                                                                                                                                      | Low if staging remains explicit.                                          |
| Do not reopen closed JSON CAS/migration lines without new evidence                                             | GitHub #138 and #139 are closed; JSON governance docs reviewed.                                                    | Compliant; this audit marks them superseded/closed.                                                                                                                                                                                                                                                             | Low.                                                                      |
| Run relevant quality gates before completion                                                                   | Required npm gates listed in this document and final report.                                                       | Final docs-only validation completed: `npm ci`, hidden Unicode, format, lint, typecheck, test, contract, security audit at critical threshold, and build passed; `test:postgres-replay` was not run to pass locally because Docker daemon was unavailable after the missing `SIMWAR_TEST_DATABASE_URL` attempt. | Low; Postgres replay remains CI/environment-gated for this local audit.   |
| Do not skip contracts before role UI/runtime                                                                   | `student-role-based-decision-implementation-plan.md`; PR #158 merged role contracts.                               | P2-002 contract slice is already merged; next runtime slices must build on it.                                                                                                                                                                                                                                  | Medium if UI is attempted before resolver and permission checks.          |

## 4. Initial Planning Document Inventory

- AGENTS.md: reviewed as authoritative development governance.
- number of docs reviewed: 69 Markdown/MDX/TXT files were inventoried; the architecture, product, contracts, quality, frontend, roadmap, and audit documents most relevant to this task were opened or searched for direct evidence.
- key planning docs:
  - `DEVELOPMENT_PLAN.md`
  - `docs/product/requirements.md`
  - `docs/product/feature-refinement.md`
  - `docs/product/user-stories.md`
  - `docs/architecture/simwar-architecture-overview.md`
  - `docs/architecture/simwar-architecture-decisions.md`
  - `docs/architecture/student-role-based-decision-refactor.md`
  - `docs/architecture/student-role-based-decision-implementation-plan.md`
  - `docs/architecture/student-role-based-decision-phase-0-audit.md`
  - `docs/architecture/student-role-based-decision-test-strategy.md`
  - `docs/architecture/simwar-development-quality-toolchain-roadmap.md`
  - `docs/architecture/command-path-migration-readiness-audit.md`
  - `docs/contracts/api-contract.md`
  - `docs/contracts/student-rbac-decision-refactor.md`
  - `docs/frontend/teacher-student-architecture.md`
  - `docs/frontend/frontend-state-flow.md`
  - `docs/quality/replay-shadow-replay-test-plan.md`
  - `docs/quality/test-coverage.md`
  - `docs/development/codegraph-mcp-operational-runbook.md`
- docs considered outdated:
  - P2-001 audit statements that `StudentRoleAssignment`, `RoleContext`, `RoleTemplate`, and `RolePermissionPolicy` do not exist are superseded by PR #158.
  - Some architecture docs reference planned `services/api/src/routes/*`, `foundation-services.ts`, and separate replay service files; current runtime is still concentrated in `services/api/src/server.ts`, `repository-facade.ts`, adapters, and `simulation.ts`.
  - Planned pnpm command references remain roadmap-level only; current repo uses npm workspaces and `package-lock.json`.
- docs still authoritative:
  - `AGENTS.md` truth protection, role workflow guardrails, quality gate guidance, and no-unrelated-change rules.
  - Student-role implementation/test strategy docs as roadmap guidance, with PR #158 treated as the completed contract slice.
  - Replay, settlement, Postgres replay, and command-path migration docs where they align with current source/tests.

## 5. Repository Map

- `apps/`: Vite React apps for admin, teacher, and student.
- `services/`: API runtime, repository facade/adapters, simulation boundary, and simulation core.
- `packages/`: shared contracts package consumed by API, apps, tests, schemas, and fixtures.
- `scripts/`: contract checks, hidden Unicode checks, Postgres replay verification harness, migration checks.
- `tests/`: unit, integration, contract, migration, and Postgres replay tests.
- `docs/`: product, architecture, contract, frontend, quality, devops, development, and audit documentation.
- `.github/`: CI, CodeQL, and Dependabot workflows/configuration.

## 6. Current Project Structure Map

- `apps/admin`: single-screen admin cockpit for tenants, users, RBAC roles, permissions, and audit state.
- `apps/teacher`: single-screen teacher cockpit for course/run/team/round lifecycle, settlement, publish, results, and audit visibility.
- `apps/student`: single-screen student dashboard using demo state, direct team decision submission, and learner-trimmed result feedback.
- `services/api`: Node HTTP API with route dispatch in `server.ts`, auth/session helpers, JSON store, repository facade, JSON adapter, Postgres adapter, runtime security config, and settlement orchestration.
- `services/simulation-core`: structured settlement engine boundary, toy logit wellness adapter, market/ops/finance/scoring modules, plugin hooks, and plugin traces.
- `packages/shared-contracts`: source of shared TypeScript interfaces, guards, permission matrices, truth-field guards, role contracts, replay/result contracts, and AI advisory contracts.
- `contracts`: OpenAPI, JSON schemas, and fixtures used by contract checks.
- `db`: SQL migrations for repository persistence and settlement identity constraints.
- `tests`: characterization, contract, replay, Postgres adapter, repository facade/provider, role contract, security, and migration coverage.

## 7. Planned Architecture vs Actual Architecture

| Layer / module        | Planned role                                                                 | Actual current role                                                                          | Drift       | Risk   | Recommendation                                                                 |
| --------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------ |
| SaaS/app layer        | Separate student, teacher, admin workflows with role-specific navigation     | Three Vite apps exist, each as a single main screen without router hierarchy                 | Partial     | Medium | Add routes only after resolver/API contracts are stable.                       |
| Student role workflow | Role assignment, role workspace, role drafts, ready, merge, CEO submit       | Direct team decision submission from `apps/student/src/App.tsx`                              | High        | High   | Continue from PR #158 to read-only resolver before UI mutations.               |
| Teacher assignment    | Teacher assigns and audits business roles                                    | Teacher can create teams and run lifecycle, but no assignment UI/API                         | High        | High   | Add assignment read/write design after read-only context and persistence plan. |
| API/BFF               | Modular route/service/repository layering                                    | `server.ts` still owns dispatch and many workflows; repository facade abstracts persistence  | Partial     | Medium | Avoid broad refactor; add focused role routes/services.                        |
| Shared contracts      | Freeze schema-first Course/Run/Team/Decision/Role/Replay contracts           | Strong shared contracts exist; PR #158 adds role context/assignment contracts                | Low         | Medium | Keep schemas/fixtures/tests as first gate for each role slice.                 |
| Repository/Postgres   | Ports, adapters, migrations, cutover readiness                               | Ports/facade/adapters and migrations exist; JSON remains default runtime                     | Intentional | Medium | Do not force runtime cutover before role resolver proof.                       |
| Settlement/replay     | Structured core truth plus replay manifest/hash                              | Implemented through `simulation.ts`, `simulation-core`, and Postgres replay harness          | Low         | Medium | Ensure role drafts remain excluded from truth hash.                            |
| AI/advisory           | Advisory-only model contracts before real AI                                 | `CoachOutput`/`ModelCallLog` contracts exist; no real model path                             | Intentional | Low    | Keep after role and replay foundations.                                        |
| Quality gates         | CI, hidden Unicode, lint, typecheck, tests, contract, build, Postgres replay | CI runs npm gates and Postgres replay service; local optional scripts differ from older docs | Partial     | Low    | Keep docs aligned with actual `package.json`.                                  |

## 8. Current Runtime Architecture

- student: reads `/api/v1/demo-state`, submits one full `DecisionPayload` to `/api/v1/runs/{runId}/rounds/{roundNo}/decisions`, and displays learner-trimmed result feedback.
- teacher: drives course/team/run/round lifecycle, locks/settles/publishes rounds, reads results, and reviews audit entries.
- admin: manages tenants, users, actor RBAC roles, permission matrix, and audit state.
- API: `services/api/src/server.ts` dispatches auth, admin, course, team, run, round, decision, settlement, result, and audit routes.
- shared contracts: `packages/shared-contracts/src/index.ts` defines domain contracts, permissions, truth guards, replay/result contracts, role contracts, and advisory AI contracts.
- repository / adapter: route-facing `RepositoryFacade` delegates to `SimWarRepositoryProvider` and repository ports; JSON and Postgres adapters exist.
- persistence: JSON snapshot remains default local/runtime path; Postgres adapter and migrations are formalization/testing paths.
- settlement: `runSettlement` loads latest team decisions, calls `prepareSettlementOutcome`, and commits settlement idempotently.
- replay: `calculateSettlement` builds replay input from run/round/scenario/parameter/team decisions/seed and emits replay hash; Postgres replay harness verifies parity.

## 9. Current Decision Flow

1. Student app builds a full `DecisionPayload`.
2. Student app posts to `POST /api/v1/runs/{runId}/rounds/{roundNo}/decisions`.
3. API checks `decision:submit`, tenant/team scope, open round status, payload validation, and truth-protected fields.
4. API writes a validated team `Decision` version through `RepositoryFacade.decisions.saveDecision`.
5. Teacher locks the round.
6. Settlement selects the latest decision version for each team and calls the structured core.
7. Settlement commits `SettlementResult`, replay manifest/hash, state snapshot, domain event, and audit event.
8. Teacher publishes the round.
9. Results endpoint returns full truth to teacher/admin and learner-trimmed own-team observations to students.

No runtime step currently creates or consumes role sections, role drafts, merge commits, team confirmations, or CEO-only final submit.

## 10. Current Role-Adjacent Concepts

| Concept                     | Location                                         | Exists?            | Current semantics                                                                                     | Role-workflow gap                                                            |
| --------------------------- | ------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `TeamMember.role_slot`      | `packages/shared-contracts/src/index.ts`         | Yes                | Member label can be `CEO`, `CFO`, `CMO`, `COO`, or `risk`.                                            | Not tied to runtime assignment resolver or permissions.                      |
| `RoleDecisionSection`       | shared contracts and schema                      | Yes                | Draft/ready section contract exists.                                                                  | Not exposed in API/store/runtime.                                            |
| `DecisionMergeCommit`       | shared contracts and schema                      | Yes                | Validated merge commit contract exists.                                                               | No merge API or persistence path.                                            |
| `TeamConfirmation`          | shared contracts and schema                      | Yes                | Confirmation contract exists.                                                                         | No confirmation API or settlement gate.                                      |
| `Decision.canonical_source` | shared contracts, Postgres adapter, DB migration | Yes                | Allows `legacy_direct` or `role_merge_commit` metadata.                                               | Current direct submit does not set or enforce a canonical source transition. |
| `ROLE_PERMISSION_MATRIX`    | shared contracts                                 | Yes                | Actor RBAC permissions for platform/tenant/teacher/learner/service roles.                             | Not a CEO/CFO/CMO/COO business-role policy.                                  |
| `StudentRoleAssignment`     | shared contracts, schemas, fixtures, tests       | Yes, since PR #158 | Contract binds student/course/run/team/role/status/effective range/audit fields.                      | No repository, route, resolver, or UI yet.                                   |
| `RoleContext`               | shared contracts, schemas, fixtures, tests       | Yes, since PR #158 | Read model for current student business role, assignment, team/course/run, template, and permissions. | No API resolver or student app consumption yet.                              |
| `RoleTemplate`              | shared contracts, schemas, fixtures, tests       | Yes, since PR #158 | MVP role metadata and scope fields.                                                                   | No teacher/admin editing or scenario binding yet.                            |
| `RolePermissionPolicy`      | shared contracts, schemas, fixtures, tests       | Yes, since PR #158 | Business-role action/field policy with truth-field guard.                                             | Not wired into runtime authorization.                                        |

## 11. Initial Functional Planning vs Current Implementation

| Planned capability                                     | Source document                                                                 | Planned scope                                                                                    | Current implementation evidence                                                                   | Test coverage                                 | Status                  | Gap                                                 | Recommended next task                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| Student workflow                                       | `docs/product/user-stories.md`, `docs/frontend/teacher-student-architecture.md` | Student joins course/team, receives role, works in role workspace, submits inputs, sees feedback | `apps/student/src/App.tsx` demo state, direct team decision submit, learner result view           | Integration decision/result tests             | Partially implemented   | No routing, role context, role workspace, or drafts | P2-003 resolver, then route skeleton                   |
| Teacher workflow                                       | `docs/product/requirements.md`, frontend docs                                   | Create courses/teams/runs, assign roles, monitor progress, review results                        | `apps/teacher/src/App.tsx`, `server.ts` course/team/run/round/settlement routes                   | P0 flow and lifecycle tests                   | Partially implemented   | No role assignment/readiness dashboard              | Add teacher assignment after resolver/persistence plan |
| Admin / tenant / user / RBAC                           | Product docs, P1 auth docs                                                      | Tenant/user/RBAC cockpit                                                                         | `apps/admin/src/App.tsx`, auth/RBAC routes, `ROLE_PERMISSION_MATRIX`                              | P1 auth/RBAC integration tests                | Implemented             | Business roles separate from actor RBAC             | Keep separation explicit                               |
| Course                                                 | Roadmap and API contract docs                                                   | Course lifecycle with publish checks                                                             | `Course` contracts, server routes, repository ports                                               | P0/P1 integration tests                       | Partially implemented   | Minimal domain rules                                | Continue small lifecycle hardening                     |
| Run                                                    | Roadmap and API contract docs                                                   | Run creation and round progression                                                               | `Run` contracts, `createRun`, teacher app                                                         | P0 flow tests                                 | Partially implemented   | Limited multi-round UX                              | Preserve current contracts                             |
| Team                                                   | Product and role docs                                                           | Teams with members and role slots                                                                | `Team`, `TeamMember.role_slot`, create team route                                                 | P0/P1 tests                                   | Partially implemented   | No assignment lifecycle                             | Role assignment repository/API later                   |
| Decision                                               | Decision and settlement docs                                                    | Canonical decision from validated team flow                                                      | `submitDecision`, `DecisionPayload`, schemas                                                      | Decision characterization, contract tests     | Partially implemented   | Still direct team submit; no role merge chain       | Keep backward-compatible legacy path                   |
| Role / Role Context / Role Assignment                  | Student role implementation plan                                                | Contracts before resolver/runtime                                                                | `StudentRoleAssignment`, `RoleContext`, schemas, fixtures, `role-contracts.test.ts`               | Unit role contract tests, contract check      | Implemented             | Runtime resolver absent                             | P2-003                                                 |
| Team role collaboration / role draft / role submission | Role refactor docs                                                              | Role sections, ready state, merge input                                                          | `RoleDecisionSection` contract/schema                                                             | Contract checks only                          | Document-only           | No API/store/UI                                     | P2-005/P2-006 after resolver                           |
| CEO final submit                                       | Role refactor docs                                                              | CEO creates merge and submits canonical decision                                                 | `RolePermissionPolicy.CEO` allows merge/canonical flags                                           | Role contract test                            | Partially implemented   | No runtime guard or endpoint                        | P2-008 after merge contract/runtime                    |
| Round lock / deadline / lifecycle                      | Architecture docs                                                               | Draft/open/locked/settled/published                                                              | server lifecycle routes and guards                                                                | Round lock/publish characterization tests     | Partially implemented   | No role readiness lock precheck                     | Add readiness gate after role submissions              |
| Settlement                                             | Settlement docs                                                                 | Structured core is truth source                                                                  | `runSettlement`, `simulation.ts`, `simulation-core`                                               | Simulation-core, integration, Postgres replay | Implemented             | Must adapt to role canonical source later           | Do not change until merge chain exists                 |
| Replay / shadow replay / audit replay                  | Replay quality plan                                                             | Manifest/hash/diff/shadow replay                                                                 | Replay manifest/hash and Postgres replay harness                                                  | Contract and Postgres replay tests            | Partially implemented   | Shadow replay remains roadmap                       | Keep role drafts excluded                              |
| Teacher review dashboard                               | Frontend docs                                                                   | Monitor teams, results, audit, role progress                                                     | Teacher app shows lifecycle/results/audit                                                         | P0 flow tests                                 | Partially implemented   | No role readiness/assignment dashboard              | Add after role APIs                                    |
| Learning feedback / role-aware feedback                | Product/user story docs                                                         | Feedback by role and learning objective                                                          | Result endpoint returns trimmed learner view                                                      | Result characterization tests                 | Partially implemented   | No role-aware feedback contract/runtime             | P2-009                                                 |
| Repository facade / repository ports                   | Architecture docs                                                               | Read/write ports and facade                                                                      | `repository-ports.ts`, `repository-facade.ts`, adapters                                           | Unit adapter/facade/provider tests            | Implemented             | No role assignment port                             | Add when persistence slice begins                      |
| Postgres adapter / migration / runtime cutover         | Post persistence docs                                                           | Adapter parity and future cutover                                                                | `postgres-repository-adapter.ts`, `db/migrations`, replay harness                                 | Postgres adapter and replay tests             | Partially implemented   | Runtime default remains JSON by design              | No cutover for P2-003                                  |
| JSON snapshot persistence / migration / recovery / CAS | #138/#139, persistence docs                                                     | Governance for JSON snapshot safety                                                              | JSON store, startup/recovery characterization                                                     | JSON snapshot startup tests                   | Deprecated / superseded | Closed governance line                              | Do not reopen absent bug                               |
| AI / competitor AI / role-aware AI advisor             | AI contract docs                                                                | Advisory-only schema/logging before real model                                                   | `CoachOutput`, `ModelCallLog`, schemas                                                            | Contract checks                               | Document-only           | No real AI integration by design                    | Keep after role/replay                                 |
| Scenario package / parameter set / seed                | Architecture docs                                                               | Bound scenario/parameters/seed for replayable settlement                                         | `ScenarioPackage`, `ParameterSet`, replay input                                                   | Simulation/replay tests                       | Partially implemented   | Minimal scenario management UX                      | Keep plugin boundary tests                             |
| Plugin / industry module                               | Plugin docs                                                                     | Industry plugins with auditable hooks                                                            | `services/simulation-core` wellness toy logit and traces                                          | Simulation-core tests                         | Partially implemented   | External plugin package path minimal                | Do not expand in role PRs                              |
| Security / tenant isolation                            | Security and auth docs                                                          | Actor scope, tenant boundary, audit                                                              | auth/session, server guards, admin RBAC                                                           | P1 auth/RBAC, security tests                  | Partially implemented   | Business role permission runtime absent             | Add role resolver authorization                        |
| Contract tests / OpenAPI / schema                      | Contract docs                                                                   | Schema/OpenAPI drift gates                                                                       | `contracts/schemas`, fixtures, `scripts/check-contracts.mjs`                                      | `npm run test:contract`                       | Partially implemented   | OpenAPI lacks role-context endpoints                | Add endpoint contracts with P2-003                     |
| CI quality gates                                       | Quality roadmap, `.github/workflows/ci.yml`                                     | CI npm gates plus Postgres replay                                                                | CI workflow runs install, hidden Unicode, lint, typecheck, test, Postgres replay, contract, build | Workflow evidence                             | Partially implemented   | No local `quality`, no coverage gate script         | Align docs/scripts before claiming                     |
| CodeGraph / MCP / Understand Anything governance       | CodeGraph runbook, AGENTS.md                                                    | Use graph tools for high-risk architecture review                                                | CodeGraph CLI initialized; MCP/UA unavailable                                                     | Audit evidence only                           | Partially implemented   | Tool availability varies by environment             | Record fallback honestly                               |

## 12. Superseded or Closed Planning Items

| Planning item                                                    | Original source              | Superseded by                                      | Current status                        | Do we reopen?                     |
| ---------------------------------------------------------------- | ---------------------------- | -------------------------------------------------- | ------------------------------------- | --------------------------------- |
| JSON snapshot writer CAS/concurrency blocker                     | GitHub #138                  | Closed issue and current runtime no-CAS strategy   | Closed                                | No                                |
| JSON snapshot migration/recovery blocker                         | GitHub #139                  | Closed issue and startup/recovery characterization | Closed                                | No                                |
| P2-001 claim that RoleContext/StudentRoleAssignment do not exist | P2-001 audit                 | PR #158                                            | Superseded                            | No                                |
| P2-002 as future next task                                       | P2-001 audit                 | PR #158 merge on origin/master                     | Superseded                            | No                                |
| Runtime persist CAS/distributed lock as mandatory next step      | Early persistence planning   | Post-persistence governance checkpoint             | Current stage intentionally avoids it | Only with new product requirement |
| pnpm command assumptions                                         | Older roadmap command tables | Current `package.json` and `package-lock.json`     | npm is current package manager        | No                                |
| Separate route-file architecture as current fact                 | Some architecture docs       | Current `services/api/src/server.ts` dispatch      | Stale/planned                         | Only with new product requirement |
| Direct P2 UI implementation before contracts/resolver            | Product/frontend plans       | AGENTS.md and role implementation plan             | Unsafe ordering                       | No                                |

## 13. Missing Role Workflow Concepts

| Missing concept                          | Needed for                                         | Current evidence                                       | Recommended PR                          |
| ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------------ | --------------------------------------- |
| StudentRoleAssignment runtime store      | Persisting effective business role assignment      | Contract/schema exists; no repository port/table/route | Post-P2-003 persistence slice           |
| RoleContext resolver endpoint            | Read-only student role-aware runtime entry         | Contract/schema exists; no OpenAPI or API route        | P2-003                                  |
| RoleTemplate runtime source              | Template lookup and role workspace metadata        | Defaults exist in shared contracts                     | P2-003 or P2-004 read-only source       |
| RolePermissionPolicy runtime enforcement | Business-role action and editable-field guards     | Contract guard rejects truth fields                    | P2-003 read-only, P2-005 mutation guard |
| RoleDraft                                | Saving role section work                           | `RoleDecisionSection` exists but no store/API          | P2-005                                  |
| RoleSubmission                           | Ready state and validated section submit           | `RoleDecisionSection.status` exists                    | P2-006                                  |
| TeamDecisionDraft / merge                | Combining role sections before canonical decision  | `DecisionMergeCommit` exists                           | P2-007                                  |
| CEO final confirmation                   | Only CEO/team captain finalizes canonical decision | `RolePermissionPolicy.CEO` flags exist                 | P2-008                                  |
| role-aware feedback                      | Showing feedback by role without truth leakage     | Result trimming exists but not role-aware              | P2-009                                  |

## 14. Student Workflow Gap Analysis

The student app is real and usable for the current P0/P1 loop, but it is still a direct team-decision dashboard. It has no `createBrowserRouter`, no role route, no role context fetch, no role workspace, no role section editing, no ready state, and no CEO-only final submit path. This is compatible with current settlement but does not implement the planned role workflow.

## 15. Teacher/Admin Workflow Gap Analysis

Teacher can operate the course/run/round/settlement loop and view results/audit, but cannot assign CEO/CFO/CMO/COO roles or inspect per-role readiness. Admin manages actor RBAC roles and tenant/user scope, but not business-role templates or student role assignments. Actor RBAC and business-role workflow must remain separate.

## 16. API and Contract Gap Analysis

Contracts now include role context and assignment types, schemas, fixtures, and unit tests. OpenAPI still exposes the P0/P1 direct decision and settlement loop only. There is no `GET role-context`, role workspace route, role draft route, role merge route, team confirmation route, or teacher assignment endpoint.

## 17. Repository / Persistence Gap Analysis

The repository facade, ports, JSON adapter, Postgres adapter, and migrations support core tenant/user/course/team/run/round/decision/settlement/audit/replay paths. They do not yet provide a role assignment port, role draft port, merge commit port, or confirmation port. P2-003 can remain read-only and derived; durable assignment persistence should be a later, explicit PR.

## 18. Permission and Audit Gap Analysis

Actor permissions protect current API access. Business-role permissions exist as `RolePermissionPolicy` contracts but are not runtime authorization. There is no audit event for role assignment, role draft save, ready state, merge, or CEO final confirmation. Future role APIs need both actor checks and business-role policy checks.

## 19. Settlement / Replay / Feedback Gap Analysis

Settlement consumes latest team decisions and writes structured results plus replay hashes. Role drafts, assignments, advisories, and learning evidence are excluded because they do not exist in runtime. When role workflow is added, only the confirmed canonical decision should enter settlement; role artifacts should be governance context or explicitly excluded from truth hash.

## 20. Test Coverage Gap Analysis

Current tests cover shared role contracts, core decision submission, round lock/publish, settlement replay hash, audit append, auth/RBAC, repository adapters/facade/provider, JSON startup, migrations, Postgres adapter, Postgres replay, and simulation-core. Missing tests include role context resolver, role assignment authorization, role workspace route, role draft mutation, merge commit, CEO final submit guard, role-aware result trimming, OpenAPI role endpoints, and UI route smoke tests.

## 21. P2 Roadmap Validation

P2-001 correctly identified the main student role workflow gap, but it is now partly superseded by PR #158. P2-002 should no longer be treated as pending because `StudentRoleAssignment`, `RoleContext`, `RoleTemplate`, `RolePermissionPolicy`, schemas, fixtures, and unit tests are already merged. The next small safe slice is P2-003: add a read-only role context resolver/API contract and tests, without UI mutation, settlement changes, or Postgres runtime cutover.

## 22. P2-002 Readiness Reassessment

P2-002 COMPLETE — ROADMAP ADJUSTED TO P2-003

P2-002 was the right next task after P2-001, and origin/master now contains it through PR #158. The roadmap adjustment is to stop treating P2-002 as pending and proceed to P2-003 read-only role context resolver.

- Why not first do UI: the student app cannot safely branch by business role until a trusted resolver returns role context and permissions.
- Why not first do teacher role assignment UI: there is no assignment persistence/API path yet; a UI would invent state outside the governed contracts.
- Why not first do CEO final submit: CEO authority depends on role context, role sections, merge commits, and confirmation contracts being wired in order.
- Why not first do DB migration: P2-003 can be read-only/derived; durable role assignment storage should be introduced only when the runtime write path is specified.
- Why not first do Postgres runtime cutover: JSON remains the current default runtime and Postgres replay parity is a separate governance line.
- Why role context / assignment contracts were the minimum safe step: they are now merged, strict, versioned, schema-backed, fixture-backed, and truth-field guarded; the next minimum step is to expose them through a read-only resolver.

## 23. Adjusted Roadmap

1. P2-003 - Add read-only student role context resolver and OpenAPI/contract tests.
2. P2-004 - Add student role workspace route skeleton consuming read-only context, with no draft mutation.
3. P2-005 - Add role draft/section save contract and tests.
4. P2-006 - Add role submission/ready contract and authorization tests.
5. P2-007 - Add team decision merge contract/runtime skeleton that emits canonical decision metadata.
6. P2-008 - Add CEO final submit permission guard and legacy direct-submit compatibility tests.
7. P2-009 - Add role-aware settlement feedback skeleton with truth-field trimming tests.
8. P2-010 - Add teacher role assignment audit/UI planning after assignment persistence is designed.

## 24. Explicit Non-Goals

- No production code changes.
- No test, script, migration, package, CI, dependency, API runtime, or UI changes.
- No role resolver implementation.
- No role workspace implementation.
- No role draft, merge, CEO submit, teacher assignment, settlement, replay, Postgres, or AI implementation.
- This audit is delivered as an independent documentation-only pull request, with no production/runtime implementation, test, script, contract, migration, package, CI, API, or UI change introduced.

## 25. Final Recommendation

P2-002 COMPLETE — ROADMAP ADJUSTED TO P2-003

P2-001A should be treated as a corrective deep audit over P2-001: the system is ready to continue role workflow work, and the exact next task is no longer P2-002 because PR #158 already completed the role contract layer. Proceed with P2-003 as a read-only role context resolver/API contract slice, preserving direct decision compatibility and truth/replay boundaries.
