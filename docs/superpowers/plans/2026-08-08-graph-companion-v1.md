# Graph Companion V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a thin, CLI-first Graph Companion that keeps Graphify/CodeGraph evidence bound to current source SHA, produces deterministic architecture/test-impact/risk/planning receipts, and self-refreshes after its own merge without becoming a runtime authority.

**Architecture:** `scripts/graph-companion.mjs` is a dependency-free adapter/orchestrator. It resolves a source SHA, builds a stable source manifest, reads/writes an append-only registry under `SIMWAR_GRAPH_HOME`, invokes Graphify code-only extraction and CodeGraph indexing when available, and emits small JSON/Markdown receipts under an external evidence root. Pure classifiers and impact/planning functions are exported for Vitest unit tests; the CLI never writes product/runtime state.

**Tech Stack:** Node.js ESM built-ins (`fs`, `path`, `crypto`, `child_process`, `os`), Graphify CLI 0.9.x, CodeGraph CLI 1.2.x, Vitest, existing npm scripts, YAML readback by conservative scalar extraction (no new dependency).

## Global Constraints

- Use the dynamically fetched `origin/master` as the start base; do not hard-code a personal path or username.
- Keep Graphify/CodeGraph outside Git as large assets; commit only automation, tests, docs, and package script wiring.
- Graph is evidence only: never write Truth, Settlement, Replay, runtime, product configuration, or merge state.
- Support `SIMWAR_GRAPH_HOME`; default to `%LOCALAPPDATA%\\SimWar\\graph-companion` on Windows and `${XDG_DATA_HOME:-~/.local/share}/SimWar/graph-companion` elsewhere.
- Preserve historical graph directories; never overwrite a prior source-SHA directory.
- Expose `npm run graph:companion -- --mode entry|refresh|impact|plan|postmerge` and keep `automatic_next_start: false` in receipts.
- If CodeGraph is unavailable, emit `DEGRADED_CODEGRAPH`, use Graphify adjacency fallback, and downgrade Planning Gate to `PLAN_ALLOWED_WITH_LIMITS`.
- Do not add a GitHub workflow unless both CLIs prove deterministic, non-interactive, secret-free runner execution; record `LOCAL_CODEX_ORCHESTRATION_ONLY_V1` otherwise.

---

### Task 1: Freeze current-reality and capability evidence

**Files:**

- Create: `docs/architecture/simwar-graph-companion-v1.md`
- Test: `tests/unit/graph-companion.test.ts`

**Interfaces:**

- The test file imports pure functions that will be exported from `scripts/graph-companion.mjs`: `classifyFreshness`, `buildSourceManifest`, `buildArchitectureDelta`, `buildTestImpact`, and `evaluatePlanningGate`.
- The architecture document records the truth order, stable graph-home layout, state machine, fallback semantics, and known limits without claiming Graph equals runtime truth.

- [ ] **Step 1: Write failing classifier tests**

  Add Vitest cases for exact SHA, docs-only code-equivalent, product delta, unbound graph, missing graph, stale graph planning block, current graph planning pass, CodeGraph degraded fallback, direct/transitive impact, missing-edge conservative expansion, tenant/Truth safety floors, planning SHA drift, and path independence. Each case asserts an explicit state string and no `automatic_next_start` drift.

- [ ] **Step 2: Run the focused test and verify the expected missing-export failure**

  Run `npx vitest run tests/unit/graph-companion.test.ts`. It must fail because `scripts/graph-companion.mjs` does not yet export the functions.

- [ ] **Step 3: Write the architecture contract**

  Document the registry fields, source manifest classifications, CLI modes, refresh policy, test tiers T0–T4, mandatory safety floors, planning gate statuses, continuous triggers, GitHub feasibility outcome, and known limits. Include the future Macro Mission command `npm run graph:companion -- --mode entry`.

- [ ] **Step 4: Commit the red tests and contract**

  Run `git add tests/unit/graph-companion.test.ts docs/architecture/simwar-graph-companion-v1.md` then `git commit -m "test: define graph companion freshness and planning gates"`.

### Task 2: Implement stable manifests, registry, and freshness

**Files:**

- Create: `scripts/graph-companion.mjs`
- Modify: `package.json`

**Interfaces:**

- `resolveGraphHome(env, platform, homeDir) -> string`.
- `buildSourceManifest(repoRoot, gitFiles) -> {schema_version, entries, code_digest, planning_files}`.
- `classifyFreshness({currentRepoSha, graphSourceSha, currentCodeDigest, graphCodeDigest, changedFiles, registryPresent, sourceAvailable}) -> {state, reason, limits}`.
- `loadRegistry(graphHome, repoKey)`, `writeRegistry(...)`, `canonicalJson(value)`, and `sha256(value)` are deterministic and append-only.

- [ ] **Step 1: Implement only the pure helpers needed by the failing tests**

  Use `git ls-files -z` and `crypto.createHash('sha256')` for content digests. Classify `apps`, `services`, `packages`, `plugins`, `contracts`, `db`, `tests`, `scripts`, `package.json`, workspace/runtime config, and workflow files; exclude ordinary docs from the code digest and track planning docs separately.

- [ ] **Step 2: Run the focused tests and make the freshness cases green**

  Run `npx vitest run tests/unit/graph-companion.test.ts -t "freshness|graph home|manifest"`. Confirm all freshness states and stable path assertions pass.

- [ ] **Step 3: Add CLI argument parsing and package wiring**

  Add `"graph:companion": "node scripts/graph-companion.mjs"` to `package.json`. Parse `--mode`, `--repo`, `--base`, `--target`, `--evidence-root`, `--current-sha`, `--graph-home`, and `--json`. Do not execute CLI work on module import.

- [ ] **Step 4: Commit the registry/freshness slice**

  Run `git add scripts/graph-companion.mjs package.json` then `git commit -m "feat: add graph companion registry and freshness gate"`.

### Task 3: Add Graphify/CodeGraph adapters and refresh receipts

**Files:**

- Modify: `scripts/graph-companion.mjs`
- Modify: `docs/architecture/simwar-graph-companion-v1.md`

**Interfaces:**

- `discoverTools() -> tool-health.json` records version/help/capabilities/result/limitation for Graphify and CodeGraph.
- `runGraphifyRefresh(repoRoot, graphDir) -> {status, version, path, logical_digest, node_count, edge_count, warnings}`.
- `runCodeGraphIndex(repoRoot) -> {status, version, path, logical_digest, indexed_files, node_count, edge_count, pending_changes, warnings}`.
- `refreshGraph({repoRoot, registry, currentSha, graphHome, tools}) -> {registry, freshness, refreshReceipt}`.

- [ ] **Step 1: Extend tests with fake-tool adapter cases**

  Use injected runners (not mocks of the production result) to prove a Graphify code-only extraction creates a source-SHA directory, a CodeGraph-unavailable run produces `DEGRADED_CODEGRAPH`, the SQLite/WAL database file is never hashed (only normalized status text may receive a logical digest), and old temp paths do not block a rebuild.

- [ ] **Step 2: Run the adapter tests red**

  Run `npx vitest run tests/unit/graph-companion.test.ts -t "adapter|refresh|degraded"` and verify the new exports/behavior fail before implementation.

- [ ] **Step 3: Implement CLI adapters**

  Invoke `graphify extract <repo> --code-only --no-cluster --out <staging>` only when refresh is needed; copy small metadata/receipts into `graphs/<short-sha>/graphify/` and keep the large graph outside Git. Run `codegraph init` for a missing index or `codegraph sync` for an existing one; parse `codegraph status` text and hash normalized status as a logical digest. Never hash a live SQLite/WAL file as a stable digest.

- [ ] **Step 4: Run adapter tests green and record real CLI capability results**

  Run the focused adapter tests and then `npm run graph:companion -- --mode refresh --repo <repo> --evidence-root <root>`. Store `tool-health.json` and `refresh-receipt.json` externally.

- [ ] **Step 5: Commit the refresh slice**

  Run `git add scripts/graph-companion.mjs docs/architecture/simwar-graph-companion-v1.md` then `git commit -m "feat: refresh Graphify and CodeGraph with source-bound receipts"`.

### Task 4: Add architecture delta, Test Impact, risk, and Planning Gate

**Files:**

- Modify: `scripts/graph-companion.mjs`
- Modify: `tests/unit/graph-companion.test.ts`
- Modify: `docs/architecture/simwar-graph-companion-v1.md`

**Interfaces:**

- `buildArchitectureDelta({repoRoot, baseSha, targetSha, graph}) -> architecture-delta.json`.
- `buildTestImpact({repoRoot, baseSha, targetSha, changedFiles, graph, codeGraph}) -> test-impact.json`.
- `buildRiskDelta({changedFiles, graph, testImpact}) -> risk-delta.json`.
- `readPlanningReality({repoRoot, currentSha}) -> planning-reality.json`.
- `evaluatePlanningGate({freshness, architectureDelta, testImpact, riskDelta, planningReality, codeGraphStatus}) -> planning-gate.json`.

- [ ] **Step 1: Add red tests for direct/transitive impact and gate floors**

  Assert changed authority files map to tenant/ParameterSet/ScenarioPackage tests, max traversal depth is two, missing graph edges expand rather than reduce tests, Truth/Settlement/Replay/Tenant/RBAC changes retain mandatory safety floors, docs-only changes select T0 only, shared-contract changes escalate to T2/T4, and planning SHA drift yields `PLAN_ALLOWED_WITH_LIMITS` with `PLANNING_REALITY_DRIFT`.

- [ ] **Step 2: Implement file-level graph traversal and safety floors**

  Read Graphify nodes/edges when available; supplement with deterministic import edges from source files. Record depth, reason, confidence, mandatory/recommended, and graph source for each test recommendation. Use CodeGraph `affected --json` when healthy, but merge it with conservative floor tests rather than replacing them.

- [ ] **Step 3: Implement architecture/risk/planning receipts**

  Generate every required field from sections 16–20 and 23 of the mission, including changed writers/authority boundaries, truth/settlement/replay touchpoints, unmapped files, risk levels, planning drift, product-value drift, and explicit limits.

- [ ] **Step 4: Run the full focused Graph Companion test file green**

  Run `npx vitest run tests/unit/graph-companion.test.ts` and inspect the JSON output fields, not just the exit code.

- [ ] **Step 5: Commit the impact/planning slice**

  Run `git add scripts/graph-companion.mjs tests/unit/graph-companion.test.ts docs/architecture/simwar-graph-companion-v1.md` then `git commit -m "feat: add graph-driven impact and planning gates"`.

### Task 5: Execute real current-master run and external evidence

**Files:**

- Create externally: `C:\Users\Marshall\AppData\Local\Temp\E-SIMWAR-GRAPH-COMPANION-V1-<UTC_TIMESTAMP>/*`
- Modify: `scripts/graph-companion.mjs` only if a real-run defect is found.

**Interfaces:**

- `entry` runs freshness → refresh → delta → impact → risk → planning gate.
- `postmerge` runs the same sequence against the exact detached merge SHA.
- All required output names exist under `<evidence-root>/graph-companion/`; `99-digests.sha256` covers the evidence pack.

- [ ] **Step 1: Record current reality and historical characterization SHAs**

  Select three real changes from `git log`: a docs-only governance commit, the PR #358 tenant-baseline repair range, and a teacher unified-journey commit. Record dynamic SHAs and expected impact tiers; do not use the prompt examples blindly.

- [ ] **Step 2: Run `entry` on current master**

  Execute `npm run graph:companion -- --mode entry --repo <worktree> --evidence-root <root>` and verify current SHA, registry, freshness, Graphify, CodeGraph/fallback, architecture delta, test impact, risk delta, planning reality, planning gate, and summary all exist.

- [ ] **Step 3: Run `plan` and `impact` independently**

  Re-run the two modes against the same source and one historical base/head pair; verify outputs are deterministic and no large graph/index is staged.

- [ ] **Step 4: Run required local quality gates**

  Run `npx vitest run tests/unit/graph-companion.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:hidden-unicode`, `npm run format:check -- scripts/graph-companion.mjs tests/unit/graph-companion.test.ts docs/architecture/simwar-graph-companion-v1.md`, and `git diff --check`. Run the existing root suite once if shared script wiring affects it.

- [ ] **Step 5: Commit the final implementation and evidence-independent docs**

  Confirm `git status`, `git diff --stat`, and the exact changed-file list; commit only source/test/docs/package wiring. Evidence remains external.

### Task 6: Review, PR, merge, postmerge self-refresh, adoption

**Files:**

- External evidence only: `E-SIMWAR-GRAPH-COMPANION-V1-<UTC_TIMESTAMP>`.

**Interfaces:**

- One PR titled `feat: add SimWar Graph Companion freshness and planning gates`.
- PR body includes Summary, Validation, Scope Notes, Graph Companion V1 states/modes, no product/truth changes, no graph binaries, known limits, final head, and `automatic_next_start: false`.

- [ ] **Step 1: Request three independent read-only reviews**

  Review graph authority/freshness, Test Impact false-negative controls/safety floors, and Planning/DevEx gate usability. Require `BLOCKING=0` and `MUST_FIX=0`; repair within the same PR if needed.

- [ ] **Step 2: Re-read PR head and required checks**

  If master moves, use at most three ordinary protected-master sync merges, never rebase/squash/force-push. Re-run all final gates for every derived head.

- [ ] **Step 3: Perform one ordinary merge**

  Bind the merge to the final verified PR head, record two parents and merge SHA, and do not merge any other PR.

- [ ] **Step 4: Fresh detached postmerge run**

  Clone/check out the actual merge SHA detached, run `graph:companion --mode postmerge` and `--mode plan`, verify `CURRENT_EXACT_SHA` (or explicit docs-only `CURRENT_CODE_EQUIVALENT`), new registry, and planning gate.

- [ ] **Step 5: Write external adoption and final report, then stop**

  Record `OWNER_ADOPTS_SIMWAR_GRAPH_COMPANION_V1`, all known limits, final master/graph SHAs, PR/merge SHA, checks, postmerge self-refresh, and `automatic_next_start: false`. Do not start W020, Eldercare, Human Validation, PostgreSQL, or another mission.
