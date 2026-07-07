# R7-A Eldercare Core Model and Scenario Asset

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

本文记录 `R7-A` 北京-燕郊康养核心模型与 scenario asset foundation。该资产用于后续教学场景、参数候选和插件边界讨论，不是 `Pilot`、`Production` 或 durable settlement 证明。

## Purpose

`R7-A` 把康养业务中最小但可复核的模型要素收束为一个纯 TypeScript scenario asset：

- 北京与燕郊两个 synthetic region。
- active senior、assisted living、medical rehab 三类 synthetic demand segment。
- facility capacity、staffing ratio、payer mix、license scope 和 care quality risk。
- 六轮 scenario draft，用于后续教学设计和 evidence review。
- 一个 `plugin_wellness_eldercare_v1` candidate manifest。

该资产不创建 API route，不修改 OpenAPI / JSON Schema，不接入 PostgreSQL，不改变当前 M1 runtime truth。

## Model Surface

| Surface           | File                                                          | Boundary                                   |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------ |
| Core model        | `services/simulation-core/src/eldercare-core-model.ts`        | pure deterministic source-only model       |
| Scenario compiler | `services/simulation-core/src/eldercare-scenario-compiler.ts` | deterministic synthetic asset compiler     |
| Plugin wrapper    | `plugins/wellness/eldercare-plugin-v1.ts`                     | scenario asset only, no formal truth write |
| Fixture           | `contracts/fixtures/r7a-eldercare-core-scenario.valid.json`   | synthetic data only                        |

## Deterministic Inputs

The default scenario uses:

- `scenario_id = r7a-beijing-yanjiao-eldercare-core-scenario-v1`
- `seed = 70707`
- `tenant_id = tenant_r7a_synthetic`
- `parameter_set_id = parameter_r7a_eldercare_v1`
- `plugin_package_ids = [plugin_wellness_eldercare_v1]`

All values are synthetic. The fixture contains no real user, real tenant, real payment, production identifier, connection string, secret, token, password or private replay payload.

## Core Invariants

```text
formal_truth_write = false
postgresql_runtime_required = false
replay_writes_formal_results = false
direct_store_delta = NONE
```

The model returns source-only metrics, learner-safe projection hints and controlled failure classifications. It does not return or mutate formal settlement result shapes.

## Six-Round Scenario Draft

| Round | Title                            | Focus                                                |
| ----- | -------------------------------- | ---------------------------------------------------- |
| 1     | Beijing-Yanjiao demand discovery | region selection, community channel discovery        |
| 2     | Facility and service capacity    | bed capacity, day-care slot planning, staffing ratio |
| 3     | Payer mix and affordability      | payer mix, public subsidy, commercial insurance      |
| 4     | Medical-care license boundary    | license scope, medical care boundary                 |
| 5     | Care quality and staffing risk   | service quality, staff safety, family trust          |
| 6     | Replay and non-overwrite review  | shadow replay candidate, non-overwrite evidence      |

## Controlled Failure Boundary

The current controlled failure path is:

```text
ELDERCARE_LICENSE_SCOPE_DENIED
```

It is triggered when medical-care expansion is requested without an authorized eldercare medical license scope. The failure is an evidence classification only; it does not modify runtime truth, route behavior, schema, database state, workflow or repository policy.

## Non-Goals

This asset does not prove:

- `G0 PASS`
- `L1 READY`
- Controlled Pilot readiness
- Production readiness
- PostgreSQL runtime readiness
- durable settlement
- R4 Macro
- R9
- R10

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
