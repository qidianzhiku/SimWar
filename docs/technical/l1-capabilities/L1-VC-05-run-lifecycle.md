# L1-VC-05 — Run Lifecycle：Create→Open→Decision→Lock→Settle→Publish

**Card Version:** `1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Ledger:** `L1-LEDGER-005`<br>
**L1 DoD:** `L1-DOD-012—017`<br>
**Platform Gate:** `P-G3/P-G5`<br>
**Current Status:** `IMPLEMENTED_NOT_VERIFIED`<br>
**Risk Tier:** `T3`<br>
**Parallel Classification:** `SERIAL_REQUIRED`

## 1. Product and Operator Value

形成一轮可重复、失败可解释、非法转换被拒绝的教学运行闭环。

## 2. Stable Technical Contract

- **Primary Outcome type:** one recognizable L1 capability state transition.
- **Entry condition:** current master and graph manifest remain at `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2` or are revalidated.
- **Sole writer:** Run/Round command path and settlement outcome port.
- **Resource locks:** Run lifecycle, Settlement, Run/Replay/Golden.
- **Blocks L1:** `false`.
- **Gap classification:** `L1_EVIDENCE_GAP`.

## 3. Current Source Map

- `services/api/src/server.ts`
- `services/api/src/synthetic-run-lifecycle.ts`
- `services/api/src/repository-facade.ts`
- `tests/integration/round-lock-publish-characterization.test.ts`
- `tests/integration/settlement-write-replay-hash-characterization.test.ts`

## 4. Entry Symbols and Interfaces

- `routeRequest`
- `lockRoundWithRunLock`
- `runSettlement`
- `publishRoundWithRunLock`
- `acquireRunMutationLock`

## 5. Required Validation

### Focused / Affected

- `round-lock-publish-characterization.test.ts`
- `settlement-write-replay-hash-characterization.test.ts`

### Closure

- `default formal Run full lifecycle receipt`

### Negative Matrix

- invalid transition
- repeat settle
- concurrent mutation
- publish before settle

## 6. Current Gaps

- B01 must prove full default-server chain

## 7. Graphify / CodeGraph Query Contract

**Graphify intent:** map module ownership, file overlap, resource locks, upstream/downstream capability impact, and candidate path alternatives.<br>
**CodeGraph intent:** trace exact definitions, callers, callees, imports, mutations, handlers, repository calls and test references for the listed entry symbols.<br>
**Required output:** exact source paths, exact symbols, affected tests, writer conclusion, collision report and confidence.<br>
**Stop condition:** graph source SHA differs from current master, writer is ambiguous, or a second Authority path appears.

## 8. Mission Compiler Interface

```yaml
capability_id: {c['id']}
ledger_id: {c['ledger_id']}
dod_reference: "{c['dod']}"
current_state: {c['status']}
target_state: CLOSED_AND_CURRENT
primary_outcome: "One bounded {c['name']} state transition"
sole_writer: "{c['writer']}"
risk_tier: "{c['risk']}"
parallel_classification: {c['parallel']}
resource_locks:
  - "Run lifecycle"
  - "Settlement"
  - "Run/Replay/Golden"
automatic_next_start: false
```

## 9. Explicit Non-Proofs

- characterization tests不等于current master post-merge evidence
- This card is a technical execution contract, not a current Mission authorization.
- Static graph presence is not runtime, CI, browser, fresh-clone or post-merge proof.

## 10. Invalidation

This card requires revalidation when master, graph manifest, Authority, shared contracts, runtime provider, listed source modules, tests or Known Limits change.
