# Shanghai Eldercare Golden M1 Productization Design

## Goal

把现有 R7A/R7B/R7C 合成教学资产显式映射为可复用的 Golden M1 formal-authority 草稿，并通过现有 JSON HTTP 运行链完成一条真实的租户隔离课程闭环；Human Validation 只生成 readiness package，不在本任务执行。

## Boundaries

- R7 assets remain `L0_SYNTHETIC` / `SYNTHETIC_TEACHING_BASELINE`; no Shanghai calibration or production claim is introduced.
- Existing ParameterSet, PluginRelease, ScenarioPackage, CourseBlueprint, CoursePackage, Course, Run, Decision and Settlement command services remain the sole writers.
- No new registry, kernel, settlement engine, Truth authority, PostgreSQL runtime, RLS, external AI, or durable-recovery claim.
- Frontends consume current governed API/BFF surfaces; no frontend writes truth or private replay material.

## Architecture

`services/api/src/eldercare-golden-m1.ts` is a pure adapter/factory. It compiles the existing Shanghai R7A asset, preserves R7B/R7C evidence references, and emits deterministic formal draft inputs for a caller-supplied source tenant and target tenant/course identifiers. The adapter computes no formal digest itself; command services calculate canonical content digests and lifecycle records.

The integration test creates an isolated platform/source/target setup through existing HTTP endpoints, registers an approved/available Eldercare plugin release, creates and approves ParameterSet, ScenarioPackage and CourseBlueprint, provisions target baselines through the existing tenant-baseline route, creates an AVAILABLE CoursePackage, and runs the existing Course → Run → Round → Decision → Settlement → Publish → student projection → teacher debrief/export chain. It repeats the same deterministic source/decision inputs for two fresh tenants and checks equality of replay evidence plus tenant isolation.

## Components

1. Pure Golden M1 adapter and immutable constants.
2. Unit tests for deterministic mapping, synthetic labels, plugin dependency and rejection of truth/private fields.
3. HTTP integration test for formal materialization, full Golden chain, no-write conflict and tenant isolation.
4. Browser smoke spec using existing Admin/Teacher/Student apps and seeded formal references; it verifies visible product surfaces and student redaction only.
5. Architecture/readiness documentation and external evidence receipts.

## Failure handling

All invalid tenant/reference/digest/lifecycle requests must fail through existing governed errors. The adapter must reject mismatched target/source identifiers and never fall back to `tenant_demo`, legacy first-approved selection, or implicit source versions. Conflicts must leave formal authority and runtime truth counts unchanged.

## Verification

Focused unit/integration/browser tests run before the full repository gates. Determinism compares formal content digests, CoursePackage references, replay evidence digests, settlement result identity and published student-safe projection. Truth matrix checks that only normal canonical Decision and official SettlementResult paths write their expected records; no advisory, R7 shadow evidence or frontend path writes truth.

## Human Validation readiness

The evidence package records executable operator steps, two fresh tenant prerequisites, synthetic-data limitations, expected safe surfaces, rollback/no-write checks, and explicit `HUMAN_VALIDATION_NOT_PERFORMED`. It recommends `SIMWAR-ELDERCARE-SHANGHAI-L1-HUMAN-INTERNAL-VALIDATION-001` as a future separately authorized mission.
