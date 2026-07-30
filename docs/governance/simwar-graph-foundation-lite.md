# SimWar Graph Foundation Lite

## Purpose and boundary

Graph Foundation Lite is the minimal, durable, SHA-bound navigation asset for SimWar. It prevents a useful CodeGraph or Graphify index from disappearing with a disposable clone while L1 Closure product work remains the priority.

It supports architecture navigation, symbol and caller/callee discovery, test association, and impact-analysis support. It is not authoritative for Git history, source code, contracts, test evidence, runtime behavior, settlement truth, Replay hashes, or governance decisions. Always review exact source, Git diff, schemas, and relevant evidence before acting on graph output.

This baseline does not provide automatic master updates, PR-delta graphs, incremental graph merging, a CI required check, a dashboard, multi-repository management, or a distributed lock.

## Tool responsibilities

CodeGraph is used for symbols, references, callers, callees, affected tests, and high-risk call paths. Follow the [CodeGraph MCP operational runbook](../development/codegraph-mcp-operational-runbook.md) for when call-graph review is mandatory.

Graphify is used for cross-module relationships. Its code-only baseline supports queries without an LLM or external model access. Architecture and governance documents may be included only under separately reviewed scope; evidence, screenshots, dependency folders, and graph assets must stay excluded.

Both tools may read the same exact source but must not share an index. CodeGraph 1.2.0 stores `.codegraph/` in the source and offers no external-index-root option, so that source-internal location is the actual CodeGraph index root. Graphify writes the separate `graphify-out/graph.json` below its supplied index root.

## Managed assets and exact-SHA rule

The standard persistent root is `D:\codex\graph-infra`.

```text
D:\codex\graph-infra\
  sources\SimWar\<SHA12>\                 exact detached, clean source
  indexes\codegraph\SimWar\<SHA12>\       reserved metadata root
  indexes\graphify\SimWar\<SHA12>\        Graphify output parent
  evidence\<SHA12>\                        provenance and health evidence
  registry\simwar-current-master.json      published current baseline
  locks\simwar-graph-foundation.lock.json  local ownership record
```

Every source, provenance record, health query, and registry entry includes the full SHA. The source is a clean detached checkout with the official SimWar origin and is not a product-development worktree.

A fresh development clone is not automatically a graph source: it can have a different SHA, uncommitted changes, generated folders, or nested task snapshots. An index directory is not healthy merely because it exists; successful representative queries tied to the SHA are required.

## Safe preparation and verification

Run only from a dedicated clean worktree, never from `D:\codex\SimWar` or another task's worktree. Preparation fetches `origin`, records `START_MASTER_SHA`, creates or verifies an exact managed source, and writes a registry candidate. It never publishes the current registry by itself.

```powershell
$ownerToken = "graph-foundation-<unique-task-token>"

.\scripts\graph\prepare-simwar-graph-foundation.ps1 `
  -GraphInfraRoot "D:\codex\graph-infra" `
  -EvidenceRoot "D:\codex\evidence\SIMWAR-L1-GRAPH-FOUNDATION-LITE-PARALLEL-001-<UTC>" `
  -OwnerToken $ownerToken `
  -BuildGraphify -BuildCodeGraph -RunHealthChecks
```

Use `-WhatIf` first when planning an asset location. It resolves the current `origin/master` SHA and reports paths without fetching, creating a directory, cloning source, creating a lock, or publishing a registry.

After provenance and health evidence exist, verify and publish only from the same lock owner.

```powershell
.\scripts\graph\verify-simwar-graph-foundation.ps1 `
  -GraphInfraRoot "D:\codex\graph-infra" `
  -OwnerToken $ownerToken `
  -PublishCurrent -ReleaseOwnedLock
```

The verifier checks registry candidate/current state, source location, source HEAD and cleanliness, provenance, health evidence, graph paths, final master relationship, and lock ownership. It revalidates live graph metrics and Graphify structure before publication. Publication fetches the official master ref explicitly, and only a `READY` graph with `PASS` health counts as available. It atomically replaces the current registry only after an exact or partial baseline is validated; an existing registry is kept as a timestamped backup. It never removes a lock without the owner token.

## Parallel work and local lock

The lock is local coordination, not a distributed lock. It records the mission id, owner token, process id, hostname, start time, SHA, and all managed paths. Create it atomically before source/index writes and release only the owning token after registry publication.

If a standard lock exists but ownership or process liveness cannot be proved, never delete, overwrite, or reuse it. Do not write its source or indexes. Use a task-specific persistent candidate root, such as `D:\codex\graph-infra-candidates\<mission>-<UTC>`, with its own source, indexes, evidence, registry candidate, and lock. Record the conflict, do not publish that candidate as standard current master, and close with `PASS_WITH_LIMITS`.

Parallel tasks must use independent Git worktrees, branches, evidence roots, and index roots. They must not change another task's uncommitted files, branch, protected workspace, source checkout, index, evidence, or lock.

## Moving-master protocol

Capture `START_MASTER_SHA` once after the initial fetch and do not continually chase master. Before publication, fetch once more and record `FINAL_MASTER_SHA`.

- If the SHAs match, the exact source may be current after all publication checks pass.
- If they differ, retain the old source as `EXACT_SHA_BASELINE`; it must not be silently registered as current. The verifier reports `GRAPH_STALE_FOR_CURRENT_MASTER`.
- At most one explicit controlled refresh may target the final SHA. If master moves again, retain the refreshed historical baseline and report `PASS_WITH_LIMITS`.

## Status, fallback, and rebuilds

`GRAPH_EXACT_READY` means both tools passed health queries for the final SHA. `GRAPH_PARTIAL_READY` means the exact source and registry are valid and one graph is `READY` with `PASS` health while the other is partial, unavailable, or query-limited. `GRAPH_STALE_FOR_CURRENT_MASTER` means exact historical evidence after master moved. `GRAPH_BROKEN` means source, registry, provenance, index, or path consistency failed. `GRAPH_UNAVAILABLE_WITH_REPO_NATIVE_FALLBACK` means no graph is `READY` with `PASS` health, while the managed source and fallback evidence remain valid.

For low-risk work, unavailable graphs fall back to Git, `rg`, source review, and relevant tests. For high-risk persistence, settlement, Replay, API, authorization, tenant-isolation, or cross-module work, follow the CodeGraph runbook or perform equivalent explicit source-level call-path review. Graph status is never a global required gate.

Create a new exact baseline when master changes, a source is dirty, provenance is inconsistent, health queries fail, generated or nested-task material enters an index, or a tool upgrade changes its format. Never automatically overwrite historical exact baselines.

Each execution retains absolute paths, UTC times, full SHAs, command/tool results, exit codes, and observed limits without secrets. Evidence includes mission context, preflight, repository/tool facts, start/final SHA records, source and graph provenance, health, lock record, validation, overlap review, change summary, and final report.

After Graph Foundation Lite is complete, return to L1 Closure: Golden M1, the Teacher/Student minimum loop, and Evidence Pack validation.
