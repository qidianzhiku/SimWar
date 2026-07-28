# L1-VC-10 — Official Replay与Evidence Non-Overwrite

**Card Version:** `1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Ledger:** `L1-LEDGER-010`<br>
**L1 DoD:** `L1-DOD-031—033`<br>
**Platform Gate:** `P-G4`<br>
**Current Status:** `IMPLEMENTED_NOT_VERIFIED`<br>
**Risk Tier:** `T3`<br>
**Parallel Classification:** `SERIAL_REQUIRED`

## 1. Product and Operator Value

用冻结输入重建并比较结果，同时保证Replay不覆盖official result。

## 2. Stable Technical Contract

- **Primary Outcome type:** one recognizable L1 capability state transition.
- **Entry condition:** current master and graph manifest remain at `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2` or are revalidated.
- **Sole writer:** Replay evidence/report writer; no writer authority over official SettlementResult.
- **Resource locks:** Run/Replay/Golden.
- **Blocks L1:** `false`.
- **Gap classification:** `L1_EVIDENCE_GAP`.

## 3. Current Source Map

- `services/api/src/run-manifest-replay-evidence.ts`
- `services/api/src/formal-runtime-input-resolver.ts`
- `services/api/src/repository-facade.ts`
- `contracts/json-schema/m1-public-replay-evidence.v1.json`
- `tests/integration/m1-run-manifest-replay-evidence.test.ts`

## 4. Entry Symbols and Interfaces

- `createM1RunReplayEvidence`
- `createM1CanonicalEvidenceDigest`
- `selectM1RunReplayEvidenceGolden`
- `toPublicEvidence`
- `resolveFormalRuntimeInputsForHistoricalRead`

## 5. Required Validation

### Focused / Affected

- `m1-run-manifest-replay-evidence.test.ts`
- `formal-run-runtime-binding-activation.test.ts`
- `settlement-write-replay-hash-characterization.test.ts`

### Closure

- `B01 full chain private/public replay evidence and historical non-overwrite`

### Negative Matrix

- replay writes formal results
- provider calls during official replay
- private manifest in student projection

## 6. Current Gaps

- B01 same default server proof

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
  - "Run/Replay/Golden"
automatic_next_start: false
```

## 9. Explicit Non-Proofs

- Replay不等于Recovery或backup/restore
- This card is a technical execution contract, not a current Mission authorization.
- Static graph presence is not runtime, CI, browser, fresh-clone or post-merge proof.

## 10. Invalidation

This card requires revalidation when master, graph manifest, Authority, shared contracts, runtime provider, listed source modules, tests or Known Limits change.
