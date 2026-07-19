# Phase 7 Minimal JSON Lifecycle Controls Evidence

## Scope

This change provides one internal Tenant Admin surface and one minimal BFF vertical slice for
synthetic, pre-settlement, pre-publication runs in the JSON runtime. It implements `ABORT`,
`RESET`, and `CLEANUP` without adding a database, migration, package, workflow, Teacher
mutation surface, Student mutation surface, Replay execution, recovery, restore, or generic
purge path.

The runtime activation marker is server generated in the tenant-scoped `run.create` audit event
only when the repository provider is `json` and `SIMWAR_ENV` is `development` or `test`.
Production, staging, custom providers, unmarked runs, wrong-tenant runs, settled runs, published
runs, and runs with Replay references fail closed.

## Lifecycle State Map

| Source state            | Operation      | Result state  | Persisted artifact mutation                                                   |
| ----------------------- | -------------- | ------------- | ----------------------------------------------------------------------------- |
| `ACTIVE`                | `ABORT`        | `ABORTED`     | append safe lifecycle audit only                                              |
| `ABORTED`               | `RESET`        | `RESET_READY` | reopen locked round control and remove `decision_batch_id`, then append audit |
| `ABORTED`               | `CLEANUP`      | `CLEANED`     | append evidence-sealed tombstone; delete zero persisted artifacts             |
| `RESET_READY`           | `ABORT`        | `ABORTED`     | append safe lifecycle audit only                                              |
| `RESET_READY`           | `CLEANUP`      | `CLEANED`     | append evidence-sealed tombstone; delete zero persisted artifacts             |
| same terminal operation | same operation | unchanged     | idempotent response; no new audit                                             |

`ABORTED` and `CLEANED` runs cannot start a round, submit a decision, lock, settle, or publish.
The server coordinates these operations and lifecycle transitions with the same process-local,
tenant-and-run key lock.

## Authority Matrix

| Actor / boundary                     | Inventory | Mutation                        | Notes                                                |
| ------------------------------------ | --------- | ------------------------------- | ---------------------------------------------------- |
| Tenant Admin in authenticated tenant | allowed   | allowed with exact confirmation | requires `run:lifecycle`                             |
| Teacher                              | denied    | denied                          | no Teacher lifecycle product surface                 |
| Student                              | denied    | denied                          | no Student lifecycle product surface                 |
| Platform Admin                       | denied    | denied                          | tenant scope is not inferred from platform authority |
| Client `x-tenant-id` override        | denied    | denied                          | actor tenant is server-owned session context         |
| PostgreSQL or custom provider        | denied    | denied                          | no parity or activation claim                        |

The BFF client sends only the bearer session and never sends a tenant header. The operation body
must contain exact confirmation text such as `ABORT run_001`.

## Artifact Ownership

The reset allowlist contains only `round_lock_control`, represented by a locked round status and
its transient `decision_batch_id`. The lifecycle service preserves:

- tenant, course, run, scenario, and ParameterSet identity;
- all submitted decision versions and decision evidence;
- audit and security history;
- SettlementResult, official result, score, and rank;
- truth hashes and Replay evidence or references.

Cleanup v1 has an empty delete allowlist. It writes a lifecycle tombstone and permanently blocks
the run; it is not a data purge.

## Runtime And API Surface

- `GET /api/v1/bff/admin/run-lifecycle-controls`
- `POST /api/v1/bff/admin/courses/{courseId}/runs/{runId}/lifecycle/{operation}`
- Admin product surface: `synthetic run lifecycle controls`
- Runtime: `JSON_INTERNAL_ONLY`
- Environment: `development` or `test`

The OpenAPI contract fixes the role boundary, exact confirmation, state and operation enums,
fail-closed responses, and cleanup zero-delete semantics.

## Security And Privacy Evidence

- Integration tests cover unauthenticated, Teacher, Student, cross-tenant, wrong-course,
  wrong-run, non-synthetic, settled, published, and unfrozen evidence denial paths.
- Browser evidence verifies no client tenant header and no protected truth or private Replay
  markers in the product surface, console, cookies, local storage, or session storage.
- Audit events contain lifecycle state, allowlist version, changed-artifact names, and the
  evidence-freeze flag. They do not contain decision payloads, credentials, truth payloads, or
  private Replay artifacts.
- Codex Security Plugin: `NOT_AVAILABLE` in the implementation session. This is not security
  proof; source review, negative tests, boundary checks, dependency audit, and browser evidence
  are the recorded fallback.

## Validation

| Command / evidence                          | Result                                      |
| ------------------------------------------- | ------------------------------------------- |
| Initial integration RED test (route absent) | `FAIL_AS_EXPECTED` (`404` instead of `200`) |
| Targeted API and BFF tests                  | `PASS` - 2 files, 9 tests                   |
| Targeted Playwright lifecycle test          | `PASS` - 2 tests                            |
| TypeScript project typecheck                | `PASS`                                      |
| Full serial Vitest baseline                 | `PASS` - 78 files, 613 tests                |
| Default Playwright suite                    | `PASS` - 27 passed, 5 opt-in tests skipped  |
| Golden M1 opt-in Playwright suite           | `PASS` - 5 passed                           |
| Format, Unicode, lint, contract, build      | `PASS`                                      |
| Direct-store boundary manifest              | `PASS` - 0 new, 0 stale                     |
| Dependency security audit                   | `PASS` at critical threshold; 0 critical    |

## Known Limits And Non-Proofs

- The same-run lock is process local. It is not a cross-process or durable transaction proof.
- A JSON write plus lifecycle audit is not a database transaction.
- Abort is not rollback.
- Reset is not restore or recovery.
- Cleanup is not purge, backup, durable cleanup, or durable recovery.
- JSON runtime is not PostgreSQL parity or activation.
- Browser and automated evidence are not a human Phase 7 internal session.
- This capability does not grant `L1 READY`, Controlled Pilot, Pilot, or Production.

## Status Boundary And Continuity

```text
G0 Status: PASS
G0 PASS: GRANTED
G5: PASS_WITH_LIMITS
G6: CANDIDATE_REMEDIATION_PENDING_FORMALIZATION
L1 Status: NOT_READY
PostgreSQL Runtime: NOT_ACTIVATED
Durable Settlement: NOT_PROVEN
Durable Recovery: NOT_PROVEN
Controlled Pilot / Production: NOT_AUTHORIZED
```

After an ordinary merge and fresh post-merge validation, the sole next product mission is an
actual Phase 7 human internal session. No additional capability PR may intervene.
