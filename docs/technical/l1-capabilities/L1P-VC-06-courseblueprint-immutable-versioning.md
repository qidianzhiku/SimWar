# L1P-VC-06: CourseBlueprint Immutable Versioning

**Proposed status:** `CLOSED_AND_CURRENT` after this governance PR is merged

**Repository status before merge:** `NOT_YET_CLOSED_BY_GOVERNANCE_MERGE`

**Product merge:** `#295` / `1f281abf02f2f79604cbe30a1145e8e249f4f18e`

**Contract remediation merge:** `#296` / `60f4f518bc51b962da3975b86fd96558aac6a35d`

**Runtime authority:** `JSON_INTERNAL_ONLY`

## Product Outcome

CourseBlueprint versions use an exact tenant, blueprint ID, version, and content-digest identity. `CourseBlueprintCommandService` is the sole lifecycle writer and advances append-only `DRAFT -> VALIDATED -> FROZEN -> APPROVED -> RETIRED` snapshots through the JSON-compatible registry. Static v0 remains `LEGACY_READ_ONLY`.

A Teacher can list an approved tenant-scoped catalog, inspect combined CourseBlueprint and formal-course readiness, select an exact CourseBlueprint reference, and create a Course with an independent `CourseBlueprintBinding`. The existing B5 `FormalCourseAuthorityBinding`, formal Run binding, runtime input resolver, and Simulation Core remain unchanged.

## Evidence

- PR #295 exact head `d3dc261ad1d4b079fda5ccabeb4abb18ce954b5a` passed all required acceptance criteria and an independent Challenge Review with zero blocking or must-fix findings.
- CourseBlueprint authority tests cover immutable identity, legal and illegal lifecycle transitions, approval integrity, tenant isolation, corruption rejection, and append-only history.
- Teacher product tests cover safe catalog projection, readiness, exact binding, compatibility rejection, failure compensation, and zero surviving uncommitted binding state.
- Golden non-interference proves unchanged SettlementResult, Score, Rank, Replay evidence, and idempotent replay behavior.
- Historical non-overwrite proves that retiring v1 and approving v2 do not rewrite an existing exact v1 Course binding.
- Student evidence proves there is no CourseBlueprint catalog or readiness surface and no expansion of private replay or truth projections.
- Playwright isolation passed the C1 A-G matrix at the product exact head.

## Post-Merge Contract Regression

The fresh-clone contract gate after PR #295 was classified as `POST_MERGE_REGRESSION`. PR #296 changed only `tests/integration/m1-handler-contract-conformance.test.ts`, adding a bounded `10_000ms` test-local timeout. It did not change product source, assertions, the default parallel command, global timeout, worker scheduling, retry, skip, lockfile, workflow, or product semantics.

The remediation exact head passed 10/10 default parallel cold runs, independent Challenge Review, CI, browser smoke, and CodeQL. At remediation merge `60f4f518bc51b962da3975b86fd96558aac6a35d`, both fresh clones passed five contract runs and the 43-test C1 focused suite.

## Snapshot CLI Historical Event

The later Snapshot CLI event remains retained as a separate historical event. Its current classification is `NOT_REPRODUCIBLE`; the root cause is not proven, remediation is `NONE`, and it is not attributed to PR #296. Two independent current-master clones passed 20/20 direct child probes, 20/20 exact tests, 10/10 test-file runs, and 6/6 default full suites with zero residue.

## Boundaries and Known Limits

- `CourseBlueprintBinding` is a teaching-configuration companion record. It does not replace the Course writer or B5 formal binding.
- CourseBlueprint content does not enter settlement truth or Replay hash inputs.
- `JSON_INTERNAL_ONLY` remains the sole active runtime authority.
- JSON compensation is `COMPENSATING_ATOMICITY_NOT_CRASH_SAFE`.
- Human Validation was waived by Owner and was not performed.
- Issue #111 remains `OPEN_KNOWN_LIMIT`.
- PostgreSQL is not active. Durable settlement/recovery, Pilot, and Production are not proven or authorized.
- Current dependency advisories remain 2 low and 6 high; this closure does not modify dependencies.

## Revalidation Triggers

Revalidate this capability after CourseBlueprint authority or registry changes, shared-contract changes, formal Course/Run binding changes, Golden or Replay contract changes, Student visibility changes, or product/runtime changes.

## Successor Boundary

`CAND-L1P-C2-TEACHER-BLUEPRINT-STUDIO` is `RECOMMENDED_NOT_AUTHORIZED`. This closure does not create an authorization record, acquire C2 locks, or start another mission. `automatic_next_start` remains `false`.
