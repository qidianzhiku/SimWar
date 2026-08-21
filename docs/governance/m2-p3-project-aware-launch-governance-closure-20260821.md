# SimWar M2-P3 project-aware Course launch governance closure

Date: 2026-08-21

Mission: `SIMWAR-SH-M2-P3-PROJECT-AWARE-LAUNCH-V5.14-20260821`

Target outcome: `PROJECT_AWARE_COURSE_LAUNCH_STUDENT_ENTRY_READY`

## Closure decision

`PASS_WITH_LIMITS` for the authorized M2-P3 project-aware Course launch scope.

This closure records the corrective Product PR #426 and its exact post-merge
readback. Earlier PR #422 and Governance PR #423 are retained as historical
M2-P3 attempts; this closure does not conceal or relabel them. PR #426 is the
single corrective Product PR for this V5.14 execution, and this document is the
single docs-only Governance Closure for that execution.

The Product PR was merged only after the exact head passed the required GitHub
quality, browser-smoke, JavaScript/TypeScript analysis and CodeQL checks, all
review conversations were resolved, and the merge was performed through the
ordinary non-admin, non-auto, non-force path.

## Exact Product and source readback

- Product PR: [#426](https://github.com/qidianzhiku/SimWar/pull/426)
- Product head before merge: `4101cbe4a1cf55585fcb3286e6cbdc6e652eab8d`
- Product PR base at merge: `a53c057b9c7416fb5b17434a69f90707d7f8d4e7`
- Product merge commit: `c0ee529ed3bc9d9c61e0df4f7a5e59784ab1bfb1`
- Product merge tree: `44a653ec3c084df4ced4bdaf3ecd978e24295548`
- Fresh detached post-merge worktree: `D:\codex\SimWar-m2-p3-v514-postmerge-20260821`
- Current planning pointer before this docs-only merge: `c0ee529ed3bc9d9c61e0df4f7a5e59784ab1bfb1`
- Final governance merge SHA and final `origin/master` are recorded in the
  final detached readback receipt because this document is the commit being
  merged by the Governance PR.

## Delivered Product scope

- Teacher readiness is derived from the exact tenant/Course/Run/Team scope and
  reports `BLOCKED`, `STALE`, `DEGRADED`, `READY`, or `UNKNOWN_VERIFYING`.
- Every blocker is an evidence-bound public DTO with `blocker_id`, `category`,
  `code`, `reason`, `impact`, `source_authority`, `owner`, `action`,
  `recovery_action`, `freshness`, `evidence_ref`, and optional `waiver_policy`.
  `blocker_id` is stable and unique within one readiness projection. A scope
  failure identifies the actual failing Course, Run, or ProjectProfile check;
  it does not use a generic Course label for every failure.
- Launch consumes the existing formal Run authority and requires an active Run,
  an open opening Round, exact validated ProjectProfile references, complete
  role assignments, and an authoritative formal binding.
- Repeated launch commands are idempotent only for the exact same tenant,
  Course, Run and derived team set; a changed team set is rejected.
- Student context is derived from the existing role-safe authority and returns
  only the enrolled student's exact project, role and run context. Cross-team
  access is denied with HTTP 403.
- Admin audit remains tenant-scoped and read-only; it exposes launch/readiness
  lineage without becoming a new runtime or settlement authority.
- The only Product mutation files were the project-aware shared contract,
  OpenAPI contract, service, focused contract/unit/integration/browser tests,
  and the related design specification. No settlement, Replay truth, provider,
  model, or unrelated application authority was added.

## Authority delta and reuse decision

The existing Course, Run, Round, ProjectProfile, ProjectAssignment,
FormalCourseAuthorityBinding, ProjectLibrary, RoleWorkflow, W4 initial-state,
Student BFF and tenant-scoped Admin audit paths remain the authorities and
writers for their respective domains. The M2-P3 layer is a readiness and
orchestration projection only. It does not write a second Course, Run, role,
EnterpriseState, settlement, score, rank, replay input, provider, or model
registry.

The exact matched-arena fixture uses:

- tenant `tenant_demo`, Course `course_demo`;
- Run `run_m2_p3_project_aware_browser`, opening Round
  `round_m2_p3_project_aware_browser`;
- ProjectProfile `shanghai-project-m2-p3-browser`, version `2026-08-21.1`,
  digest `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
- ProjectAssignment IDs `project-assignment-m2-p3-team_alpha` and
  `project-assignment-m2-p3-team_beta`;
- the same exact ProjectProfileRef for both teams;
- two distinct opening W4 `enterprise_state_id` values and two distinct
  `state_digest` values, both scoped to the same exact Run/Round and team;
- zero opening decisions and zero opening outcomes; and
- no other-team data in either opening state.

The integration and browser evidence assert those exact references and
relationships. The generated W4 state IDs/digests are intentionally read from
the live store and checked for pairwise distinctness rather than copied into a
static governance fixture.

## Blocker and recovery contract

The public blocker contract is defined in the shared type and OpenAPI schema
and documented in the project-aware design specification. The required fields
have these governance meanings:

| Field                        | Governance meaning                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `blocker_id`                 | Stable unique identity for the failed condition in the projection                        |
| `category`                   | Failed domain: Course, Run, Round, assignment, profile, role workflow, or formal binding |
| `reason` / `impact`          | Human-readable cause and launch consequence                                              |
| `source_authority`           | Existing authority that must be inspected or repaired                                    |
| `owner` / `recovery_action`  | Accountable actor and explicit legal recovery path                                       |
| `freshness` / `evidence_ref` | Snapshot/reference freshness and exact scoped evidence locator                           |
| `waiver_policy`              | Optional metadata only; never an implicit launch approval                                |

Missing, stale, retired, conflicting, or scope-invalid references stop launch.
There is no implicit `latest`, `current`, `default`, automatic successor
rebind, or destructive historical overwrite. A successor can be informational;
legal rebind must be explicit and must go through the existing authority.

## Student and Admin acceptance

The real-BFF journey verifies the following sequence with mocks disabled:

1. Teacher reads blocked readiness for the initially incomplete assignment.
2. Teacher uses the exact ProjectProfileRef for both teams.
3. Readiness becomes `READY` for the exact Course/Run/Team scope.
4. Teacher launches once through the existing formal authority.
5. Receipt readback returns the same audit identity and exact team set.
6. Team Alpha and Team Beta each receive their own safe project/role context.
7. Student Alpha requesting Team Beta receives HTTP 403.
8. Admin receives only the tenant-scoped launch/readiness lineage.
9. Equivalent retries return the stable idempotent result.
10. A changed participating team set is rejected as an idempotency conflict.

The browser journey is automation evidence, not Human Validation.

## Dual-KG, Local Vault, design and OSS evidence

- CodeGraph was checked for the exact source baseline; the current index was
  unavailable, so the source-level call-path review and limitation were recorded
  rather than fabricating an MCP result.
- Graphify and the dual knowledge-graph reconciliation receipt were executed and
  retained with the unmapped/current-index limitation explicitly recorded.
- Local Vault was executed usage-first within the V5.14 bounded retrieval
  budget. The Historical Reference Receipt and assessment are retained.
- Figma/ProductDesign reuse was assessed as reference-only; it is not product
  truth.
- Historical competitor and OSS patterns were recorded through the allowlist
  receipt; no new dependency, provider, model, or external runtime was added.

Receipts:

- `C:\Temp\simwar-m2p3-v514-20260821\00-mission-control-receipt.md`
- `C:\Temp\simwar-m2p3-v514-20260821\01-tool-health-receipt.md`
- `C:\Temp\simwar-m2p3-v514-20260821\04-local-vault-retrieval-assessment.md`
- `C:\Temp\simwar-m2p3-v514-20260821\05-codegraph-receipt.md`
- `C:\Temp\simwar-m2p3-v514-20260821\06-graphify-and-kg-reconciliation.md`
- `C:\Temp\simwar-m2p3-v514-20260821\08-design-reuse-receipt.md`
- `C:\Temp\simwar-m2p3-v514-20260821\10-competitor-pattern-ledger.md`
- `C:\Temp\simwar-m2p3-v514-20260821\11-oss-allowlist-receipt.md`
- `C:\Temp\simwar-m2p3-v514-20260821\15-current-master-reconciliation-receipt.json`
- `C:\Temp\simwar-m2p3-v514-20260821\17-post-merge-validation-receipt.md`

## Planning pointer and issue disposition

`docs/planning/current-cycle.yaml` and
`docs/planning/l1-plus-portfolio-register.yaml` previously pointed at the
historical W027 cycle and an old master SHA. Those files are mutable current
planning carriers, not immutable historical records. This Governance Closure
reconciles them to M2-P3/PR #426, records the exact Product merge/tree, and
sets:

`CURRENT_PLANNING_POINTER_DISPOSITION=RECONCILED_MUTABLE_CURRENT_POINTER`

Issue #418 is `PRESERVED_NOT_CONSUMED`. It is not closed, rewritten, or
silently treated as acceptance evidence by this mission.

The next candidate remains pending explicit owner direction. No automatic
successor, W6 activity, Pilot, Production, provider activation, or model
activation is initiated.

## Validation

- PR #426 required GitHub checks on the final Product head: `quality`,
  `browser-smoke`, `Analyze JavaScript and TypeScript`, and CodeQL: all passed.
- Focused unit/contract/integration suites after Product merge: `15/15` passed.
- Fresh detached Product merge `npm ci`: passed.
- Fresh detached Product merge `npm run build`: passed for all workspaces.
- Fresh detached Product merge `npm run typecheck`: passed.
- `npm run check:hidden-unicode`: passed.
- `npm run check:direct-store-boundaries`: passed with
  `new-unapproved-runtime-direct-store-access=0`.
- `node scripts/check-contracts.mjs`: passed with 20 baseline files, 37 M1
  contract files and 29 schema/fixture case groups.
- Fresh detached real-BFF browser journey with mocks disabled: `1/1` passed.

The full local `npm test` run on the Product worktree remains a known baseline
limitation: `224 passed (229 files), 17 failed tests, 5 worker errors`, with
`1350 passed / 1367 tests`. The failures are recorded and were not reclassified
as a Product pass. Remote required CI passed its configured gates.

## Known limits and explicit non-claims

- `PASS_WITH_LIMITS` is not a full WCAG or accessibility PASS. The known
  color-contrast limitation remains visible; this closure does not waive it.
- Automated browser evidence is not Human Validation and does not prove
  teaching effectiveness or human usability.
- Pilot and Production are `NOT_AUTHORIZED`.
- No provider activation, real model, W6 work, release approval, or automatic
  successor is claimed.
- Post-merge evidence does not authorize any unrelated merge, deployment,
  governance closure, or future task.
- Existing npm audit output reported 2 low and 7 high advisories; no dependency
  or lockfile change was made by this mission.

## Resource locks and rollback

The M2-P3 Product and Governance locks are released only on successful
Governance PR merge plus fresh detached final-master readback. The final
readback receipt records the exact final master SHA and confirms no active
M2-P3 lock remains.

Product rollback is the normal reviewed revert of merged PR #426. This
docs-only Governance Closure does not mutate Course, Run, Round, W4, settlement,
Replay, provider, deployment, or Production state.

This document closes only the M2-P3 Product PR and its governance readback. It
does not authorize a successor task.
