import { describe, expect, it } from "vitest";

import {
  analyzeIdentityDigestSemantics,
  routeGraphSupportQuestion
} from "../../scripts/graph-companion.mjs";

const TARGET_SHA = "a".repeat(40);
const TARGET_TREE = "b".repeat(40);

function qualifiedRoute(overrides: Record<string, unknown> = {}) {
  return {
    risk_class: "G2",
    source_readback_resolved: true,
    codegraph_observed: true,
    codegraph_execution_status: "PASS",
    codegraph_relevance: "RELEVANT",
    codegraph_coverage: "COMPLETE",
    target_sha: TARGET_SHA,
    codegraph_target_sha: TARGET_SHA,
    target_tree: TARGET_TREE,
    codegraph_target_tree: TARGET_TREE,
    ...overrides
  };
}

describe("KG-O3B2 Router trust hardening", () => {
  it("RT-001 keeps G0 source-only work ready without graph tooling", () => {
    const route = routeGraphSupportQuestion({
      risk_class: "G0",
      source_readback_resolved: true,
      codegraph_available: false
    });

    expect(route).toMatchObject({
      question_admission: "READY",
      codegraph_admitted: false,
      codegraph_route: "NOT_NEEDED"
    });
  });

  it("RT-002 keeps G1 source-only work ready without graph observations", () => {
    const route = routeGraphSupportQuestion({
      risk_class: "G1",
      source_readback_resolved: true,
      codegraph_available: false
    });

    expect(route).toMatchObject({
      question_admission: "READY",
      codegraph_admitted: false,
      codegraph_route: "OPTIONAL_OR_FIRST"
    });
  });

  it("RT-003 holds G2 when mandatory source readback is unresolved", () => {
    const route = routeGraphSupportQuestion(
      qualifiedRoute({ source_readback_resolved: false })
    );

    expect(route.question_admission).toBe("HOLD_THIS_SEAM");
  });

  it("RT-004 holds G3 when mandatory source readback is unresolved", () => {
    const route = routeGraphSupportQuestion(
      qualifiedRoute({ risk_class: "G3", source_readback_resolved: false })
    );

    expect(route.question_admission).toBe("HOLD_THIS_SEAM");
  });

  it("RT-005 ignores a caller-supplied admitted flag", () => {
    const route = routeGraphSupportQuestion(
      qualifiedRoute({ codegraph_admitted: true, codegraph_observed: false })
    );

    expect(route).toMatchObject({
      codegraph_observed: false,
      codegraph_admitted: false,
      question_admission: "SOURCE_FALLBACK"
    });
  });

  it("RT-006 requires an observed CodeGraph result", () => {
    const route = routeGraphSupportQuestion(
      qualifiedRoute({ codegraph_observed: false })
    );

    expect(route.question_admission).toBe("SOURCE_FALLBACK");
  });

  it("RT-007 rejects a failed CodeGraph execution", () => {
    const route = routeGraphSupportQuestion(
      qualifiedRoute({ codegraph_execution_status: "FAIL" })
    );

    expect(route.question_admission).toBe("SOURCE_FALLBACK");
  });

  it("RT-008 rejects a non-relevant CodeGraph result", () => {
    const route = routeGraphSupportQuestion(
      qualifiedRoute({ codegraph_relevance: "NO_RELEVANCE" })
    );

    expect(route.question_admission).toBe("SOURCE_FALLBACK");
  });

  it("RT-009 rejects incomplete CodeGraph coverage", () => {
    const route = routeGraphSupportQuestion(
      qualifiedRoute({ codegraph_coverage: "PARTIAL" })
    );

    expect(route.question_admission).toBe("SOURCE_FALLBACK");
  });

  it("RT-010 rejects a CodeGraph observation bound to another target SHA", () => {
    const route = routeGraphSupportQuestion(
      qualifiedRoute({ codegraph_target_sha: "c".repeat(40) })
    );

    expect(route.question_admission).toBe("SOURCE_FALLBACK");
  });

  it("RT-011 rejects a CodeGraph observation bound to another target tree", () => {
    const route = routeGraphSupportQuestion(
      qualifiedRoute({ codegraph_target_tree: "d".repeat(40) })
    );

    expect(route.question_admission).toBe("SOURCE_FALLBACK");
  });

  it("RT-012 admits G2 only with every independent trust condition", () => {
    const route = routeGraphSupportQuestion(qualifiedRoute());

    expect(route).toMatchObject({
      codegraph_observed: true,
      codegraph_admitted: true,
      question_admission: "READY"
    });
  });
});

describe("QF-11 identity and digest semantics", () => {
  const coherentInput = {
    target_sha: TARGET_SHA,
    target_tree: TARGET_TREE,
    source_readback: {
      resolved: true,
      anchors: ["services/api/src/graph-support.ts:10"]
    },
    contract: {
      anchors: ["docs/development/kg-o3b2-qf11.json#/checks"],
      identity_scope: ["repository", "target_sha", "target_tree", "config_digest"],
      digest_scope: ["repository", "target_sha", "target_tree", "config_digest"],
      semantic_name: "codegraph_snapshot_digest"
    },
    observation: {
      identity_scope: ["repository", "target_sha", "target_tree", "config_digest"],
      digest_scope: ["repository", "target_sha", "target_tree", "config_digest"],
      source_kind: "INDEX_SNAPSHOT",
      runtime_claim: false,
      invocation_bound: true,
      identity_field: "snapshot_identity",
      digest_field: "snapshot_digest",
      semantic_name: "codegraph_snapshot_digest"
    }
  };

  it("QF-11 accepts a source- and contract-anchored coherent identity", () => {
    const findings = analyzeIdentityDigestSemantics(coherentInput);

    expect(findings).toEqual([]);
  });

  it("QF-11 reports scope-too-narrow identity semantics", () => {
    const findings = analyzeIdentityDigestSemantics({
      ...coherentInput,
      observation: {
        ...coherentInput.observation,
        identity_scope: ["repository"]
      }
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SCOPE_TOO_NARROW", severity: "HIGH" })
      ])
    );
  });

  it("QF-11 reports scope-too-broad identity semantics", () => {
    const findings = analyzeIdentityDigestSemantics({
      ...coherentInput,
      observation: {
        ...coherentInput.observation,
        digest_scope: [
          ...coherentInput.observation.digest_scope,
          "occurred_at",
          "command_output"
        ]
      }
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SCOPE_TOO_BROAD", severity: "MEDIUM" })
      ])
    );
  });

  it("QF-11 reports a static snapshot presented as runtime state", () => {
    const findings = analyzeIdentityDigestSemantics({
      ...coherentInput,
      observation: {
        ...coherentInput.observation,
        source_kind: "INDEX_SNAPSHOT",
        runtime_claim: true
      }
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "STATIC_AS_RUNTIME", severity: "HIGH" })
      ])
    );
  });

  it("QF-11 reports an invocation without exact target binding", () => {
    const findings = analyzeIdentityDigestSemantics({
      ...coherentInput,
      observation: {
        ...coherentInput.observation,
        invocation_bound: false
      }
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INVOCATION_NOT_BOUND", severity: "HIGH" })
      ])
    );
  });

  it("QF-11 reports identity and content digest conflation", () => {
    const findings = analyzeIdentityDigestSemantics({
      ...coherentInput,
      observation: {
        ...coherentInput.observation,
        identity_field: "snapshot_digest",
        digest_field: "snapshot_digest"
      }
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "IDENTITY_DIGEST_CONFLATION", severity: "HIGH" })
      ])
    );
  });

  it("QF-11 reports a semantic-name mismatch", () => {
    const findings = analyzeIdentityDigestSemantics({
      ...coherentInput,
      observation: {
        ...coherentInput.observation,
        semantic_name: "runtime_health"
      }
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SEMANTIC_NAME_MISMATCH", severity: "MEDIUM" })
      ])
    );
  });

  it("QF-11 bounds findings and preserves source/contract anchors", () => {
    const findings = analyzeIdentityDigestSemantics({
      ...coherentInput,
      source_anchors: Array.from({ length: 30 }, (_, index) => `source:${index}`),
      contract_anchors: Array.from({ length: 30 }, (_, index) => `contract:${index}`),
      observation: {
        ...coherentInput.observation,
        identity_scope: [],
        digest_scope: ["repository", "occurred_at", "command_output"],
        source_kind: "INDEX_SNAPSHOT",
        runtime_claim: true,
        invocation_bound: false,
        identity_field: "snapshot_digest",
        digest_field: "snapshot_digest",
        semantic_name: "runtime_health"
      }
    });

    expect(findings.length).toBeLessThanOrEqual(10);
    expect(findings[0]).toMatchObject({
      source_anchors: ["source:0", "source:1", "source:2", "source:3", "source:4"],
      contract_anchors: ["contract:0", "contract:1", "contract:2", "contract:3", "contract:4"]
    });
  });
});
