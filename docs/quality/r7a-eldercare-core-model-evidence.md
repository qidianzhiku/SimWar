# R7-A Eldercare Core Model Evidence

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY
```

This document records evidence for the R7-A eldercare core model scenario asset. It is not a release note, Pilot approval, Production approval or L1 readiness proof.

## Evidence Labels

| Evidence                                   | Label                       | Source                                           |
| ------------------------------------------ | --------------------------- | ------------------------------------------------ |
| Deterministic model output                 | `SOURCE_ONLY_INFERENCE`     | simulation tests                                 |
| Scenario compiler and fixture parity       | `CONTRACT_BACKED_EVIDENCE`  | fixture comparison test                          |
| Plugin manifest and non-overwrite boundary | `SOURCE_ONLY_INFERENCE`     | plugin conformance test                          |
| Golden M1 compatibility                    | `INTEGRATION_TEST_EVIDENCE` | integration test with existing settlement engine |

## Validation Coverage

| Test                                                              | Coverage                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `tests/simulation/r7a-eldercare-core-model.test.ts`               | deterministic model metrics, learner-safe projection, controlled failure             |
| `tests/simulation/r7a-eldercare-scenario-compiler.test.ts`        | six-round scenario asset, status boundary, fixture parity                            |
| `tests/simulation/r7a-eldercare-plugin-conformance.test.ts`       | plugin manifest, scenario-only authority, official-result non-overwrite              |
| `tests/integration/r7a-eldercare-golden-m1-compatibility.test.ts` | candidate scenario asset remains consumable by current Golden M1 settlement boundary |

## Student Visibility Boundary

The learner projection is limited to:

- demand band
- capacity band
- quality signal
- suggested classroom discussion prompts
- `replay_writes_formal_results = false`

The projection must not expose formal truth fields, private replay manifest data, runtime digest fields, Teacher private metadata, Tenant Admin private metadata, other tenant data or other team data.

## Replay and Non-Overwrite Boundary

R7-A only asserts that the plugin asset and model evaluation do not write formal results. It does not perform a complete replay service rehearsal, shadow replay execution, backup restore, distributed recovery test or PostgreSQL transaction test.

## Direct-Store Delta

```text
Expected Direct-Store Delta:
NONE
```

The implementation does not add direct store reads or writes. It does not modify `services/api/src/server.ts`, repository adapters, repository facade, schemas, OpenAPI, migrations or workflow configuration.

## Known Limits

- Metrics are model foundation signals, not production-grade actuarial or medical calculations.
- Fixture parity proves deterministic asset generation only.
- Golden M1 compatibility proves current engine compatibility only.
- Browser, E2E, real teacher rehearsal, real tenant data and production observability remain outside this R7-A scope.

## Issue Relationship

Relates to #111. Relates to #114. Relates to #115.
