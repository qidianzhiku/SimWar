# MOD-05 Parallelism and Join Charter

**Document ID:** `SIMWAR-MOD-05-PARALLELISM-JOIN-CHARTER-20260822`<br>
**Machine manifest:** [`parallelism-join-manifest.json`](../evidence/mod-05-parallelism-20260822/parallelism-join-manifest.json)<br>
**Manifest version:** `1.0.0`<br>
**Manifest status:** `PARALLELISM_QUALIFIED`<br>
**Qualification scope:** `GOVERNANCE_MANIFEST_STRUCTURAL_ONLY`<br>
**Plan ID:** `SIMWAR-MOD-AGT-DUAL-TRACK-PLAN-V1.0-20260820`<br>
**Plan SHA-256:** `EF2104E90C04A811697749388999E31AE27BCFC457D7804FB765A10C68120260`

This is a reviewer-facing rendering of the canonical machine manifest. It is a governance document only. It does not create a runtime writer, alter settlement or replay truth, activate a provider, or authorize a downstream mission.

## 1. Authority and status

The V1.0 plan identified above is **design/coordination input only**. The current implementation source baseline is `origin/master@1fbe6eec73c0d234023549834f86c9c1f4d6b8d8`; current source and exact readback remain authoritative over historical plans, detached checkouts, or stale snapshots. The manifest records `runtime_authority=JSON_INTERNAL_ONLY`, `provider_calls=0`, and `official_truth_writer=false`.

MOD-05 qualification is `GOVERNANCE_MANIFEST_STRUCTURAL_ONLY`. It means that this manifest and charter describe lane, ownership, lock, admission, Join, expiry, rollback, and evidence controls. It does not prove that a lane ran, that future CI will pass, or that any runtime or provider behavior exists. `automatic_next_start=false`: no successor or downstream mission starts automatically.

Downstream mutation missions remain blocked until each has its own fresh, exact admission record containing the current source identity, isolated worktree, exact file allowlist, unique owner and lock IDs, validation, evidence root, runtime-store and provider declarations, expiry, and stop conditions. A plan, ledger entry, or this charter cannot substitute for that admission record.

## 2. Five-line Dependency Graph

The five lanes are bounded by the manifest as follows:

- **MAIN** owns the current JSON mainline integration boundary, shared contracts, API/server coordination, test and CI coordination, and serial merge control. MAIN coordinates integration but does not become a new truth writer.
- **SH** prepares Shanghai and eldercare scenario or plugin candidates as bounded inputs to the existing core path. SH is not a formal truth writer.
- **MOD** prepares offline or shadow model research, registry, comparison, and evidence candidates. MOD output remains candidate input and never becomes runtime authority.
- **AGT** owns the existing Agent Gateway advisory-only boundary for schema-validated candidate or advisory output and audit inputs. AGT cannot write formal truth.
- **FE** owns teacher, student, and shared UI presentation and interaction surfaces that consume structured contracts, safe projections, and advisory explanations. FE does not calculate or persist official outcomes.

The manifest permits these information edges; every edge has `formal_truth_write=false`:

| From | To | Kind | Allowed data flow |
| --- | --- | --- | --- |
| MAIN | SH | `read_contract` | SH reads current API, shared-contract, simulation, and governance boundaries before preparing scenario/plugin candidates. |
| MAIN | MOD | `read_contract` | MOD reads the current source baseline and contracts before preparing research or registry candidates. |
| MAIN | AGT | `read_contract` | AGT reads the current actor, tenant, schema, audit, and truth-protection boundaries. |
| MAIN | FE | `read_contract` | FE reads current shared contracts and API projection boundaries. |
| SH | MAIN | `candidate_input` | Scenario and plugin candidates are reviewed inputs only; MAIN remains the controlled integration path. |
| MOD | SH | `candidate_input` | Offline model research may inform bounded scenario analysis without activating a model or changing scenario truth. |
| MOD | AGT | `candidate_input` | Model metadata and research candidates may be consumed by advisory-only work after contract and authority checks. |
| AGT | FE | `advisory_output` | AGT exposes only schema-validated advisory or candidate output for UI display. |
| MAIN | FE | `explanation_projection` | FE consumes structured result and explanation projections and does not calculate official outcomes. |
| MAIN | SH | `merge_control` | MAIN controls cross-track conflict review and serial Join admission for SH. |
| MAIN | MOD | `merge_control` | MAIN controls evidence review and serial Join admission for MOD. |
| MAIN | AGT | `merge_control` | MAIN controls advisory-boundary conflict review and serial Join admission for AGT. |
| MAIN | FE | `merge_control` | MAIN controls UI contract conflict review and serial Join admission for FE. |

The Simulation Core remains the sole official realization and settlement truth boundary. AGT output is advisory or candidate material only. FE consumes projections and explanations and does not calculate official market, finance, scoring, ranking, or settlement outcomes. SH and MOD provide bounded candidates or evidence and do not become truth writers. No lane may write `SettlementResult`, canonical `Decision`, `state_true`, `score`, `rank`, replay truth/hash inputs, or the official Simulation Core writer topology.

## 3. Shared resource ownership and lock matrix

The following is the complete `resource_owners` inventory from the manifest. `Path boundary` is the allowed path boundary; `Forbidden writes` is the manifest’s forbidden-path or forbidden-authority list. Readers are read consumers, not co-owners.

1. **`RES-MAIN-SHARED-CONTRACTS`**
   - Owner / mode: `MAIN` / `WRITE_EXCLUSIVE`
   - Path boundary: `packages/shared-contracts/**`; `contracts/openapi/**`; `contracts/schemas/**`; `contracts/fixtures/**`
   - Readers: `SH`, `MOD`, `AGT`, `FE`
   - Forbidden writes: `services/simulation-core/src/**`; `db/migrations/**`; `package-lock.json`; provider configuration or credentials
   - Release condition: Release after the exact contract allowlist is closed, focused contract validation passes, and the same source SHA is reviewed.
   - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

2. **`RES-MAIN-API-SERVER`**
   - Owner / mode: `MAIN` / `WRITE_EXCLUSIVE`
   - Path boundary: `services/api/src/**`
   - Readers: `SH`, `MOD`, `AGT`, `FE`
   - Forbidden writes: `services/simulation-core/src/**`; `SettlementResult` or canonical `Decision` writer changes; provider activation; shared runtime store
   - Release condition: Release after route/service validation, truth-boundary review, and exact-head CI are recorded.
   - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

3. **`RES-MAIN-SIMULATION-CORE-TRUTH`**
   - Owner / mode: `MAIN` / `RESERVED`
   - Path boundary: `services/simulation-core/src/market.ts`; `services/simulation-core/src/operations.ts`; `services/simulation-core/src/finance.ts`; `services/simulation-core/src/scoring.ts`; `services/simulation-core/src/enterprise-state.ts`; `services/simulation-core/src/index.ts`; `services/simulation-core/src/types.ts`; `services/simulation-core/src/toy-logit-engine.ts`; `services/simulation-core/src/w5-governed-convergence.ts`
   - Readers: `SH`, `MOD`, `AGT`, `FE`
   - Forbidden writes: any new or competing truth writer; `SettlementResult`; `state_true`; `score` or `rank`; `replay_hash` or truth-hash inputs; provider or database authority activation
   - Release condition: Release only after an owner-approved stage decision explicitly preserves the single Simulation Core truth boundary; MOD-05 does not release this reservation.
   - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

4. **`RES-SH-SCENARIO-PLUGIN-ASSETS`**
   - Owner / mode: `SH` / `WRITE_EXCLUSIVE`
   - Path boundary: `plugins/**`; `services/simulation-core/src/eldercare-*.ts`; `docs/architecture/eldercare-*.md`; `docs/product/shanghai-market-world-product-reuse-map.md`
   - Readers: `MAIN`, `MOD`, `AGT`, `FE`
   - Forbidden writes: `services/simulation-core/src/market.ts`; `services/simulation-core/src/operations.ts`; `services/simulation-core/src/finance.ts`; `services/simulation-core/src/scoring.ts`; `services/simulation-core/src/enterprise-state.ts`; `SettlementResult` or canonical `Decision`; provider activation
   - Release condition: Release after scenario/plugin validation confirms bounded hook use, no truth-writer change, and current-source evidence is attached.
   - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

5. **`RES-MOD-MODEL-RESEARCH-REGISTRY`**
   - Owner / mode: `MOD` / `WRITE_EXCLUSIVE`
   - Path boundary: `docs/model-governance/**`; `docs/research/**`
   - Readers: `MAIN`, `SH`, `AGT`, `FE`
   - Forbidden writes: `services/simulation-core/src/**`; `services/api/src/**`; `services/agent-gateway/**`; `contracts/schemas/**`; `package.json`; `package-lock.json`; provider activation or real-model calls
   - Release condition: Release after source identity, version or unverified disposition, license, fallback, expiry, and provider-off boundaries are reviewed.
   - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

6. **`RES-AGT-GATEWAY-ADVISORY`**
   - Owner / mode: `AGT` / `WRITE_EXCLUSIVE`
   - Path boundary: `services/agent-gateway/**`; `docs/contracts/model-engineering-contract.md`; `docs/contracts/w020-governed-ai-advisory.md`
   - Readers: `MAIN`, `SH`, `MOD`, `FE`
   - Forbidden writes: `services/api/src/**`; `services/simulation-core/src/**`; `db/**`; provider configuration or credentials; `SettlementResult`, canonical `Decision`, `state_true`, `score`, `rank`, or replay truth
   - Release condition: Release after schema, actor/tenant scope, advisory-only output, audit input, and negative truth-write validation are reviewed.
   - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

7. **`RES-FE-TEACHER-STUDENT-UI`**
   - Owner / mode: `FE` / `WRITE_EXCLUSIVE`
   - Path boundary: `apps/teacher/**`; `apps/student/**`; `packages/ui/**`
   - Readers: `MAIN`, `SH`, `MOD`, `AGT`
   - Forbidden writes: `services/api/src/**`; `services/simulation-core/src/**`; `db/**`; official market, finance, scoring, ranking, or settlement calculations; provider activation
   - Release condition: Release after projection/contract validation, role-safe UI checks, and required browser or focused evidence are recorded.
   - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

8. **`RES-MAIN-TESTS-CI`**
   - Owner / mode: `MAIN` / `WRITE_EXCLUSIVE`
   - Path boundary: `tests/**`; `.github/workflows/**`; `scripts/**`
   - Readers: `SH`, `MOD`, `AGT`, `FE`
   - Forbidden writes: `package-lock.json`; runtime or provider configuration; test-only bypass of truth, role, tenant, or replay protections
   - Release condition: Release after focused validation, hidden-unicode/format checks where applicable, and exact-head CI evidence are attached.
   - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

9. **`RES-MAIN-DATABASE-MIGRATIONS`**
   - Owner / mode: `MAIN` / `RESERVED`
   - Path boundary: `db/**`
   - Readers: `SH`, `MOD`, `AGT`, `FE`
   - Forbidden writes: migration execution; PostgreSQL activation; durable settlement or recovery authority; runtime database cutover
   - Release condition: Release only after a separate database stage decision, migration-specific allowlist, and rollback evidence are approved.
   - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

10. **`RES-MAIN-PROVIDER-PORTS`**
    - Owner / mode: `MAIN` / `RESERVED`
    - Path boundary: `services/api/src/repository-ports.ts`; `services/api/src/repository-facade.ts`; `services/api/src/repository-provider.ts`; `services/api/src/json-repository-adapter.ts`; `services/api/src/postgres-repository-adapter.ts`
    - Readers: `SH`, `MOD`, `AGT`, `FE`
    - Forbidden writes: provider activation; dual writer or competing registry; runtime authority cutover; `SettlementResult` or replay truth changes
    - Release condition: Release only after explicit provider/adapter authorization, contract parity validation, and non-dual-write evidence.
    - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

11. **`RES-MOD-EVIDENCE-ROOTS`**
    - Owner / mode: `MOD` / `WRITE_EXCLUSIVE`
    - Path boundary: `docs/evidence/mod-04-research-refresh-20260821/**`; `docs/evidence/mod-05-parallelism-20260822/**`; `docs/evidence/mod-03-*/**`
    - Readers: `MAIN`, `SH`, `AGT`, `FE`
    - Forbidden writes: `services/**`; `apps/**`; `packages/**`; `contracts/**`; `db/**`; provider activation
    - Release condition: Release after evidence files are source-bound, scope-reviewed, and explicitly labeled for current proof or non-proof limits.
    - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

12. **`RES-MOD-05-MANIFEST`**
    - Owner / mode: `MOD` / `WRITE_EXCLUSIVE`
    - Path boundary: `docs/evidence/mod-05-parallelism-20260822/parallelism-join-manifest.json`
    - Readers: `MAIN`, `SH`, `AGT`, `FE`
    - Forbidden writes: `docs/superpowers/plans/2026-08-22-mod-05-parallelism.md`; `docs/governance/mod-05-parallelism-join-charter-20260822.md`; `services/**`; `apps/**`; `packages/**`; `contracts/**`; `db/**`; provider activation
    - Release condition: Release after the exact MOD-05 manifest path is committed or the task is closed without Join; any further mutation requires a fresh source and lock readback.
    - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

13. **`RES-MAIN-GITHUB-MERGE-CONTROL`**
    - Owner / mode: `MAIN` / `SCHEDULED_EXCLUSIVE`
    - Path boundary: `.github/**`
    - Readers: `SH`, `MOD`, `AGT`, `FE`
    - Forbidden writes: force-push; destructive history rewrite; parallel merge execution; merge without exact-head CI or evidence review
    - Release condition: Release after serial merge, post-merge fresh readback, and closure evidence are complete; no lane may self-merge.
    - Expiry: `2026-08-29T23:59:59Z` or earlier on current-master, scope, owner, or lock-contract change.

Every writer owner is unique in the manifest: no shared resource has more than one writer owner. Every active lock must resolve to exactly one machine row and exactly one owner. `RESERVED` is a held boundary, not an available write slot. The 18 manifest lock rows are:

| Lock ID | Resource ID | Owner | Mode | Mission |
| --- | --- | --- | --- | --- |
| `LOCK-LANE-MAIN` | `LANE-MAIN` | `MAIN` | `WRITE_EXCLUSIVE` | MOD-05 five-lane admission and serial integration control |
| `LOCK-LANE-SH` | `LANE-SH` | `SH` | `WRITE_EXCLUSIVE` | Bounded Shanghai/scenario/plugin candidate preparation |
| `LOCK-LANE-MOD` | `LANE-MOD` | `MOD` | `WRITE_EXCLUSIVE` | Bounded model research, registry, and governance evidence preparation |
| `LOCK-LANE-AGT` | `LANE-AGT` | `AGT` | `WRITE_EXCLUSIVE` | Bounded advisory-only Agent Gateway preparation |
| `LOCK-LANE-FE` | `LANE-FE` | `FE` | `WRITE_EXCLUSIVE` | Bounded teacher/student UI projection and explanation preparation |
| `LOCK-MAIN-SHARED-CONTRACTS` | `RES-MAIN-SHARED-CONTRACTS` | `MAIN` | `WRITE_EXCLUSIVE` | Freeze one writer for shared contracts and fixtures |
| `LOCK-MAIN-API-SERVER` | `RES-MAIN-API-SERVER` | `MAIN` | `WRITE_EXCLUSIVE` | Freeze one writer for API/server route and service composition |
| `LOCK-MAIN-SIMULATION-CORE-TRUTH` | `RES-MAIN-SIMULATION-CORE-TRUTH` | `MAIN` | `RESERVED` | Protect the existing single Simulation Core truth boundary |
| `LOCK-SH-SCENARIO-PLUGIN-ASSETS` | `RES-SH-SCENARIO-PLUGIN-ASSETS` | `SH` | `WRITE_EXCLUSIVE` | Freeze one writer for scenario/plugin candidate assets |
| `LOCK-MOD-MODEL-RESEARCH-REGISTRY` | `RES-MOD-MODEL-RESEARCH-REGISTRY` | `MOD` | `WRITE_EXCLUSIVE` | Freeze one writer for model research and registry evidence |
| `LOCK-AGT-GATEWAY-ADVISORY` | `RES-AGT-GATEWAY-ADVISORY` | `AGT` | `WRITE_EXCLUSIVE` | Freeze one writer for advisory-only gateway boundary |
| `LOCK-FE-TEACHER-STUDENT-UI` | `RES-FE-TEACHER-STUDENT-UI` | `FE` | `WRITE_EXCLUSIVE` | Freeze one writer for teacher/student/shared UI |
| `LOCK-MAIN-TESTS-CI` | `RES-MAIN-TESTS-CI` | `MAIN` | `WRITE_EXCLUSIVE` | Freeze one writer for tests, scripts, and CI workflow changes |
| `LOCK-MAIN-DATABASE-MIGRATIONS` | `RES-MAIN-DATABASE-MIGRATIONS` | `MAIN` | `RESERVED` | Reserve database and migration surfaces outside MOD-05 scope |
| `LOCK-MAIN-PROVIDER-PORTS` | `RES-MAIN-PROVIDER-PORTS` | `MAIN` | `RESERVED` | Reserve provider and repository-port surfaces without activation |
| `LOCK-MOD-05-MANIFEST` | `RES-MOD-05-MANIFEST` | `MOD` | `WRITE_EXCLUSIVE` | MOD-05 Task 1 exact machine manifest |
| `LOCK-MOD-EVIDENCE-ROOTS` | `RES-MOD-EVIDENCE-ROOTS` | `MOD` | `WRITE_EXCLUSIVE` | Freeze MOD evidence roots and preserve source-bound receipts |
| `LOCK-MAIN-GITHUB-MERGE-CONTROL` | `RES-MAIN-GITHUB-MERGE-CONTROL` | `MAIN` | `SCHEDULED_EXCLUSIVE` | Reserve serial GitHub merge and Join control |

Every lock-matrix row is bound to source SHA `1fbe6eec73c0d234023549834f86c9c1f4d6b8d8` and the manifest expiry `2026-08-29T23:59:59Z` or earlier on current-master or scope change, with the resource-specific exceptions and release conditions stated above and in the manifest.

## 4. Mission start contract

The following is a copyable rendering of the manifest `mission_start_contract`. Its declarations are required before mutation; the `file_allowlist` shown is the manifest’s exact Task-1 machine allowlist, and the report path is the manifest’s Task-1 report path.

```text
worktree: A dedicated isolated linked worktree for one lane and one mission; no dirty or shared writer state may be adopted implicitly.
source_sha: 1fbe6eec73c0d234023549834f86c9c1f4d6b8d8
file_allowlist:
  - docs/evidence/mod-05-parallelism-20260822/parallelism-join-manifest.json
report_path: .superpowers/sdd/2026-08-22-mod-05-parallelism/task-1-report.md
tests:
  - node -e "const fs=require('fs'); const p='docs/evidence/mod-05-parallelism-20260822/parallelism-join-manifest.json'; const x=JSON.parse(fs.readFileSync(p,'utf8')); if(x.status!=='PARALLELISM_QUALIFIED') throw new Error('wrong gate'); if(x.baseline.master_sha!=='1fbe6eec73c0d234023549834f86c9c1f4d6b8d8') throw new Error('wrong baseline'); if(x.lanes.length!==5) throw new Error('wrong lane count'); if(x.resource_owners.some(r=>!r.owner||!r.lock_mode||!r.release_condition||!r.expiry)) throw new Error('incomplete lock'); console.log('MOD-05 manifest PASS')"
evidence_root: docs/evidence/mod-05-parallelism-20260822/
locks:
  - LOCK-MOD-05-MANIFEST
  - LOCK-MOD-EVIDENCE-ROOTS
  - LOCK-MAIN-GITHUB-MERGE-CONTROL
ports: NONE_FOR_TASK_1; any future lane must reserve a unique port and may not share a running service.
runtime_store: NO_RUNTIME_START; JSON_INTERNAL_ONLY baseline; any future validation uses an isolated memory or task-local JSON store and never the shared development snapshot.
provider_selector: PROVIDER_OFF; provider_calls must remain 0; no implicit latest/current selector and no dependency installation or upgrade.
stop_conditions:
  - Current source SHA changes before validation.
  - A path falls outside the exact file allowlist.
  - A lock is expired, conflicted, or owned by more than one writer.
  - Any change would touch runtime, settlement, replay truth, database, provider, or frontend runtime files outside the allowlist.
  - The exact manifest assertion fails.
  - A request attempts provider activation, Human Validation, Pilot, Production, automatic successor creation, or a second writer.
scope_escape_action: CANCEL_TRACK_AND_RECOMPILE
```

Any scope escape action is exactly `CANCEL_TRACK_AND_RECOMPILE`. A mission may not silently broaden its allowlist, adopt a shared runtime store or port, change provider selection, or infer a successor from this charter.

## 5. Merge Barrier and Join order

The required Merge Barrier order is:

1. `cross_track_conflict_scan`
2. `focused_validation`
3. `exact_head_ci`
4. `evidence_review`
5. `post_merge_fresh_readback`

The manifest makes each step mandatory. A manifest parse does not substitute for lane-specific validation. Exact-head CI must be read back at the candidate head; pending or failed CI is not a pass. Serial closure admits only one ready-for-closure PR at a time. If two PRs are ready for closure, the failure action is `STOP_SERIAL_CLOSURE_AND_RECOMPILE_PORTFOLIO`.

The 11 manifest Join stages and their failure actions are:

| # | Stage | Required evidence | Failure action |
| ---: | --- | --- | --- |
| 1 | `BASELINE_FREEZE` | `origin/master` exact SHA; V1.0 plan ID and SHA-256; MOD-03 and MOD-04 baseline paths; CodeGraph absence receipt | `PAUSE_ALL_LANES_AND_REAUTHENTICATE_CURRENT_SOURCE` |
| 2 | `LANE_ADMISSION` | Lane ID; isolated worktree; exact file allowlist; unique owner and lock IDs; ports, runtime store, provider selector, and expiry declarations | `CANCEL_TRACK_AND_RECOMPILE` |
| 3 | `MISSION_START` | Complete mission_start_contract; source SHA matches baseline; no scope escape | `DO_NOT_MUTATE_AND_CANCEL_TRACK_AND_RECOMPILE` |
| 4 | `PARALLEL_EXECUTION` | Lane-local diff; lane-local validation output; no shared runtime or port collision; candidate/advisory/projection output classification | `PAUSE_AFFECTED_LANE_AND_INVALIDATE_UNBOUND_EVIDENCE` |
| 5 | `PRE_JOIN_EVIDENCE` | Source-bound evidence root; forbidden-path scan; truth/provider non-write receipt | `REJECT_JOIN_PACKAGE_AND_RECOMPILE_LOCKS` |
| 6 | `CROSS_TRACK_CONFLICT_SCAN` | All lane diffs; resource owner comparison; path overlap result; authority/writer overlap result | `STOP_AND_CANCEL_CONFLICTING_TRACKS` |
| 7 | `FOCUSED_VALIDATION` | Lane-specific test command and output; contract/schema/projection checks where applicable; no provider activation | `KEEP_LANE_OUT_OF_JOIN_AND_REPAIR_WITHIN_ALLOWLIST_ONLY` |
| 8 | `EXACT_HEAD_CI` | Candidate head SHA; required CI check results at that SHA; no pending required check treated as pass | `BLOCK_MERGE_AND_KEEP_PR_OR_BRANCH_RECOVERABLE` |
| 9 | `EVIDENCE_REVIEW` | Manifest/charter mapping; owner and expiry review; explicit non-proofs; scope and truth-boundary review | `REJECT_CLOSURE_AND_RECOMPILE_PORTFOLIO` |
| 10 | `SERIAL_MERGE` | One approved closure slot; one ready PR at a time; merge-control lock held by MAIN | `CLOSE_OR_REVERT_RECOVERABLY_WITHOUT_FORCE_PUSH` |
| 11 | `POST_MERGE_READBACK` | Fresh master SHA; fresh changed-path readback; post-merge required-check state; lock expiry and next-start state | `INVALIDATE_PENDING_JOIN_EVIDENCE_AND_RECOMPILE_PORTFOLIO` |

The barrier is not complete until post-merge fresh readback has re-read master, the merged head, changed paths, required checks, and lock validity. No later stage can retroactively make a pending or failed earlier stage pass.

## 6. Rollback, expiry, and re-authentication

Allowed rollback is recoverable only:

- Close an unmerged branch or PR without deleting unrelated work.
- Revert a merged change with a new reviewable revert commit.
- Use a recoverable branch/PR closure path and preserve the evidence receipt.

Forbidden rollback includes destructive reset, `git reset --hard` as a rollback mechanism, force-push, history rewrite, and destructive deletion or overwrite of another lane’s files. Rollback must not rewrite historical official results, replay truth, audit evidence, or another owner’s work.

An expired or stale lock pauses its lane, invalidates pending Join evidence, and requires `PORTFOLIO_AND_LOCK_RECOMPILATION` before any restart. There is no silent continuation. The manifest’s expiry triggers are:

- Current master SHA changes.
- Owner, path, mission, port, provider, or runtime-store declaration changes.
- The lock expiry timestamp passes.
- A second writer or unregistered worktree is detected.
- A required check or evidence receipt becomes stale.

The current master, owner, path, mission, port, provider, runtime-store, or required-check change invalidates the receipt even when the changed value appears operationally compatible. Re-authentication must re-read the current source, regenerate the affected admission and lock records, and discard unbound evidence before mutation or Join resumes.

## 7. Parallelism ledger

The manifest ledger records these entries as evidence classification, not as runtime capability:

### MOD-03

- Lane: `MOD`
- Write scope: `docs/governance/mod-agt-document-authority-supersession-register-20260821.md`
- Locks: `LOCK-MOD-MODEL-RESEARCH-REGISTRY`, `LOCK-MOD-EVIDENCE-ROOTS`
- Conflict scan: `MERGED_BASELINE_READ_ONLY; revalidate dependent work against current master before mutation.`
- Validation: `MOD-03 authority/supersession receipt is the bounded baseline; no runtime/provider mutation is inferred.`
- Merge barrier: `MERGED_BASELINE; no automatic successor authority.`
- State: `MERGED_BASELINE_READ_ONLY`

### MOD-04

- Lane: `MOD`
- Write scope: `docs/evidence/mod-04-research-refresh-20260821/benchmark-manifest.json`; `docs/evidence/mod-04-research-refresh-20260821/official-source-ledger.md`; `docs/governance/mod-04-official-research-refresh-20260821.md`
- Locks: `LOCK-MOD-MODEL-RESEARCH-REGISTRY`, `LOCK-MOD-EVIDENCE-ROOTS`
- Conflict scan: `MERGED BASELINE READ ONLY; provider-off, research-only, and no-dependency-activation boundaries remain binding.`
- Validation: `Benchmark manifest and MOD-04 governance receipt provide the bounded research baseline; no runtime/provider mutation is inferred.`
- Merge barrier: `MERGED_BASELINE; no automatic model or provider activation.`
- State: `MERGED_BASELINE_READ_ONLY`

### MOD-05

- Lane: `MOD`
- Write scope: `docs/evidence/mod-05-parallelism-20260822/parallelism-join-manifest.json`
- Locks: `LOCK-MOD-EVIDENCE-ROOTS`, `LOCK-MOD-05-MANIFEST`
- Conflict scan: `REQUIRED_BEFORE_JOIN_NOT_PERFORMED`
- Validation: `Task 1 exact Node JSON assertion is required; report output must be recorded separately.`
- Merge barrier: `REQUIRED_BEFORE_JOIN_NOT_PERFORMED`
- State: `TASK_1_LOCAL_EVIDENCE_ONLY`

MOD-03 and MOD-04 are merged-baseline read-only entries, and MOD-05 is local evidence only. None of these entries proves runtime execution, provider activation or access, Human Validation, Pilot, Production, or a successor authority. The MOD-05 charter itself does not promote the ledger state.

## 8. Gate and stop conditions

The qualified gate is exactly:

- Status: `PARALLELISM_QUALIFIED`
- Scope: `GOVERNANCE_MANIFEST_STRUCTURAL_ONLY`

This gate is structural only. Classify the lane or Join as `NOT_PROVEN` and pause when any of the following is true:

- The source is missing, stale, or not freshly authenticated against the required baseline.
- A path overlaps another lane’s mutable path or falls outside the exact allowlist.
- A shared resource has multiple owners or a second writer is detected.
- A lock is expired, conflicted, or stale.
- The Simulation Core truth, provider, database, runtime-store, or runtime-authority boundary changes.
- Evidence is unbound, scope-unbound, or cannot be tied to the exact source and owner.
- Exact-head CI is pending or failed; pending is never treated as pass.
- Post-merge fresh readback is missing.

The manifest’s Merge Barrier also stops on two ready-for-closure PRs, unresolved cross-track conflict, more than one writer for a shared resource, missing evidence review, or any truth/provider/database/runtime-authority boundary change. The required response is the applicable pause, cancellation, rejection, recoverable closure, or portfolio/lock recompilation action above; no automatic next start is permitted.

## 9. Non-proofs and source notes

The manifest explicitly does not prove:

- Runtime execution.
- Future CI success.
- The absence of unregistered external worktrees.
- Human Validation.
- Provider, Pilot, or Production readiness.
- CodeGraph analysis; `.codegraph/` is absent in the current worktree.
- Provider, dependency, database, PostgreSQL runtime, or second-writer activation.
- Mutation authorization beyond a separately declared exact file allowlist.
- Any change to settlement logic, `SettlementResult`, canonical `Decision`, replay truth/hash inputs, or official Simulation Core authority.

The CodeGraph status is `ABSENT` with claim `NO_CODEGRAPH_ANALYSIS_PERFORMED`; no graph result is asserted. The current source baseline is the manifest’s `origin/master` record, not the older source snapshots or baseline statements that may appear in historical governance receipts.

Source paths for review:

- [`AGENTS.md`](../../AGENTS.md) - repository development, truth-protection, lock, validation, and scope guardrails.
- [Current planning lock policy](../planning/L1_MAINLINE_BOUNDED_PARALLEL_EXECUTION_PLAN.md) - bounded parallel execution, resource lock, WIP, serial closure, and re-authentication policy.
- [Current planning portfolio register](../planning/l1-portfolio-register.yaml) - dynamic planning and lock register referenced by the planning policy.
- [MOD-03 authority/supersession register](mod-agt-document-authority-supersession-register-20260821.md) - merged-baseline read-only MOD-03 evidence path.
- [MOD-04 governance receipt](mod-04-official-research-refresh-20260821.md) - merged-baseline read-only MOD-04 governance path.
- [MOD-05 machine manifest](../evidence/mod-05-parallelism-20260822/parallelism-join-manifest.json) - canonical machine values for this charter.
- [MOD-05 implementation plan](../superpowers/plans/2026-08-22-mod-05-parallelism.md) - task decomposition and document-only scope context.

The machine manifest remains the canonical authority for exact IDs, values, owners, paths, lock modes, expiry, failure actions, and non-proof language. If this charter and the manifest diverge, stop and recompile the charter from the manifest before any Join or mutation.
