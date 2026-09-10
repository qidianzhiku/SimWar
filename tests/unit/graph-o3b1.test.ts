import { describe, expect, it } from "vitest";
import {
  normalizeQueryObservationV21,
  routeGraphSupportQuestion,
  evaluateContractProvenanceOverlay,
  buildGraphSupportEnvelopeV11,
  compareBlindInvestigationCells,
  buildQuestionReceipt,
  normalizeQueryEvidenceForAdmission
} from "../../scripts/graph-companion.mjs";

const TARGET = "a".repeat(40);
const TARGET_TREE = "b".repeat(40);

describe("KG-O3B1 Query Contract V2.1", () => {
  it("keeps command success separate from admission when relevance is absent", () => {
    const value = normalizeQueryObservationV21({
      command_ok: true,
      relevance: "NO_RELEVANCE",
      coverage: "COMPLETE"
    });
    expect(value).toMatchObject({
      execution_status: "PASS",
      relevance: "NO_RELEVANCE",
      question_admission: "SOURCE_FALLBACK",
      exit_code: 0
    });
  });

  it("keeps command success separate from admission when output is truncated", () => {
    const value = normalizeQueryObservationV21({
      command_ok: true,
      relevance: "RELEVANT",
      coverage: "OUTPUT_TRUNCATED"
    });
    expect(value).toMatchObject({
      execution_status: "PASS",
      coverage: "OUTPUT_TRUNCATED",
      question_admission: "SOURCE_FALLBACK",
      exit_code: 0
    });
  });

  it("routes a G3 seam to a local hold when source authority remains unresolved", () => {
    const route = routeGraphSupportQuestion({
      question_id: "V21-004",
      risk_class: "G3",
      source_readback_resolved: false,
      codegraph_available: false,
      graphify_applicable: true
    });
    expect(route.question_admission).toBe("HOLD_THIS_SEAM");
    expect(route.codegraph_route).toBe("REQUIRED");
    expect(route.source_readback_required).toBe(true);
  });

  it("does not globally hold an unrelated G0 seam when tools are unavailable", () => {
    const route = routeGraphSupportQuestion({
      question_id: "V21-005",
      risk_class: "G0",
      source_readback_resolved: true,
      codegraph_available: false,
      graphify_applicable: false
    });
    expect(route.question_admission).toBe("READY");
    expect(route.codegraph_route).toBe("NOT_NEEDED");
    expect(route.graphify_route).toBe("NOT_NEEDED");
  });

  it("maps a failed command to FAIL while retaining a seam-local fallback", () => {
    const value = normalizeQueryObservationV21({
      command_ok: false,
      risk_class: "G2",
      source_readback_resolved: true
    });
    expect(value).toMatchObject({
      execution_status: "FAIL",
      exit_code: 1,
      question_admission: "SOURCE_FALLBACK"
    });
  });

  it("never admits a failed NOT_APPLICABLE required observation", () => {
    const value = normalizeQueryObservationV21({
      command_ok: false,
      relevance: "NOT_APPLICABLE",
      coverage: "NOT_APPLICABLE",
      risk_class: "G3",
      source_readback_resolved: true
    });
    expect(value).toMatchObject({
      execution_status: "FAIL",
      question_admission: "SOURCE_FALLBACK"
    });
  });

  it("requires an observed CodeGraph result before admitting G2/G3", () => {
    const route = routeGraphSupportQuestion({
      risk_class: "G2",
      source_readback_resolved: true,
      codegraph_available: true,
      codegraph_observed: false,
      graphify_applicable: false
    });
    expect(route.question_admission).toBe("SOURCE_FALLBACK");
  });

  it("does not treat an unqualified observation flag as CodeGraph admission", () => {
    const route = routeGraphSupportQuestion({
      risk_class: "G3",
      source_readback_resolved: true,
      codegraph_available: true,
      codegraph_observed: true
    });
    expect(route.codegraph_admitted).toBe(false);
    expect(route.question_admission).toBe("SOURCE_FALLBACK");
  });

  it("treats non-applicable Graphify as neutral when CodeGraph and source are ready", () => {
    const route = routeGraphSupportQuestion({
      risk_class: "G2",
      source_readback_resolved: true,
      codegraph_available: true,
      codegraph_observed: true,
      codegraph_execution_status: "PASS",
      codegraph_relevance: "RELEVANT",
      codegraph_coverage: "COMPLETE",
      target_sha: TARGET,
      codegraph_target_sha: TARGET,
      target_tree: TARGET_TREE,
      codegraph_target_tree: TARGET_TREE,
      graphify_applicable: false
    });
    expect(route.question_admission).toBe("READY");
    expect(route.graphify_route).toBe("NOT_APPLICABLE");
  });

  it("treats an applicable-unavailable graph as NOT_APPLICABLE, not a failure", () => {
    const value = normalizeQueryObservationV21({
      command_ok: true,
      relevance: "NOT_APPLICABLE",
      coverage: "NOT_APPLICABLE",
      risk_class: "G0",
      source_readback_resolved: true
    });
    expect(value).toMatchObject({
      execution_status: "PASS",
      relevance: "NOT_APPLICABLE",
      coverage: "NOT_APPLICABLE",
      question_admission: "READY"
    });
  });

  it("rejects a historical receipt when its target SHA differs", () => {
    const contract = {
      question_id: "V21-006",
      risk_class: "G2",
      target_sha: TARGET,
      canonical_seam: "services/api/src/routes/example.ts",
      decision_before: "unknown",
      decision_needed: "confirm consumer",
      seed_paths: ["services/api/src/routes/example.ts"],
      seed_symbols: ["createExample"],
      seed_routes: ["POST /examples"],
      seed_schemas: ["Example"],
      expected_edge_types: ["CALLS"],
      mandatory_source_readback: ["services/api/src/routes/example.ts"],
      mandatory_tests: ["tests/unit/example.test.ts"]
    };
    const receipt = buildQuestionReceipt({
      contract,
      graphify: {
        command_ok: true,
        relevance: "RELEVANT",
        coverage: "COMPLETE",
        anchors: contract.seed_paths,
        edge_types: ["CALLS"]
      },
      codegraph: {
        command_ok: true,
        relevance: "RELEVANT",
        coverage: "COMPLETE",
        anchors: [...contract.seed_paths, ...contract.seed_symbols],
        edge_types: ["CALLS"]
      },
      sourceReadback: {
        resolved: true,
        anchors: contract.mandatory_source_readback,
        unresolved: []
      }
    });
    const normalized = normalizeQueryEvidenceForAdmission({
      queryEvidence: { question_receipts: [receipt] },
      targetSha: "b".repeat(40)
    });
    expect(normalized.invalid_target_count).toBe(1);
    expect(normalized.receipts[0].question_admission).toBe("HOLD_THIS_SEAM");
  });
});

describe("KG-O3B1 contract/provenance overlay", () => {
  it("reports path-specific cross-layer findings without promoting graph evidence", () => {
    const result = evaluateContractProvenanceOverlay({
      target_sha: TARGET,
      findings: [
        {
          id: "context-gap",
          category: "context_propagation_gap",
          path: "services/api/src/routes/example.ts",
          symbol: "createExample",
          source_anchors: ["services/api/src/routes/example.ts:42"],
          contract_anchors: ["contracts/openapi/example.yaml#/paths/~1examples/post"],
          confidence: "HIGH",
          reason: "tenantId is not forwarded to the application service"
        }
      ]
    });
    expect(result.status).toBe("FINDINGS");
    expect(result.findings[0]).toMatchObject({
      path: "services/api/src/routes/example.ts",
      source_anchors: ["services/api/src/routes/example.ts:42"],
      contract_anchors: ["contracts/openapi/example.yaml#/paths/~1examples/post"]
    });
  });
});

describe("KG-O3B1 Graph Support Envelope V1.1", () => {
  it("emits a compact reusable envelope with bounded evidence", () => {
    const envelope = buildGraphSupportEnvelopeV11({
      mission_id: "SIMWAR_KG_O3B1_SHIFT_LEFT",
      lane: "MAIN",
      target_sha: TARGET,
      target_tree: "b".repeat(40),
      risk_class: "G2",
      risk_reasons: ["shared contract"],
      canonical_seam: "services/api/src/routes/example.ts",
      decision_needed: "confirm consumer contract parity",
      tool_route: { codegraph: "REQUIRED", graphify: "OPTIONAL_BY_APPLICABILITY" },
      source_anchors: Array.from({ length: 20 }, (_, i) => `src:${i}`),
      consumer_paths: ["apps/teacher/src/client.ts"],
      mandatory_tests: Array.from({ length: 20 }, (_, i) => `test-${i}`),
      unresolved: ["consumer fixture not observed"],
      admission: "SOURCE_FALLBACK"
    });
    expect(envelope.schema_version).toBe("SIMWAR_GRAPH_SUPPORT_ENVELOPE_V1_1");
    expect(envelope.source_anchors).toHaveLength(10);
    expect(envelope.mandatory_tests).toHaveLength(15);
    expect(envelope.admission).toBe("SOURCE_FALLBACK");
  });
});

describe("KG-O3B1 blind value comparison", () => {
  it("classifies material, confirmatory, and no-material outcomes without inventing significance", () => {
    const result = compareBlindInvestigationCells({
      control: {
        finding_correct: true,
        total_investigation_ms: 120,
        scope_delta: 1,
        mandatory_test_delta: 1,
        authority_delta: 0
      },
      treatment: {
        finding_correct: true,
        total_investigation_ms: 100,
        scope_delta: 1,
        mandatory_test_delta: 1,
        authority_delta: 0
      }
    });
    expect(result.contribution).toBe("CONFIRMATORY");
    expect(result.finding_correct).toBe(true);
    expect(result.statistics).toBe("NOT_COMPUTED");
  });

  it("records a control-only miss as treatment gain rather than false negative", () => {
    const result = compareBlindInvestigationCells({
      control: { finding_correct: false, total_investigation_ms: 120 },
      treatment: { finding_correct: true, total_investigation_ms: 140 }
    });
    expect(result.finding_correct).toBe(true);
    expect(result.finding_missed).toBe(false);
    expect(result.false_negative).toBe(false);
    expect(result.contribution).toBe("MATERIAL");
  });
});
