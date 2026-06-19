# Pull Request

## Summary

What does this pull request change?

## Audit finding

- Related Issue:
- Finding ID:
- Severity:
- Tracker phase:
- Closing keyword used:
- Why this PR is sufficient or intentionally partial:

Use `Relates to #...` for partial implementation.
Use `Closes #...` only when every closure condition is satisfied.

## Runtime reachability

What real runtime, API route, command handler, scheduled task, or operational
entry point reaches this change?

Provide the complete call chain:

```text
runtime entry
-> application orchestration
-> facade/port
-> adapter
-> authoritative state
```

If runtime behavior is intentionally unchanged, state that explicitly and
identify the follow-up Issue.

## Authoritative truth source

- What state is authoritative?
- Which component may write it?
- Which read path observes it?
- Does this PR add a second write path or fallback?
- How is tenant isolation preserved?

## Failure semantics

Describe what happens when the operation fails.

- Which state must remain unchanged?
- Can partial state remain?
- Is rollback required?
- What stable error is returned?
- Can internal paths, credentials, payloads, or stack traces leak?

## Retry and concurrency semantics

- Is the operation idempotent?
- What identifies an identical retry?
- What happens on an identical retry?
- What happens on a conflicting retry?
- What happens under concurrent requests?
- Which behavior is deferred, and where is it tracked?

For documentation-only or unrelated changes, write:

`Not applicable - no state-changing runtime behavior.`

## Required regression tests

Mark only tests that are applicable and explain exclusions.

- [ ] Runtime-level success path
- [ ] Runtime-level failure path
- [ ] Partial-write/rollback behavior
- [ ] Authorization and tenant isolation
- [ ] Retry and conflict behavior
- [ ] Concurrent behavior
- [ ] Existing characterization/golden tests
- [ ] Database migration or upgrade tests
- [ ] Real PostgreSQL verification
- [ ] Contract/schema tests
- [ ] Security-sensitive negative tests

## Behavior changed

List only observable behavior intentionally changed by this PR.

## Behavior explicitly unchanged

List important boundaries intentionally preserved, for example:

- settlement calculation;
- canonical decision selection;
- replay hash algorithm and inputs;
- API request/response contract;
- authorization;
- tenant isolation;
- database migration history;
- Postgres runtime;
- JSON runtime;
- frontend behavior.

## Data and migration safety

- New migration:
- Forward-only:
- Old migrations modified:
- Existing-data audit:
- Empty database migration:
- Existing database upgrade:
- Duplicate/invalid legacy-data behavior:
- Rollback or fail-safe behavior:

If not applicable, explain why.

## Validation

| Check                                | Result | Evidence or notes |
| ------------------------------------ | ------ | ----------------- |
| Focused tests                        |        |                   |
| `npm run check:hidden-unicode`       |        |                   |
| `npm run format:check`               |        |                   |
| `npm run lint`                       |        |                   |
| `npm run typecheck`                  |        |                   |
| `npm test`                           |        |                   |
| `npm run test:contract`              |        |                   |
| `npm run build`                      |        |                   |
| `npm run security:audit`             |        |                   |
| Database verification, if applicable |        |                   |
| GitHub quality checks                |        |                   |
| CodeQL                               |        |                   |

Use only:

- `PASS`
- `FAIL`
- `ENV BLOCKED`
- `NOT RUN`
- `NOT APPLICABLE`

Never report an unexecuted check as PASS.

## Deferred work

Every known excluded item that affects correctness, production readiness,
security, authorization, data integrity, idempotency, concurrency, or runtime
reachability must link to an Issue.

- Deferred item:
- Tracking Issue:
- Why it is safe to defer:

## Risk and rollback

- Main risk:
- Failure detection:
- Rollback/revert approach:
- Data compatibility:
- Operational considerations:

## Reviewer closure checklist

An audit Finding must not be closed merely because a contract, adapter, unit
test, or standalone factory exists.

- [ ] Active runtime is wired, or this PR is explicitly documented as partial
- [ ] Authoritative truth source is unambiguous
- [ ] Failure regression tests exist
- [ ] Retry/concurrency behavior is implemented or tracked
- [ ] Required CI checks passed
- [ ] Documentation is updated
- [ ] No untracked second truth source or fallback exists
- [ ] Closing keyword is appropriate
