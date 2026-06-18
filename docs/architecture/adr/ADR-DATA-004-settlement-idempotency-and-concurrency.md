# ADR-DATA-004: Settlement Idempotency and Concurrency Policy

| Field                | Value                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| Status               | Accepted                                                                               |
| Date                 | 2026-06-18                                                                             |
| Scope                | Settlement business idempotency, retry semantics, concurrency policy, and rollout plan |
| Implementation state | Policy only. Runtime enforcement remains pending.                                      |
| Related issue        | #111                                                                                   |
| Depends on           | #117 active settlement route atomic outcome persistence                                |

## 1. Context

The active settlement route now commits `SettlementResult` and the target `Round`
through the atomic settlement outcome port. That closed the single-operation
consistency gap: a successful commit writes the settlement result and the round
status/hash together, and a failed commit leaves both unchanged.

Atomicity is not the same as business idempotency. It does not, by itself,
define what should happen when:

- the same settlement request is retried after a network timeout;
- two workers submit the same round settlement concurrently;
- two different candidate outcomes are produced for the same round;
- a caller reuses a technical `settlement_result_id` for a different business
  round;
- an administrator needs to correct an already committed outcome.

The settlement truth chain cannot fork. A round must not end up with multiple
authoritative replay hashes, multiple ordinary authoritative results, or a
"last write wins" result that silently overwrites the first committed truth.
This policy is also a blocker for a safe PostgreSQL runtime and for future
role-based final submission flows.

This ADR defines the policy and implementation boundaries. It deliberately does
not add JSON locks, PostgreSQL constraints, migrations, route behavior changes,
or API fields.

## 2. Current Implementation Evidence

The policy below is based on the current `origin/master` implementation.

| Area                                  | Current behavior                                                                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SettlementResult` fields             | `settlement_result_id`, `tenant_id`, `run_id`, `round_id`, `round_no`, `parameter_set_id`, `scenario_package_id`, `replay_hash`, `team_results`                        |
| `settlement_result_id` generation     | `createSettlementResult()` calls `nextId(store, "result", "result")` in `services/api/src/simulation.ts`                                                               |
| Active HTTP route                     | The route prepares settlement output, calls `RepositoryFacade.commitSettlementOutcome(...)`, then appends the success audit after commit success                       |
| Existing route retry behavior         | If an existing result is found for the route's run and round number, the route returns that result without a second atomic commit                                      |
| Existing route audit retry behavior   | A repeated route call can append another success audit for the same already committed result                                                                           |
| JSON atomic port technical lookup     | `tenant_id + settlement_result_id`                                                                                                                                     |
| JSON atomic port business lookup      | Undefined. It does not enforce one authoritative result per `tenant_id + run_id + round_no`                                                                            |
| JSON direct duplicate behavior        | Reusing the same technical id can replace the stored settlement result; using a different technical id for the same round can append another result if called directly |
| JSON concurrency control              | Undefined. There is no keyed settlement mutex and no cross-process lock                                                                                                |
| PostgreSQL atomic conflict target     | `ON CONFLICT (tenant_id, settlement_result_id) DO UPDATE`                                                                                                              |
| PostgreSQL round lock                 | The atomic port selects the target round with `FOR UPDATE` inside the commit query                                                                                     |
| PostgreSQL business uniqueness        | Undefined. The migration has no unique constraint for one settlement result per round business identity                                                                |
| Current database unique constraint    | `UNIQUE (tenant_id, settlement_result_id)`                                                                                                                             |
| Current authoritative-result policy   | Partially characterized by route behavior, not enforced by repository/database identity                                                                                |
| Current overwrite behavior            | A technical-id conflict can update an existing settlement row in PostgreSQL and replace an existing result in JSON                                                     |
| Current stable route failure envelope | Persistence failures are mapped to the existing safe internal-error response, without returning internal state                                                         |

## 3. Decision Drivers

- One round can have only one authoritative settlement.
- Legitimate retries must be safe and deterministic.
- Conflicting outcomes must never silently overwrite authoritative truth.
- JSON and PostgreSQL semantics must converge.
- Tenant isolation is mandatory.
- Settlement history must be auditable.
- Existing data must be migratable before database constraints are added.
- API callers must not control the database truth key by choosing a technical
  result id.
- Concurrent behavior must be deterministic.
- Administrator correction must not masquerade as a normal retry.

## 4. Technical Identity

The technical row identity for a `SettlementResult` remains:

```text
tenant_id + settlement_result_id
```

This identity locates a concrete settlement result record. It is useful for
references, audit payloads, and storage-level lookup.

It is not sufficient as the business idempotency policy because it does not
answer whether a round already has an authoritative settlement. A caller could
generate a new `settlement_result_id` for the same round and bypass a policy
that only checks the technical id.

Technical identity must therefore remain separate from business settlement
identity.

## 5. Business Idempotency Identity

The business identity for an ordinary settlement outcome is:

```text
tenant_id + run_id + round_no
```

This key represents the user-visible business fact: a specific tenant's run and
round number has one official settlement.

The target `round_id` remains required for relational validation and efficient
storage access. Implementations must verify that:

```text
round.tenant_id == settlement_result.tenant_id
round.run_id == settlement_result.run_id
round.round_id == settlement_result.round_id
round.round_no == settlement_result.round_no
```

The identities are distinct:

| Identity type                | Key                                                      | Purpose                                                 |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| Database row identity        | `tenant_id + settlement_result_id`                       | Locate the stored settlement result row/object          |
| Business settlement identity | `tenant_id + run_id + round_no`                          | Enforce one authoritative ordinary settlement per round |
| Request retry identity       | Business identity plus replay-relevant input fingerprint | Decide whether a retry is identical or conflicting      |

`round_id` may be globally unique in many runtime paths, but this ADR chooses
`tenant_id + run_id + round_no` as the stable business key because it aligns with
API route identity and teacher/student round semantics. Implementations may also
use `round_id` as a database foreign key and invariant check.

## 6. Authoritative Result Policy

The first successful ordinary settlement commit for a business settlement
identity becomes the authoritative result for that round.

Ordinary settlement requests must not:

- overwrite the authoritative result;
- modify the authoritative replay hash;
- move the result to another round;
- reuse the same technical result id for a different business identity;
- create a second authoritative result for the same business identity;
- mutate settled round payload as part of conflict handling.

A settled round is immutable for ordinary settlement. Further ordinary requests
for the same business identity are either identical retries or conflicts.

## 7. Identical Retry Policy

An identical retry is a request for the same business settlement identity whose
replay-relevant inputs match the existing authoritative result.

At minimum, the implementation must compare:

- `tenant_id`;
- `run_id`;
- `round_no`;
- `round_id`;
- canonical decision identity or a stable canonical decision fingerprint;
- `parameter_set_id`;
- `scenario_package_id`;
- `replay_hash`;
- settlement result identity, when the request already carries one;
- settlement calculation version, if present in the current or future model;
- an input payload fingerprint when the route can construct one.

Future implementation should choose this behavior for identical retries:

```text
return the existing authoritative result
```

The system should not write another `SettlementResult` and should not rewrite the
round. Recalculation is allowed as an internal verification step only when it is
safe, deterministic, and does not mutate authoritative state. If recalculation is
performed and the replay hash differs, the request becomes a conflict.

External semantics:

| Topic                 | Policy                                                                   |
| --------------------- | ------------------------------------------------------------------------ |
| HTTP status           | Existing success status                                                  |
| Response body         | Existing authoritative result in the existing response shape             |
| Database write        | No new truth write                                                       |
| Success audit         | Do not append a duplicate first-commit success audit                     |
| Retry audit           | Optional dedicated retry audit, separate from first-commit success audit |
| Client interpretation | Successful idempotent retry                                              |

## 8. Conflicting Retry Policy

A conflicting retry is a request for the same business settlement identity where
any replay-relevant identity, replay hash, parameter, scenario, canonical
decision identity, or result payload differs from the authoritative result.

The system must:

- reject the request;
- keep the authoritative result unchanged;
- keep `Round.status` unchanged;
- keep `Round.replay_hash` unchanged;
- keep round payload unchanged;
- preserve the existing `SettlementResult`;
- return a stable conflict response;
- record a security or settlement-conflict audit event when the audit layer is
  available.

Preferred internal error code:

```text
settlement_outcome_conflict
```

The external HTTP status should be a conflict response, currently expected to be
`409`, using the repository's existing safe error-envelope style.

## 9. Concurrent Request Policy

For concurrent ordinary settlement requests with the same business identity:

```text
at most one request may create the authoritative result
```

Loser behavior depends on the inputs:

| Concurrent scenario                             | Winner                           | Loser                                                                       |
| ----------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| Identical requests                              | Creates the authoritative result | Returns the same authoritative result or a deterministic retryable response |
| Different outcomes                              | Creates the authoritative result | Returns stable conflict                                                     |
| Persistence failure before authoritative commit | No winner                        | Existing safe persistence failure response; no partial state                |

Concurrent losers must not create a second row, overwrite the first result, or
produce a second replay hash. Retrying a deterministic retryable loser response
must eventually resolve to the existing authoritative result or a conflict.

## 10. JSON Runtime Policy

The JSON runtime remains a single-writer runtime. It does not support multiple
API processes sharing the same JSON snapshot path.

Future JSON enforcement should use a process-local keyed mutex:

```text
settlement-lock:<tenant_id>:<run_id>:<round_no>
```

Policy requirements:

- acquire the key before checking settled state and existing settlement result;
- re-read the round and authoritative result inside the lock;
- perform calculation and atomic outcome commit while the key is held, or
  re-check immediately before commit if calculation is intentionally outside the
  lock;
- always release the key in `finally`;
- release on thrown errors;
- never rely on the mutex as the only source of truth;
- preserve the authoritative-state checks for crash recovery and future imports;
- document that the lock is process-local and does not protect multi-process or
  multi-host JSON deployments.

The keyed mutex is preferred over a global JSON settlement lock because it
preserves concurrency between different rounds while serializing the only key
that must be exclusive.

## 11. PostgreSQL Runtime Policy

Future PostgreSQL enforcement must use one transaction for the full settlement
outcome commit.

Required behavior:

- lock the target round row, using `SELECT ... FOR UPDATE` or an equivalent
  repository operation;
- verify tenant, run, round id, and round number invariants;
- query for an existing authoritative settlement by business identity;
- return identical retry results without rewriting truth;
- reject conflicting existing results;
- insert the new settlement result only when no authoritative result exists;
- update the round status/hash in the same transaction;
- rely on a business unique constraint as the final race guard;
- rollback on any error.

The expected isolation level is the database default `READ COMMITTED` plus row
locks and a unique constraint. `SERIALIZABLE` can be considered later if tests
show anomalies that row locks and constraints do not cover.

This ADR requires a future forward migration. It does not add the migration.

## 12. Database Constraint Plan

Preferred future constraint on `settlement_results`:

```text
UNIQUE (tenant_id, run_id, round_no)
```

The existing technical uniqueness must remain:

```text
UNIQUE (tenant_id, settlement_result_id)
```

Before adding the business constraint, the implementation PR must run or provide
a data audit for duplicates:

- duplicate `tenant_id + run_id + round_no`;
- mismatched `round_id` for the same business identity;
- null or malformed identity fields;
- different replay hashes for the same business identity;
- result rows without matching round rows.

If duplicates exist, the migration must fail safely and require an explicit
cleanup plan. It must not silently pick a winner.

The future migration should keep `round_id` as a relational check and may add a
supporting unique or foreign-key-friendly index if the current schema requires
it. The business uniqueness rule still lives at the round business identity.

## 13. Immutable Fields

After an authoritative `SettlementResult` is created, ordinary settlement flows
must treat these fields as immutable:

- `tenant_id`;
- `run_id`;
- `round_id`;
- `round_no`;
- canonical decision identity or fingerprint;
- `parameter_set_id`;
- `scenario_package_id`;
- `replay_hash`;
- result payload and team results;
- settlement calculation version, when available.

Mutable metadata, if added later, must be explicitly separated from the
authoritative result payload and must not change the replay hash or official
business outcome.

## 14. Administrator Override Policy

The ordinary settlement API does not allow override.

If administrator re-settlement is introduced later, it must use a separate
command with:

- distinct permission;
- explicit reason;
- actor identity;
- old and new result references;
- audit trail;
- version history;
- a clear indication that the new result is an override, not an ordinary retry.

Administrator override must not silently `UPDATE` the original authoritative
result in place.

This ADR does not implement override.

## 15. Audit Policy

Future implementation should distinguish these events:

| Scenario                       | Audit policy                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| First authoritative settlement | Existing success audit, exactly once after commit succeeds                         |
| Identical retry                | Optional retry audit; must not duplicate first-commit success audit                |
| Conflicting retry              | Conflict/security audit with business identity and safe metadata                   |
| Concurrent identical loser     | Same as identical retry, or no audit if it returns a deterministic retry response  |
| Concurrent conflicting loser   | Conflict/security audit                                                            |
| Administrator override         | Dedicated override audit with reason, actor, old result, and new result references |

Current success audit remains outside the settlement storage transaction unless a
future outbox or transactional audit design changes that. This creates a
recoverability gap: settlement may commit while audit append fails. That risk is
outside this ADR and should be handled by a future outbox/recovery design.

## 16. API Semantics

The future runtime behavior should be:

| Scenario                     | HTTP/result semantics                                        |
| ---------------------------- | ------------------------------------------------------------ |
| First success                | Existing success response                                    |
| Identical retry              | Same authoritative result in existing success response shape |
| Conflicting retry            | Stable conflict response                                     |
| Concurrent identical loser   | Existing result or deterministic retryable response          |
| Concurrent conflicting loser | Stable conflict response                                     |
| Unauthorized                 | Unchanged                                                    |
| Persistence failure          | Existing safe internal-error envelope                        |

This ADR does not modify OpenAPI, request bodies, response bodies, or status
codes. Contract updates belong to the implementation PR if behavior becomes
externally observable beyond existing envelopes.

## 17. Error Taxonomy

Preferred future error codes:

| Code                                    | Visibility                       | Retryable             | Meaning                                                               |
| --------------------------------------- | -------------------------------- | --------------------- | --------------------------------------------------------------------- |
| `settlement_outcome_conflict`           | Public safe conflict             | No                    | Same business identity, different replay-relevant outcome             |
| `settlement_already_committed`          | Public or internal               | Yes as success lookup | Existing authoritative result found                                   |
| `settlement_concurrent_commit_conflict` | Internal or public safe conflict | Maybe                 | Race lost to another transaction; caller can retry to discover result |
| `settlement_identity_mismatch`          | Public validation/conflict       | No                    | Technical result or round identity does not match business identity   |

The implementation should avoid proliferating overlapping errors. Conflict
errors must not include full settlement payloads, database details, stack traces,
tokens, secrets, or snapshot contents.

## 18. Migration and Rollout

Recommended implementation order:

1. Audit existing settlement data for business duplicates.
2. Add a forward migration and business unique constraint.
3. Add JSON keyed concurrency control and authoritative-result rechecks.
4. Add PostgreSQL transaction/locking enforcement and conflict handling.
5. Update route retry/conflict behavior.
6. Add concurrent tests for identical and conflicting requests.
7. Update runtime documentation and rollout notes.

Deployment order matters. Application code must understand conflicts before a
strict database constraint can become the only line of defense. Conversely, the
database constraint must exist before PostgreSQL runtime is considered protected
against races.

## 19. Alternatives Considered

| Alternative                              | Decision                              | Rationale                                                                                        |
| ---------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Only use `settlement_result_id`          | Rejected                              | It protects a row id, not one authoritative result per round                                     |
| Only application-level check             | Rejected                              | Races and future direct adapter paths can bypass it                                              |
| Last-write-wins upsert                   | Rejected                              | It allows replay hash forks and silent truth overwrite                                           |
| Unique business key                      | Accepted as future constraint         | It directly represents one ordinary authoritative result per round                               |
| Immutable result plus versioned override | Accepted as future override direction | It preserves auditability without hiding correction history                                      |
| PostgreSQL advisory lock                 | Deferred                              | It may be useful, but row locks plus business unique constraint are simpler and more inspectable |
| Round row lock                           | Accepted for PostgreSQL               | The round is the natural aggregate root for settlement finalization                              |
| Serializable isolation                   | Deferred                              | It may be heavier than needed; test row locks and constraints first                              |
| JSON global lock                         | Rejected                              | It serializes unrelated rounds unnecessarily                                                     |
| JSON keyed mutex                         | Accepted for future JSON runtime      | It protects the business identity while preserving unrelated work                                |

## 20. Consequences

### Positive

- Prevents replay hash forks.
- Makes retries deterministic.
- Defines one authoritative result per round.
- Aligns JSON and PostgreSQL semantics.
- Gives PostgreSQL rollout a constraint-backed target.
- Separates normal retry from administrator correction.

### Negative

- Requires migration and duplicate cleanup planning.
- Adds lock contention for the same round.
- Adds conflict and retry error semantics.
- Requires concurrent integration tests.
- Administrator override needs a separate design and implementation.

## 21. Explicitly Deferred

This ADR does not solve or implement:

- PostgreSQL runtime provider activation;
- repository direct-store migration;
- course membership;
- role-based decisions;
- outbox or transactional audit;
- distributed locks;
- multi-region settlement;
- administrator override implementation;
- JSON keyed mutex implementation;
- PostgreSQL unique constraint migration;
- route behavior changes.

## 22. Follow-up Implementation Plan

### Follow-up PR 1: `db: add settlement business identity constraint`

Scope:

- existing data audit;
- forward migration;
- business unique constraint;
- migration upgrade tests;
- clear failure behavior for legacy duplicates.

### Follow-up PR 2: `api: enforce JSON settlement idempotency`

Scope:

- keyed mutex by `tenant_id + run_id + round_no`;
- recheck authoritative result inside the lock;
- identical retry behavior;
- conflicting retry behavior;
- route-level tests for retry and JSON concurrency.

### Follow-up PR 3: `api: enforce Postgres settlement concurrency`

Scope:

- row lock and business result lookup;
- unique constraint conflict handling;
- concurrent transaction tests;
- parity tests with JSON behavior.

These PRs may be split further if review size grows. They must not be merged
into an unreviewable single change.

## 23. PR Scope for This ADR

This ADR PR changes documentation only. It does not change production behavior,
database schema, OpenAPI contracts, JSON locking, PostgreSQL locking, route
semantics, or settlement result persistence code.
