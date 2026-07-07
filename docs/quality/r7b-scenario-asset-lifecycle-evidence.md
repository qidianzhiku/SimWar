# R7-B Scenario Asset Lifecycle Evidence

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY
```

本文记录 `R7-B` 场景资产生命周期的本地证据。它不是 `G0 PASS`、`L1 READY`、`Pilot READY`、`Production READY` 或 durable settlement proof。

## Evidence Matrix

| Capability                           | Evidence                                                       | Label                       | Result Boundary                           |
| ------------------------------------ | -------------------------------------------------------------- | --------------------------- | ----------------------------------------- |
| Draft / compile determinism          | `tests/simulation/r7b-scenario-lifecycle.test.ts`              | `CONTRACT_BACKED_EVIDENCE`  | deterministic synthetic asset only        |
| Validation failure matrix            | `validateR7BScenarioLifecycleRecord`                           | `CONTRACT_BACKED_EVIDENCE`  | no schema/OpenAPI mutation                |
| Approval authority                   | student and cross-tenant denial tests                          | `CONTRACT_BACKED_EVIDENCE`  | no PR review or GitHub policy proof       |
| Freeze and run binding               | immutable binding and mutation rejection tests                 | `CONTRACT_BACKED_EVIDENCE`  | no production runtime                     |
| Scenario/parameter/plugin/shock diff | `tests/simulation/r7b-scenario-diff-trace.test.ts`             | `CONTRACT_BACKED_EVIDENCE`  | teacher/governance evidence only          |
| Student projection                   | redaction assertions                                           | `CONTRACT_BACKED_EVIDENCE`  | state_obs/state_est style projection only |
| Golden M1 compatibility              | `tests/integration/r7b-golden-m1-replay-compatibility.test.ts` | `INTEGRATION_TEST_EVIDENCE` | existing engine path only                 |
| Shadow replay non-overwrite          | official result snapshot preservation                          | `INTEGRATION_TEST_EVIDENCE` | shadow evidence only                      |
| Browser smoke                        | `tests/e2e-ui/r7b-scenario-lifecycle-browser-smoke.spec.ts`    | `E2E_BROWSER_PARTIAL_ONLY`  | no full product route                     |
| R4 Discovery                         | `docs/architecture/r4-discovery-parity-gap-directory.md`       | `SOURCE_ONLY_INFERENCE`     | no R4 Macro                               |

## Validation Commands

Required validation for this package:

```text
npm ci
npm test -- tests/integration/p0-flow.test.ts
npm test -- tests/integration/m1-teaching-loop.test.ts
npm test -- tests/integration/decision-submit-characterization.test.ts
npm test -- tests/integration/m1-run-manifest-replay-evidence.test.ts
npm test -- tests/integration/l1-shared-golden-m1-scenario.test.ts
npm test -- tests/integration/r3-runtime-boundary.test.ts
npm test -- tests/integration/l1-synthetic-internal-application-exercise.test.ts
npm test -- tests/simulation/r7a-eldercare-core-model.test.ts
npm test -- tests/simulation/r7a-eldercare-plugin-conformance.test.ts
npm test -- tests/simulation/r7a-eldercare-scenario-compiler.test.ts
npm test -- tests/integration/r7a-eldercare-golden-m1-compatibility.test.ts
npm test -- tests/simulation/r7b-scenario-lifecycle.test.ts
npm test -- tests/simulation/r7b-scenario-diff-trace.test.ts
npm test -- tests/integration/r7b-golden-m1-replay-compatibility.test.ts
npm run test:contract
npm run typecheck
npm test
npm run build
npm run lint
npm run test:e2e:ui
npm run check:hidden-unicode
npm run security:audit
npm run check:direct-store-boundaries
npm run format:check
git diff --check
npm audit --json
```

## Direct-Store Delta

```text
Expected Direct-Store Delta:
NONE
```

The package does not modify `services/api/src/server.ts`, repository adapters, repository facade, OpenAPI, schemas, database files, migrations, workflow files, package files, or lockfiles.

## Security And Privacy Assertions

Student projections must not contain:

```text
state_true
private scenario draft
private parameter candidate
private plugin trace
private shock internal detail
private replay artifact
manifest_hash
canonical_evidence_digest
other tenant data
other team data
```

Teacher projections may contain authorized lifecycle evidence for the same tenant/course. Tenant Admin projections are limited to tenant-scoped status, approved version, and run binding state.

## Known Limits

- Scenario values are synthetic and uncalibrated.
- The lifecycle proof does not activate PostgreSQL, SQL, migration, ProviderSelector PostgreSQL mode, dual read, dual write, shadow write, or durable settlement.
- Shadow replay evidence is local candidate evidence and does not overwrite official result.
- Browser smoke is partial and does not establish a complete Teacher product workflow.
- R4 Discovery remains read-only only.

Relates to #111. Relates to #114. Relates to #115.
