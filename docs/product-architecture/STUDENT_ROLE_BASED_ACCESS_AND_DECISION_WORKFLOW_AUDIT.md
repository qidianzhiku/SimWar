# Student Role-Based Access and Decision Workflow Audit

## 1. Baseline

- origin/master commit: `d4203e2c315a1b19640ec873d34ed24b5a003ea2`
- branch/worktree: `codex/p2-001-student-role-workflow-audit` at `D:\codex\SimWar-p2-001-student-role-workflow-audit`
- audit date/time: `2026-06-22T15:33:46.8007955+08:00`
- P2-000 status: PR #156 is merged; `13cdb9bcd140aa5852c6daddca2742e6ff9c65ed` is an ancestor of `origin/master`
- #138 status: CLOSED
- #139 status: CLOSED
- CodeGraph status: `.codegraph/` is not present in this worktree and `codegraph status` reports the project is not initialized; this audit used `rg` plus source, contract, test, and documentation review as the equivalent source-callgraph review.

## 2. Current System Map

### Apps

- `apps/student/src/App.tsx` is an independent student app entry, but it is a single dashboard component rather than a routed student workflow.
- `apps/teacher/src/App.tsx` is an independent teacher app entry for the P0 run lifecycle.
- `apps/admin/src/App.tsx` is an independent admin app entry for tenant and user administration.

### Services

- `services/api/src/server.ts` owns the current HTTP routes for auth, demo state, courses, teams, runs, rounds, decisions, settlement, results, and admin state.
- `services/api/src/store.ts` owns the in-memory and JSON snapshot store shape.
- `services/api/src/repository-ports.ts`, `services/api/src/json-repository-adapter.ts`, and `services/api/src/repository-facade.ts` define the repository boundary currently used by route handlers and settlement persistence.

### Shared Contracts

- `packages/shared-contracts/src/index.ts` already defines `TeamMember.role_slot`, `RoleDecisionSection`, `DecisionMergeCommit`, `TeamConfirmation`, and `Decision.canonical_source`.
- `contracts/schemas/role-decision-section.v1.json`, `contracts/schemas/decision-merge-commit.v1.json`, and `contracts/schemas/team-confirmation.v1.json` exist with matching fixtures.
- There is no runtime route, store collection, repository port, or app UI using those role-based decision objects yet.

### Routes

Current implemented route families include:

- `POST /api/v1/auth/login`
- `GET /api/v1/demo-state`
- `GET/POST /api/v1/courses`
- `POST /api/v1/courses/{courseId}/teams`
- `POST /api/v1/courses/{courseId}/runs`
- `POST /api/v1/runs/{runId}/rounds/{roundNo}/start`
- `POST /api/v1/runs/{runId}/rounds/{roundNo}/decisions`
- `POST /api/v1/runs/{runId}/rounds/{roundNo}/lock`
- `POST /api/v1/runs/{runId}/rounds/{roundNo}/settle`
- `POST /api/v1/runs/{runId}/rounds/{roundNo}/publish`
- `GET /api/v1/runs/{runId}/rounds/{roundNo}/results`

No current OpenAPI or server route exists for role context, role sections, role submissions, team decision merge, or team confirmation.

### Data Objects

Runtime store collections currently include tenants, users, RBAC objects, sessions, scenarios, parameter sets, courses, teams, runs, rounds, decisions, settlement results, audit logs, and counters.

Runtime store collections do not include:

- role decision sections
- decision merge commits
- team confirmations
- student role assignments as first-class objects
- role permission policies
- role workspace snapshots

### Decision Flow

The current implemented flow is:

```text
student login
-> student app loads demo state
-> app identifies current_user.team_id
-> app posts a full team decision payload
-> API validates permission, team ownership, round status, and payload
-> API saves a Decision with canonical_source=legacy_direct
-> teacher locks the round
-> settlement reads the latest Decision version per team
```

### Settlement Flow

Settlement currently runs after lock, finds the latest submitted decision per team directly from the store, and fails if a team has no decision. Results are role-trimmed at query time: teacher/admin style actors can see truth fields, while learners only see their own team result without `state_true`.

## 3. Current Student Workflow

- Student app exists: yes, `apps/student/src/App.tsx`.
- Current student routes: no client-side router was found; the app is one dashboard screen.
- Dashboard/course/run entry: partially present through `GET /api/v1/demo-state`; the app displays the first course and latest run/round but does not provide a course picker or run picker.
- `course_id` / `run_id` / `team_id`: partially present. The app derives run and team from demo state and `current_user.team_id`; it does not expose explicit role-aware selection.
- `role_id` or role context: missing. The app displays actor roles from auth, but not business role context such as CEO/CFO/CMO/COO.
- Decision form: present as one full team decision form.
- Decision submission: present through `POST /api/v1/runs/{runId}/rounds/{roundNo}/decisions`.
- Settlement / feedback / replay: partial. The app shows the learner's own settlement feedback when results exist; it does not show role-specific feedback, replay QA, or role contribution analysis.

## 4. Current Teacher/Admin Workflow

### Teacher

- Course management: minimal. Teacher app displays the demo course and can create a run for `course_demo`; broad course creation and editing UI were not found.
- Run management: present for the P0 lifecycle. Teacher app can create run, start round, lock round, settle, and publish.
- Team management: read-only in the current app screen. API has a team creation route, but the teacher app does not expose full team management.
- Student-to-team assignment: no teacher UI found.
- Role assignment: no teacher UI or API found for assigning CEO/CFO/CMO/COO beyond the existing `TeamMember.role_slot` field in team data.
- Team decision review: partial. Teacher app sees whether any decision exists and sees results, but does not show role drafts, readiness, merge commits, or confirmation history.
- Override / lock round: lock, settle, and publish are present. Override decision or role merge override was not found.
- Role policy / permission UI: missing.

### Admin

- Tenant and user management exist in `apps/admin/src/App.tsx`.
- Admin role options are platform/system roles such as `tenant_admin`, `teacher`, `learner`, `team_captain`, and `scenario_designer`.
- No course/run/team business-management UI was found in the admin app.
- No CEO/CFO/CMO/COO role assignment or role permission policy UI was found.

## 5. Current Decision Submission Workflow

### Current True Flow

```text
student actor
-> owns current_user.team_id
-> submits full DecisionPayload while the round is open
-> API writes a validated legacy_direct Decision version
-> same team can submit additional versions before lock
-> teacher locks round
-> settlement consumes latest Decision version for each team
-> settlement writes SettlementResult and round state
-> learner result query returns own team and hides state_true
```

Who creates decisions:

- Any actor with `decision:submit` and a matching `actor.team_id` can create a team decision for the open round.

Who edits decisions:

- There is no edit endpoint. Repeated submissions create additional `Decision.version` entries while the round remains open.

Who submits decisions:

- Learner/student/team captain style actors can submit for their own `team_id`. Cross-team submission is blocked.

Who can overwrite decisions:

- No in-place overwrite was found in the API route. However, repeated submissions before lock create later versions, and settlement currently uses the latest version.

When settlement reads decisions:

- Settlement reads after round lock and picks the latest stored decision per team for the target run and round.

Where audit/history exists:

- `decision.submit`, round lifecycle, settlement, and admin/user operations append audit log entries. There is no role draft, merge, or team confirmation audit path yet.

### Target Role-Based Flow

```text
login
-> course
-> run/team
-> role context
-> role workspace
-> role draft
-> role submission
-> team merge
-> CEO final submit
-> round lock
-> settlement
-> role feedback
```

The target flow is not implemented at runtime. It is described in architecture documents and partially represented by shared contracts and JSON schemas.

## 6. Current Role / Permission / Assignment Support

| Capability            | Exists?                      | Evidence                                                                             | Gap                                                                                                                   |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| StudentRoleAssignment | No                           | No runtime type, schema, route, store collection, or repository port found.          | Need a first-class assignment contract binding user, course/run/team, role, effective dates/status, and audit fields. |
| RoleTemplate          | No                           | Role names appear as `TeamMember.role_slot`, but no reusable template object exists. | Need role template contract if role fields, labels, and defaults must vary by scenario/course.                        |
| RolePermissionPolicy  | No                           | `ROLE_PERMISSION_MATRIX` is actor-role based, not business-role field policy.        | Need a policy model for CEO/CFO/CMO/COO read/write fields and final-submit authority.                                 |
| RoleDraft             | Partial under different name | `RoleDecisionSection` type/schema/fixture exists.                                    | No runtime route, store collection, repository port, UI, or audit path.                                               |
| RoleSubmission        | Partial under different name | `RoleDecisionSection.status` supports `draft` and `ready`.                           | No submission command or ready-state transition endpoint exists.                                                      |
| TeamDecisionDraft     | Partial under different name | `DecisionMergeCommit` type/schema/fixture exists with `merged_payload`.              | No merge command, persistence, validation route, or teacher/student UI.                                               |
| DecisionVersion       | Partial                      | `Decision.version` exists and tests cover repeated submissions as versions.          | No separate decision-version aggregate or role-chain version history.                                                 |
| RoleContribution      | No                           | No runtime type/schema/route found.                                                  | Needed for role-aware feedback and learning evidence that remains outside settlement truth.                           |
| RoleContext           | No                           | Architecture docs discuss `RoleContext`; source/contracts do not implement it.       | Need read-only resolver contract before UI or mutations.                                                              |
| TeamRole              | Partial under different name | `TeamMember.role_slot` supports `CEO`, `CFO`, `CMO`, `COO`, and `risk`.              | It is embedded in team member data, not a full assignment or permission model.                                        |

## 7. Target Role-Based Workflow

The next implementation line should preserve the settlement truth boundary:

```text
student login
-> select course
-> enter run/team
-> resolve role context
-> enter role workspace
-> save role draft
-> submit role section as ready
-> team merge creates DecisionMergeCommit
-> CEO or authorized role confirms final team decision
-> canonical Decision is created from confirmed merge
-> settlement consumes only the canonical Decision
-> role feedback reads contribution context without changing truth
```

The canonical chain should remain:

```text
RoleDecisionSection(status=draft/ready)
-> DecisionMergeCommit(status=validated)
-> TeamConfirmation(status=confirmed)
-> canonical Decision
-> official settlement
```

Role drafts, learning evidence, and role feedback must not enter settlement truth or replay truth hashes unless they become explicitly approved canonical inputs.

## 8. Gap Analysis

### P0 Blockers

- No `RoleContext` contract, resolver, route, or app integration exists.
- No first-class student role assignment contract exists.
- Role-based decision objects exist only as contracts/schemas/fixtures, not runtime persistence or API flows.
- Student app submits a full team decision directly instead of role sections.
- Settlement consumes the latest direct team decision, not a confirmed role-merge chain.

### P1 Required

- Teacher role assignment and role readiness review are missing.
- CEO or authorized-role final submit guard is missing.
- Role permission policy is missing.
- Role draft save/ready endpoints and audit events are missing.
- Merge and team confirmation endpoints are missing.
- Contract and integration tests for role context, role drafts, merge, confirmation, and final canonical decision creation are missing.

### P2 Enhancement

- Role-specific learning feedback and contribution reports are not implemented.
- Role switching cache clearing behavior is not defined.
- Student course/run/team navigation is still demo-state driven.
- Admin UI does not manage business role templates or policies.

### Later

- Extended roles such as CHRO, CRO, and CTO.
- UI role dashboards beyond skeleton workflow.
- Postgres runtime adapter mapping for role workflow objects.
- Browser E2E coverage once routes and UI exist.

## 9. Proposed P2 Implementation Roadmap

| PR     | Name                                              | Scope                                                                                                                         |
| ------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| P2-002 | Define role context and role assignment contracts | Add or align shared contracts, schemas, fixtures, and docs for role context and student role assignment. No runtime mutation. |
| P2-003 | Add read-only role context resolver               | Add API/service resolver that returns course/run/team/role context for the current student. No role draft writes.             |
| P2-004 | Add student role workspace route skeleton         | Add student route shell and read-only role workspace state. No draft save yet.                                                |
| P2-005 | Add role draft contract and tests                 | Wire `RoleDecisionSection` persistence and draft/ready commands with tests.                                                   |
| P2-006 | Add team decision merge contract                  | Add merge command and `DecisionMergeCommit` runtime storage/tests.                                                            |
| P2-007 | Add CEO final submit permission guard             | Add `TeamConfirmation` path and create canonical `Decision` only after authorized confirmation.                               |
| P2-008 | Add role-aware settlement feedback skeleton       | Add read-only role contribution/feedback envelope that does not affect settlement truth.                                      |
| P2-009 | Add teacher role assignment audit / UI planning   | Audit and plan teacher-side assignment, readiness, and policy UI.                                                             |

Recommended first PR:

```text
P2-002 - Define role context and role assignment contracts
```

Reason: current runtime has enough direct decision and settlement behavior to audit, but it lacks the contract boundary needed to safely distinguish actor roles, team roles, role permissions, and canonical decision truth.

## 10. Explicit Non-Goals

This audit does not implement:

- role login
- role permissions
- role drafts
- CEO submit
- team merge
- UI changes
- database migrations
- Postgres cutover
- settlement math changes
- replay hash changes
- production API behavior changes
- test behavior changes

## 11. Validation

Validation results for this audit:

| Command                                                                                       | Result             | Notes                                                                                                                  |
| --------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `gh pr view 156 --repo qidianzhiku/SimWar --json number,state,mergedAt,mergeCommit,title,url` | PASS               | PR #156 is MERGED.                                                                                                     |
| `git merge-base --is-ancestor 13cdb9bcd140aa5852c6daddca2742e6ff9c65ed origin/master`         | PASS               | P2-000 commit is an ancestor of `origin/master`.                                                                       |
| `gh issue view 138 --repo qidianzhiku/SimWar --json number,state,title,url`                   | PASS               | #138 is CLOSED.                                                                                                        |
| `gh issue view 139 --repo qidianzhiku/SimWar --json number,state,title,url`                   | PASS               | #139 is CLOSED.                                                                                                        |
| `codegraph status`                                                                            | PASS_WITH_FALLBACK | `.codegraph/` is absent; used `rg` plus source review.                                                                 |
| `rg` source and contract review                                                               | PASS               | Reviewed student, teacher, admin, API, shared contracts, schemas, fixtures, tests, and docs.                           |
| `npm ci`                                                                                      | PASS               | Installed declared npm workspace dependencies; existing advisories remain.                                             |
| `npm run check:hidden-unicode`                                                                | PASS               | No hidden Unicode control characters found.                                                                            |
| `npm run format:check`                                                                        | PASS               | Passed after formatting this audit document.                                                                           |
| `npm run lint`                                                                                | PASS               | ESLint passed.                                                                                                         |
| `npm run typecheck`                                                                           | PASS               | TypeScript project references passed.                                                                                  |
| `npm test`                                                                                    | PASS               | 25 files / 419 tests passed.                                                                                           |
| `npm run test:contract`                                                                       | PASS               | Contract baseline files and P0/P1 paths are present.                                                                   |
| `npm run security:audit`                                                                      | PASS               | Passed at repository critical threshold; existing non-critical advisories remain.                                      |
| `npm run build`                                                                               | PASS               | All workspaces built.                                                                                                  |
| `npm run test:postgres-replay`                                                                | PASS               | First run without `SIMWAR_TEST_DATABASE_URL` failed as expected; rerun with disposable PostgreSQL 16 passed, 18 tests. |

## 12. Final Recommendation

READY FOR P2-002 ROLE CONTRACTS
