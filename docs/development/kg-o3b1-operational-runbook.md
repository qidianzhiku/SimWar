# KG-O3B1 shift-left runbook

KG-O3B1 keeps Graph Companion, CodeGraph, and Graphify as one derived engineering
evidence capability. It adds a per-question contract and a seam-local risk router;
it does not add a controller, runtime store, provider, or product authority.

## Route by risk

- G0 documentation, copy, and non-authority visual work: `SOURCE_ONLY`.
- G1 local module logic: source first, CodeGraph optional or first.
- G2 BFF, schema, OpenAPI, freshness, or consumer paths: CodeGraph plus mandatory source readback.
- G3 writer, permission, settlement, truth, or cross-cell seams: CodeGraph required, Graphify when applicable, and mandatory source readback.

Tool failure is scoped to the requested seam. A G3 hold must not freeze an
unrelated G0/G1 question.

## Evidence discipline

Use exact path/symbol/route/schema seeds. Record `execution_status`, `relevance`,
`coverage`, and `question_admission` independently. `PASS` with no relevance or
truncation is still command success and becomes `SOURCE_FALLBACK`; it is not a
synthetic command failure. Historical receipts must match the current target SHA.
For G2/G3, `READY` additionally requires a positively admitted CodeGraph
observation (`codegraph_admitted` or a qualified PASS/relevance/coverage receipt);
installation or availability alone never counts as graph evidence.

The contract/provenance overlay records source and contract anchors for review
leads. Source, contract, and tests remain the decision authority. The compact
`SIMWAR_GRAPH_SUPPORT_ENVELOPE_V1_1` is the common envelope for MAIN, SH, MOD,
AGT, and FE lanes and must not contain raw graph dumps.

## Verification

Run the focused Graph Companion tests before the affected suite:

```text
npx vitest run tests/unit/graph-companion.test.ts tests/unit/graph-o3b1.test.ts
```

Keep first failures, exact target SHA/tree, and any unavailable MCP or graph
observations in the external evidence package. Do not infer value from node or
edge counts, and do not report statistical significance from a small blind sample.
