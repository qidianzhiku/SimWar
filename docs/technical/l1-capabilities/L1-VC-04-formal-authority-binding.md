# L1-VC-04 — Formal Authority Lifecycle与Exact Run Binding

**Card Version:** `1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Ledger:** `L1-LEDGER-004`<br>
**L1 DoD:** `L1-DOD-021—022、029`<br>
**Platform Gate:** `P-G1/P-G3`<br>
**Current Status:** `PARTIALLY_IMPLEMENTED`<br>
**Risk Tier:** `T3`<br>
**Parallel Classification:** `SERIAL_REQUIRED`

## 1. Product and Operator Value

以exact identity冻结ParameterSet、ScenarioPackage、PluginRelease和Run输入，禁止latest与silent fallback。

## 2. Stable Technical Contract

- **Primary Outcome type:** one recognizable L1 capability state transition.
- **Entry condition:** current master and graph manifest remain at `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2` or are revalidated.
- **Sole writer:** Formal command services and append-only binding stores.
- **Resource locks:** ParameterSet Authority, ScenarioPackage Authority, PluginRelease Authority, Formal Run Binding, Run/Replay/Golden.
- **Blocks L1:** `true`.
- **Gap classification:** `L1_BLOCKER`.

## 3. Current Source Map

- `services/api/src/parameter-set-authority.ts`
- `services/api/src/scenario-package-authority.ts`
- `services/api/src/plugin-release-authority.ts`
- `services/api/src/formal-run-runtime-binding.ts`
- `services/api/src/formal-run-runtime-binding-store.ts`
- `services/api/src/formal-runtime-input-resolver.ts`
- `services/api/src/server.ts`

## 4. Entry Symbols and Interfaces

- `ParameterSetCommandService`
- `ScenarioPackageCommandService`
- `PluginReleaseCommandService`
- `createFormalRunRuntimeBinding`
- `FormalRunRuntimeBindingStore.append`
- `resolveFormalRuntimeInputsForActiveRun`

## 5. Required Validation

### Focused / Affected

- `formal-parameter-set-lifecycle-endpoint.test.ts`
- `formal-scenario-package-lifecycle-endpoint.test.ts`
- `formal-plugin-release-lifecycle-endpoint.test.ts`
- `formal-run-runtime-binding-activation.test.ts`

### Closure

- `same default server HTTP lifecycle→Course binding→Run→Publish→Replay`

### Negative Matrix

- missing exact reference
- digest mismatch
- retired/unavailable authority
- legacy fallback
- client override

## 6. Current Gaps

- L1-GAP-B01 default persisted authority full Golden chain

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
  - "ParameterSet Authority"
  - "ScenarioPackage Authority"
  - "PluginRelease Authority"
  - "Formal Run Binding"
  - "Run/Replay/Golden"
automatic_next_start: false
```

## 9. Explicit Non-Proofs

- 分离测试不证明同一默认server完整链
- This card is a technical execution contract, not a current Mission authorization.
- Static graph presence is not runtime, CI, browser, fresh-clone or post-merge proof.

## 10. Invalidation

This card requires revalidation when master, graph manifest, Authority, shared contracts, runtime provider, listed source modules, tests or Known Limits change.
