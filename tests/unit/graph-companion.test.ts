import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildArchitectureDelta,
  buildRiskDelta,
  buildSourceManifest,
  buildTestImpact,
  assertExternalGraphHome,
  classifyFreshness,
  classifyPlanningDocuments,
  classifyPath,
  codeGraphWorkspacePath,
  evaluateGraphAdmission,
  classifyWriterEvidence,
  classifyMcpHealth,
  normalizeQuestionContract,
  buildQuestionReceipt,
  admitQuestionReceipt,
  normalizeQueryEvidenceForAdmission,
  normalizeMcpObservationSet,
  assertArtifactRootSafety,
  evaluatePlanningGate,
  parseCodeGraphAffected,
  parseCodeGraphStatus,
  resolveGraphHome
} from "../../scripts/graph-companion.mjs";

describe("Graph Companion V1 pure contracts", () => {
  it("rejects an invalid index status even when both queries return data (KG-ADM-001)", () => {
    const admission = evaluateGraphAdmission({
      target: {
        repo_sha: "a".repeat(40),
        tree_sha: "tree-a",
        config_digest: "cfg-a",
        identity: "build-a"
      },
      status: { exit_code: 1, raw: '{"lastIndexed":"a"}', json: { lastIndexed: "a" } },
      queries: [
        { exit_code: 0, output: "relevant result", relevant: true, coverage: "COMPLETE" },
        { exit_code: 0, output: "relevant result", relevant: true, coverage: "COMPLETE" }
      ]
    });
    expect(admission.stages.BUILD_HEALTH.status).toBe("FAIL");
    expect(admission.decision).toBe("BLOCKED_INDEX_METADATA");
  });

  it("rejects invalid JSON status (KG-ADM-002)", () => {
    const admission = evaluateGraphAdmission({
      target: {
        repo_sha: "a".repeat(40),
        tree_sha: "tree-a",
        config_digest: "cfg-a",
        identity: "build-a"
      },
      status: { exit_code: 0, raw: "not-json", json: null },
      queries: [{ exit_code: 0, output: "relevant", relevant: true, coverage: "COMPLETE" }]
    });
    expect(admission.stages.BUILD_HEALTH.status).toBe("FAIL");
    expect(admission.decision).toBe("BLOCKED_INDEX_METADATA");
  });

  it("rejects a repository/tree/config mismatch (KG-ADM-003)", () => {
    const admission = evaluateGraphAdmission({
      target: {
        repo_sha: "a".repeat(40),
        tree_sha: "tree-a",
        config_digest: "cfg-a",
        identity: "build-a"
      },
      status: {
        exit_code: 0,
        raw: "{}",
        json: {
          repo_sha: "b".repeat(40),
          tree_sha: "tree-b",
          config_digest: "cfg-b",
          identity: "build-b",
          lastIndexed: "2026-09-07T00:00:00Z"
        }
      },
      queries: [{ exit_code: 0, output: "relevant", relevant: true, coverage: "COMPLETE" }]
    });
    expect(admission.stages.SNAPSHOT_APPLICABILITY.status).toBe("MISMATCH");
    expect(admission.decision).toBe("BLOCKED_TARGET_MISMATCH");
  });

  it("does not infer target identity when identity metadata is missing (KG-ADM-004)", () => {
    const admission = evaluateGraphAdmission({
      target: {
        repo_sha: "a".repeat(40),
        tree_sha: "tree-a",
        config_digest: "cfg-a",
        identity: "build-a"
      },
      status: {
        exit_code: 0,
        raw: "{}",
        json: {
          repo_sha: "a".repeat(40),
          tree_sha: "tree-a",
          config_digest: "cfg-a",
          lastIndexed: "2026-09-07T00:00:00Z"
        }
      },
      queries: [{ exit_code: 0, output: "relevant", relevant: true, coverage: "COMPLETE" }]
    });
    expect(admission.stages.SNAPSHOT_APPLICABILITY.status).toBe("UNKNOWN");
    expect(admission.decision).toBe("BLOCKED_TARGET_UNKNOWN");
  });

  it("rejects a historical index whose SHA differs from the target (KG-ADM-005)", () => {
    const admission = evaluateGraphAdmission({
      target: {
        repo_sha: "a".repeat(40),
        tree_sha: "tree-a",
        config_digest: "cfg-a",
        identity: "build-a"
      },
      status: {
        exit_code: 0,
        raw: "{}",
        json: {
          repo_sha: "b".repeat(40),
          tree_sha: "tree-a",
          config_digest: "cfg-a",
          identity: "build-b",
          lastIndexed: "2026-09-07T00:00:00Z"
        }
      },
      queries: [{ exit_code: 0, output: "relevant", relevant: true, coverage: "COMPLETE" }]
    });
    expect(admission.stages.SNAPSHOT_APPLICABILITY.target_match).toBe("FALSE");
    expect(admission.decision).toBe("BLOCKED_TARGET_MISMATCH");
  });

  it("requires identity equality and a parseable lastIndexed value", () => {
    const target = {
      repo_sha: "a".repeat(40),
      tree_sha: "tree-a",
      config_digest: "cfg-a",
      identity: "expected-target"
    };
    const admission = evaluateGraphAdmission({
      target,
      status: {
        exit_code: 0,
        raw: "{}",
        json: { ...target, identity: "wrong-target", lastIndexed: "not-a-date" }
      },
      queries: [{ exit_code: 0, output: "relevant", relevant: true, coverage: "COMPLETE" }]
    });
    expect(admission.stages.SNAPSHOT_APPLICABILITY.status).toBe("UNKNOWN");
    expect(admission.decision).toBe("BLOCKED_TARGET_UNKNOWN");
  });

  it("blocks a valid snapshot when the expected target identity differs", () => {
    const target = {
      repo_sha: "a".repeat(40),
      tree_sha: "tree-a",
      config_digest: "cfg-a",
      identity: "expected-target"
    };
    const admission = evaluateGraphAdmission({
      target,
      status: {
        exit_code: 0,
        json: { ...target, identity: "different-target", lastIndexed: "2026-09-07T00:00:00Z" }
      },
      queries: [{ exit_code: 0, output: "relevant", relevant: true, coverage: "COMPLETE" }]
    });
    expect(admission.stages.SNAPSHOT_APPLICABILITY.identity_match).toBe("FALSE");
    expect(admission.decision).toBe("BLOCKED_TARGET_MISMATCH");
  });

  it("requires an independent expected identity for exact-target admission", () => {
    const admission = evaluateGraphAdmission({
      target: { repo_sha: "a".repeat(40), tree_sha: "tree-a", config_digest: "cfg-a" },
      status: {
        exit_code: 0,
        json: {
          repo_sha: "a".repeat(40),
          tree_sha: "tree-a",
          config_digest: "cfg-a",
          identity: "self-reported",
          lastIndexed: "2026-09-07T00:00:00Z"
        }
      },
      queries: [{ exit_code: 0, output: "relevant", relevant: true, coverage: "COMPLETE" }]
    });
    expect(admission.stages.SNAPSHOT_APPLICABILITY.status).toBe("UNKNOWN");
    expect(admission.decision).toBe("BLOCKED_TARGET_UNKNOWN");
  });

  it("does not promote truncated or irrelevant queries to exact-target ready", () => {
    const target = {
      repo_sha: "a".repeat(40),
      tree_sha: "tree-a",
      config_digest: "cfg-a",
      identity: "build-a"
    };
    const status = {
      exit_code: 0,
      raw: "{}",
      json: { ...target, identity: "build-a", lastIndexed: "2026-09-07T00:00:00Z" }
    };
    const truncated = evaluateGraphAdmission({
      target,
      status,
      queries: [{ exit_code: 0, output: "partial", relevant: true, coverage: "TRUNCATED" }]
    });
    expect(truncated.stages.QUERY_USEFULNESS.status).toBe("TRUNCATED");
    expect(truncated.stages.QUERY_USEFULNESS.COMMAND_OK).toBe(true);
    expect(truncated.stages.QUERY_USEFULNESS.RELEVANT_RESULT).toBe(true);
    expect(truncated.stages.QUERY_USEFULNESS.COVERAGE_COMPLETE).toBe(false);
    expect(truncated.exact_target_ready).toBe(false);
    const irrelevant = evaluateGraphAdmission({
      target,
      status,
      queries: [{ exit_code: 0, output: "baseline", relevant: false, coverage: "COMPLETE" }]
    });
    expect(irrelevant.stages.QUERY_USEFULNESS.status).toBe("NO_RELEVANCE");
    expect(irrelevant.stages.QUERY_USEFULNESS.COMMAND_OK).toBe(true);
    expect(irrelevant.stages.QUERY_USEFULNESS.RELEVANT_RESULT).toBe(false);
    expect(irrelevant.stages.QUERY_USEFULNESS.COVERAGE_COMPLETE).toBe(true);
  });

  it("distinguishes unknown writer ownership from an observed lack of contention", () => {
    expect(classifyWriterEvidence({ observedErrors: [] }).state).toBe("NO_CONTENTION_OBSERVED");
    expect(
      classifyWriterEvidence({
        observedErrors: [],
        owner: {
          build_key: "k",
          owner: "codex",
          process_id: 42,
          started_at: "t",
          heartbeat_at: "t"
        }
      }).state
    ).toBe("LOCK_OWNERSHIP_PROVEN");
    expect(classifyWriterEvidence({ observedErrors: ["unknown lock"] }).state).toBe(
      "LOCK_OWNERSHIP_UNKNOWN"
    );
  });

  it("keeps MCP configured, handshake, tool call, and useful result separate", () => {
    expect(
      classifyMcpHealth({
        configured: true,
        handshake: true,
        tool_list: true,
        tool_call: true,
        useful: false
      })
    ).toEqual({
      MCP_CONFIGURED: true,
      MCP_HANDSHAKE_OK: true,
      MCP_TOOL_LIST_OK: true,
      MCP_TOOL_CALL_OK: true,
      MCP_RESULT_USEFUL: false
    });
  });

  it("rejects equal and nested ArtifactRoot paths before any write", () => {
    const source = "D:/simwar/source";
    expect(() => assertArtifactRootSafety({ projectRoot: source, artifactRoot: source })).toThrow();
    expect(() =>
      assertArtifactRootSafety({ projectRoot: source, artifactRoot: "D:/simwar/source/graph" })
    ).toThrow();
    expect(
      assertArtifactRootSafety({
        projectRoot: source,
        artifactRoot: "D:/simwar/artifacts"
      }).replaceAll("\\", "/")
    ).toContain("D:/simwar/artifacts");
  });

  it("rejects a physical alias that resolves an external path into the source", () => {
    const root = mkdtempSync(join(tmpdir(), "simwar-artifact-safety-"));
    const source = join(root, "source");
    const outside = join(root, "outside");
    mkdirSync(source);
    mkdirSync(outside);
    try {
      expect(() =>
        assertArtifactRootSafety({
          projectRoot: source,
          artifactRoot: join(outside, "graph"),
          realpath: (path) => (path === outside ? source : path)
        })
      ).toThrow(/resolves inside/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when physical canonicalization cannot be completed", () => {
    const root = mkdtempSync(join(tmpdir(), "simwar-artifact-realpath-"));
    const source = join(root, "source");
    const outside = join(root, "outside");
    mkdirSync(source);
    mkdirSync(outside);
    try {
      expect(() =>
        assertArtifactRootSafety({
          projectRoot: source,
          artifactRoot: join(outside, "graph"),
          realpath: () => {
            throw new Error("realpath unavailable");
          }
        })
      ).toThrow(/physical|canonical|realpath|safety/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("resolves a stable graph home without a user-specific hard-coded path", () => {
    expect(
      resolveGraphHome({
        env: {},
        platform: "win32",
        homeDir: "C:\\Users\\Example"
      })
    ).toBe("C:\\Users\\Example\\AppData\\Local\\SimWar\\graph-companion");
    expect(
      resolveGraphHome({
        env: { SIMWAR_GRAPH_HOME: "D:\\graph-cache" },
        platform: "win32",
        homeDir: "C:\\Users\\Example"
      })
    ).toBe("D:\\graph-cache");
    expect(
      resolveGraphHome({
        env: { LOCALAPPDATA: "E:\\RedirectedLocal" },
        platform: "win32",
        homeDir: "C:\\Users\\Example"
      })
    ).toBe("E:\\RedirectedLocal\\SimWar\\graph-companion");
  });

  it("builds a deterministic code manifest while tracking planning files separately", () => {
    const first = buildSourceManifest({
      files: [
        { path: "services/api/src/server.ts", content: "export const server = 1;" },
        { path: "docs/planning/current-cycle.yaml", content: "source_sha: old\n" },
        { path: ".github/ISSUE_TEMPLATE/bug.yml", content: "name: Bug\n" },
        { path: "README.md", content: "docs" }
      ]
    });
    const second = buildSourceManifest({
      files: [
        { path: "README.md", content: "docs" },
        { path: "docs/planning/current-cycle.yaml", content: "source_sha: old\n" },
        { path: ".github/ISSUE_TEMPLATE/bug.yml", content: "name: Bug\n" },
        { path: "services/api/src/server.ts", content: "export const server = 1;" }
      ]
    });
    expect(first.code_digest).toBe(second.code_digest);
    expect(first.entries).toHaveLength(1);
    expect(first.planning_files).toEqual(["docs/planning/current-cycle.yaml"]);
    expect(first.entries[0].classification).toBe("RUNTIME");
  });

  it("treats unknown paths as product-risk inputs rather than documentation", () => {
    expect(classifyPath("Dockerfile")).toBe("UNKNOWN");
    expect(classifyPath("docs/architecture/graph-companion.md")).toBe("DOCS");
    expect(classifyPath(".github/ISSUE_TEMPLATE/bug.yml")).toBe("UNKNOWN");
  });

  it("classifies an exact graph source SHA as current", () => {
    expect(
      classifyFreshness({
        currentRepoSha: "a",
        graphSourceSha: "a",
        currentCodeManifestDigest: "same",
        graphCodeManifestDigest: "same",
        changedFiles: [],
        graphFound: true,
        sourceAvailable: true
      }).state
    ).toBe("CURRENT_EXACT_SHA");
  });

  it("classifies docs-only drift with an equivalent code manifest", () => {
    expect(
      classifyFreshness({
        currentRepoSha: "b",
        graphSourceSha: "a",
        currentCodeManifestDigest: "same",
        graphCodeManifestDigest: "same",
        changedFiles: ["docs/planning/current-cycle.yaml"],
        graphFound: true,
        sourceAvailable: true
      }).state
    ).toBe("CURRENT_CODE_EQUIVALENT");
  });

  it("classifies product deltas as stale product graphs", () => {
    expect(
      classifyFreshness({
        currentRepoSha: "b",
        graphSourceSha: "a",
        currentCodeManifestDigest: "new",
        graphCodeManifestDigest: "old",
        changedFiles: ["services/api/src/server.ts"],
        graphFound: true,
        sourceAvailable: true
      }).state
    ).toBe("STALE_PRODUCT_DELTA");
  });

  it("keeps an unbound graph in rebuild-required state", () => {
    expect(
      classifyFreshness({
        currentRepoSha: "b",
        graphSourceSha: null,
        currentCodeManifestDigest: "new",
        graphCodeManifestDigest: null,
        changedFiles: [],
        graphFound: true,
        sourceAvailable: true
      }).state
    ).toBe("STALE_REBUILD_REQUIRED");
  });

  it("distinguishes missing graph from a graph tooling failure", () => {
    expect(
      classifyFreshness({
        currentRepoSha: "a",
        graphSourceSha: null,
        currentCodeManifestDigest: "same",
        graphCodeManifestDigest: null,
        changedFiles: [],
        graphFound: false,
        sourceAvailable: true
      }).state
    ).toBe("GRAPH_NOT_FOUND");
    expect(
      classifyFreshness({
        currentRepoSha: null,
        graphSourceSha: null,
        currentCodeManifestDigest: null,
        graphCodeManifestDigest: null,
        changedFiles: [],
        graphFound: false,
        sourceAvailable: false
      }).state
    ).toBe("BLOCKED_GRAPH_TOOLING");
  });

  it("maps direct and depth-two dependencies to impacted tests", () => {
    const impact = buildTestImpact({
      changedFiles: ["services/api/src/tenant-baseline-provisioning.ts"],
      graph: {
        edges: [
          {
            from: "services/api/src/tenant-baseline-provisioning.ts",
            to: "services/api/src/server.ts",
            relation: "imports"
          },
          {
            from: "services/api/src/server.ts",
            to: "tests/integration/tenant-baseline-provisioning-endpoint.test.ts",
            relation: "tested-by"
          }
        ]
      },
      codeGraphAffected: [],
      codeGraphStatus: "HEALTHY"
    });
    expect(impact.max_depth).toBe(2);
    expect(
      impact.recommendations.some((item) =>
        item.test_file.endsWith("tenant-baseline-provisioning-endpoint.test.ts")
      )
    ).toBe(true);
    expect(impact.recommendations.every((item) => item.depth <= 2)).toBe(true);
  });

  it("expands to a conservative safety floor when graph edges are missing", () => {
    const impact = buildTestImpact({
      changedFiles: ["services/api/src/settlement-service.ts"],
      graph: { edges: [] },
      codeGraphAffected: [],
      codeGraphStatus: "DEGRADED"
    });
    expect(
      impact.recommendations.some((item) => item.test_file.includes("settlement-idempotency"))
    ).toBe(true);
    expect(impact.false_negative_controls).toContain(
      "missing edge expands mandatory safety floors"
    );
  });

  it("accepts an exact-path and exact-symbol Query Contract V2", () => {
    const contract = normalizeQuestionContract({
      question_id: "Q-FORMAL-WRITER",
      risk_class: "authority",
      target_sha: "a".repeat(40),
      canonical_seam: "services/api/src/model-qualification-service.ts#commit",
      decision_before: "writer authority is not proven",
      decision_needed: "identify the sole formal writer and its audit path",
      seed_paths: ["services/api/src/model-qualification-service.ts"],
      seed_symbols: ["ModelQualificationService.commit"],
      seed_routes: [],
      seed_schemas: [],
      expected_edge_types: ["CALLS", "WRITES"],
      mandatory_source_readback: ["services/api/src/model-qualification-service.ts:2350-2382"],
      mandatory_tests: ["tests/unit/model-qualification-service.test.ts"]
    });
    expect(contract.schema_version).toBe("GraphQuestionContractV2");
    expect(contract.question_id).toBe("Q-FORMAL-WRITER");
  });

  it("rejects a Query Contract V2 with no exact seed", () => {
    expect(() =>
      normalizeQuestionContract({
        question_id: "Q-MISSING-SEED",
        risk_class: "authority",
        target_sha: "a".repeat(40),
        canonical_seam: "services/api/src/model-qualification-service.ts",
        decision_before: "unknown",
        decision_needed: "find writer",
        seed_paths: [],
        seed_symbols: [],
        seed_routes: [],
        seed_schemas: [],
        expected_edge_types: ["CALLS"],
        mandatory_source_readback: ["services/api/src/model-qualification-service.ts"],
        mandatory_tests: ["tests/unit/model-qualification-service.test.ts"]
      })
    ).toThrow(/seed/u);
  });

  it("routes truncated or generic graph results to source fallback", () => {
    const contract = normalizeQuestionContract({
      question_id: "Q-PERMISSION",
      risk_class: "permission",
      target_sha: "b".repeat(40),
      canonical_seam: "services/api/src/routes/model-qualification-routes.ts",
      decision_before: "permission path is unclear",
      decision_needed: "confirm exact tenant and team checks",
      seed_paths: ["services/api/src/routes/model-qualification-routes.ts"],
      seed_symbols: ["assertExactIndustryDiagnosticContext"],
      seed_routes: ["GET /api/v1/bff/student/model-qualification/reality-join"],
      seed_schemas: [],
      expected_edge_types: ["CALLS", "READS"],
      mandatory_source_readback: ["services/api/src/routes/model-qualification-routes.ts:317-377"],
      mandatory_tests: ["tests/unit/industry-model-diagnostic-route.test.ts"]
    });
    const receipt = buildQuestionReceipt({
      contract,
      graphify: {
        command_ok: true,
        relevance: "RELEVANT",
        coverage: "TRUNCATED",
        truncated: true,
        anchors: ["assertExactIndustryDiagnosticContext"]
      },
      codegraph: {
        command_ok: true,
        relevance: "NO_RELEVANCE",
        coverage: "COMPLETE",
        truncated: false,
        generic: true,
        anchors: ["generic permission helper"]
      },
      sourceReadback: {
        resolved: true,
        anchors: ["model-qualification-routes.ts:317-377"],
        unresolved: []
      }
    });
    expect(receipt.graphify.truncated).toBe(true);
    expect(receipt.codegraph.relevance).toBe("NO_RELEVANCE");
    expect(admitQuestionReceipt(receipt)).toBe("SOURCE_FALLBACK");
  });

  it("holds a high-risk seam when source readback is unresolved", () => {
    const receipt = buildQuestionReceipt({
      contract: normalizeQuestionContract({
        question_id: "Q-WRITER-HOLD",
        risk_class: "authority",
        target_sha: "c".repeat(40),
        canonical_seam: "services/api/src/model-qualification-service.ts#commit",
        decision_before: "unknown",
        decision_needed: "prove writer",
        seed_paths: ["services/api/src/model-qualification-service.ts"],
        seed_symbols: ["commit"],
        seed_routes: [],
        seed_schemas: [],
        expected_edge_types: ["CALLS"],
        mandatory_source_readback: ["services/api/src/model-qualification-service.ts"],
        mandatory_tests: ["tests/unit/model-qualification-service.test.ts"]
      }),
      graphify: { command_ok: true, relevance: "RELEVANT", coverage: "COMPLETE", anchors: ["commit"] },
      codegraph: { command_ok: true, relevance: "RELEVANT", coverage: "COMPLETE", anchors: ["commit"] },
      sourceReadback: { resolved: false, anchors: [], unresolved: ["writer audit path"] }
    });
    expect(admitQuestionReceipt(receipt)).toBe("HOLD_THIS_SEAM");
  });

  it("does not treat a non-empty unresolved list as resolved evidence", () => {
    const receipt = {
      graphify: { command_ok: true, relevance: "RELEVANT", coverage: "COMPLETE", truncated: false },
      codegraph: { command_ok: true, relevance: "RELEVANT", coverage: "COMPLETE", truncated: false },
      source_readback: { resolved: true, anchors: ["partial.ts:1"], unresolved: ["missing consumer"] }
    };
    expect(admitQuestionReceipt(receipt)).toBe("HOLD_THIS_SEAM");
  });

  it("binds Query Contract V2 receipts to the exact target before admission", () => {
    const contract = normalizeQuestionContract({
      question_id: "Q-V2",
      risk_class: "authority",
      target_sha: "a".repeat(40),
      canonical_seam: "services/api/src/model-qualification-service.ts#commit",
      decision_before: "unknown",
      decision_needed: "sole writer",
      seed_paths: ["services/api/src/model-qualification-service.ts"],
      seed_symbols: ["ModelQualificationService.commit"],
      seed_routes: [],
      seed_schemas: [],
      expected_edge_types: ["CALLS"],
      mandatory_source_readback: ["writer"],
      mandatory_tests: ["graph-companion"]
    });
    const receipt = buildQuestionReceipt({
      contract,
      graphify: { command_ok: true, relevance: "RELEVANT", coverage: "COMPLETE", truncated: false },
      codegraph: { command_ok: true, relevance: "RELEVANT", coverage: "COMPLETE", truncated: false },
      sourceReadback: { resolved: true, anchors: ["service.ts:1"], unresolved: [] }
    });
    expect(normalizeQueryEvidenceForAdmission({
      queryEvidence: { question_receipts: [receipt] },
      targetSha: "b".repeat(40)
    })).toMatchObject({
      query_contract_v2: true,
      invalid_target_count: 1,
      queries: [{ exit_code: 1, relevant: false, coverage: "INCOMPLETE", truncated: true }]
    });
    expect(normalizeQueryEvidenceForAdmission({
      queryEvidence: { question_receipts: [receipt] },
      targetSha: "a".repeat(40)
    })).toMatchObject({
      query_contract_v2: true,
      invalid_target_count: 0,
      queries: [{ exit_code: 0, relevant: true, coverage: "COMPLETE", truncated: false }]
    });
  });

  it("normalizes final MCP observations without turning NOT_OBSERVED into FAIL", () => {
    const receipt = normalizeMcpObservationSet({ configured: true });
    expect(receipt.MCP_CONFIGURED).toBe("PASS");
    expect(receipt.MCP_HANDSHAKE).toBe("NOT_OBSERVED");
    expect(receipt.MCP_TOOL_LIST).toBe("NOT_OBSERVED");
    expect(receipt.MCP_TOOL_CALL).toBe("NOT_OBSERVED");
    expect(receipt.MCP_RESULT_USEFUL).toBe("NOT_OBSERVED");
    expect(receipt.status).toBe("PASS_WITH_LIMITS");
  });

  it("records an observed MCP failure as FAIL while preserving other states", () => {
    const receipt = normalizeMcpObservationSet({
      configured: true,
      handshake: true,
      tool_list: false,
      tool_call: "NOT_APPLICABLE",
      useful: "NOT_APPLICABLE"
    });
    expect(receipt.MCP_HANDSHAKE).toBe("PASS");
    expect(receipt.MCP_TOOL_LIST).toBe("FAIL");
    expect(receipt.MCP_TOOL_CALL).toBe("NOT_APPLICABLE");
    expect(receipt.status).toBe("FAIL");
  });

  it("uses minimal T0 validation for docs-only changes", () => {
    const impact = buildTestImpact({
      changedFiles: ["docs/architecture/simwar-graph-companion-v1.md"],
      graph: { edges: [] },
      codeGraphAffected: [],
      codeGraphStatus: "HEALTHY"
    });
    expect(impact.recommendations.every((item) => item.tier === "T0")).toBe(true);
  });

  it("keeps tenant and authority safety floors for baseline changes", () => {
    const impact = buildTestImpact({
      changedFiles: ["services/api/src/parameter-set-authority.ts"],
      graph: { edges: [] },
      codeGraphAffected: [],
      codeGraphStatus: "HEALTHY"
    });
    expect(
      impact.recommendations.some(
        (item) => item.test_file.includes("tenant-baseline-provisioning.test.ts") && item.mandatory
      )
    ).toBe(true);
    expect(
      impact.recommendations.some(
        (item) => item.test_file.includes("parameter-set-command-service.test.ts") && item.mandatory
      )
    ).toBe(true);
  });

  it("retains Truth, Settlement, and Replay safety floors", () => {
    const impact = buildTestImpact({
      changedFiles: ["services/simulation-core/src/settlement-engine.ts"],
      graph: { edges: [] },
      codeGraphAffected: [],
      codeGraphStatus: "HEALTHY"
    });
    expect(
      impact.recommendations.some(
        (item) => item.test_file.includes("settlement-idempotency") && item.mandatory
      )
    ).toBe(true);
    expect(
      impact.recommendations.some(
        (item) => item.test_file.includes("settlement-write-replay-hash") && item.mandatory
      )
    ).toBe(true);
  });

  it("requires the simulation-core safety floor even when graph edges are present", () => {
    const impact = buildTestImpact({
      changedFiles: ["services/simulation-core/src/toy-logit-engine.ts"],
      graph: {
        nodes: [
          {
            id: "engine",
            file: "services/simulation-core/src/toy-logit-engine.ts"
          }
        ],
        edges: []
      },
      codeGraphAffected: [],
      codeGraphStatus: "HEALTHY"
    });
    expect(
      impact.recommendations.some((item) => item.test_file === "npm test" && item.mandatory)
    ).toBe(true);
    expect(
      impact.recommendations.some(
        (item) => item.test_file.includes("settlement-write-replay-hash") && item.mandatory
      )
    ).toBe(true);
  });

  it("escalates shared contract changes beyond a docs-only tier", () => {
    const impact = buildTestImpact({
      changedFiles: ["packages/shared-contracts/src/index.ts"],
      graph: { edges: [] },
      codeGraphAffected: [],
      codeGraphStatus: "HEALTHY"
    });
    expect(impact.recommendations.some((item) => item.tier === "T4" && item.mandatory)).toBe(true);
  });

  it("normalizes CodeGraph WAL status without hashing the database file", () => {
    const status = parseCodeGraphStatus(
      "CodeGraph Status\n\nProject: C:\\worktree\n\nIndex Statistics:\n  Files: 10\n  Nodes: 20\n  Edges: 30\n  DB Size: 4 MB\n  Journal: wal\n\n[OK] Index is up to date",
      "C:\\worktree"
    );
    expect(status.status).toBe("HEALTHY");
    expect(status.pending_changes).toBe(0);
    expect(status.logical_digest).not.toBe("DIGEST_UNAVAILABLE");
  });

  it("parses CodeGraph v1.2 affectedTests output and preserves test paths", () => {
    expect(
      parseCodeGraphAffected(
        JSON.stringify({
          affectedTests: [
            null,
            { file: "tests/unit/graph-companion.test.ts" },
            { path: "tests/integration/graph-companion-endpoint.test.ts" }
          ]
        })
      )
    ).toEqual([
      "tests/unit/graph-companion.test.ts",
      "tests/integration/graph-companion-endpoint.test.ts"
    ]);
  });

  it("blocks a partial architecture delta instead of treating it as complete", () => {
    const delta = buildArchitectureDelta({
      baseSha: "a",
      targetSha: "b",
      changedFiles: ["services/api/src/server.ts", "services/api/src/unknown.ts"],
      graph: { nodes: [{ id: "server", file: "services/api/src/server.ts" }], edges: [] }
    });
    expect(
      evaluatePlanningGate({
        freshness: "CURRENT_EXACT_SHA",
        architectureDeltaComplete:
          delta.confidence === "HIGH" && delta.unmapped_changed_files.length === 0,
        testImpactComplete: true,
        riskDeltaComplete: true,
        planningReality: "CURRENT",
        codeGraphStatus: "HEALTHY"
      }).status
    ).toBe("BLOCKED_UNMAPPED_PRODUCT_DELTA");
  });

  it("carries historical-SHA and P1 risk limits into the planning gate", () => {
    const gate = evaluatePlanningGate({
      freshness: "CURRENT_CODE_EQUIVALENT",
      freshnessLimits: ["GRAPH_SOURCE_SHA_HISTORICAL"],
      architectureDeltaComplete: true,
      testImpactComplete: true,
      riskDeltaComplete: true,
      riskFindings: [{ level: "P1" }],
      planningReality: "CURRENT",
      codeGraphStatus: "HEALTHY"
    });
    expect(gate.status).toBe("PLAN_ALLOWED_WITH_LIMITS");
    expect(gate.limits).toEqual(
      expect.arrayContaining(["GRAPH_SOURCE_SHA_HISTORICAL", "P1_RISK_REVIEW_REQUIRED"])
    );
    expect(parseCodeGraphAffected("{}" as string)).toBeNull();
    expect(parseCodeGraphAffected("1" as string)).toBeNull();
    expect(parseCodeGraphAffected("[{}]" as string)).toBeNull();
  });

  it("blocks planning when required planning reality inputs are missing", () => {
    expect(
      evaluatePlanningGate({
        freshness: "CURRENT_EXACT_SHA",
        architectureDeltaComplete: true,
        testImpactComplete: true,
        riskDeltaComplete: true,
        planningReality: "PLANNING_REALITY_MISSING",
        codeGraphStatus: "HEALTHY"
      }).status
    ).toBe("BLOCKED_CURRENT_REALITY");
  });

  it("does not escalate documentation-only settlement mentions to product risk", () => {
    const risk = buildRiskDelta({
      changedFiles: ["docs/architecture/settlement-boundary.md"],
      graph: { nodes: [], edges: [] },
      testImpact: { recommendations: [] }
    });
    expect(risk.findings.find((finding) => finding.id === "truth-settlement-replay")?.level).toBe(
      "INFO"
    );
  });

  it("keeps path-independent graph homes across isolated worktrees", () => {
    const first = resolveGraphHome({ env: {}, platform: "linux", homeDir: "/home/one" });
    const second = resolveGraphHome({ env: {}, platform: "linux", homeDir: "/home/two" });
    expect(first.replaceAll("\\", "/")).toContain("SimWar/graph-companion");
    expect(second.replaceAll("\\", "/")).toContain("SimWar/graph-companion");
    expect(first).not.toContain("Temp");
    expect(second).not.toContain("D:/codex/tmp");
  });

  it("builds an architecture delta with explicit unmapped files", () => {
    const delta = buildArchitectureDelta({
      baseSha: "a",
      targetSha: "b",
      changedFiles: ["services/api/src/server.ts", "unknown.bin"],
      graph: { nodes: [{ id: "server", file: "services/api/src/server.ts" }], edges: [] }
    });
    expect(delta.modified_files).toEqual(["services/api/src/server.ts", "unknown.bin"]);
    expect(delta.unmapped_changed_files).toEqual(["unknown.bin"]);
    expect(delta.confidence).toBe("PARTIAL");
  });

  it("preserves additions and deletions in architecture deltas", () => {
    const delta = buildArchitectureDelta({
      baseSha: "a",
      targetSha: "b",
      changedFiles: ["services/api/src/new.ts", "services/api/src/removed.ts"],
      changedFileEntries: [
        { status: "A", path: "services/api/src/new.ts" },
        { status: "D", path: "services/api/src/removed.ts" }
      ],
      graph: { nodes: [{ id: "new", file: "services/api/src/new.ts" }], edges: [] },
      priorGraph: { nodes: [{ id: "removed", file: "services/api/src/removed.ts" }], edges: [] }
    });
    expect(delta.added_files).toEqual(["services/api/src/new.ts"]);
    expect(delta.removed_files).toEqual(["services/api/src/removed.ts"]);
    expect(delta.unmapped_changed_files).toEqual([]);
  });

  it("blocks a deletion when the prior graph cannot map the removed file", () => {
    const delta = buildArchitectureDelta({
      baseSha: "a",
      targetSha: "b",
      changedFiles: ["services/api/src/removed.ts"],
      changedFileEntries: [{ status: "D", path: "services/api/src/removed.ts" }],
      graph: { nodes: [], edges: [] },
      priorGraph: { nodes: [], edges: [] }
    });
    expect(delta.unmapped_changed_files).toEqual(["services/api/src/removed.ts"]);
  });

  it("requires every planning document to bind the current SHA independently", () => {
    const currentSha = "a".repeat(40);
    const staleSha = "b".repeat(40);
    const result = classifyPlanningDocuments(
      [
        {
          path: "current-cycle.yaml",
          exists: true,
          scalars: {
            current_master_at_readback: staleSha,
            governance_closure_merge_sha: currentSha
          }
        },
        { path: "portfolio.yaml", exists: true, scalars: { current_master_at_readback: staleSha } }
      ],
      currentSha
    );
    expect(result.drift).toBe(true);
    expect(result.documents.map((document) => document.binding_status)).toEqual(["DRIFT", "DRIFT"]);
  });

  it("keeps the CodeGraph index workspace outside the source worktree", () => {
    const workspace = codeGraphWorkspacePath("C:\\graph-home", {
      owner: "qidianzhiku",
      name: "SimWar"
    });
    expect(workspace.replaceAll("\\", "/")).toContain("C:/graph-home/qidianzhiku-SimWar/");
    expect(workspace.replaceAll("\\", "/")).not.toContain("/source/.codegraph");
    expect(() => assertExternalGraphHome("D:/source/graph-home", "D:/source")).toThrow(
      "Graph home must be outside the source worktree"
    );
  });

  it("blocks planning on an unrefreshed product graph", () => {
    expect(
      evaluatePlanningGate({
        freshness: "STALE_PRODUCT_DELTA",
        architectureDeltaComplete: true,
        testImpactComplete: true,
        riskDeltaComplete: true,
        planningReality: "CURRENT",
        codeGraphStatus: "HEALTHY"
      }).status
    ).toBe("BLOCKED_STALE_GRAPH");
  });

  it("allows a complete exact graph for planning", () => {
    expect(
      evaluatePlanningGate({
        freshness: "CURRENT_EXACT_SHA",
        architectureDeltaComplete: true,
        testImpactComplete: true,
        riskDeltaComplete: true,
        planningReality: "CURRENT",
        codeGraphStatus: "HEALTHY"
      }).status
    ).toBe("PLAN_ALLOWED");
  });

  it("downgrades CodeGraph degradation to planning with explicit limits", () => {
    const gate = evaluatePlanningGate({
      freshness: "CURRENT_EXACT_SHA",
      architectureDeltaComplete: true,
      testImpactComplete: true,
      riskDeltaComplete: true,
      planningReality: "CURRENT",
      codeGraphStatus: "DEGRADED_CODEGRAPH"
    });
    expect(gate.status).toBe("PLAN_ALLOWED_WITH_LIMITS");
    expect(gate.limits).toContain("CODEGRAPH_DEGRADED_GRAPHIFY_ADJACENCY_FALLBACK");
  });

  it("downgrades an unproven Graphify health state without blocking current planning", () => {
    const gate = evaluatePlanningGate({
      freshness: "CURRENT_EXACT_SHA",
      architectureDeltaComplete: true,
      testImpactComplete: true,
      riskDeltaComplete: true,
      planningReality: "CURRENT",
      codeGraphStatus: "DEGRADED_GRAPHIFY"
    });
    expect(gate.status).toBe("PLAN_ALLOWED_WITH_LIMITS");
    expect(gate.limits).toContain("GRAPHIFY_HEALTH_UNPROVEN");
  });

  it("reports planning SHA drift without silently reconciling documents", () => {
    const gate = evaluatePlanningGate({
      freshness: "CURRENT_EXACT_SHA",
      architectureDeltaComplete: true,
      testImpactComplete: true,
      riskDeltaComplete: true,
      planningReality: "PLANNING_REALITY_DRIFT",
      codeGraphStatus: "HEALTHY"
    });
    expect(gate.status).toBe("PLAN_ALLOWED_WITH_LIMITS");
    expect(gate.limits).toContain("PLANNING_REALITY_DRIFT");
  });

  it("never emits an automatic successor authorization", () => {
    const gate = evaluatePlanningGate({
      freshness: "CURRENT_EXACT_SHA",
      architectureDeltaComplete: true,
      testImpactComplete: true,
      riskDeltaComplete: true,
      planningReality: "CURRENT",
      codeGraphStatus: "HEALTHY"
    });
    expect(gate.automatic_next_start).toBe(false);
  });
});
