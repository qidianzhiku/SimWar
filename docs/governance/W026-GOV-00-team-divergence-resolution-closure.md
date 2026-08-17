# SimWar W026 Governance Closure

## Document control

| Field                                         | Value                                                              |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Document ID                                   | W026-GOV-00                                                        |
| Version                                       | 1.0                                                                |
| Date                                          | 2026-08-17                                                         |
| Repository                                    | qidianzhiku/SimWar                                                 |
| Default branch                                | master                                                             |
| Planning base / current master before closure | `e7f0d911b9c8487effd0eea82c678e1cbde8b1cc`                         |
| Product PR                                    | #390                                                               |
| Product candidate SHA                         | `26f91ab611da3a859ded9d476cf5d502bc5193d5`                         |
| Product merge SHA                             | `e7f0d911b9c8487effd0eea82c678e1cbde8b1cc`                         |
| Product merge tree                            | `341943f20a45904d2514d6377c417468c3eb247d`                         |
| Governance PR                                 | #391                                                               |
| Governance merge SHA                          | PENDING_UNTIL_GOVERNANCE_MERGES                                    |
| Product changed-file count                    | 23                                                                 |
| Product manifest SHA-256                      | `81e1371583607d093b5e724a6cc9f4b5d1e559bbace79ab9d823b8a44249e159` |
| Fresh clone                                   | `D:\codex\fresh-clones\simwar-w026-postmerge-e7f0d91`              |
| Fresh clone status                            | CLEAN / DETACHED at merge SHA                                      |
| Human validation                              | NOT_PERFORMED                                                      |
| Pilot / production                            | NOT_AUTHORIZED                                                     |
| automatic_next_start                          | false                                                              |

## Closure outcome

W026 delivers one bounded primary outcome:

> When active READY role contributions contain a real field-level divergence,
> the server produces a deterministic team-scoped divergence projection; the
> captain selects one observed candidate value per divergent field; every
> active role acknowledges the resolution or preserves bounded dissent; and
> only then can the existing DecisionMergeCommit and TeamConfirmation chain
> proceed.

Preserved dissent is process evidence only. It is not a second Decision, a
SettlementResult input, a Score or Rank input, or Replay truth.

## Product merge and fresh-clone evidence

PR #390 was the one W026 Product PR. It merged as an ordinary merge commit:

- first parent: `5423c2adac82355a8f77bb134bb3e67c954cb634`;
- second parent: `26f91ab611da3a859ded9d476cf5d502bc5193d5`;
- merge SHA: `e7f0d911b9c8487effd0eea82c678e1cbde8b1cc`.

The exact candidate contained 23 changed files and the manifest digest above.
Remote `quality`, `browser-smoke`, `Analyze JavaScript and TypeScript`, and
CodeQL all passed on the exact head. Independent review recorded:

```text
BLOCKING: 0
MUST_FIX: 0
UNKNOWN: 0
```

A new detached clone at the merge SHA passed:

- `npm ci`;
- build test prerequisites;
- contract gate: 20 files / 50 tests;
- direct-store boundary: 0 new unapproved accesses;
- hidden-Unicode, typecheck, lint and build;
- default Vitest: 204 files / 1307 tests;
- default browser suite: 114 passed / 11 existing conditional skips;
- W026 real Chromium journey: 1 passed;
- disposable PostgreSQL 16 replay verification: 20/20;
- security audit at the repository critical threshold.

The disposable PostgreSQL service was stopped and its test volume removed
after the replay receipt. PostgreSQL application runtime remains inactive.

## Authority and visibility closure

The formal chain remains:

`Student UI -> Student BFF -> RoleWorkflowCommandService -> RoleWorkflowRepositoryPort -> existing DecisionMergeCommit -> existing TeamConfirmation -> canonical Decision`

The W026 surface does not create a second canonical writer. It exposes only
READY, team-scoped candidate values; it does not reveal drafts, peer private
payloads, actor identifiers, state truth, unpublished outcomes, scores, ranks,
replay manifests, or learning evidence. Teacher receives a readonly summary
and no resolution command.

The default runtime authority remains `JSON_INTERNAL_ONLY`. No migration, RLS,
general PostgreSQL runtime activation, settlement formula, replay hash, Truth,
Score, Rank, or Student visibility widening is included.

## Graph and quality limits

Graphify was refreshed at the product exact head and again at the merge SHA,
producing 13,131 nodes and 23,941 edges. The receipts retain the warnings for
130 JSON files with zero AST nodes, seven SQL files skipped because
`tree_sitter_sql` was unavailable, and three sensitive files skipped.

No current `.codegraph` index was available in the isolated worktrees. The
review therefore used explicit source caller/callee fallback and records
`CODEGRAPH_UNAVAILABLE_CURRENT_INDEX`; this is a tooling limit, not a product
pass claim.

The security audit reports the inherited repository baseline of 2 low and 7
high advisories. No dependency update or audit-fix mutation is included.

## Known limits and non-proofs

- V1 selects one observed candidate value; team-authored compromise values are deferred.
- The current roster remains four roles; six-role expansion is out of scope.
- Private judgment and independent role-position domain objects remain unmodeled.
- Issue #351 remains open; general PostgreSQL, RLS, cross-process durability and broader tenant-baseline guarantees are not claimed.
- Human Validation was not performed.
- Product checks, browser journeys and automated evidence do not prove teaching effectiveness or human usability.
- BLP/Shanghai, Small Model, Multi-Agent, Pilot, Production and successors are not authorized.

## Governance disposition

This is the single W026 docs-only Governance Closure PR. It updates the
planning carriers and this closure record only. It must not contain product
source, tests, contracts, migrations, packages, workflows, runtime authority,
or database changes.

The governance merge SHA is intentionally pending. The post-merge exact
readback is authoritative for the final governance merge SHA and tree; no
second Governance PR may be created merely to write that self-reference.

Before this Governance PR merges:

```text
W026_PRODUCT: COMPLETE_WITH_LIMITS
W026_GOVERNANCE: PENDING_GOVERNANCE_MERGE_READBACK
W026_RESOURCE_LOCKS: HELD_PENDING_GOVERNANCE_MERGE_READBACK
W027: NOT_AUTHORIZED_NOT_STARTED
automatic_next_start: false
```

After one ordinary governance merge and clean exact-master readback, the
external closure receipt may record governance as merged and release the W026
locks. No successor starts automatically.
