# R7-B Scenario Asset Lifecycle Runtime Integration

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

本文记录 `R7-B` 场景资产生命周期接入。它只覆盖 synthetic-only、JSON-only、教学场景资产的 deterministic lifecycle，不授权真实教师试跑、真实客户数据、`Pilot`、`Production`、PostgreSQL runtime、SQL、migration 或 durable settlement。

## Exact File Manifest

| File                                                                    | Purpose                                                                                                      | Boundary                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `services/simulation-core/src/eldercare-scenario-lifecycle.ts`          | Scenario draft、compile、validation、approval、freeze、run binding、diff、projection、shadow replay evidence | Pure TypeScript lifecycle, no route or store mutation |
| `services/simulation-core/src/index.ts`                                 | Export R7-B lifecycle APIs                                                                                   | Export only                                           |
| `contracts/fixtures/r7b-eldercare-scenario-lifecycle.valid.json`        | Synthetic lifecycle fixture                                                                                  | Not registered as schema gate input                   |
| `tests/simulation/r7b-scenario-lifecycle.test.ts`                       | Lifecycle state, approval, freeze, binding, mutation rejection                                               | Simulation test only                                  |
| `tests/simulation/r7b-scenario-diff-trace.test.ts`                      | Scenario/parameter/plugin/shock diff and visibility projection                                               | Simulation test only                                  |
| `tests/integration/r7b-golden-m1-replay-compatibility.test.ts`          | Golden M1 and shadow replay non-overwrite compatibility                                                      | Existing engine path only                             |
| `tests/e2e-ui/r7b-scenario-lifecycle-browser-smoke.spec.ts`             | Existing Playwright harness browser smoke with redacted views                                                | `E2E_BROWSER_PARTIAL_ONLY`                            |
| `docs/architecture/r7b-scenario-asset-lifecycle-runtime-integration.md` | Architecture boundary                                                                                        | Documentation only                                    |
| `docs/quality/r7b-scenario-asset-lifecycle-evidence.md`                 | Evidence and validation map                                                                                  | Documentation only                                    |
| `docs/governance/r7b-scenario-asset-lifecycle-handoff.md`               | Independent review handoff                                                                                   | Documentation only                                    |
| `docs/architecture/r4-discovery-parity-gap-directory.md`                | R4 Discovery gap update                                                                                      | Read-only discovery note                              |

## Lifecycle Contract

`R7-B` establishes the following explicit status sequence:

```text
DRAFT
COMPILED
VALIDATED
APPROVED
FROZEN
BOUND_TO_RUN
ARCHIVED
REJECTED
```

The implemented happy-path guard covers:

```text
DRAFT -> COMPILED -> VALIDATED -> APPROVED -> FROZEN -> BOUND_TO_RUN
```

`ARCHIVED` and `REJECTED` remain modeled status values for future governance flows. They are not active production operations.

## Authority Model

| Actor          | Allowed                                                                                     | Forbidden                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Teacher        | create draft, compile, validate, approve, freeze, bind synthetic run, inspect diff/evidence | modify frozen `ParameterSet`, write `SettlementResult`, write `state_true`, approve other tenant   |
| Student        | read redacted round summary only                                                            | read scenario draft, private parameter, private plugin trace, private shock detail, private replay |
| Tenant Admin   | read tenant-scoped status summary                                                           | read other tenant, private trace, private teacher metadata                                         |
| Platform Admin | requires explicit `platform_authority`                                                      | implicit global access                                                                             |
| System         | deterministic compile/trace support                                                         | formal truth write                                                                                 |

## Run Binding Invariants

Each bound synthetic run records:

```text
ScenarioPackage version
ParameterSet version
plugin package ids
compiler version
input hash
output hash
seed
shock timeline hash
visibility plan hash
mutation_allowed = false
```

Post-binding mutation attempts return `R7B_BOUND_SCENARIO_IMMUTABLE` and require a new scenario version.

## Beijing-Yanjiao Scenario Deepening

The synthetic mother scenario remains:

```text
SYNTHETIC_TEACHING_SCENARIO
UN_CALIBRATED
NOT_FOR_REAL_OPERATING_DECISION
NOT_FOR_PUBLIC_POLICY_DECISION
NOT_FOR_INVESTMENT_DECISION
```

It includes:

- one synthetic tenant and one synthetic course
- Teacher, Student, and Tenant Admin roles
- two synthetic teams through Golden M1 compatibility tests
- Beijing and Yanjiao synthetic regional friction
- active senior, assisted living, and medical rehab segments
- payer mix, license, service quality, staffing, and capacity constraints
- six synthetic rounds with policy, migration, qualification, and shock contracts

## Diff And Trace Surfaces

`createR7BScenarioDiff` emits:

```text
Scenario Diff
Parameter Diff
Plugin Diff
Shock Diff
```

Each entry carries tenant, course, scenario version, actor visibility, redaction flag, `mutation_allowed = false`, and whether a recompile or new scenario version is required.

## Non-Goals

This package does not implement:

```text
truth_hash
SettlementResult shape change
state_true authority change
Student visibility expansion
service / server / route change
schema / OpenAPI change
PostgreSQL runtime
SQL
migration
R4 Macro
R8-G1 release
Pilot
Production
durable settlement
```

## Known Limits

The browser smoke is `E2E_BROWSER_PARTIAL_ONLY`: it uses the existing Playwright login harness and renders lifecycle projections in-page, but no new Teacher scenario route is added. This proves projection redaction and browser rendering only; it does not prove a full product UI workflow.

Relates to #111. Relates to #114. Relates to #115.
