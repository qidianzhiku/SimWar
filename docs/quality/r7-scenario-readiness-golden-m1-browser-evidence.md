# R7 Scenario Readiness Golden M1 Browser Evidence

## Scope

This internal-only Playwright package proves the existing Teacher Scenario Readiness BFF can read a disposable synthetic Golden M1 fixture. It covers a real `READY` response, a real `BLOCKED` response for a `candidate` ParameterSet, and the absence of the Teacher surface from the Student application.

## Fixture And Reset Boundary

`tests/e2e-ui/store-isolation.ts` removes `services/api/tmp/playwright-store.json` before the Playwright API server starts. Only the dedicated harness command, with `SIMWAR_PLAYWRIGHT_GOLDEN_M1=true`, then writes a disposable JSON snapshot containing these synthetic identifiers:

- `scenario_r7_golden_m1_ready`
- `param_r7_golden_m1_ready`
- `param_r7_golden_m1_blocked`

The fixture is test-only. It uses the JSON runtime snapshot and is removed after the Golden M1 spec. It does not create a product seed endpoint, alter a course binding, or activate a Scenario Package.

Run the dedicated harness with:

```powershell
$env:SIMWAR_PLAYWRIGHT_GOLDEN_M1 = "true"
npm run test:e2e:ui -- tests/e2e-ui/zz-r7-golden-m1-scenario-readiness-evidence.spec.ts
```

The default full E2E suite leaves this fixture disabled so its baseline create-Run lifecycle stays unchanged.

## Browser Journeys

`tests/e2e-ui/zz-r7-golden-m1-scenario-readiness-evidence.spec.ts` verifies:

1. A Teacher receives `READY` for the approved synthetic references through the existing read-only BFF and the real Teacher panel.
2. A Teacher's already-authenticated browser receives `BLOCKED` with `R7_BFF_PARAMETER_SET_NOT_APPROVED` for a separately bound synthetic `candidate` ParameterSet through the same real read-only BFF, without route mocking.
3. A Student has no readiness panel and sends no request to the Teacher readiness endpoint.
4. The readiness request is `GET`, has no `x-tenant-id`, triggers no internal settlement, replay, activation, or publication request, and leaves the selected formal-state digest unchanged.
5. The readiness panel and browser console do not expose the guarded private markers asserted by the test.

The `zz-` filename keeps this supplemental evidence after legacy browser flows, while each Teacher journey independently creates or reuses the synthetic Run state and does not require a pristine initial action label.

## Explicit Non-Proofs

- `READY` does not activate a Scenario runtime or bind an official ParameterSet.
- `BLOCKED` does not execute Replay or settlement.
- The state digest comparison is browser-interaction evidence, not a durable recovery proof.
- The package is not Teacher rehearsal, Pilot, Production, PostgreSQL, or L1 readiness evidence.

## Revalidation And Expiry

Re-run the focused Golden M1 spec, the full E2E suite, and the repository quality commands when the readiness BFF, Teacher UI, Student visibility boundary, Playwright JSON fixture lifecycle, or Scenario/ParameterSet contracts change.
