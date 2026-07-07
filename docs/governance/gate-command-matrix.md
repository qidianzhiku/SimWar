# Gate Command Matrix

Sources: `package.json`, workspace package files, `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `vitest.config.ts`, `playwright.config.ts`, `scripts/check-contracts.mjs`, `scripts/check-direct-store-boundaries.mjs`, `AGENTS.md`, `DEVELOPMENT_PLAN.md`, `docs/governance/audit-remediation-process.md`.

This matrix records currently discoverable commands and CI checks. It does not execute them and does not create new gates.

`npm test` currently runs `npm run build:test-prerequisites` before `vitest run`, so clean-clone Vitest integration tests consume `@simwar/simulation-core` through its built package contract instead of a test-only source alias.

## Availability Values

| Value | Meaning |
| --- | --- |
| LOCAL_COMMAND_AVAILABLE | A root or workspace package script exists locally. |
| CI_CHECK_AVAILABLE | A GitHub Actions job/check exists, but no equivalent local aggregate command exists. |
| BOTH_AVAILABLE | Local command and CI check evidence both exist. |
| PARTIAL | Some relevant commands exist, but a dedicated gate is missing or shallow. |
| COMMAND_NOT_AVAILABLE | No command or check was found for the claimed capability. |

`quality` is a CI job in `.github/workflows/ci.yml`; it is not a local `npm run quality` command.

## Matrix

| Domain | Trigger condition | Local required commands | CI required checks | Optional commands or checks | Source path | Availability | Not-available handling | Evidence artifact candidate | Risk tier |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auth / Tenant / Membership | Auth, session, tenant, role, membership, or decision authorization changes. | `npm run lint`; `npm run typecheck`; `npm test` | `quality`; `Analyze JavaScript and TypeScript` | `npm run test:e2e:ui` when browser-visible authorization is touched. | `package.json`; `.github/workflows/ci.yml`; `.github/workflows/codeql.yml`; `vitest.config.ts`; `playwright.config.ts` | BOTH_AVAILABLE | If no focused test exists, task must add or cite a focused Vitest/integration seam before claiming coverage. | lint, typecheck, build:test-prerequisites, Vitest, CodeQL/quality check logs | RISK_TIER_0 |
| Team / Course / Run | Course, Team, Run, Round, or lifecycle route/model changes. | `npm run lint`; `npm run typecheck`; `npm test`; `npm run build` | `quality` | `npm run test:e2e:ui` for browser-visible workflow changes. | `package.json`; workspace package files; `.github/workflows/ci.yml` | BOTH_AVAILABLE | Missing domain-specific command must be recorded; use focused tests plus aggregate commands. | build:test-prerequisites, Vitest/build/quality logs | RISK_TIER_1 |
| ParameterSet / Replay Manifest | ParameterSet, replay manifest, truth hash, engine input, or Run binding changes. | `npm test`; `npm run test:contract`; `npm run test:postgres-replay` when replay/Postgres mapping is touched. | `quality` | Future `npm run test:replay` is not available. | `package.json`; `scripts/postgres-replay-verification.test.ts`; `contracts/`; `docs/quality/replay-shadow-replay-test-plan.md` | PARTIAL | Dedicated replay command is `COMMAND_NOT_AVAILABLE`; do not claim full replay gate from generic tests. | Vitest, contract, postgres replay reports | RISK_TIER_0 |
| ScenarioPackage / Plugin Reference | Scenario metadata, plugin reference, plugin compatibility, or package lifecycle changes. | `npm test`; `npm run test:contract`; `npm run build` | `quality` | Future `npm run test:plugin-boundary` is not available. | `contracts/`; `packages/shared-contracts/`; `docs/architecture/industry-plugin-model-report.md`; `package.json` | PARTIAL | Add focused tests or document evidence limits; do not claim plugin runtime proof. | Contract, Vitest, build logs | RISK_TIER_1 |
| Settlement | Settlement route, outcome, audit, replay hash, idempotency, result shape, or response header changes. | `npm run check:direct-store-boundaries`; `npm run lint`; `npm run typecheck`; `npm test`; `npm run test:contract`; `npm run test:postgres-replay` | `quality` | No transaction, row-lock, cross-process, or crash-recovery command exists. | `package.json`; `.github/workflows/ci.yml`; `tests/integration/settlement-write-replay-hash-characterization.test.ts` | PARTIAL | Missing durable gates block durable claims. Keep `DO_NOT_START_POSTGRES_OR_CROSS_PROCESS_IMPLEMENTATION` active. | Direct-store, Vitest, contract, postgres replay logs | RISK_TIER_0 |
| Contract Parity | OpenAPI, JSON Schema, fixtures, shared contracts, route payloads, DTOs, or error schema changes. | `npm run test:contract`; `npm run typecheck`; `npm test` | `quality` | Future `npm run openapi:lint`, `npm run schema:check`, and full schema drift gate are unavailable. | `package.json`; `scripts/check-contracts.mjs`; `contracts/`; `packages/shared-contracts/src/index.ts` | PARTIAL | Current `test:contract` is baseline/presence-oriented; use focused schema/fixture tests for parity claims. | Contract check and focused validation logs | RISK_TIER_1 |
| Frontend / Browser Smoke | Browser-visible app route, seeded flow, or UI interaction changes. | `npm run typecheck`; `npm run build`; `npm run test:e2e:ui` | `browser-smoke`; `quality` | Manual browser screenshot only when task authorizes it. | `package.json`; `playwright.config.ts`; `.github/workflows/ci.yml` | BOTH_AVAILABLE | If local Playwright cannot run, use CI browser-smoke or record blocked evidence. | Playwright report, browser-smoke artifacts | RISK_TIER_1 |
| Direct-Store / RepositoryFacade Boundary | Route, provider, facade, repository port, direct-store guard, or storage boundary changes. | `npm run check:direct-store-boundaries`; `npm test` | `quality` | Future `npm run lint:boundaries` is unavailable. | `scripts/check-direct-store-boundaries.mjs`; `scripts/direct-store-boundary-manifest.json`; `tests/unit/direct-store-boundary-check.test.ts` | BOTH_AVAILABLE | Script guards manifest expansion; it is not a full route architecture audit. | Direct-store guard log, manifest diff | RISK_TIER_0 |

## Current Local Commands

- `npm run check:hidden-unicode`
- `npm run format:check`
- `npm run lint`
- `npm run security:audit`
- `npm run typecheck`
- `npm run build:test-prerequisites`
- `npm test`
- `npm run test:contract`
- `npm run test:postgres-replay`
- `npm run test:e2e:ui`
- `npm run build`
- `npm run check:direct-store-boundaries`

## Current CI Checks

- `quality`
- `browser-smoke`
- `Analyze JavaScript and TypeScript`

## COMMAND_NOT_AVAILABLE

The following commands were not found in the current root `package.json`:

- `npm run quality`
- `npm run lint:boundaries`
- `npm run check:unused`
- `npm run test:coverage`
- `npm run check:schemas`
- `npm run check:migrations`
- `npm run test:migration`
- `npm run test:migration:apply`
- `npm run test:postgres-adapter`
- `npm run test:replay`
- `npm run test:settlement-idempotency`
- `npm run test:plugin-boundary`
- `npm run openapi:lint`
- `npm run schema:check`

For RISK_TIER_0 work, missing commands block claims unless the task provides an explicit equivalent evidence path. For RISK_TIER_1 work, missing commands must be reported and cannot be described as passed. For RISK_TIER_2 work, record the gap and continue only if the task scope allows it.
