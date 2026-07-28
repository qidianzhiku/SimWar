# L1-VC-06 — Student Whole-Team Decision Flow

**Card Version:** `1.0`<br>
**Repository:** `qidianzhiku/SimWar`<br>
**Source SHA:** `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2`<br>
**Ledger:** `L1-LEDGER-006`<br>
**L1 DoD:** `L1-DOD-018—020`<br>
**Platform Gate:** `P-G2/P-G3`<br>
**Current Status:** `PARTIALLY_IMPLEMENTED`<br>
**Risk Tier:** `T3`<br>
**Parallel Classification:** `CONDITIONALLY_PARALLEL`

## 1. Product and Operator Value

让学生在team/course/round范围内提交唯一canonical whole-team decision。

## 2. Stable Technical Contract

- **Primary Outcome type:** one recognizable L1 capability state transition.
- **Entry condition:** current master and graph manifest remain at `a296f9032cf1d7fc921fa837d57e5c33e3cc4de2` or are revalidated.
- **Sole writer:** Decision command repository port / canonical decision writer.
- **Resource locks:** Decision lifecycle, Student BFF projection.
- **Blocks L1:** `false`.
- **Gap classification:** `L1_EVIDENCE_GAP`.

## 3. Current Source Map

- `services/api/src/server.ts`
- `packages/shared-contracts/src/index.ts`
- `contracts/json-schema/decision*.json`
- `tests/integration/decision-submit-characterization.test.ts`
- `tests/contract/decision-payload-contract-validation.test.ts`

## 4. Entry Symbols and Interfaces

- `DecisionSubmitBody`
- `submitDecisionWithRunLock`
- `findIdempotentDecisionSubmission`
- `serializeDecisionPayloadForIdempotency`
- `saveCanonicalDecision`

## 5. Required Validation

### Focused / Affected

- `decision-submit-characterization.test.ts`
- `decision-payload-contract-validation.test.ts`

### Closure

- `wrong-team/wrong-course/late/duplicate matrix in default formal Run`

### Negative Matrix

- wrong team
- wrong tenant/course
- late submit
- duplicate payload conflict
- private field injection

## 6. Current Gaps

- B02 visibility completion impacts safe decision scope

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
  - "Decision lifecycle"
  - "Student BFF projection"
automatic_next_start: false
```

## 9. Explicit Non-Proofs

- 角色工作流扩展属于L1+，不作为L1 blocker
- This card is a technical execution contract, not a current Mission authorization.
- Static graph presence is not runtime, CI, browser, fresh-clone or post-merge proof.

## 10. Invalidation

This card requires revalidation when master, graph manifest, Authority, shared contracts, runtime provider, listed source modules, tests or Known Limits change.
