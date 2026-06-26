# Task Card Template

Sources: `docs/architecture/adr/ADR-DATA-005-authority-boundary-and-transition-strategy.md`, `docs/decisions/HUMAN_DECISION_ADR-DATA-005.md`, `AGENTS.md`, `DEVELOPMENT_PLAN.md`, `docs/governance/audit-remediation-process.md`.

No code modification starts without a complete Task Card. No task may implement work that depends on an unresolved architecture decision without an accepted ADR front matter or repository Human Decision Artifact.

```text
task_id:
task_title:
task_type:
risk_tier:

current_active_authority:
target_durable_authority:
transition_authority:

human_acceptance_artifact:
triggered_omd:
allowed_scope:
forbidden_scope:
touched_domains:

active_routes:
read_path:
write_path:
tenant_role_membership_guard:
idempotency_behavior:
audit_behavior:
contract_delta:

required_gate_matrix_rows:
required_commands:
fallback_evidence:

issue_111_delta:
issue_114_delta:
issue_115_delta:

postgres_gate_lift:
stop_conditions:
expected_final_status:
next_allowed_task:
```

## Field Rules

| Field | Required meaning |
| --- | --- |
| `task_id` | Stable task identifier. |
| `task_title` | Human-readable scope title. |
| `task_type` | Examples: `read-only`, `docs-only`, `test-only`, `implementation`, `review-gate`. |
| `risk_tier` | Highest risk tier touched by the task. |
| `current_active_authority` | What the current active runtime actually uses today. |
| `target_durable_authority` | Accepted long-term authority, if any. |
| `transition_authority` | Temporary authority or compatibility state. |
| `human_acceptance_artifact` | ADR or decision file that unlocks the task. Use `none` only when no decision gate is triggered. |
| `triggered_omd` | IDs from `open-major-decisions.md`, or `none`. |
| `allowed_scope` | Exact file, route, domain, and operation boundary. |
| `forbidden_scope` | Explicit exclusions and hard gates. |
| `touched_domains` | Gate matrix domains affected by the task. |
| `active_routes` | Active route or entry point under review/change. |
| `read_path` | Current and intended read path. |
| `write_path` | Current and intended write path. |
| `tenant_role_membership_guard` | How tenant, role, team, and membership boundaries are protected or unchanged. |
| `idempotency_behavior` | Existing behavior and any intended delta. |
| `audit_behavior` | Existing behavior and any intended delta. |
| `contract_delta` | OpenAPI, JSON Schema, fixture, shared type, or DTO change. |
| `required_gate_matrix_rows` | Rows from `gate-command-matrix.md`. |
| `required_commands` | Commands/checks to run, or explicit `COMMAND_NOT_AVAILABLE`. |
| `fallback_evidence` | Accepted alternate evidence when a command is unavailable. |
| `issue_111_delta` | No change / relates / blocker / closeout candidate. |
| `issue_114_delta` | No change / relates / matrix row impacted. |
| `issue_115_delta` | No change / relates / matrix row impacted. |
| `postgres_gate_lift` | Must be `none` unless a later human decision grants a narrow lift. |
| `stop_conditions` | Conditions that force stop or replan. |
| `expected_final_status` | Allowed final statuses. |
| `next_allowed_task` | One task or `none`. |

## Mandatory Statements

Every implementation Task Card must state:

- whether main worktree is protected;
- whether PostgreSQL/cross-process hard gate remains active;
- whether #111, #114, and #115 remain open;
- whether PR body must use `Relates to #<issue>`;
- whether source, tests, config, CI, contracts, routes, providers, schema, migration, or package files are allowed.

## Stop Rule

If the Task Card cannot name its authority state, touched domains, gate rows, and stop conditions, the task is not ready for code modification.
