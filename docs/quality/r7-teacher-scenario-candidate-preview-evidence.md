# R7 Teacher Scenario Candidate Preview Evidence

## Evidence identity

- Evidence ID: `E-043O-R7-TEACHER-SCENARIO-CANDIDATE-PREVIEW`
- Source SHA: `ee4342000f6d3247d1b9d32feb2fd462e116fac7`
- Branch: `codex/r7-scenario-candidate-preview-20260711-150634`
- Owner: Marshall
- Collected at: 2026-07-11
- Freshness: current for this branch head until an expiry trigger occurs

## Delivered surface

The product slice adds one read-only endpoint:

```text
GET /api/v1/bff/teacher/runs/:runId/scenario-package-candidates
R7_TEACHER_SCENARIO_PACKAGE_CANDIDATES_GET_V1
```

The endpoint resolves the run through `RepositoryFacade`, uses authenticated server tenant context,
and projects only `run_id`, `current_scenario_package_id`, and the minimal candidate list. The Teacher
surface holds the selected preview in React memory only. It does not send a write request or use
`localStorage` / `sessionStorage`.

## Evidence handoff

| Evidence type                 | Evidence                                                     | Proof scope                                                            | Explicit non-proof                  |
| ----------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------- |
| BFF Contract Evidence         | Shared DTO and OpenAPI operation                             | One GET route and minimal response shape                               | Not Scenario selection persistence  |
| Teacher Auth/Tenant Evidence  | Integration 401/403/non-oracle 404 tests                     | Teacher-only, authenticated tenant and run scope                       | Not full repository security proof  |
| Candidate Projection Evidence | Exact response assertions and private-field scans            | Same-tenant IDs, names, versions, current marker                       | Current marker is not compatibility |
| Teacher Browser Path Evidence | Golden Playwright Teacher journey                            | Real BFF consumption and local preview                                 | Not Scenario compile or activation  |
| Student Zero-Request Evidence | Golden Playwright Student journey                            | No automatic candidate request or DOM surface                          | Not every possible Student surface  |
| DOM Negative Evidence         | Playwright private-marker assertions                         | Candidate panel does not render protected fields                       | Not complete data-flow analysis     |
| Console Redaction Evidence    | Browser console assertions                                   | No protected marker emitted by this journey                            | Not complete observability review   |
| Network No-Mutation Evidence  | Method and forbidden-path assertions                         | Candidate path is GET-only; no assignment/activation/Replay/Settlement | Not durable transaction proof       |
| Formal-State Digest Evidence  | ScenarioPackages/ParameterSets/Runs/SettlementResults digest | Preview does not change the isolated JSON fixture                      | Not PostgreSQL parity               |
| Fixture Isolation Evidence    | Opt-in Golden fixture and default E2E run                    | Synthetic candidates are isolated from default E2E                     | Not Controlled Pilot evidence       |
| Source Integrity Evidence     | Hidden Unicode, diff, allowlist, and byte scans              | Changed source and evidence files only                                 | Not a full supply-chain audit       |

## Validation and revalidation

Required validation includes targeted integration tests, the dedicated Golden browser journey,
default E2E isolation, contract, lint, typecheck, direct-store boundary, security audit, full serial
Vitest, build, format, hidden Unicode, and `git diff --check`.

Revalidate this evidence when any of the following changes:

- PR head or remote master
- candidate endpoint, projection, auth, or tenant middleware
- repository ScenarioPackage list contract
- Teacher or Student product routes
- Golden fixture lifecycle
- package, lockfile, or workflow configuration

No-Go conditions include Student visibility, cross-tenant data, private projection, direct-store
access, formal-state writes, Run assignment, Scenario activation, ParameterSet mutation, Replay,
Settlement, or an unexpected file outside the frozen allowlist.

## Explicit non-proofs

- Candidate endpoint is not Scenario selection persistence.
- Local preview is not Run assignment.
- Candidate list is not Scenario readiness or compatibility.
- Browser evidence is not complete security proof.
- JSON runtime is not PostgreSQL parity or durable settlement.
- A pull request is not a merge, G0 PASS, L1 readiness, Controlled Pilot, or Production readiness.
