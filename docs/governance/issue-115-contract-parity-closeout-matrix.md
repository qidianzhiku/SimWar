# Issue 115 Contract Parity Closeout Matrix

Sources: GitHub issue #115, `contracts/openapi`, `contracts/schemas`, `contracts/fixtures`, `packages/shared-contracts`, `scripts/check-contracts.mjs`, route behavior tests, contract baseline evidence, `AGENTS.md`, `DEVELOPMENT_PLAN.md`, `docs/governance/audit-remediation-process.md`.

Current Issue Status: OPEN

This file is a future evaluation template and evidence entry point for #115. It is not a P0 API full parity audit and does not close #115.

## Evidence Sources

- `contracts/openapi/p0-api.openapi.yaml`
- `contracts/schemas/*.v1.json`
- `contracts/fixtures/*.valid.json`
- `packages/shared-contracts/src/index.ts`
- `scripts/check-contracts.mjs`
- route behavior tests
- contract baseline evidence
- CI `quality` evidence

## Status Values

| Status | Meaning |
| --- | --- |
| NOT_IN_SCOPE | Route or object is outside the reviewed slice. |
| PARTIALLY_ALIGNED | Some contract layers exist, but parity is incomplete. |
| ALIGNED | OpenAPI, JSON Schema, shared type, fixture, route behavior, and tests are aligned for the reviewed slice. |
| KNOWN_DRIFT | A documented mismatch exists. |
| BLOCKED_BY_DECISION | A product, architecture, or governance decision is needed before parity can be evaluated. |

## Future Matrix

| p0_route | openapi | json_schema | shared_type | fixture | route_behavior | tenant_role_scope | idempotency | audit_fields | contract_test | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| _template_ | _path/operation_ | _schema_ | _type/guard_ | _fixture_ | _test/evidence_ | _scope evidence_ | _idempotency evidence_ | _audit evidence_ | _test evidence_ | PARTIALLY_ALIGNED |

## Closeout Gate

#115 can be considered for closeout only after:

1. every P0 route in scope has a matrix row;
2. OpenAPI, JSON Schema, shared type, fixture, route behavior, tenant/role scope, idempotency, audit fields, and contract tests are aligned or explicitly out of scope;
3. current contract tests validate more than file presence for the reviewed route family;
4. known drift rows are eliminated or assigned to a later accepted scope;
5. PR wording uses relation wording and avoids closing keywords unless a dedicated issue closeout task is authorized.

This document by itself does not close #115 and does not claim P0 API parity or contract drift is complete.
