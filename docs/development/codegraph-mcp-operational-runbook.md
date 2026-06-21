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
