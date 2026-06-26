# PR Review Rubric

Sources: `.github/pull_request_template.md`, `docs/governance/audit-remediation-process.md`, `docs/governance/gate-command-matrix.md`, `docs/governance/task-card-template.md`, `docs/architecture/adr/ADR-DATA-005-authority-boundary-and-transition-strategy.md`, `AGENTS.md`.

This rubric supplements the existing pull request template. It does not replace `.github/pull_request_template.md`.

## Review Conclusions

| Conclusion | Meaning |
| --- | --- |
| PASS | Scope, evidence, checks, and issue wording match the task. |
| PASS_WITH_NOTES | Merge may proceed after recording non-blocking notes. |
| NEEDS_REVISION | Changes are in scope but require correction before merge. |
| DESIGN_GATE_BLOCKED | A human decision, ADR, or scope clarification is required. |
| STOP_AND_REPLAN | Task premise changed or a hard gate was hit. |

## Review Checklist

| Area | Questions |
| --- | --- |
| Task Card completeness | Does the PR cite a complete Task Card with allowed/forbidden scope, touched domains, gate rows, stop conditions, and final status? |
| Current Active Authority | Does the PR correctly describe the current active authority and avoid overclaiming runtime changes? |
| Target Durable Authority | If target authority is referenced, does it cite an accepted ADR or Human Decision Artifact? |
| Active route evidence | Are active routes or entry points identified from current source, not inferred from filenames? |
| Tenant / role / membership guard | Does the PR preserve or explicitly test the relevant tenant, role, team, and membership boundary? |
| Core truth boundary | Does the PR preserve simulation truth, settlement result, score, rank, replay hash, and canonical decision boundaries? |
| AI advisory-only | Does the PR keep AI outputs outside formal truth, settlement, score, rank, and ParameterSet writes? |
| #111 / #114 / #115 delta | Does the PR accurately state whether it relates to each issue and avoid issue closeout wording? |
| Gate Matrix | Are required commands/checks selected from `gate-command-matrix.md` and actually run or marked unavailable? |
| COMMAND_NOT_AVAILABLE | Are missing commands reported as unavailable rather than passed? |
| Contract / fixture / shared type | Are OpenAPI, JSON Schema, fixtures, shared contracts, and DTOs updated or explicitly unchanged? |
| Rollback / compatibility | Is the change small, reversible, and compatible with current JSON default runtime? |
| Docs / ADR / Human Decision | Are docs synchronized only where scoped, and are accepted decisions left intact? |

## Warning Protocol

| Warning | Meaning | Required action |
| --- | --- | --- |
| W0_NOTE | Non-blocking evidence note or local environment limitation. | Record in PR or final report. |
| W1_TASK_WARNING | Scope risk that remains manageable inside the current task. | Tighten evidence or tests before merge. |
| W2_DECISION_GATE | Human decision or ADR is required before proceeding. | Stop implementation; request decision artifact. |
| W3_STOP_AND_REPLAN | Hard gate, active defect, remote movement, or unauthorized scope expansion. | Stop; do not patch around it. |

## Blocking Conditions

Use `DESIGN_GATE_BLOCKED` or `STOP_AND_REPLAN` if:

- target files exceed the task allow-list;
- PR changes source/test/config/CI/contract/provider/schema/migration files without authorization;
- PostgreSQL runtime, database connection, SQL, migration, transaction, row lock, unique constraint, cross-process, or crash recovery appears without explicit authorization;
- a PR claims #111, #114, or #115 closeout without a dedicated closeout task;
- closing keywords are used for #111, #114, or #115;
- accepted ADR content is modified without a Human Decision Artifact.

## Merge Readiness Minimum

A PR is merge-ready only when:

1. diff scope matches the Task Card;
2. required gate matrix rows are satisfied or evidence-limited with approved handling;
3. no forbidden files or hard-gate scope appear;
4. issue relationship wording is safe;
5. branch and checks are mergeable under current protection;
6. no unresolved review comment or design gate remains.
