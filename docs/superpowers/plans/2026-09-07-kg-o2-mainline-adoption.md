# SimWar KG-O2 Mainline Adoption Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the recovered Graph Companion P0 admission behavior onto the current protected master, add decision-specific Query Contract V2 and canonical MCP evidence normalization, and deliver one exact-head, evidence-bound PR without changing product truth.

**Architecture:** The existing `scripts/graph-companion.mjs` remains the sole read-only engineering companion. P0 admission stays fail-closed and exact-target-bound; Query Contract V2 is represented as structured contracts and per-question receipts that drive source fallback rather than weakening admission. MCP observations are normalized only after the final activity set and remain separate from product/runtime authorities.

**Tech Stack:** Node.js ESM, Vitest, existing Graphify/CodeGraph CLIs, JSON/Markdown evidence, Git worktree, GitHub CLI.

**Spec:** User-provided `SIMWAR KG-O2 MAINLINE ADOPTION + DECISION-USEFUL QUERY PRECISION + EVIDENCE NORMALIZATION + CONTROLLED VALUE VALIDATION` contract in the current task.

## Global Constraints

- Use fresh `origin/master` and never mutate the dirty primary worktree.
- Replay only the recovered previous P0 patch; do not recreate it from prose.
- Keep Graphify/CodeGraph derived engineering evidence only; never make them Product Truth, Writer, Settlement, Score, Rank, Registry, or a second mission memory.
- Preserve fail-closed admission: `UNKNOWN`, `MISSING`, `TRUNCATED`, and generic non-relevant output never become exact-target readiness.
- Modify only the existing Graph Companion plus direct tests/docs/contracts and this plan; no product runtime, database, settlement, replay, package, workflow, migration, or frontend changes.
- Run focused RED/GREEN tests before affected/full validation and preserve any repository baseline failures.
- Create at most one branch and one PR; do not merge or auto-start a successor.

---

### Task 1: Recover and replay the previous P0 implementation

**Files:**
- Inspect only: `scripts/graph-companion.mjs`, `tests/unit/graph-companion.test.ts`, `docs/development/codegraph-mcp-operational-runbook.md`
- Create evidence outside the repository: `RECOVERED_PATCH_MANIFEST.json`

**Interfaces:**
- Consumes: previous base `ebeaba7d797d11b1a04b4fd63861056f610dbea0`, previous implementation head `6c395139b33e5cce1bc0b60be521f2fc18fb710a`, current `origin/master`.
- Produces: fresh branch containing the exact recovered commits or an explicit conflict/blocked result; no guessed implementation.

- [ ] **Step 1: Verify object and exact patch identity**

Run:

```powershell
git cat-file -e '6c395139b33e5cce1bc0b60be521f2fc18fb710a^{commit}'
git diff --name-status ebeaba7d797d11b1a04b4fd63861056f610dbea0 6c395139b33e5cce1bc0b60be521f2fc18fb710a
git show --format=fuller --stat 6c395139b33e5cce1bc0b60be521f2fc18fb710a
```

- [ ] **Step 2: Replay only the three recovered commits**

```powershell
git cherry-pick 5dc0559480272a1affb6383e5b1765f595472f0a 00b44db155b99ae5386af4941254efbee973ec10 6c395139b33e5cce1bc0b60be521f2fc18fb710a
```

If a conflict occurs, stop and record `BLOCKED` rather than resolving by broad rewrite.

- [ ] **Step 3: Run the recovered focused tests**

```powershell
npx vitest run tests/unit/graph-companion.test.ts
```

- [ ] **Step 4: Record a manifest with base/head, commit list, file list, patch digest, and replay disposition**

### Task 2: Add Query Contract V2 and per-question admission receipts (TDD)

**Files:**
- Modify: `scripts/graph-companion.mjs`
- Modify: `tests/unit/graph-companion.test.ts`
- Create: `docs/development/graph-query-contract-v2.json`
- Modify: `docs/development/codegraph-mcp-operational-runbook.md`

**Interfaces:**
- Produces `normalizeQuestionContract(contract)` validating `question_id`, `risk_class`, `target_sha`, `canonical_seam`, `decision_before`, `decision_needed`, seeds, expected edge types, source readback, and mandatory tests.
- Produces `buildQuestionReceipt({ contract, graphify, codegraph, sourceReadback })` with separate Graphify/CodeGraph command, relevance, coverage, truncation, anchors and source resolution fields.
- Produces `admitQuestionReceipt(receipt)` returning `READY`, `SOURCE_FALLBACK`, or `HOLD_THIS_SEAM`; generic/no-relevance/truncated graph output cannot be confirmatory.

- [ ] **Step 1: Write failing tests**

Add tests for exact-symbol/path contract acceptance, missing-field rejection, Graphify truncation -> `SOURCE_FALLBACK`, CodeGraph generic result -> `NO_RELEVANCE`, and unresolved high-risk source readback -> `HOLD_THIS_SEAM`.

- [ ] **Step 2: Run the focused tests and verify RED**

```powershell
npx vitest run tests/unit/graph-companion.test.ts
```

Expected: the new contract/receipt tests fail because the functions are not yet present.

- [ ] **Step 3: Implement the minimal pure helpers and JSON contract fixture**

Keep aggregate admission conservative and preserve existing `EXACT_TARGET_READY` requirements. Do not treat non-empty output as relevance or truncated output as complete coverage.

- [ ] **Step 4: Run focused tests and verify GREEN**

```powershell
npx vitest run tests/unit/graph-companion.test.ts
```

- [ ] **Step 5: Document exact query ordering and source fallback**

Document exact path -> symbol -> route/schema/function -> bounded caller/callee -> changed-file adjacency -> limited depth expansion, including seed/depth/edge/frontier/truncated receipt fields.

### Task 3: Normalize the final MCP receipt (TDD)

**Files:**
- Modify: `scripts/graph-companion.mjs`
- Modify: `tests/unit/graph-companion.test.ts`
- Create: `docs/development/mcp-final-receipt-v2.json`
- Modify: `docs/development/codegraph-mcp-operational-runbook.md`

**Interfaces:**
- Produces `normalizeMcpObservationSet(observations)` with statuses `PASS`, `FAIL`, `NOT_OBSERVED`, `NOT_APPLICABLE` for `MCP_CONFIGURED`, `MCP_HANDSHAKE`, `MCP_TOOL_LIST`, `MCP_TOOL_CALL`, and `MCP_RESULT_USEFUL`.
- Produces one final receipt from the final observation set; `NOT_OBSERVED` is never converted to `FAIL`.

- [ ] **Step 1: Write failing status-normalization tests**

Cover configured-only, successful direct tool call, observed failure, and not-applicable cases; assert no boolean-only receipt is emitted.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run tests/unit/graph-companion.test.ts
```

- [ ] **Step 3: Implement normalization and final-receipt wiring**

Use the final invocation observations only. Keep writer evidence and MCP evidence separate; do not create another controller.

- [ ] **Step 4: Run tests and verify GREEN**

```powershell
npx vitest run tests/unit/graph-companion.test.ts
```

### Task 4: Generate current-first continuity and query evidence

**Files:**
- Create external evidence only: `PREVIOUS_RUN_AUDIT.json`, `FRESH_CURRENT_REALITY.json`, `QUERY_CONTRACTS/`, `QUERY_RECEIPTS/`, `SOURCE_READBACK/`, `FINAL_MCP_RECEIPT.json`, `CONTINUITY_RECONCILIATION_V2.json`

**Interfaces:**
- Consumes current GitHub/Git/worktree reads and exact final branch head.
- Produces explicit `CURRENT_GITHUB`, `LATEST_IMPORTED`, `LATEST_CONSUMED`, `LATEST_VERIFIED`, and `HISTORICAL_ONLY` fields without rewriting old evidence.

- [ ] **Step 1: Re-run KG-ADM-001..005 against the fresh branch target**
- [ ] **Step 2: Execute narrow exact path/symbol Graphify and CodeGraph queries where tooling is available**
- [ ] **Step 3: Record each question/tool receipt and source readback anchors**
- [ ] **Step 4: Compute one canonical final MCP receipt after all activity**
- [ ] **Step 5: Record current GitHub PR/branch/check state and continuity dispositions**

### Task 5: Controlled source-only vs graph-plus-source value calibration

**Files:**
- Create external evidence only: `VALUE_CONTROL_SOURCE_ONLY.json`, `VALUE_TREATMENT_GRAPH_PLUS_SOURCE.json`, `VALUE_COMPARISON.json`

**Interfaces:**
- Uses one real historical finding snapshot (prefer PR #501/#503 pre-fix head), identical problem description and time budget, isolated read-only contexts.
- Produces raw time/navigation/source-readback metrics, correctness, scope/test/authority/material deltas, and honest `MATERIAL`, `CONFIRMATORY`, `NO_MATERIAL`, `FP`, or `FN` contribution labels.

- [ ] **Step 1: Freeze an exact historical snapshot and finding without exposing the final patch to either evaluator**
- [ ] **Step 2: Run source-only control in an isolated detached directory**
- [ ] **Step 3: Run exact graph-plus-source treatment in a separate isolated detached directory**
- [ ] **Step 4: Compare raw values using median/range only when sample count is small; do not invent p95 or statistical significance**

### Task 6: Final validation, independent review, commit, PR, and result ZIP

**Files:**
- Create external evidence only: `14_TEST_EVIDENCE/`, `15_H2_REVIEW.md`, `16_H3_REVIEW.md`, `17_LIMITATIONS.md`, `18_FINAL_RESULT.json`, `SHA256SUMS.txt`
- Create one ZIP under `D:/codex/artifacts/`

**Interfaces:**
- Final exact head is the sole evidence identity. Merge is forbidden; `MERGE_PERFORMED=false`.

- [ ] **Step 1: Run focused, affected, and available repository validation**

Run `npm run lint`, `npm run typecheck`, `npm run check:hidden-unicode`, `git diff --check`, affected contract tests, and `npm test`; preserve full-suite baseline fingerprints and environment blocks.

- [ ] **Step 2: Obtain independent H2 and H3 exact-head reviews**

If H3 tooling is unavailable, record `NOT_AVAILABLE`, never a fabricated pass.

- [ ] **Step 3: Commit only allowed implementation/tests/docs**

```powershell
git status --short
git diff --check
git add scripts/graph-companion.mjs tests/unit/graph-companion.test.ts docs/development/graph-query-contract-v2.json docs/development/mcp-final-receipt-v2.json docs/development/codegraph-mcp-operational-runbook.md docs/superpowers/plans/2026-09-07-kg-o2-mainline-adoption.md
git commit -m "feat: adopt decision-useful graph evidence"
```

- [ ] **Step 4: Push one branch and create one PR if GitHub auth works**

Include recovery, fresh base, Query Contract V2, MCP normalization, continuity limits, value calibration, pilot status, H2/H3, and baseline fingerprints. Do not enable auto-merge.

- [ ] **Step 5: Build and verify the atomic result ZIP**

Include all required paths from the mission contract; verify ZIP integrity, CRC, duplicate paths, and `SHA256SUMS.txt` before reporting.
