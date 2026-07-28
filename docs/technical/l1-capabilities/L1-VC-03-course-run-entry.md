# L1-VC-03 — Synthetic Course与Run Entry

**Card Version:** `1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Ledger:** `L1-LEDGER-003`<br>
**L1 DoD:** `L1-DOD-012—013`<br>
**Platform Gate:** `P-G1/P-G3`<br>
**Current Status:** `IMPLEMENTED_NOT_VERIFIED`<br>
**Risk Tier:** `T3`<br>
**Parallel Classification:** `SERIAL_REQUIRED`

## 1. Product and Operator Value

让教师从合成课程进入可控Run并冻结正式输入引用。

## 2. Stable Technical Contract

- **Primary Outcome type:** one recognizable L1 capability state transition.
- **Entry condition:** current master and graph manifest remain at `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2` or are revalidated.
- **Sole writer:** Course binding store for formal course configuration; Run writer for Run creation.
- **Resource locks:** Course formal authority binding, Run entry.
- **Blocks L1:** `false`.
- **Gap classification:** `L1_EVIDENCE_GAP`.

## 3. Current Source Map

- `services/api/src/server.ts`
- `services/api/src/formal-course-authority-binding.ts`
- `services/api/src/formal-course-authority-binding-store.ts`
- `contracts/openapi/p0-api.openapi.yaml`
- `tests/integration/formal-run-runtime-binding-activation.test.ts`

## 4. Entry Symbols and Interfaces

- `CourseCreateBody`
- `FormalCourseAuthorityBindingBody`
- `createFormalCourseAuthorityBinding`
- `FormalCourseAuthorityBindingStore.append`
- `parseFormalRunCreateBody`

## 5. Required Validation

### Focused / Affected

- `formal Course binding integration tests`
- `formal Run creation tests`

### Closure

- `current-SHA default server Course→Run entry receipt`

### Negative Matrix

- client override of frozen course references
- missing seed
- unapproved exact references

## 6. Current Gaps

- current capability requires integration into B01 full Golden receipt

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
  - "Course formal authority binding"
  - "Run entry"
automatic_next_start: false
```

## 9. Explicit Non-Proofs

- Course binding存在不证明后续Decision/Settlement/Replay完成
- This card is a technical execution contract, not a current Mission authorization.
- Static graph presence is not runtime, CI, browser, fresh-clone or post-merge proof.

## 10. Invalidation

This card requires revalidation when master, graph manifest, Authority, shared contracts, runtime provider, listed source modules, tests or Known Limits change.
