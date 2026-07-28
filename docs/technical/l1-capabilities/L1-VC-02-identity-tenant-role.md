# L1-VC-02 — Identity、RBAC、Tenant、Course与Team隔离

**Card Version:** `1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Ledger:** `L1-LEDGER-002`<br>
**L1 DoD:** `L1-DOD-007—011`<br>
**Platform Gate:** `P-G2`<br>
**Current Status:** `BLOCKED`<br>
**Risk Tier:** `T3`<br>
**Parallel Classification:** `SERIAL_REQUIRED`

## 1. Product and Operator Value

确保Teacher、Student、Tenant Admin、Platform Admin只读取和操作其授权tenant/course/team范围。

## 2. Stable Technical Contract

- **Primary Outcome type:** one recognizable L1 capability state transition.
- **Entry condition:** current master and graph manifest remain at `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2` or are revalidated.
- **Sole writer:** Identity/RBAC policy and API authorization guards.
- **Resource locks:** Teacher/Student projection, tenant/course visibility.
- **Blocks L1:** `true`.
- **Gap classification:** `L1_BLOCKER`.

## 3. Current Source Map

- `services/api/src/server.ts`
- `services/api/src/auth.ts`
- `packages/shared-contracts/src/index.ts`
- `contracts/json-schema/rbac.v1.json`
- `contracts/json-schema/tenant.v1.json`
- `tests/integration/p1-auth-rbac.test.ts`
- `tests/integration/decision-submit-characterization.test.ts`

## 4. Entry Symbols and Interfaces

- `createContext`
- `requireActor`
- `requirePermission`
- `canReadClassroomScope`
- `isActorMemberOfTeam`
- `getCourseForRead`

## 5. Required Validation

### Focused / Affected

- `tests/integration/p1-auth-rbac.test.ts`
- `tests/integration/decision-submit-characterization.test.ts`

### Closure

- `cross-course API/BFF/browser/log/export negative matrix`

### Negative Matrix

- wrong tenant
- wrong course
- wrong team
- client-controlled tenant override
- student private fields

## 6. Current Gaps

- L1-GAP-B02 course membership visibility
- Issue #112 remains open

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
  - "Teacher/Student projection"
  - "tenant/course visibility"
automatic_next_start: false
```

## 9. Explicit Non-Proofs

- RBAC schema和登录成功不证明跨course负向隔离闭环
- This card is a technical execution contract, not a current Mission authorization.
- Static graph presence is not runtime, CI, browser, fresh-clone or post-merge proof.

## 10. Invalidation

This card requires revalidation when master, graph manifest, Authority, shared contracts, runtime provider, listed source modules, tests or Known Limits change.
