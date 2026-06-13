# SimWar Harness Engineering and Agent Loop Execution Plan

## Purpose

This plan turns a successful Codex development and verification workflow into a repeatable, automatable, and auditable engineering system inside the SimWar repository.

The long-term target is:

- The repository provides executable rules.
- Harnesses decide validation results.
- Agent loops handle narrowly scoped, repairable failures.
- CI independently repeats local verification.
- Confirmed failures become permanent guardrails.
- Humans focus on architecture, product, security, and truth-chain decisions.

This is an execution plan, not an implementation PR. It records the order, acceptance criteria, and update rules for future Harness Engineering and Agent Loop work.

## Current Baseline

Completed capabilities currently present in the repository:

- Root `AGENTS.md` development guardrails.
- Small PR and isolated worktree workflow.
- Read-only audit pattern before risky implementation.
- Explicit allowed-files and forbidden-files task framing.
- Stop conditions for ambiguous schema, contract, runtime, and truth-chain work.
- JSON and Postgres parity tests for repository behavior.
- Settlement and replay truth-chain guardrails.
- Postgres replay read and write mapping.
- Disposable PostgreSQL replay verification harness.
- `SIMWAR_TEST_DATABASE_URL` as the explicit test database boundary.
- PostgreSQL 16 migration apply verification through the harness.
- Temporary schema isolation for disposable database checks.
- JSONB payload round-trip verification.
- Duplicate append verification for replay records.
- First-match verification using append order.
- Tenant isolation verification.
- Explicit-column verification for replay persistence.
- Replay hash preservation checks.
- Cleanup verification for temporary schema and container runs.

Current limitations:

- CI does not yet run `npm run test:postgres-replay`.
- Verification results are not yet emitted as machine-readable reports.
- No bounded repair-loop tool exists in the repository.
- No centralized failure registry exists.
- No repository-local Skills exist.
- Scoped directory `AGENTS.md` files have not been introduced.

## Problem Statement

The proven workflow is still distributed across PRs, prompts, and chat history. That creates operational gaps:

- Harness execution depends on humans.
- Real database verification is not a required CI gate.
- Verification output is mostly natural language.
- Codex cannot machine-read a single authoritative result.
- Repair steps depend on humans copying failure feedback.
- Repair loops have no maximum attempt count.
- Confirmed defects are not registered in one place.
- Failures are not always converted into permanent guardrails.
- Repeated prompts consume unnecessary tokens.
- Root `AGENTS.md` should not grow without limit.
- Long-running phases lack one status document with the current phase, active PR, next PR, and completion criteria.

## Target Development Loop

Every future Codex PR should follow this standard loop:

1. Read `AGENTS.md` and applicable scoped instructions.
2. Read the active execution plan.
3. Fetch latest `origin/master`.
4. Create an isolated branch and worktree.
5. Run read-only audit.
6. Confirm allowed and forbidden files.
7. Implement the smallest change.
8. Run targeted validation.
9. Enter bounded repair loop when allowed.
10. Run full quality gates.
11. Run domain-specific Harness.
12. Generate machine-readable verification report.
13. Confirm scope and worktree cleanliness.
14. Commit and push.
15. CI independently repeats validation.
16. Merge only when all required checks pass.
17. Convert new failures into permanent guardrails.
18. Update this execution plan when the PR changes Harness or Agent Loop direction.

## Design Principles

- One task equals one small PR.
- Start from latest `origin/master`.
- Use an isolated worktree.
- Declare explicit allowed files.
- Declare explicit stop conditions.
- Run targeted validation before full validation.
- Prefer deterministic, machine-readable results.
- Bound automated repair attempts.
- Do not delete tests to obtain green status.
- Do not expand scope during repair.
- Truth-chain failures require human review.
- CI must independently reproduce local success.
- Every escaped defect should create a permanent guardrail.
- JSON adapter remains the default runtime until an explicit runtime opt-in PR changes that.

## Harness Layers

### Layer 1: Static scope checks

Examples:

- Changed files.
- Forbidden imports.
- Dirty worktree.
- `git diff --check`.
- Formatting.
- Lint.
- Typecheck.

### Layer 2: Unit and parity tests

Examples:

- JSON and Postgres behavior parity.
- Tenant isolation.
- `null` and empty-list semantics.
- Explicit columns.
- JSONB serialization.

### Layer 3: Truth-chain characterization

Examples:

- Settlement result stability.
- Replay hash stability.
- Settlement idempotency.
- Canonical and latest decision boundaries.
- Role drafts and AI advice excluded from truth.

### Layer 4: Real dependency verification

Examples:

- PostgreSQL migration apply.
- Real JSONB behavior.
- Real constraints.
- Append sequence behavior.
- First-match replay reads.
- Cleanup verification.

### Layer 5: CI reproduction

All stable harnesses should eventually run as independent CI gates. Local validation is useful, but merge readiness should depend on CI reproducing the same result from a clean checkout.

## Bounded Agent Repair Loop

Maximum repair attempts: 2.

Each repair attempt must:

- Capture the failing command.
- Capture relevant output.
- Classify the failure.
- Confirm the failure is inside current scope.
- Modify only allowed files.
- Run targeted validation again.

Stop immediately and escalate to human review when:

- Settlement truth-chain behavior fails.
- Replay hash behavior changes.
- Migration work carries destructive risk.
- Contract meaning is ambiguous.
- Provider or runtime boundaries would change.
- Security validation fails.
- The required fix exceeds allowed files.
- The same failure repeats twice.
- The proposed fix requires weakening tests.

Forbidden during repair:

- Delete failing tests.
- Skip tests.
- Modify assertions to fit wrong behavior.
- Expand PR scope.
- Retry indefinitely.
- Automatically modify truth-chain production logic.

## Machine-Readable Verification Report

Future tooling should generate a machine-readable report such as `artifacts/verification-report.json`.

The report should be generated by scripts and uploaded as a CI artifact. It should not be committed by default.

Minimum schema:

```json
{
  "schema_version": 1,
  "branch": "",
  "commit": "",
  "base_commit": "",
  "changed_files": [],
  "allowed_files": [],
  "scope_valid": true,
  "commands": [],
  "domain_harnesses": {},
  "cleanup": {},
  "blocking_failures": [],
  "ready_for_review": false
}
```

Each command entry must record at least:

- `name`
- `status`
- `duration_ms`

Allowed command statuses:

- `passed`
- `failed`
- `unavailable`
- `skipped-with-reason`

A failed command must never be recorded as `passed`.

## Failure-to-Guardrail Loop

The standard path for real failures is:

```text
real defect
-> root cause analysis
-> immediate fix
-> permanent detection mechanism
-> CI or Harness execution
-> failure registry entry
```

Each real defect should become at least one of:

- Unit test.
- Parity test.
- Integration test.
- Real dependency Harness.
- Lint rule.
- Structural test.
- Scoped `AGENTS.md` rule.
- Repository Skill.
- CI check.

Recorded examples and permanent guardrail direction:

- `team_results` lacked explicit JSONB serialization: preserve with SQL cast and parameter serialization tests.
- Manifest omitted `source_result_id`: preserve with explicit-column projection tests and real database verification.
- ReplayReport omitted `replay_run_id`: preserve with explicit-column projection tests and real database verification.
- Harness checked payload but not explicit columns: preserve with direct SQL assertions against explicit columns.
- A repair commit was not pushed: preserve with final remote-head verification.
- `AGENTS.md` was previously overwritten incorrectly: preserve with scoped documentation guardrails and single-file scope checks.

These are engineering root causes, not personal attribution.

## Repository Skills Plan

Future repository-local Skills should live under `.agents/skills/` and reduce repeated prompting.

### `.agents/skills/simwar-small-pr/`

- Purpose: enforce one-task, one-PR workflow.
- Trigger scenario: any SimWar feature, test, docs, migration, or refactor task.
- Instructions: fetch latest master, use isolated worktree, confirm allowed files, run scope checks, commit only intended files.
- Optional scripts/resources: branch naming examples and PR body template.
- Validation expectations: clean worktree, changed files within scope, targeted and required gates run.
- Red lines: no `git add -A`, no dirty main workspace, no old branch reuse.

### `.agents/skills/simwar-postgres-mapping/`

- Purpose: guide Postgres repository mapping without changing runtime defaults.
- Trigger scenario: schema, read mapping, write mapping, or parity tests for Postgres adapter.
- Instructions: audit layout docs, confirm JSON adapter parity, preserve tenant identity, avoid runtime provider wiring.
- Optional scripts/resources: mapping checklist and SQL parameter checklist.
- Validation expectations: unit parity tests, migration checks when schema changes, disposable DB harness when real behavior matters.
- Red lines: no ordinary runtime env reads, no default Postgres switch, no truth-chain mutation.

### `.agents/skills/simwar-truth-chain-review/`

- Purpose: protect settlement, replay hash, canonical decisions, and idempotency.
- Trigger scenario: settlement, replay, decisions, role drafts, AI advice, or learning evidence work.
- Instructions: identify truth inputs, confirm excluded data, run characterization tests, avoid hash recomputation.
- Optional scripts/resources: truth-chain boundary checklist.
- Validation expectations: hash stability, idempotency, role draft and AI exclusion, latest decision behavior.
- Red lines: no production truth logic changes during repair loops without human review.

### `.agents/skills/simwar-disposable-postgres/`

- Purpose: run safe disposable PostgreSQL verification.
- Trigger scenario: real database behavior validation, migration apply, JSONB, identity, and cleanup checks.
- Instructions: use explicit test URL only, create unique schema, apply migration, run harness, clean up.
- Optional scripts/resources: Docker local verification recipe and CI service recipe.
- Validation expectations: migration apply, JSONB, append sequence, tenant isolation, cleanup.
- Red lines: no production database, no ordinary database env fallback, no password logging.

### `.agents/skills/simwar-pr-review/`

- Purpose: review SimWar PRs for scope, truth-chain, runtime, and validation completeness.
- Trigger scenario: before PR creation or after CI failure.
- Instructions: compare changed files to allowed scope, check guardrail coverage, inspect verification evidence.
- Optional scripts/resources: review checklist.
- Validation expectations: no forbidden files, no missing relevant tests, no unverified claims.
- Red lines: no approving unverified truth-chain changes.

This PR does not create Skills.

## Scoped AGENTS Plan

Future scoped instruction files should include:

- `/services/api/AGENTS.md`
- `/db/AGENTS.md`
- `/tests/AGENTS.md`
- `/scripts/AGENTS.md`

Rules:

- Root `AGENTS.md` keeps global rules and navigation.
- Subdirectories keep domain-specific rules close to code.
- Do not duplicate the same rule into multiple files.
- When instructions conflict, the more specific directory instruction wins.
- Do not modify any `AGENTS.md` file in this PR.

## Milestones

### Milestone 1: Automate the proven Postgres Harness

Candidate PRs:

- `ci: run disposable Postgres replay verification`
- `docs: add disposable Postgres replay verification runbook`

Acceptance criteria:

- CI uses a PostgreSQL 16 service.
- CI sets `SIMWAR_TEST_DATABASE_URL`.
- CI runs `npm run test:postgres-replay`.
- CI does not use ordinary database runtime env fallback.
- Failure blocks merge.
- JSON adapter remains the default runtime.

### Milestone 2: Machine-readable verification

Candidate PR:

- `tooling: add machine-readable verification reports`

Acceptance criteria:

- JSON schema is stable.
- Command statuses are accurate.
- Changed-files scope is verifiable.
- CI uploads the report as an artifact.
- PR summary can be generated from the report.

### Milestone 3: Bounded repair loop

Candidate PR:

- `tooling: add bounded validation repair loop`

Acceptance criteria:

- Maximum two repair attempts.
- Allowed-files enforcement.
- Targeted rerun after each repair.
- Same-failure detection.
- Truth-chain failure escalation.
- No deletion or weakening of tests.

### Milestone 4: Failure registry

Candidate PR:

- `docs: add SimWar harness failure registry`

Acceptance criteria:

- Unified template.
- Historical defects registered.
- Each entry links to a permanent guardrail.
- Unresolved items have owner category and next action.
- No personal names required.

### Milestone 5: Repository Skills

Candidate PR:

- `tooling: add SimWar repository skills`

Acceptance criteria:

- At least small-pr, Postgres mapping, and truth-chain review Skills exist.
- Skill trigger descriptions are clear.
- Resources load on demand.
- Repeated prompts are reduced.
- Minimal eval or fixture verifies Skill behavior.

### Milestone 6: Scoped instructions

Candidate PR:

- `docs: add scoped AGENTS instructions for database and tests`

Acceptance criteria:

- Root `AGENTS.md` remains concise.
- Domain rules live close to code.
- Existing critical rules are preserved.
- Codex can load directory-relevant constraints.

### Milestone 7: Mechanical architecture enforcement

Candidate PRs:

- `test: enforce settlement truth-chain dependency boundaries`
- `lint: enforce repository runtime boundaries`

Acceptance criteria:

- Postgres adapter does not import settlement engine.
- Repository adapter does not read runtime env.
- Role drafts and AI advice do not enter settlement truth.
- Error messages include the allowed repair scope.

### Milestone 8: Recurring quality audit

Candidate PR:

- `tooling: add recurring SimWar quality audit`

Acceptance criteria:

- Detect repeated helpers.
- Detect stale docs.
- Detect skipped or flaky tests.
- Detect compatibility fallbacks.
- Detect oversized files.
- Detect boundary violations.
- Output executable small PR candidates.

## Ordered PR Backlog

| Order | PR                                                            | Status  | Prerequisites                            | Main acceptance criteria                                                        | Risk   |
| ----- | ------------------------------------------------------------- | ------- | ---------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| 1     | `ci: run disposable Postgres replay verification`             | Planned | Disposable harness merged                | CI runs PostgreSQL 16 with `SIMWAR_TEST_DATABASE_URL`; merge blocked on failure | Medium |
| 2     | `docs: add disposable Postgres replay verification runbook`   | Planned | CI harness command exists                | Local and CI runbook documents safe env, Docker, cleanup, and failure handling  | Low    |
| 3     | `tooling: add machine-readable verification reports`          | Planned | Stable command list                      | JSON report schema, accurate statuses, CI artifact upload                       | Medium |
| 4     | `tooling: add bounded validation repair loop`                 | Planned | Machine-readable reports                 | Two-attempt cap, allowed-file enforcement, targeted rerun, escalation rules     | High   |
| 5     | `docs: add SimWar harness failure registry`                   | Planned | Failure-to-guardrail process agreed      | Template and historical defect entries with permanent guardrail links           | Low    |
| 6     | `tooling: add SimWar repository skills`                       | Planned | Stable repeated workflows                | Small-pr, Postgres mapping, truth-chain review Skills with minimal checks       | Medium |
| 7     | `docs: add scoped AGENTS instructions for database and tests` | Planned | Skill and scoped-rule plan agreed        | Root stays concise, db/tests rules scoped, no critical rule deletion            | Medium |
| 8     | `test: enforce settlement truth-chain dependency boundaries`  | Planned | Truth-chain import boundaries understood | Mechanical tests block forbidden settlement dependencies                        | High   |
| 9     | `lint: enforce repository runtime boundaries`                 | Planned | Runtime boundary patterns identified     | Lint or structural check blocks runtime env reads in adapters                   | Medium |
| 10    | `tooling: add recurring SimWar quality audit`                 | Planned | Verification reports and registry exist  | Audit outputs actionable small PR candidates                                    | Medium |

## Metrics

Future tracking metrics:

- First-pass validation pass rate.
- Average repair rounds per PR.
- Human correction count.
- Scope violation count.
- CI failure rate.
- Flaky test count.
- Branch-to-merge time.
- Codex token usage when measurable.
- Escaped defect count.
- Failure-to-permanent-guardrail conversion rate.

PR count is not the main success metric.

## Status Update Protocol

When a PR changes Harness or Agent Loop direction, update:

- Current Phase.
- Completed PRs.
- Active PR.
- Next PR.
- Open Risks.
- Decision Log.

Do not require every ordinary business PR to update this plan. Only PRs affecting Harness, Agent Loop, verification workflow, repository Skills, scoped instructions, failure registry, or CI execution should update it.

## Decision Log

### D-001

- Decision: Keep JSON adapter as default runtime.
- Reason: It is the current local/demo runtime and remains safer while Postgres parity matures.
- Consequences: Postgres work must avoid runtime opt-in unless a dedicated PR changes provider wiring.
- Status: Completed

### D-002

- Decision: Use explicit `SIMWAR_TEST_DATABASE_URL` for database Harness.
- Reason: Disposable verification must not connect to production or shared databases by accident.
- Consequences: Missing test URL fails fast; ordinary runtime database env is not a fallback.
- Status: Completed

### D-003

- Decision: Use PostgreSQL 16 for replay verification.
- Reason: The disposable harness has been verified against PostgreSQL 16.
- Consequences: CI should use the same major version for replay database checks.
- Status: Completed

### D-004

- Decision: Prefer GitHub Actions service containers over Testcontainers initially.
- Reason: The repository already has npm scripts and GitHub Actions; service containers add less tooling.
- Consequences: Testcontainers can remain a later option if CI service containers become insufficient.
- Status: Planned

### D-005

- Decision: Limit automated repair to two attempts.
- Reason: Repeated failures should trigger analysis instead of indefinite patching.
- Consequences: The repair loop needs same-failure detection and escalation.
- Status: Planned

### D-006

- Decision: Treat settlement and replay truth-chain failures as human-review required.
- Reason: Those failures can alter official outcomes, replay hashes, or idempotency.
- Consequences: Automated repair may add tests or reports, but should not rewrite truth logic without review.
- Status: Completed

### D-007

- Decision: Store machine-readable verification reports as CI artifacts, not committed outputs.
- Reason: Reports are run-specific and should not add repository churn.
- Consequences: Scripts may write local artifacts that CI uploads, while Git remains clean.
- Status: Planned

### D-008

- Decision: Convert every confirmed escaped defect into a permanent guardrail.
- Reason: The value of the Agent Loop depends on failures becoming automated future checks.
- Consequences: Fix PRs should normally include or schedule a durable test, Harness, lint, Skill, or scoped-rule guardrail.
- Status: Active

## Current Status

Current phase:

- Milestone 1: Automate the proven Postgres Harness

Completed PRs:

- `ops: add disposable Postgres replay verification harness`
- `fix: verify replay explicit columns in Postgres harness`

Active PR:

- `docs: add SimWar Harness and Agent Loop execution plan`

Next PR:

- `ci: run disposable Postgres replay verification`

Open Risks:

- CI does not yet run the disposable PostgreSQL replay harness.
- Verification reports are not machine-readable yet.
- Repair loop rules are documented here but not implemented.
- Failure registry is not yet created.
- Repository-local Skills are not yet created.

Latest completed capability:

- Disposable PostgreSQL replay verification harness.

Runtime wiring:

- Not started and out of scope.

## Completion Definition

This execution plan is complete when:

- Real database Harness runs automatically in CI.
- Verification results are machine-readable.
- A bounded repair loop is executable.
- Real defects enter a failure registry.
- Repeated workflows are captured as repository Skills.
- `AGENTS.md` instructions are layered by scope.
- Truth-chain and runtime boundaries are mechanically checked.
- Recurring quality audit can run.
- JSON adapter remains default unless an independent runtime opt-in plan changes it.
