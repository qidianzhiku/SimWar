# L1-VC-09 — Three-Part Feedback与Learning Report最小闭环

**Card Version:** `1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Ledger:** `L1-LEDGER-009`<br>
**L1 DoD:** `Persona Acceptance / L1 product chain`<br>
**Platform Gate:** `P-G3`<br>
**Current Status:** `IMPLEMENTED_NOT_VERIFIED`<br>
**Risk Tier:** `T3`<br>
**Parallel Classification:** `CONDITIONALLY_PARALLEL`

## 1. Product and Operator Value

在published result之后生成学习反馈，但不得覆盖业务结果或Truth。

## 2. Stable Technical Contract

- **Primary Outcome type:** one recognizable L1 capability state transition.
- **Entry condition:** current master and graph manifest remain at `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2` or are revalidated.
- **Sole writer:** Learning evidence writer; read-only consumer of official result.
- **Resource locks:** Learning Evidence, Student projection.
- **Blocks L1:** `false`.
- **Gap classification:** `L1_EVIDENCE_GAP`.

## 3. Current Source Map

- `services/api/src/course-delivery-productization.ts`
- `services/api/src/course-runtime-v3.ts`
- `services/api/src/teacher-student-bff-dto.ts`
- `packages/shared-contracts/src/index.ts`
- `tests/integration/r5-r6-course-delivery-learning-evidence.test.ts`

## 4. Entry Symbols and Interfaces

- `buildCourseDeliveryThreePartFeedbackV1`
- `createCourseDeliveryLearningEvidenceLedgerV1`
- `LearningReportDTO`
- `ThreePartFeedbackDTO`

## 5. Required Validation

### Focused / Affected

- `course-delivery-productization.test.ts`
- `r5-r6-course-delivery-learning-evidence.test.ts`

### Closure

- `default formal Golden chain published result→feedback/report readback`

### Negative Matrix

- learning output overwrites Settlement/Score/Rank
- student private evidence leak

## 6. Current Gaps

- current-SHA full product journey proof missing

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
  - "Learning Evidence"
  - "Student projection"
automatic_next_start: false
```

## 9. Explicit Non-Proofs

- 完整Goal/Rubric/AoL属于L1+
- This card is a technical execution contract, not a current Mission authorization.
- Static graph presence is not runtime, CI, browser, fresh-clone or post-merge proof.

## 10. Invalidation

This card requires revalidation when master, graph manifest, Authority, shared contracts, runtime provider, listed source modules, tests or Known Limits change.
