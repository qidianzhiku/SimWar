# Command-Path Migration Readiness Audit

This audit records whether SimWar is ready to migrate command / write paths from direct `SimWarStore` mutation toward command-oriented repository facade methods.

The inspected baseline is the latest fetched `origin/master` at commit `e11c2bf` (`Merge pull request #31 from qidianzhiku/codex/audit-append-characterization-tests-v2`). That baseline includes decision submit, round lock / publish, settlement result / replay hash, audit append, and audit append filter characterization tests.

This document is intentionally docs-only. It does not change runtime behavior, route contracts, tests, migrations, package dependencies, repository adapters, or CI.

## 1. Current Command / Write Paths

| Path                                  | Current implementation                                                                                                    | Direct store access                                                                                                                                      | Existing characterization coverage in inspected master                    | Readiness note                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Decision submit                       | `services/api/src/server.ts` `POST /api/v1/runs/:id/rounds/:no/decisions`                                                 | Reads run, round, team, prior decisions; writes `store.decisions`; calls `appendAudit(store, ...)`                                                       | `tests/integration/decision-submit-characterization.test.ts`              | Covered enough for helper extraction, but persistence migration still needs command port contracts and forwarding tests.               |
| Round lock                            | `services/api/src/server.ts` `POST /api/v1/runs/:id/rounds/:no/lock`                                                      | Reads run and round; mutates `round.status`; writes `round.decision_batch_id`; calls `appendAudit(store, ...)`                                           | `tests/integration/round-lock-publish-characterization.test.ts`           | Covered enough for transition helper extraction. Do not migrate lock persistence before command facade tests exist.                    |
| Round publish                         | `services/api/src/server.ts` `POST /api/v1/runs/:id/rounds/:no/publish`                                                   | Reads run and round; requires `settled`; mutates `round.status`; calls `appendAudit(store, ...)`                                                         | `tests/integration/round-lock-publish-characterization.test.ts`           | Covered enough for transition helper extraction. Keep result visibility unchanged.                                                     |
| Settlement request / settle           | `services/api/src/server.ts` `POST /api/v1/runs/:id/rounds/:no/settle` and `POST /internal/v1/runs/:id/rounds/:no/settle` | Reads run, round, scenario, parameter set, teams, latest decisions; calls `settleRound(store, input)`; appends audit                                     | `tests/integration/settlement-write-replay-hash-characterization.test.ts` | Covered for current behavior, but still high risk. Migrate last.                                                                       |
| Settlement result write               | `services/api/src/simulation.ts` `settleRound(store, input)`                                                              | Checks `store.settlementResults`; creates `SettlementResult`; pushes to `store.settlementResults`                                                        | `tests/integration/settlement-write-replay-hash-characterization.test.ts` | High risk truth write. Do not migrate until command facade and replay parity tests exist.                                              |
| `replay_hash` write                   | `services/api/src/simulation.ts` `settleRound(store, input)`                                                              | Builds hash from parameter set, scenario, run, round, seed, decisions, team truth results; writes `round.replay_hash` and `SettlementResult.replay_hash` | `tests/integration/settlement-write-replay-hash-characterization.test.ts` | Must remain frozen until replay parity tests prove exact behavior after migration.                                                     |
| `appendAudit` write                   | `services/api/src/store.ts` `appendAudit(store, input)`                                                                   | Generates audit id via `nextId`; pushes to `store.auditLogs`; calls `store.persist()`                                                                    | `tests/integration/audit-append-characterization.test.ts`                 | Best first command/write migration candidate, after command port contracts, facade forwarding tests, and facade command methods exist. |
| Audit read after write                | `services/api/src/server.ts` `GET /api/v1/audit/logs` via `filterAuditLogs`                                               | Reads order from `runtime.store.auditLogs`; reads data through `runtime.repositoryProvider.facade.auditLogs.listAuditLogs`                               | `tests/integration/audit-append-characterization.test.ts`                 | Read path already uses facade; append/read parity and filters are now characterized.                                                   |
| Canonical / latest decision selection | `services/api/src/server.ts` `runSettlement`                                                                              | Builds `latestDecisions` by filtering `store.decisions` and using `versions.at(-1)` per team                                                             | `tests/integration/settlement-write-replay-hash-characterization.test.ts` | Must not be mixed with persistence migration. Any canonical selection change needs its own PR.                                         |

## 2. Current Characterization Coverage

### Decision Submit Characterization

File: `tests/integration/decision-submit-characterization.test.ts`

Locks current behavior for:

- successful decision submit response shape;
- `store.decisions` append behavior;
- `decision.submit` audit side effect;
- repeated submit versioning while the round remains open;
- unauthenticated and unauthorized submit responses;
- draft / locked round restrictions for decision submit.

This coverage makes helper extraction reasonable, but not command persistence migration by itself.

### Round Lock And Publish Characterization

File: `tests/integration/round-lock-publish-characterization.test.ts`

Locks current behavior for:

- successful lock response shape;
- `round.status = "locked"` mutation;
- `decision_batch_id` format;
- `round.lock` audit before / after;
- successful publish response shape;
- `round.status = "published"` mutation;
- `round.publish` audit before / after;
- unauthenticated and unauthorized lock / publish responses;
- missing run and missing round responses;
- current round-state restrictions and locked-round decision submit behavior.

This coverage makes transition helper extraction reasonable, but not command persistence migration by itself.

### Settlement Result Write And Replay Hash Characterization

File: `tests/integration/settlement-write-replay-hash-characterization.test.ts`

Locks current behavior for:

- successful settlement response shape;
- `store.settlementResults` write;
- `round.status = "settled"` mutation;
- `SettlementResult.replay_hash` and `round.replay_hash` relationship;
- repeated settle reuse of existing `SettlementResult`;
- latest decision version selection during settlement;
- missing decision response after lock;
- unauthenticated and unauthorized settlement responses;
- `round.settle_requested` audit side effect.

This is critical truth-chain coverage. It does not make settlement migration low risk. It only makes future parity checks possible.

### Audit Append Characterization

File: `tests/integration/audit-append-characterization.test.ts`

Current status in inspected master: present.

The audit append characterization tests lock:

- audit persistence in `store.auditLogs`;
- audit id and append order;
- `tenant_id`, `actor_id`, `actor_role`, `action`, `resource_type`, `resource_id`, `request_id`, `created_at`;
- audit read-after-write response shape;
- audit filters for `action`, `actor_id`, `resource_type`, combined `actor_id` + `resource_type`, and tenant scope;
- unauthenticated and unauthorized audit read responses;
- platform admin versus tenant admin tenant scoping.

This coverage makes `appendAudit` the best first command/write migration candidate. It does not make direct runtime migration safe by itself; command repository port contracts, facade forwarding tests, and facade command methods should land first.

## 3. High-Risk Areas That Still Cannot Be Migrated Directly

The following areas remain blocked from direct migration or broad refactor:

- `settleRound(store, input)` signature.
- `buildReplayHash` input structure.
- Canonical / latest decision selection.
- `SettlementResult` schema and response structure.
- `round.status` mutation semantics.
- `round.replay_hash` mutation semantics.
- Audit log field semantics, id generation, ordering, and tenant ownership.
- Route paths, response bodies, status codes, and error codes.
- Package dependencies and root scripts.
- DB migrations.
- Postgres runtime wiring.

These constraints are stricter than the goal of reducing direct store access. A migration that reduces `runtime.store` usage but changes any truth-chain behavior should be rejected.

## 4. Write-Path Migration Readiness

### Audit Append

Readiness: first command/write migration candidate after command facade foundations land.

Why:

- Audit append is important but lower risk than settlement truth writes.
- The read path already uses the repository facade.
- Current master now characterizes append ordering, field semantics, read-after-write behavior, filters, permissions, and tenant scoping.
- A command facade can preserve append ordering and field semantics if forwarding tests prove the command payload is passed unchanged.

Current blocker:

- Command repository port contracts do not yet expose an audit append command boundary.
- Facade forwarding tests do not yet prove command payload preservation.
- Facade command methods are not yet exposed for live runtime use.

### Decision Submit

Readiness: ready for helper extraction, not ready for persistence migration.

Why:

- Current tests cover success, versioning, permissions, round state, store write, and audit side effect.
- The route still combines permissions, team boundary, validation, version calculation, persistence, and audit.

Next safe move:

- Extract a decision submit helper without behavior change.
- Keep helper extraction separate from repository facade wiring.
- Add command facade forwarding tests before changing persistence.

### Round Lock / Publish

Readiness: ready for transition helper extraction, not ready for persistence migration.

Why:

- Current tests cover state changes, `decision_batch_id`, audit side effects, permissions, missing resources, and current state restrictions.
- Lock and publish are state machine transitions, not simple persistence writes.

Next safe move:

- Extract transition helpers for lock and publish without behavior change.
- Keep lock and publish in separate migration PRs.
- Do not insert new canonical decision preflight in the same PR.

### Settlement Write / Replay Hash

Readiness: not ready for migration; migrate last.

Why:

- This path writes official truth state.
- It binds settlement idempotency, `SettlementResult`, `round.status`, `round.replay_hash`, replay hash input, and latest decision selection.
- Any accidental hash or input drift can break replay, shadow replay, grading, and historical comparability.

Next safe move:

- Extract a settlement write helper without behavior change only after audit and simpler command paths are stable.
- Add replay hash parity tests after any facade-backed write implementation.

### Canonical Decision Selection

Readiness: not a persistence migration task.

Why:

- Current selection is latest decision per team via `versions.at(-1)`.
- Future role lifecycle will require stricter `RoleDecisionSection -> DecisionMergeCommit -> TeamConfirmation -> canonical Decision`.
- Changing selection semantics while migrating persistence would make review impossible.

Rule:

- Canonical selection changes must be separate product / state-machine PRs with their own contracts and tests.

## 5. Recommended PR Sequence

Use the following conservative sequence. Each PR must be single-topic, small, independently revertible, and validated against existing characterization tests.

1. `api: add command repository port contracts`
   - Add TypeScript interfaces only.
   - Do not wire runtime.
   - Do not change routes.

2. `test: add command repository facade forwarding tests`
   - Prove facade methods forward payloads unchanged.
   - Use fake ports.
   - Do not touch `server.ts`.

3. `api: expose command repository facade methods`
   - Add facade methods only after forwarding tests exist.
   - Do not connect command facade methods to runtime handlers.

4. `api: route audit append through repository facade`
   - First actual write migration candidate after command contracts, forwarding tests, and facade command methods land.
   - Preserve audit id, order, tenant scope, actor fields, request id, before / after, and read filters.

5. `api: extract decision submit helper without behavior change`
   - Pure helper extraction.
   - No repository facade write.
   - No response or status changes.

6. `api: route decision persistence through repository facade`
   - Use the helper and command facade.
   - Preserve versioning, team boundary, validation errors, and audit side effects.

7. `api: extract round state transition helpers without behavior change`
   - Pure helper extraction for lock / publish.
   - No repository facade write.

8. `api: route round lock through repository facade`
   - Preserve `open -> locked`, `decision_batch_id`, audit before / after, and current error codes.

9. `api: route round publish through repository facade`
   - Preserve `settled -> published`, result visibility timing, audit before / after, and current error codes.

10. `api: extract settlement write helper without behavior change`
    - Pure helper extraction around current `settleRound` side effects.
    - Do not change hash input, idempotency, or result shape.

11. `api: add settlement command facade method`
    - Add command method and forwarding tests only.
    - Do not route live settlement writes through it yet.

12. `api: route settlement result write through repository facade`
    - Migrate only after all previous PRs are stable.
    - Preserve `SettlementResult`, `round.status`, `round.replay_hash`, and audit behavior.

13. `test: verify settlement replay hash parity after facade write`
    - Compare pre-migration and facade-backed settlement outputs.
    - Prove replay hash and response shape remain unchanged.

## 6. Strict Prohibitions By PR Type

### Docs-Only PR

- Must not modify TypeScript source.
- Must not modify tests.
- Must not modify package files, migrations, CI, or generated artifacts.

### Test-Only PR

- Must not modify business implementation.
- Must not alter route contracts, status codes, response bodies, schemas, or fixtures unless explicitly scoped as a contract PR.

### Helper Extraction PR

- Must not change behavior.
- Must not introduce new repository dependencies.
- Must not change status codes, error codes, response body shape, audit fields, or truth-chain state.

### Command Facade PR

- Must not connect new command methods to live runtime handlers.
- Must not introduce Postgres runtime wiring.
- Must not change existing JSON store behavior.

### Command Migration PR

- Must migrate one command path only.
- Must not change route path, response body, status code, error code, or permissions.
- Must not mix unrelated read model or frontend changes.
- Must not use `git add -A` to stage unrelated files.

### Settlement Migration PR

- Must not change `settleRound` signature unless a prior dedicated PR and tests approve it.
- Must not change replay hash input structure.
- Must not change canonical decision selection.
- Must not change `SettlementResult` schema.
- Must not mix plugin, AI advisory, billing, entitlement, DB migration, Postgres runtime, or package dependency changes.

## 7. Codex Execution Constraints

Future Codex tasks in this migration track must:

- Start from the latest `origin/master`.
- Use an independent branch.
- Prefer an independent worktree when the main workspace is dirty.
- State explicit Scope Notes in the PR body.
- Explicitly list validation commands.
- Stage only intended files by path.
- Avoid `git add -A` in mixed worktrees.
- Keep PRs small, single-topic, and reversible.
- Wait for CI to pass before merge.
- Report any mismatch between requested background and inspected repository state.

Required validation for code or test PRs:

```powershell
npm run typecheck
npm test
npm run test:contract
npm run build
git diff --check
```

Docs-only PRs should still run the same validation when requested by task scope, especially when the document is used as a migration gate.

## 8. Current Readiness Conclusion

Current inspected `origin/master` is not ready for direct command-path migration yet, but it now has the characterization coverage required to nominate audit append as the first command/write migration candidate.

Ready now:

- Documentation and audit-only PRs.
- Command port contract design documents.
- Command repository port contracts.
- Command repository facade forwarding tests.
- Facade command method exposure.
- Helper extraction planning for decision submit and round transitions.

Ready after command facade foundations land:

- Audit append as the first write migration candidate.

Not ready:

- Decision submit persistence migration.
- Round lock / publish persistence migration.
- Settlement result write migration.
- Replay hash write migration.
- Canonical decision selection changes.
- Postgres runtime wiring.

The safest next move is to add command repository port contracts, command facade forwarding tests, and facade command methods. Only after those are green should SimWar route `appendAudit` through the repository facade as the first command-path migration.
