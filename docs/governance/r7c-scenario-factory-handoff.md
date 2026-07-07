# R7-C Scenario Factory Runtime Independent Review Handoff

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY
```

This handoff prepares the `R7-C` pull request for independent evidence review. It does not authorize review, approval, merge, issue closeout, branch protection mutation, ruleset mutation, workflow rerun, Pilot, Production, PostgreSQL runtime, SQL, migration or durable settlement.

## Review Checklist

| Review Item             | Expected Evidence                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| PR file scope           | R7-C simulation-core source, exports, fixture, tests, docs and R4 Discovery doc update only            |
| Package integrity       | No `package.json` or `package-lock.json` changes                                                       |
| Runtime scope           | No service, server, route, auth, schema, OpenAPI, database, migration, workflow or direct-store change |
| Scenario Family         | five Beijing-Yanjiao synthetic variants with deterministic seeds                                       |
| Registry scope          | Teacher-visible, Student-hidden, Tenant Admin tenant-scoped                                            |
| Authoring state machine | draft, compile, validate, approve, freeze, release candidate, bind                                     |
| Freeze immutability     | bound scenario mutation rejected and requires new scenario version                                     |
| Shadow Arena            | all variants evaluated as candidate evidence, no formal replay/result write                            |
| Golden M1 compatibility | existing settlement engine path remains usable                                                         |
| R3 compatibility        | cross-tenant denial and Student redaction covered                                                      |
| Student redaction       | no private scenario, parameter, plugin trace, replay, digest, other tenant or other team data          |
| Browser smoke           | existing Playwright harness only, classified as partial browser evidence                               |
| R4 Discovery            | documentation update only; R4 Macro remains `NOT_AUTHORIZED`                                           |

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

1. Does `R7-C` reuse existing `R7-B`, Golden M1 and simulation-core paths instead of creating a second settlement engine?
2. Are Scenario Family, Registry, Authoring Draft, Release Candidate and Shadow Arena boundaries deterministic and synthetic-only?
3. Does any Student-facing projection leak protected truth, private trace, private replay, private assumption, digest, other tenant or other team data?
4. Does any code path change `SettlementResult`, `state_true`, replay hash semantics, manifest hash semantics or canonical evidence digest semantics?
5. Does Shadow Arena remain candidate evidence only, without official result overwrite or formal replay write?
6. Are all known limits stated without claiming `G0 PASS`, `L1 READY`, `Pilot READY`, `Production READY`, PostgreSQL readiness or durable settlement?

## Required Next Step

```text
INDEPENDENT_EVIDENCE_REVIEW_OF_R7C_SCENARIO_FACTORY_RUNTIME_AND_SHADOW_ARENA_PR
```

No automatic merge or follow-on implementation is authorized by this handoff.

Relates to #111.
Relates to #114.
Relates to #115.
