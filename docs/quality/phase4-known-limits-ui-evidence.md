# Phase 4 Known Limits UI Evidence

## Scope

This delta adds one versioned, frontend-safe Known Limits catalog and role-safe product disclosure for Teacher, Student, Tenant Admin, and Platform Admin surfaces.

The disclosure is static and read-only. Expanding it does not call an API, write browser storage, mutate the JSON store, or grant an action. Existing API, BFF DTO, auth, tenant, platform, settlement, replay, and persistence semantics remain unchanged.

## Canonical semantics

| ID    | Boundary                                                                                 |
| ----- | ---------------------------------------------------------------------------------------- |
| KL-01 | Internal synthetic validation only; not a real rehearsal, Pilot, or Production release.  |
| KL-02 | JSON remains the default runtime.                                                        |
| KL-03 | Internal rehearsal data is not guaranteed to survive environment reset.                  |
| KL-04 | Replay evidence is not backup, recovery, or disaster recovery.                           |
| KL-05 | Database persistence and durable settlement remain inactive and unproven.                |
| KL-06 | Exceptions, resets, and evidence differences still require manual operating procedures.  |
| KL-07 | UI disclosure and browser evidence do not grant G0 PASS, L1 READY, Pilot, or Production. |
| KL-08 | Role, tenant, and product authority boundaries remain in force.                          |

Policy version: `phase4-known-limits.v1`.

## Role-safe projections

- Teacher: discloses that Teacher actions remain role-bound and candidate preview does not activate scenarios, settle rounds, or publish results.
- Student: states that learning feedback is not a formal grade and does not expand result, team, or tenant visibility.
- Tenant Admin: states that the surface remains tenant-scoped and grants no platform or cross-tenant authority.
- Platform Admin: states that platform scope requires explicit platform authority and is not inferred by the disclosure.

Student copy omits protected implementation markers and private evidence terminology. None of the role projections contains an endpoint, write command, or callback.

## Test-first evidence

The targeted unit guard was added before implementation and failed all seven assertions because the policy version, catalog, and projection function did not exist. After the minimal catalog and UI implementation, the same seven assertions passed.

The browser acceptance test covers:

- real Teacher, Student, Tenant Admin, and Platform Admin sign-in journeys;
- accessible collapsed disclosure using native `details` and `summary` controls;
- mobile `375x812` and desktop `1440x900` layouts;
- no resource request created by expanding the disclosure;
- no protected marker in Student disclosure;
- unchanged digest of Courses, Runs, ScenarioPackages, ParameterSets, and SettlementResults before and after disclosure consumption.

The digest reuses the approved Playwright store helper while the fixture file exists. If an earlier spec has removed that file while the API process remains active, the test falls back to authenticated `demo-state` reads, marks ScenarioPackages and ParameterSets as not exposed on the product read surface, and combines that comparison with a zero-request assertion for the disclosure interaction.

## PR #232 browser-smoke repair evidence

The first remote browser-smoke run (`29253433513`, job `86827257865`) failed on the Teacher mobile journey because `document.documentElement.scrollWidth` exceeded the `375px` viewport. Its retained screenshot, trace, and error context confirmed that the failure occurred after the disclosure rendered and after the no-request and client-storage assertions passed. The failure did not involve the formal-state digest.

A deterministic local guard then measured the Teacher metrics grid at `clientWidth=339` and `scrollWidth=343`. The unbroken `current_json_active_runtime` value supplied the grid item's intrinsic minimum width; Linux runner font metrics made that internal overflow reach the root viewport. The repair allows metric cards to shrink inside the mobile grid and wraps continuous metric values. The browser assertion was strengthened to report any element whose content remains wider than its client box; it was not removed or relaxed.

The same guard failed before the CSS repair and passed after it. It also passed after the CI-order predecessor specs and in the complete default browser suite. Existing evidence remains in force for zero disclosure requests, unchanged cookie/local/session storage, unchanged formal-state digest, Student protected-marker denial, and empty console-error capture.

The associated CodeQL run (`29253433520`, job `86827258102`) failed before source analysis while resolving action download metadata. The authenticated log records repeated `Service Unavailable` responses. This is classified as a GitHub platform setup failure; it is not evidence of a source security finding, and no workflow change or manual rerun was made.

## Validation

| Validation                                | Result                                                        |
| ----------------------------------------- | ------------------------------------------------------------- |
| Canonical catalog unit guard              | PASS, 7/7                                                     |
| Role-safe browser acceptance              | PASS, 2/2                                                     |
| Full serial Vitest                        | PASS, 74 files / 597 tests                                    |
| Default browser suite                     | PASS, 25 passed / 5 opt-in skipped                            |
| Golden M1 and Teacher candidate suite     | PASS, 5/5                                                     |
| Admin authority suite                     | PASS, 5/5                                                     |
| Format, hidden Unicode, lint, typecheck   | PASS                                                          |
| Contract and direct-store boundary guards | PASS                                                          |
| Build                                     | PASS                                                          |
| Dependency audit                          | 2 low / 1 moderate / 2 high / 0 critical; existing advisories |
| PR #232 deterministic overflow RED/GREEN  | FAIL before repair; PASS after repair                         |
| PR #232 CI-order predecessor sequence     | PASS, 9/9                                                     |
| PR #232 repaired default browser suite    | PASS, 25 passed / 5 opt-in skipped                            |

The first full serial Vitest run encountered a transient Node `bad port` error after `listen(0)` selected a fetch-forbidden port. Both affected files passed a bounded 17-test attribution run, and the single full rerun passed all 597 tests. The first default browser run exposed an order-dependent fixture-file assumption in the new test; the test was corrected to use authenticated read fallback, then the full browser suite passed.

## Explicit non-proofs

- Known Limits disclosure does not grant `G0 PASS`.
- Known Limits disclosure does not grant `L1 READY`.
- Browser evidence is not complete security proof.
- Static product disclosure is not real Teacher rehearsal.
- JSON runtime is not durable settlement.
- Replay evidence is not backup or recovery proof.
- This implementation does not authorize Controlled Pilot or Production.

## Status boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

Phase 4 Product Surface:
PHASE4_FAIL_UNTIL_038D_POSTMERGE_RECLOSURE
```
