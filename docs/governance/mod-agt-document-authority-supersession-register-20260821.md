# MOD/AGT 文档权威与替代关系登记（候选）

## 文档控制

| 字段 | 值 |
| --- | --- |
| Document ID | `SIMWAR-MOD-03-DOCUMENT-AUTHORITY-SUPERSESSION-REGISTER-20260821` |
| Status | `CANDIDATE_PASS_WITH_LIMITS_LOCAL_ONLY` |
| Lane | `MOD-03` |
| Register kind | `FORWARD_AUTHORITY_CANDIDATE` |
| Current source readback | `origin/master@3c101e5c4a4ed431c0b20f88ffc8ee52bb723636` |
| Readback date | `2026-08-21` |
| Attached plan ID | `SIMWAR-MOD-AGT-DUAL-TRACK-PLAN-V1.0-20260820` |
| Attached plan SHA-256 | `EF2104E90C04A811697749388999E31AE27BCFC457D7804FB765A10C68120260` |
| Attached plan scope | `MACHINE_CONTRACT` / `DESIGN_OR_REFERENCE_MATERIAL` |
| Main-forward authority | `NOT_ESTABLISHED_BY_THIS_LOCAL_CANDIDATE` |
| Automatic successor | `false` |
| Repository mutation in this candidate | `docs-only` |
| Runtime, contract, settlement, provider mutation | `none` |

This register is the bounded output for MOD-03. It reconciles the attached
MOD/AGT dual-track plan with the current repository and merged GitHub facts. It
does not convert the attached plan into current repository fact, rewrite an
earlier governance document, reopen a merged PR, create a second writer, or
start MOD-04 and later model work.

The status is deliberately local-only. A local branch commit is evidence that
the candidate was drafted and checked; it is not evidence that this register
has become the repository's forward authority. That requires the normal
reviewed publication and exact current-master readback, neither of which is
performed by this task.

## 1. Authority rules applied

The following order controls the classification in this register:

1. Fresh current repository source, contracts, tests, runtime composition and
   exact `origin/master` readback.
2. Current merged PR and post-merge evidence that can be re-bound to the fresh
   source tree.
3. A current-forward governance baseline that explicitly identifies its
   predecessor, scope, limits and successor boundary.
4. Detailed lane plans and task cards, which constrain planned work but do not
   prove that the work exists in the repository.
5. Historical plans, research, screenshots, browser output and prior detached
   checkouts, which are lineage or design evidence only unless freshly
   re-bound.

The following invariants remain active:

- `WANT != CAN != REALIZED`.
- The Simulation Core remains the sole official realization/settlement truth
  path; no model, Agent, frontend or document may become a second truth writer.
- Exact IDs, versions, content digests, model references and seeds are required;
  implicit `latest`, `current` or default substitution is not accepted.
- Replay and shadow output are non-overwriting and cannot mutate formal results.
- Agent output is advisory/candidate/resolved-signal material only; provider-off
  remains the default boundary.
- Cross-round decision, effect, state and outcome records remain separate.
- Historical documents and merged PR records are immutable lineage. A successor
  may supersede their forward-planning role, but may not rewrite their recorded
  result.
- One task card and one bounded writer are active at a time. This register does
  not authorize parallel model implementation, provider activation, Pilot or
  Production.

## 2. Current repository fact snapshot

| Fact | Current readback | Interpretation |
| --- | --- | --- |
| Current branch base | `origin/master@3c101e5c4a4ed431c0b20f88ffc8ee52bb723636` | Fresh forward baseline for this candidate. |
| W5 governed model source | `services/simulation-core/src/w5-governed-convergence.ts`; `services/api/src/w5-governed-model-service.ts`; `packages/shared-contracts/src/w5-governed-model.ts`; `contracts/schemas/w5-governed-model.v1.json` | Existing bounded W5 governance-plane capability is present. |
| W5 formal rebase source | `services/api/src/w5-formal-rebase.ts`; `packages/shared-contracts/src/w5-formal-rebase.ts`; `tests/unit/w5-formal-rebase.test.ts`; `docs/evidence/w5-formal-rebase/` | Current W5 evidence is bounded and must retain its explicit limits. |
| M2-P4 live-round source | `services/api/src/m2p4-live-round-ops.ts`; `packages/shared-contracts/src/m2p4-live-round-ops.ts`; `contracts/schemas/m2p4-live-round-ops.v1.json`; `tests/unit/m2p4-live-round-ops.test.ts` | Current round-operations projection reuses existing Course/Run/Round/Decision/Settlement/Publication authorities. |
| W4 Enterprise State source | `services/simulation-core/src/enterprise-state.ts`; `services/api/src/w4-enterprise-state.ts`; `packages/shared-contracts/src/w4-enterprise-state.ts` | Existing W4 state authority remains a predecessor/current source boundary, not an MOD/AGT model writer. |
| Current model-call contract | `contracts/schemas/model-call-log.v1.json`; `contracts/fixtures/model-call-log.valid.json` | Contract presence is not provider activation or real-model access. |
| Current MOD/AGT runtime writer | No current source fact was established for a new MOD/AGT model writer or provider runtime. | Do not infer implementation from the attached plan or old W5 labels. |
| CodeGraph | No `.codegraph` index in this fresh worktree; MCP result `UNAVAILABLE / NOT_PROVEN`. | Source/contract/test readback is used; no graph claim is made. |
| Graphify | Partial code-only extraction was completed outside the worktree. | Structural orientation only; not runtime or authority evidence. |
| New W5-A~E product chain | No such current merged chain was established in the current PR census. | The later V9 prompt is not imported into this V1 register. |

The current snapshot is the source of truth for this register. The attached
plan is retained as the requested execution contract and route map, not as a
claim that every listed MOD or AGT task is implemented.

## 3. Document reconciliation cards

Each card uses the same fields: authority, successor, preserved, retired,
current-reality drift, non-proof, source identity, and reopen trigger.

### Card A — W5 governed model / Shanghai convergence

| Field | Reconciliation |
| --- | --- |
| Authority | Current bounded governance-plane implementation and its current source/contracts/tests; formal truth remains Simulation Core. |
| Successor | W5 formal rebase delta is the later forward evidence baseline; this MOD/AGT V1 plan may schedule future model work but does not supersede W5 runtime authority. |
| Preserved | Exact Scenario/Parameter/Model binding; Standard/Advanced as views over one core path; `WANT` and `CAN` non-official; `REALIZED` from Simulation Core; `PLANE_OFF` deterministic fallback; tenant/role checks; no settlement/replay-truth mutation. |
| Retired | The earlier W5 closure's preparation-time “current master” pointer is historical and is not used as today's branch identity. No earlier result is deleted or rewritten. |
| Current-reality drift | The closure was prepared at an earlier W5 merge state; current master has advanced through W4 and M2-P4 merges. Its model-family limits still require fresh source revalidation. |
| Non-proof | No BLP/RCNL, Huff, Ideal Point/Lancaster or calibrated Shanghai engine is proven by the W5 labels; browser evidence is not Human Validation, Pilot or Production evidence. |
| Source identity | Predecessor PR #402 merged at `6f5881240247cff6da8fdf1d3d7e814afe1840b5`; governance record `docs/governance/W5-GOV-00-governed-model-shanghai-convergence-closure-20260820.md`. Fresh current source is read at `3c101e5...`. |
| Reopen trigger | Any change to model ownership, official writer topology, exact binding, replay inputs, settlement path, provider state, or a claim of calibrated/validated model capability. |

### Card B — W5 formal rebase / model readiness baseline

| Field | Reconciliation |
| --- | --- |
| Authority | Current-forward W5 evidence baseline with explicit `PASS_WITH_LIMITS`; it constrains claims about the existing W5 capability and its limits. |
| Successor | A future MOD task may extend the baseline only after a fresh MOD-02 fact map and the applicable model gate; no silent successor is active. |
| Preserved | `M-RB1/M-RB2/M-RB3` bounded dispositions; exact ModelVersion/Scenario/Parameter/seed; non-overwriting replay; deterministic fallback; `BLP_RCNL` and `HUFF_SPATIAL` missing/deferred; JSON internal runtime authority. |
| Retired | The mission's start-master and product-head values are historical mission lineage, not the current repository HEAD. Historical PR #402/#404 remain predecessor evidence only. |
| Current-reality drift | The committed evidence references the W5 mission tree and earlier master snapshots; later merged W4/M2-P4 changes mean any new implementation must revalidate the relevant source and tests at current master. |
| Non-proof | `PASS_WITH_LIMITS` is not provider activation, real data, Human Model Validation, Pilot, Production, PostgreSQL/RLS activation, or formal activation of missing model families. |
| Source identity | `docs/governance/w5-formal-rebase-v5.8-governance-delta-2026-08-20.md`; evidence under `docs/evidence/w5-formal-rebase/`; product PR #406 merged at `97dd4cb66d2f244df94a332b15fcb6b782ebb988`; governance PR #407 merged at `02548d71c21ea8a2ddcdc7729bf83ede85b7f05b`. |
| Reopen trigger | Any new model family, data source, calibration claim, engine adapter, replay input, official consumer, or change to the declared current/missing/shadow disposition. |

### Card C — M2-P4 live Course round operations

| Field | Reconciliation |
| --- | --- |
| Authority | Current source and merged governance closure for the bounded Teacher live-round and Student-safe projection. Existing Course, Run, Round, RoleWorkflow, canonical Decision admission, Settlement and Publication paths remain authoritative. |
| Successor | No MOD/AGT successor is implied. Any model/Agent integration must consume approved projections and must not create a Course, Decision, Settlement, Replay, Publication or Enterprise State writer. |
| Preserved | Exact tenant/Course/Run/Round scope; canonical readiness; lock receipt; sole settlement writer; governed publication; Student own-team visibility; no cross-team truth projection. |
| Retired | The pre-merge product-head pointer in the evidence index is historical mission setup, not current HEAD. The closure's “pending later readback” wording is retained as a limit, not silently upgraded. |
| Current-reality drift | Current master is the post-merge #435 tree. The M2-P4 evidence remains bounded to its mission and must not be used to claim a general accessibility, PostgreSQL, provider, teaching-effectiveness or release pass. |
| Non-proof | Browser and remote quality evidence are not Human Validation; local PostgreSQL blocking is not activation; `PASS_WITH_LIMITS` is not Production or automatic successor authority. |
| Source identity | `docs/governance/m2-p4-live-round-ops-governance-closure-20260821.md`; `docs/evidence/m2p4-live-round-ops-v5.18/M2P4_EVIDENCE_INDEX.md`; PR #434 merged at `fbda560081e880bc4a3daf185d3c8e57092ea18a`; governance closure merged through PR #435 at `3c101e5c4a4ed431c0b20f88ffc8ee52bb723636`. |
| Reopen trigger | Any change to canonical Decision admission, lock/settlement/publication, Student visibility, cross-team isolation, replay truth, provider/runtime authority or the source route composition. |

### Card D — W4 Enterprise State and strategic evolution

| Field | Reconciliation |
| --- | --- |
| Authority | Existing W4 Enterprise State service and Simulation Core state-transition path remain the state authority for their declared scope. |
| Successor | Later W4 product/closure records supersede earlier forward-planning pointers only within their stated scope; MOD/AGT is a consumer/proposal lane, not a W4 state writer. |
| Preserved | Existing W4 state transition, canonical decision admission, exact scope checks, replay/state boundary and JSON runtime default. |
| Retired | Earlier W4 task-card pointers are not current instructions when a later merged W4 closure or current source contradicts them; the historical records remain immutable. |
| Current-reality drift | W4 was advanced by multiple merged PRs before the current master anchor (#425, #429, #430, #431, #432, #433). A model/Agent task must re-read the current route and writer path rather than relying on a single older W4 document. |
| Non-proof | W4 closure/strategic evidence is not evidence of a model engine, Agent provider, teaching result, Pilot or Production state. |
| Source identity | `services/simulation-core/src/enterprise-state.ts`; `services/api/src/w4-enterprise-state.ts`; `packages/shared-contracts/src/w4-enterprise-state.ts`; `docs/governance/w4-enterprise-state-strategic-evolution-closure-20260820.md`. |
| Reopen trigger | Any new Enterprise State writer, state payload/settlement change, canonical admission change, cross-round effect change, or model/Agent output that attempts to mutate W4 state. |

### Card E — Attached MOD/AGT dual-track plan V1.0

| Field | Reconciliation |
| --- | --- |
| Authority | Forward planning contract for MOD/AGT task decomposition, gates, ownership boundaries and non-proofs. It is not current repository fact. |
| Successor | No successor is active. The plan itself requires one bounded task card at a time and `automatic_next_start=false`; a later approved plan must explicitly supersede this one. |
| Preserved | `ONE_KERNEL`, `ONE_TRUTH_ENGINE`, `ONE_SETTLEMENT_AUTHORITY`, `ONE_ENTERPRISE_STATE_AUTHORITY`, `ONE_MODEL_GOVERNANCE_PLANE`; exact refs/digests; provider-off; WANT/CAN/REALIZED separation; MOD and AGT lane separation; Join gates; explicit non-proof language. |
| Retired | None. The plan's implementation claims are not promoted, and no plan section is silently treated as a completed code or runtime artifact. |
| Current-reality drift | The plan names W5 chain context that has since advanced through #435 and includes routes that require fresh current-source filling. The plan's `CURRENT_FIRST_ACTION=MOD-00` is planning lineage; this candidate begins the next legal bounded MOD-03 reconciliation only after fresh current-source inspection. |
| Non-proof | The plan cannot prove code, tests, provider/data access, durable authority, Human Validation, Pilot, Production, or a merged successor. Its Vault metadata explicitly classifies it as `DESIGN_OR_REFERENCE_MATERIAL` and forbids `CURRENT_REPOSITORY_FACT`. |
| Source identity | Reference Vault source path `D:\DcodexSimWar-reference\SimWar开发\目标模式下大规模并行开发\攻坚——并行开发计划\模型\SimWar_模型智能双支线_BLP_理想点_系统动力_运营模型_Governed_Agent_行业小模型_多步骤开发与五线协同闭环计划_V1.0_20260820.docx`; SHA-256 above. |
| Reopen trigger | Owner-supplied successor, changed frozen law, changed execution ordering, changed provider/authority boundary, current source contradiction, or new exact task-card authorization. |

### Card F — AGT and frontend/role-safe companion planning inputs

| Field | Reconciliation |
| --- | --- |
| Authority | Planning and interface-boundary inputs only. Current runtime authority remains the existing API/shared-contract/core paths listed in the source snapshot. |
| Successor | AGT implementation may proceed only through a separate bounded task with exact contract, actor/tenant scope, schema validation, audit/replay input and advisory-only output. Frontend work may consume safe projections but cannot become a truth writer. |
| Preserved | Provider-off default; role/tenant safe projection; canonical Decision and settlement boundaries; output schema and model-call logging boundary where already present. |
| Retired | None; no companion plan is allowed to create a parallel provider, model registry, BFF, settlement or Enterprise State authority. |
| Current-reality drift | A plan or UI surface can be newer or more detailed than the current source without being implemented. Each AGT/FE claim needs fresh source, contract and test revalidation. |
| Non-proof | A `CoachOutput`, `ModelCallLog`, UI projection, browser screenshot or mock/fixed advisory output does not prove real model access, provider activation, durable authority or human validation. |
| Source identity | Current supporting contract `contracts/schemas/model-call-log.v1.json`, fixture `contracts/fixtures/model-call-log.valid.json`, and existing role-safe W5/M2-P4 source paths; no new AGT provider writer was established. |
| Reopen trigger | Provider activation request, new Agent route, model registry/version change, role/tenant boundary change, new durable store, or any attempt to write truth fields. |

### Card G — Historical Program/M/W5 plans and prior detached evidence

| Field | Reconciliation |
| --- | --- |
| Authority | `HISTORICAL_REFERENCE_ONLY` unless a future task records an exact source/SHA/PR rebind for the specific claim. |
| Successor | Current repository source plus the applicable current-forward governance baseline supersedes historical planning pointers for implementation decisions. |
| Preserved | Lineage, rationale, prior acceptance criteria, old limits and exact historical identities where useful for audit. |
| Retired | Historical “next action”, “current branch”, “latest” and implementation status are retired as live instructions once contradicted by current source or a newer approved baseline. |
| Current-reality drift | Detached worktrees, old prompt versions, screenshots and stale branch names may describe a state that no longer exists at current master. |
| Non-proof | Historical evidence does not prove current runtime, current tests, current authority, current PR status or current product capability. |
| Source identity | Any historical document/evidence not listed as a current-forward card above; each future use must carry its exact source identity and a bounded Historical Reference Receipt. |
| Reopen trigger | An exact unresolved question that cannot be answered from current source/contracts/tests, followed by a bounded read-only historical lookup and explicit rebind receipt. |

## 4. Supersession and lock decisions

| Decision | Result |
| --- | --- |
| W5-GOV-00 → W5 formal rebase delta | `SUCCESSOR_FOR_FORWARD_EVIDENCE_WITH_LIMITS`; predecessor retained immutable. |
| W5 formal rebase → current master | `REVALIDATE_AT_CURRENT_HEAD`; no automatic model-family promotion. |
| M2-P4 product/evidence → current master | `CURRENT_MERGED_SCOPE_WITH_LIMITS`; no expansion into a general release or model authority. |
| W4 closure family → current source | `CURRENT_SOURCE_AND_LANE_BASELINE`; exact route/writer re-read required before any dependent mutation. |
| Attached MOD/AGT plan → repository fact | `NOT_SUPERSEDED_TO_RUNTIME_FACT`; retained as forward plan only. |
| Historical plans → current execution | `HISTORICAL_REFERENCE_ONLY`; no stale “latest” instruction accepted. |
| New MOD/AGT writer | `NOT_AUTHORIZED / NOT_FOUND_IN_CURRENT_SOURCE_READBACK`. |
| Provider/model activation | `NOT_AUTHORIZED / NOT_PERFORMED`. |
| Automatic next task | `FALSE`. |
| Second writer or competing registry | `FORBIDDEN`. |

The register therefore releases no implementation lock for MOD-04 or later.
The next legal work item remains a separately described task card with exact
files, symbols, tests, and an explicit mutation allowlist after MOD-03 is
published and re-read as current authority.

## 5. MOD-DOC-AUTHORITY gate

| Gate | Decision | Evidence / limit |
| --- | --- | --- |
| Fresh current-source census | `PASS_WITH_LIMITS` | Current `origin/master`, source paths, contracts, tests, merged PR identities and governance records were re-read. |
| Document-by-document authority/successor mapping | `PASS_WITH_LIMITS` | Cards A–G preserve lineage, identify successors and enumerate drift/non-proof conditions. |
| Historical rewrite protection | `PASS` | No historical file, PR, merge commit or detached evidence was modified. |
| Silent-latest protection | `PASS` | Exact HEAD/PR/SHA identities are recorded; no implicit latest/current promotion is used. |
| Current-main publication | `NOT_PERFORMED` | This is a local candidate branch only; no push, PR, merge or current-master mutation was performed. |
| `MOD-DOC-AUTHORITY` overall | `CANDIDATE_PASS_WITH_LIMITS_LOCAL_ONLY` | The candidate is ready for reviewed publication, but is not itself the current forward authority. |

## 6. Explicit non-proofs and stop conditions

This candidate does not claim:

- implementation of BLP, Ideal Point, Lancaster, Huff, System Dynamics,
  workforce, marketing or finance model families beyond the exact current
  bounded source claims;
- real Shanghai data, calibration, external data access, model fit or causal
  validity;
- provider activation, real-model access, model deployment, durable model
  registry authority or production inference;
- Human Validation, teaching effectiveness, Pilot, Production, release
  approval, PostgreSQL/RLS activation or automatic successor creation;
- completion of MOD-00 through MOD-02, MOD-04 onward, AGT-00 onward, or any
  `INT-*` Join gate;
- a current code graph, because no `.codegraph` index was available in this
  worktree;
- permission to change settlement logic, `SettlementResult`, replay truth
  hash inputs, canonical/latest decision selection, Enterprise State writer
  topology, provider configuration or sensitive data.

Stop and reopen this register if a future source readback finds a conflicting
authority, a second writer, an unbound reference, a changed current master, a
new merged PR in the same scope, an owner-supplied successor plan, or an
attempt to treat a design/reference claim as implementation evidence.

## 7. Candidate handoff

The only deliverable of this MOD-03 candidate is this docs-only register. The
next task card, if separately authorized, must be filled from a fresh source
readback and must name one bounded objective, exact allowed files, forbidden
files, validation commands, evidence root, rollback path and stop conditions.

No code, schema, fixture, runtime, provider, database, frontend, PR, remote
branch or production state was changed by this candidate.
