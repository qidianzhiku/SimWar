# R7 BFF Endpoint Contract Draft

Source master: `40e4e6b2e7c1440598e54dc92ea66a5d9d8160d3`

This package freezes a future BFF endpoint boundary only. It does not add an
API route, server handler, frontend fetch, service registration, IO, scenario
runtime activation, or database contract.

The future request context must carry explicit `tenant_id`, `course_id`,
`run_id`, `scenario_package_id`, and `parameter_set_id`. A future response is
a redacted projection and may contain advisory-only references, never
`state_true`, private replay, official result writes, or protected digests.

The only next gate is `OWNER_AUTHORIZED_R7_BFF_ENDPOINT_IMPLEMENTATION`.
Until that gate exists, this document remains a contract draft and not a
runtime capability.

Status boundary: `G0 Status: EXCEPTION`, `G0 PASS: NOT_GRANTED`,
`L1 Status: NOT_READY`, `R8-G1: INTERNAL_ONLY_DRAFT_NOT_RELEASED`.
