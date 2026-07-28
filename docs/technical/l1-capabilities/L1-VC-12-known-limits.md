# L1-VC-12 — Known Limits与阶段声明边界

**Card Version:** `1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Ledger:** `L1-LEDGER-012`<br>
**L1 DoD:** `L1-DOD-038—040`<br>
**Platform Gate:** `P-G8 boundary`<br>
**Current Status:** `IMPLEMENTED_NOT_VERIFIED`<br>
**Risk Tier:** `T0/T3`<br>
**Parallel Classification:** `PARALLEL_ELIGIBLE`

## 1. Product and Operator Value

让用户明确L1是JSON内部自动化验证，不误认为Pilot或Production。

## 2. Stable Technical Contract

- **Primary Outcome type:** one recognizable L1 capability state transition.
- **Entry condition:** current master and graph manifest remain at `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2` or are revalidated.
- **Sole writer:** Known Limits policy owner.
- **Resource locks:** Known Limits policy.
- **Blocks L1:** `false`.
- **Gap classification:** `L1_KNOWN_LIMIT`.

## 3. Current Source Map

- `services/api/src/known-limits.ts`
- `apps/teacher/src/App.tsx`
- `apps/student/src/App.tsx`
- `apps/admin/src/App.tsx`
- `tests/e2e-ui/known-limits-product-disclosure.spec.ts`

## 4. Entry Symbols and Interfaces

- `KNOWN_LIMITS_CATALOG`
- `getKnownLimitsProjection`
- `KNOWN_LIMITS_POLICY_VERSION`

## 5. Required Validation

### Focused / Affected

- `known-limits-product-disclosure.test.ts`
- `known-limits-product-disclosure.spec.ts`

### Closure

- `all persona product disclosure on current master`

### Negative Matrix

- production/Pilot/durable/PG-active claim

## 6. Current Gaps

- current-master browser disclosure receipt needed

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
  - "Known Limits policy"
automatic_next_start: false
```

## 9. Explicit Non-Proofs

- Known Limits存在不证明L1其他能力通过
- This card is a technical execution contract, not a current Mission authorization.
- Static graph presence is not runtime, CI, browser, fresh-clone or post-merge proof.

## 10. Invalidation

This card requires revalidation when master, graph manifest, Authority, shared contracts, runtime provider, listed source modules, tests or Known Limits change.
