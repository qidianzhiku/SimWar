# G0 Solo-Maintainer Control Policy

## Status Boundary

```text
G0 Status:
EXCEPTION

G0 PASS:
NOT_GRANTED

L1 Status:
NOT_READY

PostgreSQL runtime:
NOT_AUTHORIZED
```

本文记录当前 single-maintainer governance control policy。它不是 `G0 PASS` 授权，不是 `L1 READY`，不授权 `Pilot`、`Production`、PostgreSQL runtime、SQL、migration、durable settlement 或 bypass merge。

## Evidence Package Boundary

```text
INTERNAL_ONLY_DRAFT_NOT_RELEASED
```

本文可被 synthetic internal application evidence package 引用，但只能作为 G0 solo-maintainer control 的内部草案证据。它不授权 `Pilot`、`Production`，且 PostgreSQL runtime 保持 `NOT_AUTHORIZED`。

## Policy Statement

The current solo-maintainer policy is not self-approval. It is:

- Pull Request requirement retained.
- required checks retained.
- required approving review count intentionally set to `0`.
- force push prohibited.
- branch deletion prohibited.
- conversation resolution retained.
- admin enforcement retained where supported by current branch protection.
- ordinary merge only.

## Required Checks

| Check                               | Required |
| ----------------------------------- | -------- |
| `quality`                           | yes      |
| `browser-smoke`                     | yes      |
| `Analyze JavaScript and TypeScript` | yes      |

## Control Layer Rules

Owner authorization does not replace required checks. Local validation does not replace GitHub checks. `mergeable = MERGEABLE` does not replace `mergeStateStatus = CLEAN`. An ordinary merge must still be separately authorized and must not use `--admin`, `--squash`, `--rebase` or `--auto`.

## Evidence Layer Rules

For implementation and source audit:

- use fixed SHA
- use isolated clone
- verify clean worktree
- record command outputs and exit codes

For PR merge:

- read current PR state
- read required checks
- read current remote refs
- verify changed-file scope
- scan PR body for issue closeout keywords

## Action Layer Rules

Source audit does not grant merge authority. Human or Owner disposition does not grant code mutation unless explicit. A merged R3 PR does not grant `L1 READY`. An L1 readiness PR does not grant Teacher rehearsal, `Pilot` or `Production`.

## Mutation Boundary

This policy does not authorize branch protection mutation, ruleset mutation, workflow dispatch, CI rerun, Issue mutation, PostgreSQL runtime, SQL, migration, durable settlement or direct push.

## Non-Proofs

The solo-maintainer policy does not prove `G0 PASS`, `L1 READY`, `Pilot`, `Production`, PostgreSQL runtime, SQL migration, R4 Macro, R9 or R10.
