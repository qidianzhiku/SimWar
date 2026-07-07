# R7-C Scenario Factory Runtime and Shadow Arena

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

本文记录 `R7-C` 的 Scenario Factory Runtime、Scenario Registry、Scenario Family V1 和 Scenario Shadow Arena Batch。它只覆盖 synthetic-only、JSON-only、教学场景资产治理，不授权真实教师试跑、真实客户数据、`Pilot`、`Production`、PostgreSQL runtime、SQL、migration 或 durable settlement。

## Exact File Manifest

| File                                                                 | Purpose                                                                   | Runtime Delta                       | Forbidden Neighbor                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| `services/simulation-core/src/eldercare-scenario-factory.ts`         | R7-C family、registry、authoring、release candidate、shadow arena runtime | pure TypeScript simulation boundary | `SettlementResult` shape、`state_true` authority |
| `services/simulation-core/src/index.ts`                              | export R7-C API                                                           | export only                         | package / lockfile                               |
| `contracts/fixtures/r7c-scenario-family.valid.json`                  | synthetic family metadata fixture                                         | fixture only                        | schema / OpenAPI registry                        |
| `tests/simulation/r7c-scenario-factory-runtime.test.ts`              | family、registry、authoring state machine、freeze and mutation rejection  | simulation test only                | service / route                                  |
| `tests/simulation/r7c-shadow-arena-batch.test.ts`                    | diff、trace、shadow arena batch、non-overwrite evidence                   | simulation test only                | formal replay write                              |
| `tests/integration/r7c-golden-m1-runtime-compatibility.test.ts`      | existing Golden M1 engine, R3 scope and projection compatibility          | existing engine path only           | second settlement engine                         |
| `tests/e2e-ui/r7c-scenario-factory-browser-smoke.spec.ts`            | browser smoke for teacher/student/admin projections                       | browser smoke only                  | full product route claim                         |
| `docs/architecture/r7c-scenario-factory-runtime-and-shadow-arena.md` | architecture boundary                                                     | documentation only                  | R4 Macro                                         |
| `docs/quality/r7c-scenario-factory-evidence.md`                      | validation evidence map                                                   | documentation only                  | G0/L1 pass claim                                 |
| `docs/governance/r7c-scenario-factory-handoff.md`                    | independent review handoff                                                | documentation only                  | review / merge authorization                     |
| `docs/architecture/r4-discovery-parity-gap-directory.md`             | R4 Discovery gap update                                                   | documentation only                  | SQL / migration                                  |

## Runtime Contract

`R7-C` adds a layer above `R7-B` lifecycle:

```text
Scenario Family
→ Scenario Registry
→ Teacher Authoring Draft
→ Compile
→ Validate
→ Approve
→ Freeze
→ Release Candidate
→ Run Binding
→ Shadow Arena Batch
→ Evidence Handoff
```

The implementation reuses the existing `R7-B` lifecycle and existing `createToyLogitEngine` path. It does not create another settlement engine, direct store write path, route bypass, schema bypass or formal truth writer.

## Beijing-Yanjiao Scenario Family V1

The family contains five synthetic variants:

```text
base_operations
payer_policy_shift
regional_migration
competition_entry
crisis_shock
```

Each variant records:

```text
deterministic seed
scenario version
parameter version
plugin version
policy rule ids
migration rule ids
qualification rule ids
shock ids
private assumption reference
release eligibility = candidate_only
```

These variants are teaching scenarios. They are not real market forecasts, operating advice, investment advice, policy conclusions or production release candidates.

## Authority Model

| Actor          | Allowed                                                                                                                                         | Forbidden                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Teacher        | create registry, draft, compile, validate, approve, freeze, create release candidate, bind synthetic run, inspect diff and shadow arena summary | write `state_true`, write `SettlementResult`, mutate frozen scenario, modify ParameterSet in place                |
| Student        | read redacted scenario observation only                                                                                                         | read private assumption, private parameter, private plugin trace, private replay, other tenant or other team data |
| Tenant Admin   | read tenant-scoped scenario status                                                                                                              | read private trace, other tenant, Teacher private evidence                                                        |
| Platform Admin | explicit authority only                                                                                                                         | implicit global access                                                                                            |
| System         | deterministic compile and trace support                                                                                                         | formal truth write                                                                                                |

## Shadow Arena

`R7-C` `Shadow Arena Batch` evaluates all family variants as candidate evidence:

```text
model regression status
plugin conformance status
Golden M1 compatibility
R3 boundary compatibility
policy / migration / qualification / shock controlled failures
official result non-overwrite
```

The public shadow arena view exposes only:

```text
replay_mode
status
case_count
official_result_non_overwrite
```

It does not expose `state_true`, private replay metadata, `manifest_hash`, `canonical_evidence_digest`, private assumptions or private plugin details.

## Non-Goals

This package does not implement:

```text
truth_hash
SettlementResult shape change
state_true authority change
replay_hash semantic change
manifest_hash semantic change
canonical_evidence_digest semantic change
service / server / route change
schema / OpenAPI change
PostgreSQL runtime
SQL
migration
ProviderSelector PostgreSQL mode
R4 Macro
R8-G1 release
Teacher rehearsal
Pilot
Production
durable settlement
```

## Known Limits

- Browser coverage is `E2E_BROWSER_PARTIAL_ONLY`; it renders projections through the existing login harness and does not prove a complete Teacher product workflow.
- Shadow Arena uses deterministic synthetic evidence and does not prove real-world scenario quality.
- R4 Discovery remains read-only. R4 Macro, PostgreSQL runtime, transaction proof, RLS and backup/restore remain unproven.

Relates to #111.
Relates to #114.
Relates to #115.
