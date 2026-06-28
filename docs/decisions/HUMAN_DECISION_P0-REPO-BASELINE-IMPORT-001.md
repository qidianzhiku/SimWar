---
decision_id: HUMAN_DECISION_P0-REPO-BASELINE-IMPORT-001
status: accepted
accepted_by: Haipang Zhang (Project Owner)
accepted_at: 2026-06-28
scope:
  candidate_source: "D:\\codex\\SimWar\\docs\\architecture\\simwar-development-quality-toolchain-roadmap.md"
  target_path: docs/architecture/simwar-development-quality-toolchain-roadmap.md
  import_type: docs-only
allowed_files:
  - docs/architecture/simwar-development-quality-toolchain-roadmap.md
non_goals:
  - no actual import in this decision-recording task
  - no second path
  - no route/provider/business/runtime change
  - no tests, contracts, frontend, CI, package, schema, migration, or SQL work
  - no PostgreSQL, transaction, row lock, unique constraint, or cross-process work
  - no #111/#114/#115 closeout
evidence_refs:
  - "D:\\codex\\audit-evidence\\SimWar-p0-repo-baseline-import-001-prep-20260627-164050\\BASELINE_NOTE.md"
  - "D:\\codex\\audit-evidence\\SimWar-p0-repo-baseline-import-001-prep-20260627-164050\\IMPORT_SLICE_PREPARATION.md"
  - "D:\\codex\\audit-evidence\\SimWar-p0-repo-baseline-import-001-human-decision-20260627-171457\\DECISION_GATE_NOTE.md"
candidate_sha256: 67467B7E40E048C01063E69C9857DD15CF59AF4B9BE9D4FB23C3953B415B4670
candidate_size_bytes: 27749
next_allowed_task: P0-REPO-BASELINE-IMPORT-001-DECISION-NOTE-PR
supersedes: null
---

# Human Decision: Baseline Import 001

## Decision

The Project Owner accepts only the future import of one exact docs-only
candidate file:

```text
docs/architecture/simwar-development-quality-toolchain-roadmap.md
```

This decision does not import the candidate file.

This decision authorizes no second path.

This decision does not authorize business code, tests, contracts, frontend,
CI, schema, migration, SQL, provider, route, runtime, PostgreSQL,
cross-process, durable settlement, or Issue closeout work.

## Candidate Fingerprint

```text
source:
D:\codex\SimWar\docs\architecture\simwar-development-quality-toolchain-roadmap.md

target:
docs/architecture/simwar-development-quality-toolchain-roadmap.md

sha256:
67467B7E40E048C01063E69C9857DD15CF59AF4B9BE9D4FB23C3953B415B4670

size_bytes:
27749
```

## Accepted Scope

This decision is limited to recording acceptance for a later docs-only import
task. The later task must independently verify the remote baseline, candidate
path, candidate fingerprint, allowed scope, and no-import-before-authorization
boundary before any repository import occurs.

## Explicit Non-Goals

- No actual candidate import in this decision-recording task.
- No candidate-file modification.
- No `.gitignore` update.
- No source, test, fixture, contract, OpenAPI, frontend, CI, package, schema,
  migration, SQL, provider, route, or runtime change.
- No PostgreSQL runtime, transaction, row lock, unique constraint,
  cross-process, crash/retry/recovery, or durable settlement work.
- No #111, #114, or #115 closeout.
- No push or PR creation in this task.

## Allowed Follow-Up

```text
P0-REPO-BASELINE-IMPORT-001-DECISION-NOTE-PR
```
