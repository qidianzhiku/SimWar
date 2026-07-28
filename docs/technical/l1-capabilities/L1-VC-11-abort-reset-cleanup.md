# L1-VC-11 — Abort、Reset、Cleanup与Failure Matrix

**Card Version:** `1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Ledger:** `L1-LEDGER-011`<br>
**L1 DoD:** `L1-DOD-034—037`<br>
**Platform Gate:** `P-G5`<br>
**Current Status:** `IMPLEMENTED_NOT_VERIFIED`<br>
**Risk Tier:** `T3`<br>
**Parallel Classification:** `SERIAL_REQUIRED`

## 1. Product and Operator Value

失败后可受控终止、重置、清理并再次进入Golden执行，无残留污染。

## 2. Stable Technical Contract

- **Primary Outcome type:** one recognizable L1 capability state transition.
- **Entry condition:** current master and graph manifest remain at `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2` or are revalidated.
- **Sole writer:** Synthetic lifecycle service within JSON_INTERNAL_ONLY L1 scope.
- **Resource locks:** Run lifecycle, Run/Replay/Golden.
- **Blocks L1:** `false`.
- **Gap classification:** `L1_EVIDENCE_GAP`.

## 3. Current Source Map

- `services/api/src/synthetic-run-lifecycle.ts`
- `services/api/src/server.ts`
- `tests/integration/l1-session-abort-reset-recovery.test.ts`
- `tests/integration/synthetic-run-lifecycle-controls.test.ts`
- `tests/e2e-ui/zzz-synthetic-run-lifecycle-controls.spec.ts`

## 4. Entry Symbols and Interfaces

- `executeSyntheticRunLifecycleOperation`
- `listSyntheticRunLifecycleControls`
- `RESET_EPHEMERAL_ALLOWLIST`
- `allowedOperations`
- `blockedReasons`

## 5. Required Validation

### Focused / Affected

- `l1-session-abort-reset-recovery.test.ts`
- `synthetic-run-lifecycle-controls.test.ts`

### Closure

- `failure injection matrix and zero-residue receipt after B01`

### Negative Matrix

- formal authority mutation
- official result overwrite
- cross-tenant lifecycle control

## 6. Current Gaps

- L1-GAP-E04 current failure matrix and zero-residue evidence

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
  - "Run/Replay/Golden"
automatic_next_start: false
```

## 9. Explicit Non-Proofs

- L1 cleanup不证明durable recovery、backup或restore
- This card is a technical execution contract, not a current Mission authorization.
- Static graph presence is not runtime, CI, browser, fresh-clone or post-merge proof.

## 10. Invalidation

This card requires revalidation when master, graph manifest, Authority, shared contracts, runtime provider, listed source modules, tests or Known Limits change.
