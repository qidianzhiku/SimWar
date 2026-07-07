# Issue 114 Direct-Store Closeout Matrix

Sources: GitHub issue #114, `scripts/check-direct-store-boundaries.mjs`, `scripts/direct-store-boundary-manifest.json`, `services/api/src/repository-facade.ts`, `services/api/src/repository-ports.ts`, active route source locations, direct-store tests, CI quality evidence, `AGENTS.md`, `DEVELOPMENT_PLAN.md`, `docs/governance/audit-remediation-process.md`.

Current Issue Status: OPEN

This file is a future evaluation template and evidence entry point for #114. It is not a full route audit and does not close #114.

## Evidence Sources

- `scripts/check-direct-store-boundaries.mjs`
- `scripts/direct-store-boundary-manifest.json`
- `services/api/src/repository-facade.ts`
- `services/api/src/repository-ports.ts`
- active route source locations
- `tests/unit/direct-store-boundary-check.test.ts`
- repository facade and provider tests
- CI `quality` evidence

## Status Values

| Status             | Meaning                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| NOT_REVIEWED       | Route or domain has not been reviewed for this matrix.                                         |
| COMPLIANT          | No direct-store access remains in the reviewed active runtime path.                            |
| APPROVED_EXCEPTION | Direct-store access remains but is explicitly approved with owner, reason, and exit condition. |
| NEEDS_REFACTOR     | Direct-store access remains and must move behind facade or ports.                              |
| NOT_APPLICABLE     | Domain is not active runtime, not tenant-scoped, or not storage-backed.                        |

## Future Matrix

| domain_or_route | active_route        | direct_store_access  | allowed_location    | required_facade_or_port | test_evidence      | exception_owner | exception_reason | exit_condition   | status       |
| --------------- | ------------------- | -------------------- | ------------------- | ----------------------- | ------------------ | --------------- | ---------------- | ---------------- | ------------ |
| _template_      | _route or use case_ | _expression or none_ | _file/path or none_ | _facade/port_           | _test/CI evidence_ | _owner_         | _reason_         | _exit condition_ | NOT_REVIEWED |

## Closeout Gate

#114 can be considered for closeout only after:

1. every active route and command path in scope has a row;
2. every remaining direct-store access is either removed or recorded as `APPROVED_EXCEPTION`;
3. `scripts/direct-store-boundary-manifest.json` matches reviewed exceptions;
4. `npm run check:direct-store-boundaries` and required related tests pass in the relevant task;
5. PR wording uses relation wording and avoids closing keywords unless a dedicated issue closeout task is authorized.

This document by itself does not close #114 and does not claim direct-store debt is zero.
