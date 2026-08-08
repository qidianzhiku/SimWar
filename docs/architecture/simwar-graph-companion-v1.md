# SimWar Graph Companion V1

## Purpose and authority

Graph Companion V1 is a thin, CLI-first evidence companion for SimWar's
current source. It keeps Graphify and CodeGraph artifacts bound to a source
SHA, refreshes them when a product delta is detected, derives a bounded test
impact set, and emits a planning gate that future Macro Missions can consume.

The authority order is:

```text
current Git source > executable tests/runtime > contracts > Graphify/CodeGraph
> planning documents > historical evidence
```

Graphs are never runtime writers, product configuration writers, merge
authorities, or test-pass authorities. They cannot prove runtime behavior,
tenant isolation, browser behavior, CI enforcement, or post-merge closure by
themselves.

## Stable asset home

`SIMWAR_GRAPH_HOME` may point to any stable cache/data directory. When unset,
Windows uses `%LOCALAPPDATA%\\SimWar\\graph-companion`; other platforms use
`${XDG_DATA_HOME:-~/.local/share}/SimWar/graph-companion`. The repository key is
derived from the remote owner/name, never from a hard-coded user name.

```text
SIMWAR_GRAPH_HOME/
  qidianzhiku-SimWar/
    registry.json
    graphs/<short-source-sha>/
      source-manifest.json
      graphify/graph.json
      graphify/refresh-receipt.json
    current/
    logs/
```

Graph directories are append-only. Registry history entries are append-only;
the current pointer may be refreshed without deleting prior source records.
Large graph/index files are external and must not be committed to Git. The registry stores the source SHA, tree SHA,
manifest digests, logical graph/index digests, counts, pending changes, scope,
health, limits, and validity for architecture analysis, test impact, and
planning.

## Freshness states

| State                     | Meaning                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `CURRENT_EXACT_SHA`       | Graph source SHA and current SHA match and the source manifest is valid.                                           |
| `CURRENT_CODE_EQUIVALENT` | SHAs differ, but the delta is docs/excluded-only and source-code manifest digests match. Both SHAs remain visible. |
| `STALE_PRODUCT_DELTA`     | Product, runtime, contract, test, migration, workflow, package, or plugin code changed. Refresh is required.       |
| `STALE_REBUILD_REQUIRED`  | The graph is unbound or incremental safety cannot be proven.                                                       |
| `DEGRADED_CODEGRAPH`      | Graphify is usable but CodeGraph is missing/unhealthy; Graphify adjacency fallback is required.                    |
| `DEGRADED_GRAPHIFY`       | CodeGraph is present but Graphify health cannot be proven.                                                         |
| `GRAPH_NOT_FOUND`         | No trusted source-bound graph exists.                                                                              |
| `BLOCKED_GRAPH_TOOLING`   | Current source or both graph/fallback paths cannot be established.                                                 |

`CURRENT_CODE_EQUIVALENT` is never presented as an exact current-master graph.
`STALE_*` states block a GRAPH_MANDATORY planning gate until refresh completes.

## CLI modes and continuous triggers

```powershell
npm run graph:companion -- --mode entry
npm run graph:companion -- --mode refresh
npm run graph:companion -- --mode impact --base <sha> --target <sha>
npm run graph:companion -- --mode plan
npm run graph:companion -- --mode postmerge
```

`entry` performs freshness, refresh-if-needed, architecture delta, Test
Impact, risk, planning reality, and planning gate. `refresh` updates
Graphify/CodeGraph and the registry. `impact` compares a validated base/head
pair. `plan` consumes the current registry without re-indexing or mutating the
registry. `postmerge` refuses a dirty or attached checkout and runs the same
self-refresh sequence against a fresh detached merge clone.

The three triggers are Macro Mission Entry, product/runtime/contract
post-merge, and Macro Planning. There is no resident server. Each trigger is
self-healing by re-running the entry gate.

## Graphify and CodeGraph adapters

Graphify is invoked code-only and without clustering when a rebuild is needed.
The generated graph is copied to the source-SHA directory; existing historical
directories are never overwritten; a corrupt or incomplete same-SHA artifact
is repaired into a distinct manifest-suffixed directory. CodeGraph is initialized in a new worktree
or synchronized in an existing one. Its status output is normalized into a
logical digest; an active SQLite/WAL file is never hashed as a stable database
digest. If CodeGraph cannot run, the receipt explicitly records
`DEGRADED_CODEGRAPH` and the companion traverses Graphify adjacency only.

The fallback is deliberately bounded: direct and reverse adjacency, one-hop
and two-hop traversal, impacted files, and impacted tests. CodeGraph v1.2
`affectedTests` output is parsed with an explicit depth-two request. It is not a
new graph database or a CodeGraph replacement. Planning becomes
`PLAN_ALLOWED_WITH_LIMITS`, never an unqualified `PLAN_ALLOWED`.

## Architecture delta and Test Impact

Each run emits `architecture-delta.json` with file/node/edge changes, route,
contract, writer, repository, authority, teacher/student/admin, scenario,
ParameterSet, plugin, Truth/Settlement/Replay, tenant, fan-in/fan-out, and
unmapped-file fields.

`GraphDrivenTestImpactV1` traverses at most depth two. Recommendations include
test file/command, T0–T4 tier, reason, impacted node, dependency path,
confidence, mandatory/recommended, depth, and graph source. Mandatory safety
floors are retained for Truth, Settlement, Replay, Tenant, RBAC,
ScenarioPackage, ParameterSet, Plugin, and security projection paths. Missing
edges expand the floor; they never suppress tests.

T0 static checks cover diff integrity, hidden Unicode, and formatting. T1 is
direct unit coverage, T2 contract/boundary coverage, T3 runtime integration,
and T4 browser/full-suite coverage for high fan-out, authority, shared
contract, runtime-provider, Truth/Settlement, decision/round/canonical truth,
or broad frontend changes. Student/teacher/admin changes receive explicit
build and browser floors.

## Planning reality and gate

Planning reality reads the current source SHA, Graph Registry,
`docs/planning/current-cycle.yaml`,
`docs/planning/l1-plus-portfolio-register.yaml`, recent commit classifications,
and known limits. A planning document bound to an older SHA is reported as
`PLANNING_REALITY_DRIFT`; missing required planning inputs produce
`BLOCKED_CURRENT_REALITY`. The companion does not create a governance PR to
silently reconcile either condition.

The gate states are:

- `PLAN_ALLOWED`: exact/equivalent graph, complete deltas/impact/risk, current
  planning reality, and healthy tooling.
- `PLAN_ALLOWED_WITH_LIMITS`: degraded CodeGraph/Graphify, equivalent SHA, P1
  risk review, or explicit planning drift with limits listed.
- `BLOCKED_STALE_GRAPH`, `BLOCKED_GRAPH_TOOLING`,
  `BLOCKED_CURRENT_REALITY`, `BLOCKED_HIGH_RISK_DELTA`, or
  `BLOCKED_UNMAPPED_PRODUCT_DELTA` when required evidence is missing.

`PRODUCT_VALUE_DRIFT` is a non-blocking signal (`ON_TRACK`,
`WARNING_GENERIC_INFRASTRUCTURE_DRIFT`, or `UNKNOWN`) based on simple recent
commit classification and the stated product goal.

## External receipts

Runs write small receipts under `<evidence-root>/graph-companion/`:

`graph-state.json`, `tool-health.json`, `source-manifest.json`,
`freshness.json`, `refresh-receipt.json`, `architecture-delta.json`,
`test-impact.json`, `risk-delta.json`, `planning-reality.json`,
`planning-gate.json`, and `summary.md`.

Every JSON receipt carries `schema_version`; every run records
`automatic_next_start: false`. The external evidence root is the authoritative
run receipt; no graph binary, SQLite database, or receipt-of-receipt artifact is
committed.

## Known limits

- Graphify parser coverage and inferred edges are not complete runtime proof.
- Graphify and CodeGraph CLI/MCP capabilities vary by environment.
- CodeGraph logical digest is derived from normalized status text only; the
  active SQLite/WAL database file is never read or hashed. Status, source SHA,
  pending changes, and scope remain recorded.
- GitHub Actions feasibility is recorded as `LOCAL_ORCHESTRATION_ONLY`; no
  workflow is claimed or required by this V1.
- Graph Companion does not prove runtime behavior, Human Validation, PostgreSQL
  activation, RLS, PITR, Production, or a durable transaction boundary.
- `automatic_next_start` remains false; the only follow-up recommendation is a
  separate current-reality/product-roadmap rebase decision.
