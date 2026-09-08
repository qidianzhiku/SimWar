# CodeGraph MCP Operational Runbook

## 1. Purpose

CodeGraph MCP is a call graph review and impact analysis tool for SimWar. Its
main value is finding active paths, callers, callees, and blast radius before
high-risk changes touch persistence, settlement, Replay, API boundaries, role
access, tenant isolation, or other core flows.

It is not a hard blocker for every small PR. Documentation-only work, PR
operation checks, tiny formatting fixes, and local runbook updates should not
spend more time on MCP installation than on the SimWar task itself.

## 2. Current status

CodeGraph CLI and CodeGraph MCP have been used successfully across multiple
SimWar PRs. The current closeout smoke test also confirmed that the CLI and MCP
can query the SimWar index from a fresh worktree.

Each new worktree may need its own `.codegraph/` directory. Running
`codegraph init` initializes the index for that worktree; it is not a fresh MCP
installation. If the Codex App or MCP server is pointed at a different
worktree, CodeGraph may look unavailable even when the CLI and MCP are installed
and usable elsewhere.

Closeout smoke evidence from `D:\codex\SimWar-codegraph-mcp-closeout`:

- `codegraph status` initially reported the worktree was not initialized.
- `codegraph init` created the local index.
- `codegraph status` then reported an up-to-date index with 68 files, 942
  nodes, and 4,931 edges.
- MCP queries returned symbol, node, caller, and exploration results.

## 3. Setup / smoke test

Use these CLI commands inside the target worktree:

```powershell
codegraph status
codegraph init
codegraph sync
codegraph status
```

`codegraph init` is needed only when the worktree has no `.codegraph/` index.
`codegraph sync` is useful when the status indicates the index is stale.

Minimum MCP smoke queries:

- search `createP1Store`
- search `persistSnapshotAtomically`
- search `toRuntimeSnapshot`
- search `SettlementResult`
- search `Replay`
- callers `persistSnapshotAtomically`
- callers `toRuntimeSnapshot`
- explore `What are the highest-risk call graph areas in SimWar where CodeGraph MCP should remain mandatory?`

Representative successful closeout results:

- `createP1Store`, `persistSnapshotAtomically`, and `toRuntimeSnapshot` resolve
  to `services/api/src/store.ts`.
- `persistSnapshotAtomically` is called by `createP1Store`.
- `toRuntimeSnapshot` is called by `inspectPersistedSnapshotText` and
  `loadSnapshot`.
- `SettlementResult` spans shared contracts, simulation write helpers, and the
  Postgres adapter.
- `Replay` spans shared contracts, replay fixtures, and Postgres replay mapping
  code.
- The high-risk exploration identified the store, snapshot runtime conversion,
  repository ports, settlement write path, scoring, and shared contract models
  as areas where call graph review has real value.

## 4. Mandatory MCP tasks

Use CodeGraph MCP first for high-risk call graph review when a task modifies or
audits:

- persistence, store, or repository code;
- settlement;
- Replay;
- Postgres adapter behavior;
- API boundary behavior;
- permission, role access, or tenant isolation boundaries;
- cross-module refactors;
- core algorithms or call-chain behavior;
- security-sensitive flows;
- tenant isolation changes.

## 5. Optional MCP tasks

Do not block these small tasks only because CodeGraph MCP is unavailable:

- documentation-only PRs;
- PR description or merge checks;
- typo or formatting documentation changes;
- small test isolation changes;
- package script documentation;
- runbook updates;
- issue triage;
- local environment notes.

For these tasks, record the limitation and continue with source review, Git
diff, and the relevant lightweight validation.

## 6. Fallback rule

If CodeGraph MCP is unavailable:

- For high-risk production code tasks, stop or downgrade to an explicit
  source-level call graph review before deciding whether to continue.
- For small documentation-only, test-isolation-only, PR-only, or runbook-only
  tasks, record `CodeGraph unavailable` and continue with `rg`, source reading,
  Git diff, tests, and CI validation as appropriate.
- Do not fabricate MCP call results.
- Do not report MCP unavailability as a passing test.

## 7. Prompt policy

Future Codex prompts should use this rule:

```text
Use CodeGraph MCP for high-risk call graph review.
If CodeGraph MCP is unavailable and this is documentation-only, test-isolation-only, PR-only, or runbook-only work, do not block development. Record the limitation and continue with source review, git diff, and tests.
If the task modifies persistence, settlement, Replay, Postgres adapter, API boundary, permissions, tenant isolation, or core algorithms, CodeGraph MCP or an equivalent explicit source-level call graph review is required.
```

## 8. What MCP should not do

CodeGraph MCP does not replace source review. It does not replace tests, CI, PR
review, security review, or contract review. It is not the development goal for
every worktree.

Do not let repeated MCP setup troubleshooting slow down SimWar product and
platform work after the worktree-level status and fallback rule are understood.

## 9. Closeout conclusion

The CodeGraph MCP setup is considered operational enough for SimWar
development. Future work should focus on SimWar product and platform tasks, not
repeated MCP installation troubleshooting.

## 10. Exact-target admission (Graph Admission V1)

The Graph Companion now exposes a four-stage admission contract. A non-empty
query is never sufficient to call a snapshot current-target ready:

1. `BUILD_HEALTH` — the status command must exit successfully and produce
   valid structured metadata.
2. `SNAPSHOT_APPLICABILITY` — repository SHA, tree SHA, configuration digest,
   build identity, and `lastIndexed` must be present and match the requested
   target. A newer timestamp cannot substitute for identity.
3. `QUERY_USEFULNESS` — command success, relevance, and coverage completeness
   are tracked separately. `TRUNCATED`, `NO_RELEVANCE`, `COMMAND_FAILED`, and
   `NOT_RUN` are explicit outcomes.
4. `DECISION_ADMISSION` — only four passing stages yield
   `EXACT_TARGET_READY`. Invalid metadata, missing identity, historical SHA,
   or incomplete query coverage fail closed for that seam.

The pure contract is exported by `scripts/graph-companion.mjs` as
`evaluateGraphAdmission` and is covered by `KG-ADM-001` through `KG-ADM-005`
in `tests/unit/graph-companion.test.ts`. Consumers must preserve the returned
stage values in receipts rather than collapsing them into one boolean.

## 11. Artifact roots and writer evidence

Graph output and evidence must live outside the source worktree. Use
`assertArtifactRootSafety` before creating a directory; it rejects equal,
nested, case-insensitive, and physical symlink/junction paths. Failed checks
must happen before clone, extraction, or index creation.

Writer status is intentionally conservative:

- `NO_CONTENTION_OBSERVED` means only that no contention was observed;
- `LOCK_OWNERSHIP_PROVEN` requires build key, owner, process id, start time,
  and heartbeat evidence;
- `LOCK_OWNERSHIP_UNKNOWN` must not trigger lock deletion or process killing.

Use `classifyWriterEvidence` for the machine receipt and keep the owner
evidence alongside the build key. A successful CLI command does not prove
exclusive ownership.

## 12. MCP health is a ladder, not a configuration flag

Record `MCP_CONFIGURED`, `MCP_HANDSHAKE_OK`, `MCP_TOOL_LIST_OK`,
`MCP_TOOL_CALL_OK`, and `MCP_RESULT_USEFUL` independently. Configuration is
not a handshake, a handshake is not a callable tool, and a callable tool is
not useful evidence. `classifyMcpHealth` provides the small structured shape;
it does not install, upgrade, or silently change MCP configuration.

## 13. Evidence boundaries

Graphify and CodeGraph remain derived engineering evidence. They do not become
product truth, a formal writer, a global quality gate, a mission registry, or
an automatic successor trigger. When an admission stage is blocked, continue
legal low-risk source/documentation work with an explicit source-only receipt;
hold only the high-risk seam whose authority chain cannot be proven.

## 14. Query Contract V2

Decision-useful graph work starts from an exact question contract, not a broad
natural-language probe. Every contract binds `target_sha`, a canonical seam,
the decision before/after the query, exact path/symbol/route/schema seeds,
expected edge types, mandatory source readback, and mandatory tests. Query
ordering is exact path, exact symbol, exact route/schema/function, bounded
caller/callee, changed-file adjacency, then limited-depth expansion.

Each question has independent Graphify and CodeGraph receipts containing
`command_ok`, `relevance`, `coverage`, `truncated`, and `anchors`, plus source
readback `resolved`, `anchors`, and `unresolved`. A generic CodeGraph helper,
an empty result, or a truncated Graphify expansion is not confirmatory. The
question admission can be `READY`, `SOURCE_FALLBACK`, or `HOLD_THIS_SEAM`; the
last state is mandatory when high-risk source readback is unresolved. See
`docs/development/graph-query-contract-v2.json` and the exported
`normalizeQuestionContract`, `buildQuestionReceipt`, and
`admitQuestionReceipt` helpers.

## 15. Canonical final MCP receipt

After all direct MCP activity, recompute one final receipt with
`normalizeMcpObservationSet`. The five checks are
`MCP_CONFIGURED`, `MCP_HANDSHAKE`, `MCP_TOOL_LIST`, `MCP_TOOL_CALL`, and
`MCP_RESULT_USEFUL`; each is one of `PASS`, `FAIL`, `NOT_OBSERVED`, or
`NOT_APPLICABLE`. `NOT_OBSERVED` is not a failure. Configuration-only local
evidence therefore remains `PASS_WITH_LIMITS` and cannot be upgraded to an
operational tool-call claim. The machine output is `mcp-final-receipt.json`
under the external evidence root; no receipt is committed into the repository.
