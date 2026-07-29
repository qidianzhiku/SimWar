# L1P-VC-05: Teacher Formal Course/Run Binding and Golden Parity

**Status:** `CLOSED_AND_CURRENT`  
**Product merge:** `#292` / `20d9874b75307d63cf9d993f141528b3da7fada3`  
**Parity evidence merge:** `#293` / `4006ab84401f4d4faed8ea4ab7f15a92ce4746a5`  
**Runtime authority:** `JSON_INTERNAL_ONLY`

## Product Outcome

A Teacher can select an approved, tenant-scoped ScenarioPackage, inspect a server-derived exact Engine Profile, create a formal-bound Course, publish it, and create a formal-bound Run with an explicit seed. The Course and Run bindings use exact ScenarioPackage, ParameterSet, Plugin, and Engine references; the browser does not submit those hidden authority fields.

## Evidence

- `tests/unit/teacher-formal-course-binding-service.test.ts` covers rejected lifecycle, tenant, plugin, Course persistence, and binding-append paths with no surviving Course binding state.
- `tests/unit/formal-bound-run-creation-service.test.ts` covers resolver, Run, Round, and binding-append failures with cleanup.
- `tests/integration/formal-run-runtime-binding-activation.test.ts` covers the Teacher BFF journey, exact inherited Run binding, safe replay projections, direct-path versus Teacher-BFF-path settlement business-result parity, and independent historical results.
- The B5 browser isolation matrix and full browser suite passed for #292; current exact-head CI, browser-smoke, and CodeQL passed for #292 and #293.

## Boundary and Known Limits

- `JSON_INTERNAL_ONLY` remains the only active runtime authority.
- This capability creates bindings; it does not activate PostgreSQL, add an Engine Authority writer, alter Truth-L1 through Truth-L3, or alter SettlementResult, Score, or Rank writers.
- Parity intentionally compares business result fields. Run and team identities are distinct historical records and are not asserted equal.
- Human Validation was waived by Owner and was not performed. Issue #111 remains an open known limit. Durable settlement/recovery, Pilot, and Production are not proven or authorized.

## Successor Boundary

This closure creates no automatic successor. Any further Program B, Course OS, plugin, or runtime work requires a separate mission and authorization.
