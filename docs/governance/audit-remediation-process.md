# Audit-Driven Remediation and Pull Request Governance

## 1. Purpose

This process turns an audit finding into a repeatable repository workflow:

```text
audit finding
-> GitHub Issue
-> remediation tracker
-> small implementation PRs
-> runtime proof
-> failure regression
-> merge evidence
-> Issue closure
```

The goal is to make remediation evidence visible in the repository instead of
depending on one-off prompts, reviewer memory, or private notes.

## 2. Scope

This process applies to security, data integrity, authorization, architecture,
database, contracts, testing, CI, and feature-gap remediation. Ordinary feature
pull requests should also use the repository pull request template, but audit
finding closure requires stricter proof.

## 3. Roles

- Finding owner: records the finding, severity, expected behavior, evidence,
  dependencies, and acceptance criteria.
- Implementation owner: proposes the smallest reviewable change and supplies
  validation evidence.
- Reviewer: checks scope, truth-source boundaries, failure semantics, tests,
  deferred work, and issue-closing keywords.
- Repository maintainer: confirms merge readiness, required checks, branch
  status, and safe post-merge cleanup.
- Tracker owner: updates the remediation tracker, preserves historical context,
  and records completion evidence.

## 4. Finding Intake

Each audit finding must have:

- a stable finding or issue ID;
- severity;
- type and area labels when available;
- reproduction steps or code evidence;
- expected behavior;
- acceptance criteria;
- dependencies and blocked work;
- tracker linkage;
- duplicate search before creating new issues.

A pull request is not a substitute for a finding issue. The issue is the durable
record of risk, acceptance criteria, and closure requirements.

## 5. Severity and Phase

P0 findings block production readiness and may freeze new feature expansion.
P1 findings are high-priority remediation work that should be sequenced before
unrelated feature expansion when they affect truth-chain safety, authorization,
data integrity, runtime reachability, or quality gates.

Tracker phases should be maintained in the remediation tracker rather than
copied into long-lived documents. Dependency and blocking relationships must be
recorded in the issue or tracker comments.

## 6. One Issue, Multiple PRs

Large issues may be split into small pull requests, for example:

```text
policy/ADR
-> database constraint
-> adapter/runtime enforcement
-> integration tests
-> closeout
```

Intermediate pull requests use `Relates to #...`. Only the final pull request
that satisfies all applicable acceptance criteria may use `Closes #...`,
`Fixes #...`, or `Resolves #...`.

## 7. Required Worktree Workflow

Remediation work must:

- start from the latest `origin/master`;
- use an independent branch;
- use an independent worktree;
- avoid development in a dirty main workspace;
- preserve unrelated local changes;
- avoid `git reset`, `git clean`, `git restore .`, `git checkout -- .`, and
  `git stash` unless explicitly requested;
- avoid `git add -A` and `git add .`;
- stage only explicitly allowed files;
- after merge, verify the worktree is clean and its HEAD is in `origin/master`
  before removing it.

This section complements `AGENTS.md`; it does not weaken any agent, truth-chain,
security, or testing rule.

## 8. Test-First and Characterization

For implementation changes, authors should first freeze current behavior or
write failing tests that prove the gap. Test-first evidence must record the
real failure reason. Do not use `skip`, `todo`, weakened assertions, or deleted
tests to manufacture a red/green story.

Algorithm migrations require characterization or golden tests. Database changes
require real database verification. Runtime wiring must be proven from a real
entry point, unless the pull request is explicitly partial wiring.

## 9. Runtime Reachability

Runtime proof should show the active path:

```text
API route
-> application service
-> facade/port
-> adapter
-> authoritative state
```

The following are not enough by themselves to prove runtime completion:

```text
interface exists
adapter exists
factory exists
unit tests pass
source code contains method name
```

At least one test should cover the target path from a real runtime entry point
when the pull request claims runtime behavior is fixed.

## 10. Authoritative Truth Source

Each state-changing pull request must identify:

- authoritative state;
- legal writer;
- legal reader;
- transaction boundary;
- fallback behavior;
- whether a second write path is introduced;
- JSON and PostgreSQL parity expectations;
- tenant isolation.

Truth-chain changes must not create hidden fallback writers or parallel sources
of truth.

## 11. Failure Semantics

Each applicable pull request must explain:

- which state remains unchanged on failure;
- whether partial writes can remain;
- rollback or cleanup behavior;
- retryable and non-retryable errors;
- stable external error semantics;
- protection against secret, data, path, payload, and stack leakage;
- audit ordering.

Failures must not be silently converted into success and must not use unsafe
fallback writes.

## 12. Retry, Idempotency, and Concurrency

Applicable command paths must define:

- business identity;
- request identity;
- identical retry behavior;
- conflicting retry behavior;
- concurrent winner and loser behavior;
- immutable authoritative result fields;
- database constraints;
- locks or serialization strategy;
- no-fork requirements.

If any of these are intentionally deferred, the pull request must link the
tracking issue.

## 13. Migration Governance

Database remediation must be forward-only:

- do not edit published migration files;
- audit existing data before adding constraints;
- fail loudly on duplicate or invalid legacy data;
- do not silently delete rows or choose a winner;
- verify empty database migration;
- verify existing database upgrade;
- rely on transactional rollback for failed migrations when supported;
- use real PostgreSQL verification for PostgreSQL behavior;
- use stable constraint and index names;
- document application and database deployment order when relevant.

Migration pull requests must not claim readiness when real database verification
is blocked.

## 14. Required Validation

Check `package.json` before running commands. Current common repository checks
include:

```text
npm run check:hidden-unicode
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:contract
npm run build
npm run security:audit
```

Database pull requests must also run the repository's real PostgreSQL
verification when applicable.

Use these result states:

- `PASS`
- `FAIL`
- `ENV BLOCKED`
- `NOT RUN`
- `NOT APPLICABLE`

Do not report an unexecuted check as `PASS`. If a script does not exist, record
`NOT RUN` with the reason. If required database verification is environment
blocked, do not claim `READY FOR MERGE`.

## 15. Readiness Vocabulary

### NOT READY

Use when there is a known blocker, failed required validation, unresolved scope
violation, or missing required evidence.

### READY FOR REVIEW - awaiting CI

Use when local scope and validation are complete, but GitHub required checks or
CodeQL have not completed.

### READY FOR MERGE

Use only when scope, local validation, required database verification, GitHub
checks, CodeQL, and merge-conflict status satisfy the pull request's closure
requirements.

`READY FOR MERGE` means the pull request is mergeable. It does not necessarily
mean the entire issue is complete when the pull request is explicitly partial.

## 16. Closure Policy

These alone are not sufficient to close a finding:

```text
contract defined
adapter implemented
unit tests passed
standalone factory merged
ADR accepted
database constraint added
```

Closure requires the applicable full loop:

```text
production/runtime path wired
+ failure regression tests
+ required CI/database verification
+ documentation updated
+ all Acceptance criteria satisfied
```

If an issue is accidentally closed by an incorrect closing keyword, reopen it
and leave a comment explaining the remaining runtime or validation work.

## 17. Tracker Maintenance

The remediation tracker remains open until the overall remediation plan is
complete. Intermediate pull requests add progress comments only. Checkboxes
change only when the linked issue is fully complete.

Tracker updates must:

- update `Current verified master SHA` after completed merge work;
- preserve the original audit date and baseline;
- preserve phases, issue references, feature-freeze criteria, and closure
  policy;
- include merge SHA, checks, and validation evidence in completion comments;
- distinguish in-progress comments from completion comments.

## 18. Post-Merge Closeout

Closeout should:

1. confirm the pull request is `MERGED`;
2. verify whether closing keywords produced the intended issue state;
3. confirm the issue state;
4. update the remediation tracker;
5. add completion evidence;
6. retrieve the latest `master` SHA;
7. check the worktree is clean;
8. confirm the branch HEAD is included in `origin/master`;
9. remove the completed worktree;
10. delete the merged local branch;
11. leave the main workspace untouched.

## 19. Deferred Work

Deferred work that affects security, data integrity, authorization,
idempotency, concurrency, migration safety, runtime reachability, contract
mismatch, or production readiness must link to a GitHub issue. Do not write only
`future work`.

## 20. Automation Roadmap

This document and the pull request template establish a human-review process.
Machine enforcement remains tracked separately by Issue #116.

Future automation may include:

- pull request body section validation;
- migration history immutability checks;
- architecture boundary enforcement;
- OpenAPI, schema, and handler parity checks;
- format, security, and E2E alignment;
- branch protection and required-check documentation.

This process document does not complete Issue #116.
