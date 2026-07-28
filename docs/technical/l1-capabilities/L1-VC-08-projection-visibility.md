# L1-VC-08 — Publish与Teacher/Student/Admin安全Projection

**Card Version:** `1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Ledger:** `L1-LEDGER-008`<br>
**L1 DoD:** `L1-DOD-025—027`<br>
**Platform Gate:** `P-G2/P-G3`<br>
**Current Status:** `BLOCKED`<br>
**Risk Tier:** `T2/T3`<br>
**Parallel Classification:** `SERIAL_REQUIRED`

## 1. Product and Operator Value

在不泄露state_true和私有Evidence的前提下向不同persona发布可用结果。

## 2. Stable Technical Contract

- **Primary Outcome type:** one recognizable L1 capability state transition.
- **Entry condition:** current master and graph manifest remain at `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2` or are revalidated.
- **Sole writer:** Projection builders are read-only; Settlement remains formal result writer.
- **Resource locks:** Teacher/Student projection, Public contract.
- **Blocks L1:** `true`.
- **Gap classification:** `L1_BLOCKER`.

## 3. Current Source Map

- `services/api/src/server.ts`
- `services/api/src/teacher-student-bff-dto.ts`
- `packages/shared-contracts/src/index.ts`
- `contracts/json-schema/m1-student-result-envelope.v1.json`
- `contracts/json-schema/m1-teacher-admin-result-envelope.v1.json`
- `tests/integration/teacher-student-bff-dto-productization.test.ts`

## 4. Entry Symbols and Interfaces

- `createPublicResultView`
- `createPublicReplayEvidenceView`
- `createTeacherBffWorkspaceDto`
- `createStudentBffCockpitDto`
- `STUDENT_BFF_FORBIDDEN_FIELDS`

## 5. Required Validation

### Focused / Affected

- `teacher-student-bff-dto-productization.test.ts`
- `r3-runtime-boundary.test.ts`
- `teacher-student-frontend-bff-dto-consumption.spec.ts`

### Closure

- `course/tenant negative projection matrix and executable contract parity`

### Negative Matrix

- state_true
- binding_digest
- formal_resolution_digest
- decision_batch_hash
- private Manifest

## 6. Current Gaps

- L1-GAP-B02 course membership visibility
- L1-GAP-B04 executable contract parity

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
  - "Public contract"
automatic_next_start: false
```

## 9. Explicit Non-Proofs

- DTO过滤测试不证明log/export/error全部安全
- This card is a technical execution contract, not a current Mission authorization.
- Static graph presence is not runtime, CI, browser, fresh-clone or post-merge proof.

## 10. Invalidation

This card requires revalidation when master, graph manifest, Authority, shared contracts, runtime provider, listed source modules, tests or Known Limits change.
