# L1P-VC-08: Role Workflow Productization

**Status:** `CLOSED_AND_CURRENT`

**Product merge:** `#304` / `6e657fd32c84901566796cd680270de4d3a59fc5`

**Product head:** `b75c31a988c889a88c1ff9f60ba90171fdefff46`

**Sole writer:** `RoleWorkflowCommandService`

**Runtime authority:** `JSON_INTERNAL_ONLY`

## Product Outcome

Teacher and Student surfaces now complete one governed Role Workflow:

`Role Definition -> Role Assignment -> Safe Role Context -> Individual Draft
-> Team Merge Candidate -> Final Confirmation -> canonical Decision`.

The canonical Decision then continues through the existing lock, settlement,
publish and Replay chain. Teams must have exactly one distinct CEO, CFO, CMO
and COO owner, and the captain must own the CEO role, before workflow
activation can close the legacy Decision path.

## Evidence

- PR #304 passed exact-head CI, browser smoke, CodeQL and independent Challenge
  Review with zero blocking or must-fix findings.
- Focused unit, integration and executable contract coverage passed 21/21.
- The post-merge fresh clone passed the contract gate, typecheck, lint,
  843/843 full tests and the full build.
- Canonical browser coverage passed 58 tests with nine existing conditional
  skips, followed by the independent real C3 Role Workflow journey.
- Direct-store protection reported zero new unapproved runtime access.
- Student projections exclude merged private payload, `state_true`, private
  Replay material and canonical evidence internals.

## Failure, Concurrency and Historical Protection

Coverage includes illegal transitions, stale draft versions, repeated
assignment, tenant/team/role isolation, concurrent merge behavior, idempotent
confirmation, compensation on persistence failure, reset, historical
non-overwrite and Golden/Replay non-interference.

After Role Workflow history exists, the legacy direct Decision route remains
closed even after reset. Rejected activation of a nonviable team performs no
assignment or event write and leaves the legacy Decision path available.

## Boundaries and Known Limits

- No second Role authority or registry was introduced.
- SettlementResult, Score, Rank, Simulation Core and Replay hash semantics are
  unchanged.
- `JSON_INTERNAL_ONLY` remains the sole active runtime authority.
- JSON compensation is `COMPENSATING_ATOMICITY_NOT_CRASH_SAFE`.
- Human Validation was waived by Owner and was not performed.
- Issue #111 remains `OPEN_KNOWN_LIMIT`.
- PostgreSQL, durable recovery, Pilot and Production are not active, proven or
  authorized.
- C4, D1, M1 and STK-S1 are not implemented or authorized by this closure.

## Revalidation Triggers

Revalidate after Role Workflow authority or registry changes, shared-contract
changes, canonical Decision or formal Run binding changes, Golden/Replay
changes, Student visibility changes, or product/runtime changes.

## Successor Boundary

`CAND-L1P-C4-INSTRUCTOR-DEBRIEF-KIT` is
`RECOMMENDED_NOT_AUTHORIZED`. No successor locks are acquired and
`automatic_next_start` remains `false`.
