# MOD-06 Model Governance Authority Receipt

| Field                   | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| Mission                 | `MOD-06`                                                           |
| Gate                    | `MODEL_AUTHORITY_PASS`                                             |
| Qualification scope     | `CONTRACT_AND_STATE_MACHINE_STRUCTURAL_ONLY`                       |
| V1.0 plan               | `SIMWAR-MOD-AGT-DUAL-TRACK-PLAN-V1.0-20260820`                     |
| V1.0 plan SHA-256       | `EF2104E90C04A811697749388999E31AE27BCFC457D7804FB765A10C68120260` |
| Current source baseline | `origin/master@0f2cdcb88c4c660f2a1ef6389dc38e90a853ef81`           |
| Canonical authority ID  | `SIMWAR-MODEL-GOVERNANCE-PLANE`                                    |
| Sole declared writer    | `MAIN_MODEL_GOVERNANCE`                                            |
| Runtime authority       | `JSON_INTERNAL_ONLY`                                               |
| Provider calls          | `0`                                                                |
| Official truth writer   | `false`                                                            |
| Activation policy       | `NOT_AUTHORIZED`                                                   |
| CodeGraph               | `UNAVAILABLE_DOT_CODEGRAPH_ABSENT`                                 |

## Current-source finding

Current source proves an append-only `ParameterSetVersion` authority through
`ParameterSetCommandService` and `ParameterSetRegistryPort`. The existing
`ParameterSetVersion.model_version_ref` is an exact-looking string carried into
formal Run binding, not a proven ModelVersion lifecycle entity or registry.
The MOD-04 `ModelCandidateRegistry` remains research/candidate evidence and is
not promoted to runtime authority. MOD-06 therefore adds one canonical
contract plane and pure state/reference guards without introducing a second
registry, persistence port, runtime resolver, or route.

## Delivered contract

- `model-governance-plane.v1` represents `ModelSpec`, `ModelVersion`,
  `Experiment`, `CalibrationRun`, `Approval`, `Activation`, `Retirement`, and
  `Rollback` records under one authority identity.
- Every cross-record ModelVersion reference requires exact ID, semver, and
  lowercase SHA-256 digest. Floating `latest`, wildcard, caret, and tilde
  selectors are rejected by the shared helper and excluded by the schema.
- The pure lifecycle boundary is
  `DRAFT -> VALIDATED -> FROZEN -> APPROVED -> ACTIVE -> RETIRED`, with the
  approved-to-retired path allowed for direct retirement. Reverse transitions
  and content replacement are rejected; transition output preserves every
  non-status identity and is deeply frozen.
- Activation and rollback records are parseable governance history only and
  require `runtime_activation=false`. The authority contract fixes provider
  calls to zero and official truth writer to false.
- `assertModelGovernancePlaneIntegrity` rejects duplicate identities and every
  dangling exact ModelSpec/ModelVersion reference, including `supersedes` and
  rollback endpoints, for arbitrary plane payloads rather than only fixtures.
- Empty governance-history collections are valid for a newly initialized plane;
  retirement proposals require request metadata, while completed retirements
  require completed-by/time metadata.
- SemVer validation rejects leading-zero core or numeric prerelease identifiers,
  empty prerelease segments, and other non-SemVer exact selectors at both the
  shared-helper and JSON Schema boundaries.
- The shared writer guard accepts only `MAIN_MODEL_GOVERNANCE` and rejects
  AGT, SH, FE, Teacher, Student, provider, Simulation Core, ParameterSet, and
  frontend writers.

## Exact changed paths

The MOD-06 change set is limited to these paths:

- `packages/shared-contracts/src/model-governance.ts`
- `packages/shared-contracts/src/index.ts`
- `contracts/schemas/model-governance-plane.v1.json`
- `contracts/fixtures/model-governance-plane.valid.json`
- `contracts/fixtures/model-governance-plane.invalid.json`
- `tests/unit/model-governance.test.ts`
- `tests/contract/model-governance-plane-contract.test.ts`
- `scripts/contract-validation-facade.mjs`
- `package.json`
- `docs/superpowers/plans/2026-08-22-mod-06-model-governance.md`
- `docs/governance/mod-06-model-governance-authority-20260822.md`

No runtime service, route, OpenAPI, database, provider, frontend, settlement,
Replay, lockfile, or formal authority implementation path is in scope.

## Validation evidence

| Check                                                                                                       | Result                                                             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `npx vitest run tests/unit/model-governance.test.ts tests/contract/model-governance-plane-contract.test.ts` | `PASS` — 8 tests                                                   |
| `node scripts/check-contracts.mjs`                                                                          | `PASS` — 31 schema/fixture case groups                             |
| `npm run test:contract`                                                                                     | `PASS` — 31 files / 73 tests                                       |
| `npm run typecheck`                                                                                         | `PASS`                                                             |
| `npm run check:hidden-unicode`                                                                              | `PASS`                                                             |
| `npm run lint`                                                                                              | `PASS`                                                             |
| MOD-06 scoped `prettier --check`                                                                            | `PASS` — all changed files                                         |
| `npm run format:check`                                                                                      | `LIMITED` — repository baseline reports 85 existing style warnings |
| `npm test`                                                                                                  | `PASS` — 247 test files / 1479 tests                               |

## Explicit non-proofs and stop boundaries

This receipt does not prove or activate:

- a persisted ModelVersion registry or runtime ModelVersion resolver;
- ParameterSet-to-ModelVersion runtime compatibility enforcement;
- provider/model calls, BLP/PyBLP execution, calibration validity, or
  predictive validity;
- activation in JSON, PostgreSQL, Pilot, Production, or Human Validation;
- a new Simulation Core truth writer, SettlementResult writer, Replay writer,
  canonical Decision path, or replay-hash input;
- any automatic successor, implicit latest/current/default selection, or
  registry fork.

`.codegraph/` is absent in the current worktree, so no CodeGraph result is
claimed. Any future persistence, route, runtime activation, ParameterSet
binding, or provider change requires a fresh source read, a separately scoped
mission, and the MAIN shared-contract/authority lock.

The full-repository Prettier result is retained as a baseline limitation; this
mission did not reformat unrelated files. An earlier full-suite attempt showed
two transient `fetch failed / bad port` failures; the fresh final rerun passed
all 247 test files and 1479 tests.
