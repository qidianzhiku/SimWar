# R7-C Scenario Factory Runtime Evidence

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY
```

本文记录 `R7-C` 的本地证据。它不是 `G0 PASS`、`L1 READY`、`Pilot READY`、`Production READY` 或 durable settlement proof。

## Evidence Matrix

| Capability                                 | Evidence                                                        | Label                       | Result Boundary                    |
| ------------------------------------------ | --------------------------------------------------------------- | --------------------------- | ---------------------------------- |
| Scenario Family V1                         | `buildR7CBeijingYanjiaoScenarioFamily`                          | `CONTRACT_BACKED_EVIDENCE`  | synthetic-only family              |
| Scenario Registry                          | `createR7CScenarioRegistry`                                     | `CONTRACT_BACKED_EVIDENCE`  | no store write                     |
| Teacher authoring                          | `createR7CScenarioAuthoringDraft` through release candidate     | `UNIT_TEST_EVIDENCE`        | teacher authority only             |
| Compile determinism                        | repeated family and shadow arena equality assertions            | `UNIT_TEST_EVIDENCE`        | deterministic synthetic inputs     |
| Validation failure classification          | invalid family test                                             | `UNIT_TEST_EVIDENCE`        | no scope expansion                 |
| Freeze immutability                        | bound mutation rejection                                        | `UNIT_TEST_EVIDENCE`        | requires new version               |
| Scenario / parameter / plugin / shock diff | `buildR7CScenarioDiffAndTrace`                                  | `UNIT_TEST_EVIDENCE`        | redacted evidence only             |
| Shadow Arena Batch                         | `buildR7CShadowArenaBatch`                                      | `SHADOW_ARENA_EVIDENCE`     | candidate evidence only            |
| Golden M1 compatibility                    | `tests/integration/r7c-golden-m1-runtime-compatibility.test.ts` | `INTEGRATION_TEST_EVIDENCE` | existing engine path only          |
| R3 tenant/projection compatibility         | projection and cross-tenant assertions                          | `INTEGRATION_TEST_EVIDENCE` | no route mutation                  |
| Student negative visibility                | private marker assertions                                       | `INTEGRATION_TEST_EVIDENCE` | redacted scenario observation only |
| Browser smoke                              | `tests/e2e-ui/r7c-scenario-factory-browser-smoke.spec.ts`       | `E2E_BROWSER`               | partial browser projection proof   |
| R4 Discovery                               | `docs/architecture/r4-discovery-parity-gap-directory.md`        | `SOURCE_ONLY_INFERENCE`     | no R4 Macro                        |

## Validation Commands

Required validation for this package:

```text
npm ci
npm test -- tests/simulation/r7c-scenario-factory-runtime.test.ts
npm test -- tests/simulation/r7c-shadow-arena-batch.test.ts
npm test -- tests/integration/r7c-golden-m1-runtime-compatibility.test.ts
npm test -- tests/e2e-ui/r7c-scenario-factory-browser-smoke.spec.ts
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

This package does not modify `services/api/src/server.ts`, repository adapters, repository facade, OpenAPI, schemas, database files, migrations, workflow files, package files, or lockfiles.

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

Teacher projections may contain authorized scenario factory evidence for the same tenant/course. Tenant Admin projections are limited to tenant-scoped status and current candidate state.

## Known Limits

- Scenario values are synthetic and uncalibrated.
- Shadow Arena evidence is local candidate evidence and does not publish scenarios.
- Browser smoke is partial and does not establish a complete Teacher product workflow.
- No PostgreSQL, SQL, migration, ProviderSelector PostgreSQL mode, dual read, dual write, shadow write or durable settlement is activated.
- `npm audit --json` can report non-critical dependency findings; remediation requires separate package/lockfile authorization.

Relates to #111.
Relates to #114.
Relates to #115.
