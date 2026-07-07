# R5/R6/R7-C Course Delivery and Learning Evidence Guard

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

本文记录 `R5 / R6 / R7-C` 场景资产驱动课程交付与 Learning Evidence 的 synthetic guard。它不是 `G0 PASS`，不是 `L1 READY`，不证明 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration、backup restore 或 durable settlement。

## 目的与非目标

本 Guard 的目标是把已合并的 R7-C Scenario Factory evidence 接入一个最小课程交付闭环：Teacher 选择 approved/frozen Scenario Asset，Course 绑定 ScenarioPackage / ParameterSet / Plugin / Seed，Run 创建，Round 开启，Student 提交结构化 Decision，Teacher lock / settlement / publish，Student 读取 redacted feedback，Teacher 读取 approved replay evidence，Tenant Admin 读取 tenant-scoped status，并生成不写正式真值的 Learning Evidence Ledger。

非目标：

- 不实现 PostgreSQL runtime。
- 不修改 `SettlementResult` shape。
- 不修改 `state_true` authority。
- 不实现 `truth_hash`。
- 不扩大 Student visibility。
- 不执行真实教师 rehearsal、Pilot 或 Production。

## Synthetic Course Blueprint

| 项                   | 值                                                        |
| -------------------- | --------------------------------------------------------- |
| Course Blueprint     | `course-blueprint-r7c-golden-m1-v1`                       |
| Scenario Family      | `r7c-beijing-yanjiao-eldercare-family-v1`                 |
| Scenario Variant     | `base_operations`                                         |
| Required asset state | `APPROVED -> FROZEN -> RELEASE_CANDIDATE -> BOUND_TO_RUN` |
| Teams                | `Course Delivery Alpha`, `Course Delivery Beta`           |
| Round                | `round_no = 1`                                            |
| Direct-store delta   | `NONE`                                                    |

The guard uses the existing JSON runtime and existing settlement kernel. It does not add API, schema, OpenAPI, package, workflow, SQL, migration, service or route changes.

## Evidence Boundaries

| Boundary               | Guard assertion                                                                                                                     | Evidence label              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Scenario asset binding | approved/frozen R7-C release candidate is bound to the synthetic run id and matches Course/Run ScenarioPackage and ParameterSet ids | `INTEGRATION_TEST_EVIDENCE` |
| Course lifecycle       | draft course rejects run creation, published course allows run creation                                                             | `STATE_MACHINE_EVIDENCE`    |
| Team / role scope      | two synthetic teams submit only their own decisions                                                                                 | `INTEGRATION_TEST_EVIDENCE` |
| Settlement             | existing API settlement path produces official result                                                                               | `INTEGRATION_TEST_EVIDENCE` |
| Replay                 | replay evidence is matched and does not write formal results                                                                        | `REPLAY_GOLDEN`             |
| Shadow Arena           | R7-C shadow arena preserves official result non-overwrite                                                                           | `SHADOW_ARENA_EVIDENCE`     |
| Learning Evidence      | ledger is `excluded_from_truth_hash` and `formal_truth_write = false`                                                               | `CONTRACT_BACKED_EVIDENCE`  |
| Student visibility     | Student feedback omits private truth, replay and digest fields                                                                      | `INTEGRATION_TEST_EVIDENCE` |
| Tenant Admin scope     | Tenant Admin state remains tenant-scoped                                                                                            | `INTEGRATION_TEST_EVIDENCE` |
| Platform Admin         | Platform Admin explicit authority remains separate from Tenant Admin                                                                | `INTEGRATION_TEST_EVIDENCE` |

## Known Limits

This guard is synthetic. It confirms current JSON runtime behavior only. It does not prove production durability, real teacher readiness, production security posture, PostgreSQL transaction behavior, RLS, distributed recovery, backup restore, `R4 Macro`, `R9`, `R10`, Pilot or Production readiness.

The current public Course API still selects the first approved tenant ScenarioPackage / ParameterSet from the JSON store. This guard verifies that an approved R7-C asset can be seeded as the approved asset and inherited by the existing Course / Run creation path, but it does not add a production authoring API for ScenarioPackage selection. The guard uses an approved course-binding copy of the R7-C parameter asset because the accepted shared `ParameterSetStatus` model does not currently include a `FROZEN` state. Final ParameterSet lifecycle authority remains a future human decision and is not changed by this PR.

## Local Validation Commands

```text
npm test -- tests/integration/r5-r6-course-delivery-learning-evidence.test.ts
npm run test:contract
npm run typecheck
npm test
npm run build
npm run lint
npm run test:e2e:ui
npm run security:audit
npm run check:direct-store-boundaries
git diff --check
```

## Relationship To Issues

Relates to #111.
Relates to #114.
Relates to #115.
