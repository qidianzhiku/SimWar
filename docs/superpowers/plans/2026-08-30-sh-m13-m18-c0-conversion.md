# Shanghai M13-M18 C0 Conversion

## Goal

Convert the existing Shanghai/MOD C1 support surfaces into one current, observable, role-safe C0 product-consumption seam for M13 through M18. The seam is read-only with respect to official truth, settlement, parameter state, replay truth, and registry/runtime authority.

## Architecture and constraints

- Add one shared `ShanghaiC0Conversion` contract with exact run binding, macro id, experience profile, bounded experiment input, consumer receipt, and separate Teacher/Student/Admin projections.
- Add one API service and one route family. The service validates the current tenant/run/round/team binding and stores only an in-process candidate receipt; it never writes official state.
- Map M13-M18 to existing current consumer surfaces: W4/ESL/M4, W5/Teacher Scenario Studio, O4/W4, W5/Shanghai Full Vertical, ESL/learning, and Regional Transfer/Enterprise Course Factory. Candidate support remains explicitly labelled and qualification/calibration remains `NOT_PROVEN`.
- Student reads require enrolled-team scope. Student choice is a non-official draft projection, never a canonical Decision or settlement input.
- Add OpenAPI/JSON Schema and focused unit, integration, contract, and UI projection tests. Mount role-specific lightweight panels in the existing Teacher, Student, and Admin apps behind an explicit exact-context query.
- Do not add providers, PostgreSQL/RLS runtime, a second Truth/Settlement/Registry/Runtime writer, implicit latest resolution, or production/pilot behavior.

## Planned files

- `packages/shared-contracts/src/shanghai-c0-conversion.ts`
- `packages/shared-contracts/src/index.ts`
- `contracts/schemas/shanghai-c0-conversion.v1.json`
- `contracts/openapi/p0-api.openapi.yaml`
- `services/api/src/shanghai-c0-conversion-service.ts`
- `services/api/src/routes/shanghai-c0-conversion-routes.ts`
- `services/api/src/server.ts`
- `tests/unit/shanghai-c0-conversion-service.test.ts`
- `tests/integration/shanghai-c0-conversion-endpoint.test.ts`
- `tests/contract/shanghai-c0-conversion-contract.test.ts`
- `apps/teacher/src/ShanghaiC0ConversionWorkspace.tsx`
- `apps/student/src/ShanghaiC0ConversionProjection.tsx`
- `apps/admin/src/ShanghaiC0ConversionAuditPanel.tsx`
- existing app entrypoints for explicit query-gated mounts

## Execution sequence

1. Add failing shared-contract/service tests for exact binding, six macro mapping, role-safe projection, student choice, and non-write behavior.
2. Implement the shared contract and deterministic service; run focused tests to green.
3. Wire the route and current repository read-only checks; add integration and contract tests.
4. Add minimal role-specific product panels and query-gated mounts; run typecheck/build and focused UI tests.
5. Re-run the full relevant local gates, inspect the diff and source boundary, and record M13–M18 State A→B receipts.
6. Create the implementation/evidence pack, open/update only the single current Product PR slot, run CI/CodeQL/review remediation, ordinary merge, detached post-merge verification, and the canonical final ZIP with independent archive checks.

## Acceptance

- All six macros return a current C0 consumer receipt with exact binding and a named current consumer surface.
- Teacher receives experiment controls and evidence; Student receives only safe mechanism/constraint/uncertainty content; Admin receives lineage and rights/qualification metadata.
- Invalid or stale bindings, unknown macro ids, malformed choices, and cross-team student reads fail closed.
- Official store snapshots and settlement/replay truth remain byte-identical across create and student-choice operations.
- `MODEL_CALIBRATED`, production, pilot, human validation, and PostgreSQL/RLS activation are never asserted.
