# SimWar Graph Foundation Lite

## Purpose and priority

Graph Foundation Lite gives SimWar development tasks a stable, reusable code-navigation baseline without coupling graph assets to disposable clones. Each baseline binds a managed source, CodeGraph index, Graphify index, provenance, health evidence, and registry record to one full Git SHA.

This is P1 engineering enablement for L1 Closure. Golden M1, the Teacher / Student minimal loop, runtime authority, and Evidence Pack closure remain the product priorities. Graph maintenance must not block those paths unless a separate high-risk mission explicitly requires an exact-head graph.

## Roles and authority

CodeGraph is the symbol and call-path graph. Use it for definitions, references, callers, callees, affected tests, and focused blast-radius analysis.

Graphify is the cross-module relationship graph. Use it for broader traversal among applications, services, shared contracts, tests, scripts, and architecture concepts. A code-only extraction is a valid partial baseline when semantic document extraction is unavailable, but its registry status must say `PARTIAL`.

Neither graph is a truth source. Graph output does not replace Git commits, exact diffs, source code, schemas, tests, runtime evidence, replay evidence, or formal governance decisions. In particular, graphs cannot authorize changes to canonical Decision, SettlementResult, Replay truth hashes, score, rank, runtime authority, or student visibility.

## Managed layout

The default local layout is:

```text
D:\codex\graph-infra\
  repos\SimWar.git
  sources\SimWar\<SHA12>\
  indexes\codegraph\SimWar\<SHA12>\
  indexes\graphify\SimWar\<SHA12>\
  registry\simwar-current-master.candidate.json
  registry\simwar-current-master.json
  locks\simwar-graph-foundation.lock.json
  evidence\<SHA12>\
```

The current CodeGraph CLI requires `.codegraph\` inside the source. Its registry `index_root` therefore records the actual source-local directory rather than pretending that the external CodeGraph path is in use. Graphify supports an external output root and writes `<index-root>\graphify-out\graph.json`. The tools share the same exact-SHA source but never share an index.

The persistent bare repository is administration state for managed worktrees. The exact-SHA source is detached and read-only by convention. Product development happens in a separate branch worktree.

## Exact SHA and provenance

Every usable baseline records:

- the full 40-character Git SHA and its 12-character directory name;
- the remote URL and fetched ref;
- a detached, clean source root;
- the actual tool versions, commands, include/exclude behavior, and index roots;
- available file, node, and edge counts;
- parse failures or `UNKNOWN_NOT_EXPOSED_BY_TOOL`;
- representative query results and contamination checks.

An index directory existing is not evidence of health. Readiness requires successful representative queries against the registered exact source.

Fresh clones and graph sources have different jobs. A fresh clone is disposable validation input. A graph source is a stable, managed, SHA-bound worktree retained after the mission so later tasks can locate and revalidate the same baseline.

## Registry workflow

`simwar-current-master.candidate.json` is preparation state. It may be updated while health and moving-master checks are still in progress, but it is never treated as the current baseline.

Publish `simwar-current-master.json` only after all of the following are true:

1. registry SHA equals source `HEAD`;
2. source status is clean;
3. required provenance and health files exist;
4. each tool reports its own honest status;
5. representative health queries ran;
6. no graph index is being written;
7. the publishing mission owns the active lock;
8. the relationship to `FINAL_MASTER_SHA` is explicit.

Publication uses a fully written candidate followed by an atomic replacement. Preserve a previous current registry as a recoverable backup when it exists.

Consumers must inspect `overall_status` and each tool independently. They must not infer Graphify readiness from CodeGraph readiness, or the reverse.

## Local resource lock

The lock at `locks\simwar-graph-foundation.lock.json` is an atomic, mission-scoped local lease. It records mission identity, execution identity or process ID, timestamps, SHA, source, index roots, host, and status.

Before writing, check whether the lock exists, whether its owner is the current mission, and whether its status is active. Never delete or overwrite an unverified lock. A conflicting active lock requires a mission-specific candidate root or repository-only work; it must not lead to terminating an unknown process.

Only the creating mission releases its lock. Release happens after index writes and registry publication stop, including on partial failure when ownership is still provable. The lock is local coordination, not a distributed lock.

## Parallel execution

Each graph mission uses its own:

- Codex task;
- branch and product-change worktree;
- evidence root;
- source/index target for its SHA;
- logs and lock ownership.

The protected workspace and other tasks' worktrees are read-only facts. Do not switch their branches, clean them, prune them, reset them, reuse their uncommitted changes, or write their evidence/index roots.

Repository changes stay under:

- `scripts/graph/prepare-simwar-graph-foundation.ps1`;
- `scripts/graph/verify-simwar-graph-foundation.ps1`;
- this governance document.

Generated source clones, indexes, evidence, `node_modules`, screenshots, reports, and registry files stay outside Git.

## START / FINAL master protocol

At mission start:

1. fetch `origin`;
2. resolve `origin/master`;
3. record the full `START_MASTER_SHA` and UTC time;
4. build source, indexes, provenance, and initial health against that SHA.

Do not continuously chase master during the build.

Before current-registry publication:

1. fetch `origin` once more;
2. resolve `FINAL_MASTER_SHA`;
3. compare it with `START_MASTER_SHA`.

If the values match, the verified baseline may become current.

If they differ, perform at most one controlled refresh when the change is bounded and rebuilding is safe. If a refresh is not appropriate, retain the start graph as an `EXACT_SHA_BASELINE`, mark it `GRAPH_STALE_FOR_CURRENT_MASTER`, do not publish it as current, and provide the next refresh command. If master moves again during the single refresh, finish the refresh target as an exact historical baseline and stop chasing later SHAs.

## Status and fallback

The verifier emits one of:

- `GRAPH_EXACT_READY`: both tools are fully ready for the registered final SHA;
- `GRAPH_PARTIAL_READY`: the source is exact and at least one tool is usable, while another is partial or unavailable;
- `GRAPH_STALE_FOR_CURRENT_MASTER`: the graph is exact for a historical SHA but not current master;
- `GRAPH_BROKEN`: source, SHA, path, provenance, index, lock, or registry integrity failed;
- `GRAPH_UNAVAILABLE_WITH_REPO_NATIVE_FALLBACK`: the exact source is usable but neither graph is currently healthy.

For low-risk work, graph unavailability falls back to Git, `rg`, source, schemas, tests, and runtime evidence. Graph Foundation Lite is not a global required gate.

## Prepare and verify

Dry-run preparation:

```powershell
pwsh -NoProfile -File scripts/graph/prepare-simwar-graph-foundation.ps1 `
  -GraphRoot D:\codex\graph-infra `
  -MissionId <MISSION_ID> `
  -ProtectedWorkspace D:\codex\SimWar `
  -WhatIf
```

Preparation fetches master, resolves a full SHA, creates or validates the detached source, prepares independent paths, checks the lock, and writes only a candidate registry. It does not build a fake MCP automation path and does not publish current.

Verification:

```powershell
pwsh -NoProfile -File scripts/graph/verify-simwar-graph-foundation.ps1 `
  -GraphRoot D:\codex\graph-infra `
  -RegistryPath D:\codex\graph-infra\registry\simwar-current-master.json `
  -ExpectedMasterSha <FULL_SHA>
```

During a mission-owned pre-publication check, `-AllowOwnedLock -MissionId <MISSION_ID>` permits only the matching mission lock. Default verification rejects any active lock.

## Rebuild triggers

Build a new exact-SHA baseline when:

- master SHA changes and the current graph is required;
- source or provenance no longer matches the registry;
- the source is dirty or missing;
- a tool reports a corrupt or stale index;
- representative queries fail systematically;
- tool parser/version changes materially;
- directory structure changes enough that include/exclude assumptions no longer hold.

Do not delete valid historical assets merely because a new SHA exists.

## Deliberate non-goals and known limits

Graph Foundation Lite does not implement:

- automatic updates after master merges;
- per-PR exact-head delta graphs;
- automatic incremental graph merging;
- a CI required check;
- a graph dashboard;
- a multi-repository registry;
- a long-term historical retention policy;
- a graph database service;
- automated portfolio scheduling or authority decisions;
- a distributed lock.

Only one current-master registry is maintained. Graph health applies only to its exact SHA. A master change requires revalidation or rebuilding. Parallel safety still depends on independent worktrees, branches, evidence roots, index roots, and honest lock ownership.
