# MOD-05 Parallelism and Join Charter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the V1.0 MOD-05 five-line parallelism requirement into a current-source, machine-readable lock manifest and a human-readable Join Charter without creating a second runtime writer or activating any provider.

**Architecture:** The deliverable is governance-only. A JSON manifest records the current baseline, five-line dependency graph, unique owners, read/write modes, locks, merge barrier, join order, rollback, expiry, and parallelism ledger. A Markdown charter explains the same controls, their source evidence, and the stop conditions. Runtime, settlement, replay truth, database, provider, and frontend behavior remain unchanged.

**Tech Stack:** Markdown, JSON, Git worktrees, PowerShell, Node.js JSON parsing, existing SimWar governance documents.

**Spec:** `D:/DcodexSimWar-reference/SimWar-ReferenceVault/80-Machine-Mirrors/Markdown/SIMWAR-MOD-AGT-DUAL-TRACK-PLAN-V1.0-20260820__ef2104e90c04.md`, sections MOD-02–MOD-05; V1.0 plan SHA-256 `EF2104E90C04A811697749388999E31AE27BCFC457D7804FB765A10C68120260`.

## Global Constraints

- Current-source baseline is `origin/master@5ebf3a4b0ca4166659b8017f8a03e377f5a3e360`; historical plan snapshots and V9 documents are not current implementation evidence.
- `automatic_next_start=false`; the charter cannot authorize later mutation tasks, provider activation, Pilot, Production, or Human Validation.
- Every shared resource has one writer owner; all other lanes are read-only or reserved.
- No lane may modify settlement logic, `SettlementResult`, canonical Decision, `state_true`, score/rank, replay truth/hash inputs, or the official Simulation Core writer.
- Every mission must declare an isolated worktree, exact file allowlist, tests, evidence root, lock IDs, and expiry before mutation.
- Shared runtime stores, ports, provider selectors, databases, and lockfiles are not shared between parallel lanes.
- `CodeGraph unavailable` must be recorded when `.codegraph/` is absent; no graph result may be fabricated.

### Task 1: Write the MOD-05 machine manifest

**Files:**
- Create: `docs/evidence/mod-05-parallelism-20260822/parallelism-join-manifest.json`
- Read: `docs/planning/L1_MAINLINE_BOUNDED_PARALLEL_EXECUTION_PLAN.md`
- Read: `docs/governance/mod-agt-document-authority-supersession-register-20260821.md`
- Read: `docs/evidence/mod-04-research-refresh-20260821/benchmark-manifest.json`

**Interfaces:**
- Consumes: exact V1.0 plan identity, current master SHA, MOD-03 authority baseline, MOD-04 research baseline, and current repository path inventory.
- Produces: a JSON object with `baseline`, `dependency_graph`, `resource_owners`, `mission_start_contract`, `lock_matrix`, `merge_barrier`, `join_order`, `rollback_policy`, `expiry_policy`, `parallelism_ledger`, and `non_proof` fields.

- [ ] **Step 1: Capture current baseline and evidence paths**

  Record the exact current master SHA, V1.0 plan ID/SHA, MOD-03 merged evidence, MOD-04 merged evidence, and the fact that `.codegraph/` is absent.

- [ ] **Step 2: Encode five lanes and graph edges**

  Use the lane IDs `MAIN`, `SH`, `MOD`, `AGT`, and `FE`. Make authority/data-flow edges explicit and label each edge as `read_contract`, `candidate_input`, `advisory_output`, `explanation_projection`, or `merge_control`; do not imply that any edge writes formal truth.

- [ ] **Step 3: Encode unique owners and lock modes**

  Cover shared contracts, API/server, simulation-core truth, scenario/plugin assets, model research/registry, agent-gateway/advisory, teacher/student UI, tests/CI, database/migrations, provider/ports, evidence roots, and GitHub merge control. Use `WRITE_EXCLUSIVE`, `READ_ONLY`, `RESERVED`, or `SCHEDULED_EXCLUSIVE` modes and include an owner, allowed paths, forbidden paths, release condition, and expiry for each lock.

- [ ] **Step 4: Encode Mission start, merge, and rollback controls**

  Require worktree, exact allowlist, tests, evidence root, locks, source SHA, and stop conditions before mutation. Require cross-track conflict scan and exact-head CI before Join. Define rollback as a recoverable branch/PR close or revert path and forbid destructive reset/force-push.

- [ ] **Step 5: Validate JSON structure locally**

  Run:

  ```powershell
  node -e "const fs=require('fs'); const p='docs/evidence/mod-05-parallelism-20260822/parallelism-join-manifest.json'; const x=JSON.parse(fs.readFileSync(p,'utf8')); if(x.status!=='PARALLELISM_QUALIFIED') throw new Error('wrong gate'); if(x.baseline.master_sha!=='5ebf3a4b0ca4166659b8017f8a03e377f5a3e360') throw new Error('wrong baseline'); if(x.lanes.length!==5) throw new Error('wrong lane count'); if(x.resource_owners.some(r=>!r.owner||!r.lock_mode||!r.release_condition||!r.expiry)) throw new Error('incomplete lock'); console.log('MOD-05 manifest PASS')"
  ```

  Expected: `MOD-05 manifest PASS`.

### Task 2: Write the human-readable Join Charter

**Files:**
- Create: `docs/governance/mod-05-parallelism-join-charter-20260822.md`
- Read: `docs/evidence/mod-05-parallelism-20260822/parallelism-join-manifest.json`
- Read: `AGENTS.md`

**Interfaces:**
- Consumes: Task 1 manifest and repository guardrails.
- Produces: reviewer-facing charter that maps each V1.0 MOD-05 acceptance criterion to an evidence path, lock rule, and stop condition.

- [ ] **Step 1: State authority and scope**

  Identify the V1.0 plan as design/coordination input, identify current master as the implementation baseline, and state that this charter does not authorize a mutation task.

- [ ] **Step 2: Document the five-line dependency graph**

  Explain lane responsibilities and the allowed direction of information. Call out that FE consumes structured projections and explanations rather than calculating official outcomes; AGT produces advisory/candidate output; SH and MOD do not become truth writers.

- [ ] **Step 3: Publish the lock matrix and Mission start block**

  Include exact path families, unique owner, mode, read consumers, forbidden mutations, expiry, and release condition. Include a copyable Mission start block with all required declarations.

- [ ] **Step 4: Publish Merge Barrier, Join order, rollback, and expiry**

  Require each lane to pass focused validation, conflict scan, exact-head CI, evidence review, and post-merge fresh readback in order. If a lock expires, the lane pauses and the portfolio is recompiled; it may not silently continue.

- [ ] **Step 5: Record limitations and non-proofs**

  State that the charter does not prove runtime execution, CI success for future tasks, absence of unregistered external worktrees, human validation, Provider/Pilot/Production readiness, or CodeGraph analysis when the directory/tool is unavailable.

### Task 3: Run governance-only verification and package one PR

**Files:**
- Verify: `docs/evidence/mod-05-parallelism-20260822/parallelism-join-manifest.json`
- Verify: `docs/governance/mod-05-parallelism-join-charter-20260822.md`
- Verify: `docs/superpowers/plans/2026-08-22-mod-05-parallelism.md`

**Interfaces:**
- Consumes: Tasks 1–2 artifacts.
- Produces: one small PR with explicit Summary, Validation, and Scope Notes; no runtime changes.

- [ ] **Step 1: Check formatting and scope**

  Run:

  ```powershell
  git diff --check
  git status --short
  git diff --name-only origin/master...HEAD
  ```

  Expected: only the three declared documents are changed.

- [ ] **Step 2: Check hidden Unicode and JSON parse**

  Run `npm run check:hidden-unicode` and the Task 1 Node manifest assertion. Expected: both pass.

- [ ] **Step 3: Review truth and lock boundaries**

  Confirm no file under `services/simulation-core/src`, settlement/replay truth paths, database, provider configuration, or frontend runtime was modified. Confirm every shared resource in the manifest has exactly one writer owner. The lock resolver must iterate every row in lock_matrix, not only IDs referenced by mission_start_contract.locks or parallelism_ledger[*].lock_ids. For each lock row, require exactly one resource_owners row for resource_id; require matching owner and mode; require lock source_sha to equal baseline.master_sha; require both lock and owner source_sha, release_condition, and expiry fields to be present and exactly equal. This makes the lock row and resource-owner row one auditable contract rather than two divergent descriptions.

  Run this full-lock validation:

    node -e "const fs=require('fs'); const p='docs/evidence/mod-05-parallelism-20260822/parallelism-join-manifest.json'; const m=JSON.parse(fs.readFileSync(p,'utf8')); const failures=[]; for(const lock of m.lock_matrix){const owners=m.resource_owners.filter(r=>r.resource_id===lock.resource_id); if(owners.length!==1){failures.push(lock.lock_id+': owner_count='+owners.length); continue;} const owner=owners[0]; if(lock.owner!==owner.owner||lock.mode!==owner.lock_mode||lock.source_sha!==m.baseline.master_sha||lock.source_sha!==owner.source_sha||lock.release_condition!==owner.release_condition||lock.expiry!==owner.expiry||![lock.owner,lock.mode,lock.source_sha,lock.release_condition,lock.expiry,owner.owner,owner.lock_mode,owner.source_sha,owner.release_condition,owner.expiry].every(Boolean)) failures.push(lock.lock_id+': unresolved_or_mismatched_lock_owner'); } if(failures.length) throw new Error(failures.join('; ')); console.log('MOD-05 full lock resolution PASS rows='+m.lock_matrix.length+' owners='+m.resource_owners.length)"

  Expected: MOD-05 full lock resolution PASS rows=18 owners=18.

- [ ] **Step 4: Commit only allowlisted files**

  ```powershell
  git add docs/evidence/mod-05-parallelism-20260822/parallelism-join-manifest.json docs/governance/mod-05-parallelism-join-charter-20260822.md docs/superpowers/plans/2026-08-22-mod-05-parallelism.md
  git commit -m "docs: add MOD-05 parallelism join charter"
  ```

- [ ] **Step 5: Push, create a draft PR, and wait for CI**

  Push the named branch, create one draft PR against the exact current master base, and record CI URLs. Do not mark Ready or merge until all applicable checks pass and the head SHA is re-read.

## Self-review checklist

- [ ] Every MOD-05 requirement has a corresponding manifest or charter section.
- [ ] No resource is assigned multiple write owners.
- [ ] Lock expiry and release conditions are explicit rather than implicit.
- [ ] Join order cannot bypass exact-head CI or post-merge readback.
- [ ] The manifest and charter do not claim provider activation, runtime truth, human validation, or CodeGraph results.
- [ ] No dependency, lockfile, schema, runtime, database, frontend, or provider mutation is included.
