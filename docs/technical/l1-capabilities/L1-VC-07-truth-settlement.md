# L1-VC-07 — Truth-L1—L3与L1范围Settlement

**Card Version:** `1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Ledger:** `L1-LEDGER-007`<br>
**L1 DoD:** `L1-DOD-021、023—024`<br>
**Platform Gate:** `P-G1/P-G3/P-G5`<br>
**Current Status:** `IMPLEMENTED_NOT_VERIFIED`<br>
**Risk Tier:** `T4_IF_FORMULA_OR_AUTHORITY_CHANGE_ELSE_T3_EVIDENCE`<br>
**Parallel Classification:** `SERIAL_REQUIRED`

## 1. Product and Operator Value

确保市场、运营、财务和评分真值只由Kernel/Settlement正式writer产生，且一轮只有一个正式结果。

## 2. Stable Technical Contract

- **Primary Outcome type:** one recognizable L1 capability state transition.
- **Entry condition:** current master and graph manifest remain at `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2` or are revalidated.
- **Sole writer:** Simulation Core L1–L3 and atomic SettlementOutcomePersistencePort.
- **Resource locks:** Simulation Core Truth, Settlement, Score/Rank.
- **Blocks L1:** `false`.
- **Gap classification:** `L1_EVIDENCE_GAP`.

## 3. Current Source Map

- `services/simulation-core/src/simulation.ts`
- `services/simulation-core/src/market.ts`
- `services/simulation-core/src/operations.ts`
- `services/simulation-core/src/finance.ts`
- `services/simulation-core/src/scoring.ts`
- `services/api/src/repository-facade.ts`
- `services/api/src/repository-ports.ts`

## 4. Entry Symbols and Interfaces

- `prepareSettlementOutcome`
- `calculateSettlement`
- `calculateMarketDemand`
- `calculateOperations`
- `calculateFinance`
- `calculateScore`
- `commitSettlementOutcome`

## 5. Required Validation

### Focused / Affected

- `simulation-core.test.ts`
- `settlement-outcome-persistence-port.test.ts`
- `tenant-settlement-identity-matrix.test.ts`

### Closure

- `formal binding default chain settles once and persists one result`

### Negative Matrix

- AI/plugin/frontend direct Truth write
- duplicate settlement
- tenant collision
- replay overwrite

## 6. Current Gaps

- B01 evidence; Issue #111 remains high-risk current issue

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
  - "Simulation Core Truth"
  - "Settlement"
  - "Score/Rank"
automatic_next_start: false
```

## 9. Explicit Non-Proofs

- PostgreSQL adapters and replay harness do not prove PostgreSQL active authority
- This card is a technical execution contract, not a current Mission authorization.
- Static graph presence is not runtime, CI, browser, fresh-clone or post-merge proof.

## 10. Invalidation

This card requires revalidation when master, graph manifest, Authority, shared contracts, runtime provider, listed source modules, tests or Known Limits change.
