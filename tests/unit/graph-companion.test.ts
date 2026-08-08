import { describe, expect, it } from "vitest";
import {
  buildArchitectureDelta,
  buildSourceManifest,
  buildTestImpact,
  classifyFreshness,
  evaluatePlanningGate,
  parseCodeGraphAffected,
  parseCodeGraphStatus,
  resolveGraphHome
} from "../../scripts/graph-companion.mjs";

describe("Graph Companion V1 pure contracts", () => {
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
  });

  it("builds a deterministic code manifest while tracking planning files separately", () => {
    const first = buildSourceManifest({
      files: [
        { path: "services/api/src/server.ts", content: "export const server = 1;" },
        { path: "docs/planning/current-cycle.yaml", content: "source_sha: old\n" },
        { path: "README.md", content: "docs" }
      ]
    });
    const second = buildSourceManifest({
      files: [
        { path: "README.md", content: "docs" },
        { path: "docs/planning/current-cycle.yaml", content: "source_sha: old\n" },
        { path: "services/api/src/server.ts", content: "export const server = 1;" }
      ]
    });
    expect(first.code_digest).toBe(second.code_digest);
    expect(first.entries).toHaveLength(1);
    expect(first.planning_files).toEqual(["docs/planning/current-cycle.yaml"]);
    expect(first.entries[0].classification).toBe("RUNTIME");
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
      changedFiles: ["services/api/src/server.ts", "unknown.bin"],
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
