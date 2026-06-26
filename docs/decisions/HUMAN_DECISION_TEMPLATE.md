---
decision_id:
status: proposed
accepted_by:
accepted_at:
scope:
non_goals:
evidence_refs:
next_allowed_task:
supersedes:
---

# Human Decision Template

Sources: `docs/decisions/HUMAN_DECISION_ADR-DATA-005.md`, `docs/architecture/adr/ADR-DATA-005-authority-boundary-and-transition-strategy.md`, `AGENTS.md`, `DEVELOPMENT_PLAN.md`, `docs/governance/audit-remediation-process.md`.

This template records auditable human acceptance. Chat phrases such as "continue", "can proceed", or "agree" do not by themselves unlock downstream execution. A downstream task is unlocked only by accepted ADR front matter or a repository Human Decision Artifact.

## Decision

State the selected decision in one or two precise paragraphs.

## Reasoning

Explain why this decision is sufficient for the next allowed task and what evidence supports it.

## Accepted Scope

List exactly what is accepted.

## Explicit Non-Goals

List what is not authorized. Include runtime, migration, transaction, cross-process, issue closeout, and production-data boundaries when relevant.

## Evidence References

Reference ADRs, design notes, source evidence, PRs, issues, or audit evidence used for the decision.

## Allowed Follow-up Task

Name exactly one next allowed task, or `none`.

## Acceptance Rule

Set `status: accepted`, `accepted_by`, and `accepted_at` only after the project owner has explicitly accepted the decision. Keep proposed or draft decisions as `status: proposed`.
