# Codex Execution Rules

Sources: `docs/architecture/adr/ADR-DATA-005-authority-boundary-and-transition-strategy.md`, `docs/decisions/HUMAN_DECISION_ADR-DATA-005.md`, `AGENTS.md`, `DEVELOPMENT_PLAN.md`, `docs/governance/audit-remediation-process.md`.

This document is the reusable execution control plane for Codex tasks. It does not change product behavior, storage behavior, issue state, runtime provider selection, schema, migration, or CI configuration.

## Authority Terms

| Term | Meaning | Current SimWar baseline |
| --- | --- | --- |
| Current Active Authority | The source that current active routes actually read from or write to today. | JSON runtime remains the active default runtime unless a task proves otherwise. |
| Target Durable Authority | The accepted long-term authority for durable operational control-plane and governance assets. | ADR-DATA-005 accepts PostgreSQL as target durable authority for Team, TeamMember, ParameterSet, and ScenarioPackage metadata. |
| Transition Authority | A temporary, explicitly bounded authority during migration or compatibility work. | Must be documented in a Human Decision Artifact before implementation work depends on it. |
| Projection | A read, reporting, search, analytics, or compatibility view that is not authoritative for writes. | PostgreSQL surfaces can be projection-only until explicitly accepted as authority. |
| Fixture / Seed | Demo, test, import/export, or controlled compatibility data. | JSON may continue as fixture, seed, demo, import/export, or compatibility data under ADR-DATA-005. |

## Anchor Table

`status` and `risk_tier` are separate fields. A stable high-risk anchor can have `status: confirmed`; a low-risk anchor can still be `status: conflict`.

| ID | Conclusion | Status values | Risk tier | Update condition |
| --- | --- | --- | --- | --- |
| ANCHOR-001 | `D:\codex\SimWar` main worktree is protected and not a development surface. | confirmed / evidence_limited / conflict | RISK_TIER_0 | Any task wants to modify, clean, reset, stash, or develop in main. |
| ANCHOR-003 | JSON is the current active default runtime. | confirmed / changed / not_verified | RISK_TIER_1 | Runtime provider selection, server bootstrap, or active route wiring changes. |
| ANCHOR-004 | PostgreSQL is not the default active runtime. | confirmed / changed / not_verified | RISK_TIER_1 | Any task adds `DATABASE_URL`, provider-kind activation, server selection, or request/runtime switching. |
| ANCHOR-005 | Core Simulation Engine L1-L3 is the sole formal simulation truth writer. | in_scope / not_in_scope / conflict | RISK_TIER_0 | Settlement, score, rank, result, replay hash, or truth-field changes. |
| ANCHOR-006 | AI remains advisory_only and cannot write formal truth. | in_scope / not_in_scope / conflict | RISK_TIER_0 | Any task touches AI output, model policy, prompt, RAG, tool policy, settlement, score, or rank. |
| ANCHOR-008 | #111 remains open and durable settlement is unproven. | confirmed / not_verified / conflict | RISK_TIER_0 | Settlement durability, transaction, lock, crash recovery, cross-process, or issue-state changes. |
| ANCHOR-009 | #114 and #115 remain open. | confirmed / not_verified / conflict | RISK_TIER_1 | Direct-store closeout, contract parity closeout, or issue-state changes. |

## Main Worktree Rule

Do not develop in `D:\codex\SimWar`. The main worktree may be dirty for historical or user-owned reasons. Dirty main state means: do not edit, clean, reset, restore, stash, or use it as an implementation surface. It does not mean clean worktree development is blocked.

## Worktree Bootstrap Exception

Only the following main-worktree operations are allowed when a task card explicitly authorizes a new worktree:

1. discover default branch;
2. `git ls-remote origin refs/heads/<default-branch>`;
3. `git fetch --no-tags origin <default-branch>`;
4. `git rev-parse origin/<default-branch>`;
5. `git status --porcelain=v1`;
6. `git worktree list --porcelain`;
7. `git worktree add` with an explicit branch or detached inspection path.

If remote-before, local tracking, and remote-after SHAs do not match, stop with `REPLAN_REQUIRED`.

## Task Worktree Allow-List

Work only inside the task worktree and only on files explicitly allowed by the task card. Do not carry unrelated changes into the task. If an unapproved path appears, stop unless the task card already defines a safe handling rule.

## Forbidden Git Commands

Unless a human task card explicitly grants a narrower exception, do not run: `git reset`, `git restore`, `git clean`, `git stash`, `git pull`, `git checkout`, `git switch`, `git merge`, `git rebase`, `git worktree remove`, `git worktree prune`, `git add .`, `git add -A`, or `git push --force`.

## L0-L6 Loop Engineering

| Loop | Purpose | Required output |
| --- | --- | --- |
| L0 Baseline | Verify remote stability, accepted decisions, issue state, worktree cleanliness. | Baseline note or final report section. |
| L1 Scope | Confirm allowed files, forbidden files, touched domains, and hard gates. | Task card scope decision. |
| L2 Evidence | Read only the source, docs, tests, workflow, and issue evidence needed for the task. | Evidence refs, not broad audit sprawl. |
| L3 First Change | For implementation tasks, add the smallest approved test or docs change first. | Focused diff in approved paths. |
| L4 Verification | Run only the gate matrix rows required by touched domains. | Logs or explicit not-available evidence. |
| L5 Review | Confirm diff scope, issue wording, no forbidden paths, and no overclaims. | Review checklist. |
| L6 Handoff | Stop at the required final status and do not auto-start the next task. | Final report and next allowed task. |

## STOP And REPLAN Triggers

Stop immediately when:

- remote default branch moves during capture;
- accepted ADR or Human Decision Artifact is missing, changed, or contradicted;
- task scope requires a forbidden file or domain;
- target path conflicts with existing repository files;
- a Risk Tier 0 boundary is unclear or contradicted;
- a command required for a Risk Tier 0 claim is unavailable and no equivalent evidence exists;
- PostgreSQL runtime, database connection, migration, transaction, row lock, unique constraint, cross-process, or crash/recovery work becomes necessary without explicit authorization;
- #111, #114, or #115 issue state unexpectedly changes.

Use `REPLAN_REQUIRED` when the task premise changes. Use `DESIGN_GATE_BLOCKED` when a human scope or decision artifact is missing.

## Human Acceptance Artifact

Chat approval alone is not sufficient to unlock architecture-dependent implementation. A downstream task that depends on a new architecture decision must cite either:

- accepted ADR front matter in the repository; or
- a repository Human Decision Artifact in `docs/decisions/`.

The artifact must identify scope, non-goals, evidence references, and `next_allowed_task`.

## PostgreSQL And Cross-Process Hard Gate

`DO_NOT_START_POSTGRES_OR_CROSS_PROCESS_IMPLEMENTATION` remains active by default. A task may discuss, design, or document PostgreSQL only within its explicit scope. It may not start PostgreSQL, connect to a database, write SQL or migrations, activate runtime selection, implement transactions, row locks, unique constraints, cross-process idempotency, or crash recovery unless a later task explicitly grants that authority.

## Open Issue Governance

#111, #114, and #115 remain open unless a dedicated closeout task proves every closeout gate and a human explicitly authorizes issue mutation. Normal PR bodies should use `Relates to #<issue>` and avoid closing keywords.

## Required References For Implementation PRs

Every implementation PR must cite:

- its Task Card;
- the relevant rows of `docs/governance/gate-command-matrix.md`;
- any triggered item in `docs/governance/open-major-decisions.md`;
- relevant #114 or #115 matrix rows when storage boundary or contract parity is touched.
