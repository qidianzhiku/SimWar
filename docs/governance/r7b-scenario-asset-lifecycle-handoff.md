# R7-B Scenario Asset Lifecycle Independent Review Handoff

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY
```

This handoff package prepares the `R7-B` pull request for independent evidence review. It does not authorize merge, review bypass, issue closeout, branch protection mutation, ruleset mutation, workflow rerun, Pilot, Production, PostgreSQL runtime, SQL, migration, or durable settlement.

## Review Checklist

| Review Item             | Expected Evidence                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| PR file scope           | Only R7-B lifecycle source, tests, fixture, docs, and R4 Discovery doc update                               |
| Package integrity       | No `package.json` or `package-lock.json` changes                                                            |
| Runtime scope           | No service, server, route, auth, schema, OpenAPI, database, migration, workflow, or direct-store change     |
| Lifecycle state machine | `DRAFT -> COMPILED -> VALIDATED -> APPROVED -> FROZEN -> BOUND_TO_RUN` covered                              |
| Approval authority      | Student and cross-tenant teacher denial covered                                                             |
| Freeze immutability     | Bound scenario mutation rejected and requires new scenario version                                          |
| Run binding             | ScenarioPackage version, ParameterSet version, plugin version, compiler version, seed and hashes recorded   |
| Diff and trace          | Scenario, parameter, plugin, and shock diff covered with visibility metadata                                |
| Student redaction       | No private scenario, parameter, plugin trace, shock detail, replay, digest, other tenant or other team data |
| Teacher evidence        | Same-tenant authorized scenario evidence available                                                          |
| Tenant Admin scope      | Tenant-scoped status only                                                                                   |
| Golden M1 compatibility | Existing settlement engine path remains usable                                                              |
| Shadow replay           | Evidence does not overwrite official result                                                                 |
| Browser smoke           | Existing Playwright harness only, classified as `E2E_BROWSER_PARTIAL_ONLY`                                  |
| R4 Discovery            | Documentation update only; R4 Macro remains `NOT_AUTHORIZED`                                                |

## Explicit Non-Authorization

```text
PR review / approval / merge: NOT_AUTHORIZED
Issue mutation / closeout: NOT_AUTHORIZED
Branch protection / ruleset mutation: NOT_AUTHORIZED
Workflow rerun / dispatch: NOT_AUTHORIZED
PostgreSQL / SQL / migration: NOT_AUTHORIZED
Pilot / Production: NOT_AUTHORIZED
```

## Independent Review Questions

1. Does the lifecycle module remain pure and deterministic?
2. Are all synthetic scenario assumptions clearly marked as uncalibrated teaching assumptions?
3. Does any Student-facing projection leak protected truth, private trace, private replay, or cross-tenant data?
4. Does any code path change `SettlementResult`, `state_true`, replay hash semantics, manifest hash semantics, or canonical evidence digest semantics?
5. Does the R7-B PR preserve Golden M1, R3, R7-A, contract, lint, build, E2E, hidden unicode, audit, and direct-store boundaries?
6. Are known limits stated without claiming `G0 PASS`, `L1 READY`, `Pilot READY`, `Production READY`, PostgreSQL readiness, or durable settlement?

## Required Next Step

```text
INDEPENDENT_EVIDENCE_REVIEW_OF_R7B_SCENARIO_ASSET_RUNTIME_INTEGRATION_PR
```

No automatic merge or follow-on implementation is authorized by this handoff.

Relates to #111. Relates to #114. Relates to #115.
