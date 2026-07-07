# Course Delivery Productization V1 Evidence Note

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

PostgreSQL runtime:
NOT_AUTHORIZED
```

This note records the synthetic Course Delivery Productization V1 guard. It is not `G0 PASS`, not `L1 READY`, not Teacher rehearsal approval, not Pilot readiness, not Production readiness, not PostgreSQL runtime proof, and not durable settlement proof.

## Objective

Course Delivery Productization V1 connects the existing JSON runtime course flow to the R7-C Scenario Factory release-candidate evidence:

```text
Course Blueprint
-> approved ScenarioPackage
-> approved ParameterSet
-> plugin / engine / feature-mapper / seed binding
-> Course
-> Teams
-> Run
-> Round
-> Student Decisions
-> Teacher Lock
-> Kernel Settlement
-> Teacher Publish
-> Student Three-Part Feedback
-> Teacher replay evidence
-> Learning Evidence Ledger
```

The guard keeps Learning Evidence out of formal settlement truth. It uses existing `Course`, `Run`, `Round`, `Team`, `Decision`, `SettlementResult`, `PublicResultView`, `AuditLog`, replay and R7-C release-candidate surfaces.

## Course Blueprint Contract

| Field group                     | Evidence                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| course / tenant / teacher scope | `CourseDeliveryBlueprintV1.course_id`, `tenant_id`, `teacher_scope`                                                                  |
| scenario asset versions         | `scenario_asset_id`, `scenario_version`, `template_version`, `variant_version`                                                       |
| runtime binding                 | `scenario_package_id`, `parameter_set_id`, `plugin_package_id`, `plugin_version`, `engine_version`, `feature_mapper_version`, `seed` |
| delivery plan                   | `course_objective`, `round_plan`, `team_plan`, `role_plan`, `visibility_plan`                                                        |
| governance references           | `approval_reference`, `freeze_reference`, `run_binding_reference`, `audit_reference`, `known_limits_reference`                       |
| learning evidence               | `LEARNING_EVIDENCE_ONLY`, `NOT_SETTLEMENT_INPUT`, `NOT_FORMAL_TRUTH`, `NOT_AUTOMATIC_GRADE`, `NOT_AI_DECISION`                       |

The blueprint rejects tenant mismatch, non-approved `ScenarioPackage`, non-approved `ParameterSet`, and plugins not listed by the scenario package.

## State Transition Guard

| Entity     | Transition                       | Current guard                  | Idempotency assertion                                                                  |
| ---------- | -------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| Course     | `draft -> published`             | Teacher `course:publish` route | repeated publish returns the published course without duplicate `course.publish` audit |
| Run        | `course published -> active run` | Teacher `run:create` route     | current route creates a fresh run; no idempotency claim                                |
| Round      | `open -> locked`                 | Teacher `round:lock` route     | repeated lock returns the locked round without duplicate `round.lock` audit            |
| Settlement | `locked -> settled`              | Existing settlement route      | repeated settlement returns `reused` and does not overwrite official result            |
| Round      | `settled -> published`           | Teacher `round:publish` route  | repeated publish returns the published round without duplicate `round.publish` audit   |

## API / Permission / Idempotency / Audit Matrix

| Operation                  | API Layer         | Actor                      | Tenant Scope   | Team Scope           | Permission        | Preconditions                               | Postconditions                   | Idempotency                              | Audit                    | Error codes                                    | Projection / non-proof                       |
| -------------------------- | ----------------- | -------------------------- | -------------- | -------------------- | ----------------- | ------------------------------------------- | -------------------------------- | ---------------------------------------- | ------------------------ | ---------------------------------------------- | -------------------------------------------- |
| Course Draft Create        | Course API        | Teacher                    | current tenant | none                 | `course:create`   | approved scenario and parameter set exist   | `course.status=draft`            | fresh create is not idempotent           | `course.create`          | `COURSE-422-001`                               | not a run start                              |
| Course Draft Update        | Course API        | Teacher                    | current tenant | none                 | `course:update`   | draft course                                | draft remains draft              | future idempotent update only            | `course.update`          | `COURSE-404-001`                               | not implemented by current public API        |
| Scenario Asset Select      | Scenario Factory  | Teacher                    | current tenant | none                 | `course:publish`  | approved/frozen scenario asset              | blueprint references asset       | same asset keeps same id                 | `scenario.select`        | `COURSE_DELIVERY_SCENARIO_NOT_APPROVED`        | source evidence, not production authoring UI |
| Scenario Asset Bind        | Scenario Factory  | Teacher                    | current tenant | none                 | `run:create`      | release candidate bound to run              | `mutation_allowed=false`         | same asset/run pair returns same binding | `scenario.bind`          | `COURSE_DELIVERY_RUN_BINDING_MISMATCH`         | does not create scenario authority           |
| ParameterSet Bind          | Blueprint         | Teacher                    | current tenant | none                 | `course:publish`  | `ParameterSet.status=approved`              | parameter id frozen for run      | same id keeps same binding               | `parameter.bind`         | `COURSE_DELIVERY_PARAMETER_NOT_APPROVED`       | no ParameterSet lifecycle change             |
| Plugin Bind                | Blueprint         | Teacher                    | current tenant | none                 | `course:publish`  | plugin listed by scenario package           | plugin id/version frozen for run | same plugin keeps same binding           | `plugin.bind`            | `COURSE_DELIVERY_PLUGIN_NOT_BOUND`             | no plugin truth authority                    |
| Course Publish             | Course API        | Teacher                    | current tenant | none                 | `course:publish`  | `draft` or already `published`              | `course.status=published`        | repeated publish has no duplicate audit  | `course.publish`         | `COURSE-409-001`                               | not Pilot/Production                         |
| Run Create                 | Run API           | Teacher                    | current tenant | none                 | `run:create`      | course published                            | active run and open round        | fresh create is not idempotent           | `run.create`             | `COURSE-409-002`                               | does not settle                              |
| Team Create                | Team API          | Teacher                    | current tenant | target team          | `team:create`     | course and captain exist                    | team scoped to course/tenant     | fresh create is not idempotent           | `team.create`            | `USER-404-001`                                 | no cross-team write                          |
| Role Bind                  | Team API          | Teacher                    | current tenant | target team          | `team:create`     | team exists                                 | role remains team scoped         | future stable binding only               | `role.bind`              | `TEAM-404-001`                                 | current seed role defaults remain            |
| Round Open                 | Run API           | Teacher                    | current tenant | none                 | `run:create`      | run active                                  | round open                       | no duplicate round claim                 | `round.open`             | `ROUND-409-001`                                | current run create opens round one           |
| Decision Submit            | Decision API      | Student                    | current tenant | own team             | `decision:submit` | round open and actor in team                | validated decision               | versioned own-team submit                | `decision.submit`        | `ROUND-409-002`, `TEAM-403-001`, `DEC-422-001` | AI advisory excluded                         |
| Round Lock                 | Round API         | Teacher                    | current tenant | none                 | `round:lock`      | `open` or already `locked`                  | `round.status=locked`            | repeated lock has no duplicate audit     | `round.lock`             | `ROUND-409-003`                                | not durable settlement                       |
| Settlement Trigger         | Settlement API    | Teacher                    | current tenant | all course teams     | `settlement:run`  | round locked and decisions valid            | official result persisted once   | repeated settlement returns `reused`     | `round.settle_requested` | `ROUND-409-004`, `DEC-409-001`                 | not PostgreSQL runtime proof                 |
| Result Publish             | Round API         | Teacher                    | current tenant | none                 | `round:publish`   | `settled` or already `published`            | `round.status=published`         | repeated publish has no duplicate audit  | `round.publish`          | `ROUND-409-005`                                | not production publication                   |
| Replay Request             | Replay API        | Teacher                    | current tenant | course scope         | `result:read`     | official result exists                      | no result mutation               | read-only                                | none                     | `TRUTH-403-001`                                | replay is not recovery proof                 |
| Shadow Replay Request      | Shadow Arena      | Teacher                    | current tenant | course scope         | `result:read`     | candidate and official result exist         | official result unchanged        | read-only candidate diff                 | none                     | `TRUTH-403-001`                                | shadow replay not truth authority            |
| Learning Evidence Read     | Learning Evidence | Teacher / Student redacted | current tenant | own team for student | `result:read`     | published result or teacher evidence exists | `formal_truth_write=false`       | read-only                                | none                     | `TRUTH-403-001`                                | not formal grade                             |
| Teacher Evidence Read      | Teacher Evidence  | Teacher                    | current tenant | course scope         | `result:read`     | result exists                               | no result mutation               | read-only                                | none                     | `TRUTH-403-001`                                | not Teacher rehearsal approval               |
| Tenant Admin Summary Read  | Tenant Admin      | Tenant Admin               | current tenant | none                 | `audit:read`      | tenant admin actor                          | no state mutation                | read-only                                | none                     | `TENANT-403-001`                               | not platform authority                       |
| Platform Admin Scoped Read | Platform Admin    | Platform Admin             | platform       | none                 | `platform:read`   | platform admin actor                        | no state mutation                | read-only                                | none                     | `AUTH-403-001`                                 | no tenant mutation authority                 |

## Student Three-Part Feedback

Student feedback is a derived, redacted evidence object:

1. `what_happened`: visible published result status, count and team ids.
2. `why_it_happened`: public scenario observation only; no private trace and no protected truth.
3. `next_step_suggestion`: deterministic advisory-only text; not an automatic decision.

## Learning Evidence Ledger

The ledger carries:

```text
excluded_from_truth_hash = true
formal_truth_write = false
```

It references official replay source result id and run binding evidence, but it does not write `SettlementResult`, `state_true`, score, rank, replay hash, manifest hash or canonical evidence digest.

## Known Limits

- JSON runtime only.
- Synthetic scenario only.
- No PostgreSQL transaction, RLS, backup restore or durable settlement proof.
- No real Teacher rehearsal.
- No production Course authoring UI.
- No AI scoring or AI decision authority.
- No Pilot or Production readiness.

## Validation Commands

```text
npm test -- tests/integration/course-delivery-productization.test.ts
npm run format:check
npm run check:hidden-unicode
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e:ui
npm run test:contract
npm run security:audit
npm run check:direct-store-boundaries
git diff --check
npm audit --json
```

## Relationship To Issues

Relates to #111.
Relates to #114.
Relates to #115.
