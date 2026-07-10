import { existsSync, readFileSync } from "node:fs";
import {
  createR7RuntimeAdapterPreparationPackage,
  R7_RUNTIME_ADAPTER_PREPARATION_EXPLICIT_NON_PROOFS,
  R7_RUNTIME_ADAPTER_PREPARATION_SOURCE_MASTER_SHA,
  validateR7RuntimeAdapterPreparationPackage
} from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";

const EXPECTED_MASTER = "9bc3c1dac3491fd6103fb50354bff566b75579ef";
const RELATION_ONLY_ISSUES = ["Relates to #111", "Relates to #114", "Relates to #115"] as const;

const docs = [
  "docs/architecture/r7-runtime-adapter-preparation-no-activation.md",
  "docs/quality/r7-runtime-adapter-compatibility-matrix.md",
  "docs/quality/r7-scenario-evidence-ledger.md",
  "docs/quality/r7-runtime-adapter-no-go-register.md",
  "docs/operations/r7-runtime-adapter-boundary.md"
] as const;

const forbiddenBoundaryTerms = [
  "state_true",
  "SettlementResult",
  "truth_hash",
  "replay_hash",
  "manifest_hash",
  "canonical_evidence_digest",
  "official_parameter_set",
  "official_scenario_binding",
  "official_replay_result",
  "plugin_runtime_trace",
  "ai_formal_output"
] as const;

function readRequired(path: string): string {
  expect(existsSync(path), `${path} must exist`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("R7 runtime adapter preparation without activation", () => {
  it("creates a contract-only runtime adapter preparation package", () => {
    const packageDraft = createR7RuntimeAdapterPreparationPackage();

    expect(packageDraft.evidence_kind).toBe("r7_runtime_adapter_preparation_no_activation");
    expect(packageDraft.evidence_version).toBe("r7-runtime-adapter-preparation-no-activation.v1");
    expect(packageDraft.source_master_sha).toBe(EXPECTED_MASTER);
    expect(R7_RUNTIME_ADAPTER_PREPARATION_SOURCE_MASTER_SHA).toBe(EXPECTED_MASTER);
    expect(packageDraft.status).toBe("PREPARATION_PACKAGE_ONLY");
    expect(packageDraft.g0_status).toBe("EXCEPTION");
    expect(packageDraft.g0_pass).toBe("NOT_GRANTED");
    expect(packageDraft.l1_status).toBe("NOT_READY");
    expect(packageDraft.r8_g1_status).toBe("INTERNAL_ONLY_DRAFT_NOT_RELEASED");
    expect(packageDraft.direct_store_delta).toBe("NONE");

    expect(packageDraft.selection_reference.status).toBe(
      "TEACHER_SELECTION_BOUNDARY_MERGED_AND_POSTMERGE_VALIDATED"
    );
    expect(packageDraft.adapter_contract.adapter_status).toBe("DRAFT_CONTRACT_ONLY");
    expect(packageDraft.adapter_contract.source_runtime_path).toBe("NOT_BOUND_TO_RUNTIME_ROUTE");
    expect(packageDraft.adapter_contract.allowed_future_gate).toBe(
      "OWNER_AUTHORIZED_R7_SCENARIO_RUNTIME_ADAPTER"
    );
    expect(validateR7RuntimeAdapterPreparationPackage(packageDraft)).toEqual({
      issues: [],
      ok: true
    });
  });

  it("fails closed for runtime, route, IO, ParameterSet, truth and Replay drift", () => {
    const packageDraft = createR7RuntimeAdapterPreparationPackage();

    const drifts = [
      {
        expectedIssue: "R7_RUNTIME_ADAPTER_RUNTIME_ACTIVATION_DRIFT",
        patch: {
          runtime_route_enabled: true
        }
      },
      {
        expectedIssue: "R7_RUNTIME_ADAPTER_RUNTIME_ACTIVATION_DRIFT",
        patch: {
          scenario_runtime_executes: true
        }
      },
      {
        expectedIssue: "R7_RUNTIME_ADAPTER_IO_OR_DATABASE_DRIFT",
        patch: {
          io_enabled: true
        }
      },
      {
        expectedIssue: "R7_RUNTIME_ADAPTER_PARAMETERSET_WRITE_DRIFT",
        patch: {
          official_parameter_set_write: true
        }
      },
      {
        expectedIssue: "R7_RUNTIME_ADAPTER_TRUTH_AUTHORITY_DRIFT",
        patch: {
          settlement_result_write: true
        }
      },
      {
        expectedIssue: "R7_RUNTIME_ADAPTER_REPLAY_SEMANTICS_DRIFT",
        patch: {
          replay_executes: true
        }
      },
      {
        expectedIssue: "R7_RUNTIME_ADAPTER_STUDENT_VISIBILITY_DRIFT",
        patch: {
          student_visibility_expansion: true
        }
      }
    ] as const;

    for (const drift of drifts) {
      expect(
        validateR7RuntimeAdapterPreparationPackage({
          ...packageDraft,
          boundary: {
            ...packageDraft.boundary,
            ...drift.patch
          }
        })
      ).toEqual({
        issues: [drift.expectedIssue],
        ok: false
      });
    }
  });

  it("preserves authorization, advisory and Plugin runtime boundaries", () => {
    const packageDraft = createR7RuntimeAdapterPreparationPackage();

    expect(packageDraft.runtime_authorization).toEqual({
      ai_runtime: "NOT_AUTHORIZED",
      durable_settlement: "NOT_PROVEN",
      pilot: "NOT_AUTHORIZED",
      plugin_runtime: "NOT_AUTHORIZED",
      postgresql_runtime: "NOT_AUTHORIZED",
      production: "NOT_AUTHORIZED",
      scenario_factory_runtime_route: "NOT_AUTHORIZED",
      scenario_runtime_adapter_route: "NOT_AUTHORIZED",
      shadow_replay_runtime: "NOT_AUTHORIZED",
      teacher_bff_runtime_route: "NOT_AUTHORIZED"
    });
    expect(packageDraft.advisory_boundary.advisory_only).toBe(true);
    expect(packageDraft.advisory_boundary.ai_writes_formal_truth).toBe(false);
    expect(packageDraft.plugin_boundary.plugin_runtime_enabled).toBe(false);
    expect(packageDraft.plugin_boundary.plugin_trace_write).toBe(false);

    for (const term of forbiddenBoundaryTerms) {
      expect(packageDraft.forbidden_writes).toContain(term);
    }
  });

  it("preserves explicit non-proofs and no-go register triggers", () => {
    const packageDraft = createR7RuntimeAdapterPreparationPackage();

    expect(packageDraft.explicit_non_proofs).toBe(
      R7_RUNTIME_ADAPTER_PREPARATION_EXPLICIT_NON_PROOFS
    );
    expect(R7_RUNTIME_ADAPTER_PREPARATION_EXPLICIT_NON_PROOFS).toEqual([
      "Runtime adapter preparation != Scenario runtime activation",
      "Runtime adapter preparation != runtime API route",
      "Runtime adapter preparation != Teacher scenario selection UI",
      "Runtime adapter preparation != official Scenario binding",
      "Runtime adapter preparation != official ParameterSet write",
      "Runtime adapter preparation != Shadow Replay execution",
      "Runtime adapter preparation != Plugin runtime",
      "Runtime adapter preparation != AI advisory runtime",
      "Runtime adapter preparation != R8-G1 release",
      "Runtime adapter preparation != Pilot readiness",
      "Runtime adapter preparation != Production readiness"
    ]);
    expect(packageDraft.no_go_register).toContain("runtime_route_enabled");
    expect(packageDraft.no_go_register).toContain("official_parameter_set_write");
    expect(packageDraft.no_go_register).toContain("state_true_exposure");
    expect(packageDraft.no_go_register).toContain("student_visibility_expansion");
  });

  it("ships docs and source without closeout wording or runtime imports", () => {
    const combinedDocs = docs.map(readRequired).join("\n");
    const source = readRequired("packages/shared-contracts/src/scenario-runtime-adapter.ts");

    for (const path of docs) {
      const doc = readRequired(path);

      expect(doc).toContain(EXPECTED_MASTER);
      expect(doc).toContain("G0 Status:");
      expect(doc).toContain("EXCEPTION");
      expect(doc).toContain("G0 PASS:");
      expect(doc).toContain("NOT_GRANTED");
      expect(doc).toContain("L1 Status:");
      expect(doc).toContain("NOT_READY");
      expect(doc).toContain("R8-G1 Status:");
      expect(doc).toContain("INTERNAL_ONLY_DRAFT_NOT_RELEASED");

      for (const issue of RELATION_ONLY_ISSUES) {
        expect(doc).toContain(issue);
      }
    }

    expect(combinedDocs).toContain("Runtime adapter preparation without activation");
    expect(combinedDocs).toContain("runtime_route_enabled = false");
    expect(combinedDocs).toContain("scenario_runtime_executes = false");
    expect(combinedDocs).toContain("official_parameter_set_write = false");
    expect(combinedDocs).toContain("shadow_replay_overwrites_official_result = false");
    expect(combinedDocs).toContain("student_visibility_expansion = false");
    expect(combinedDocs).not.toMatch(/\b(Fixes|Closes|Resolves)\s+#(111|114|115)\b/i);

    expect(source).not.toContain("node:fs");
    expect(source).not.toContain("services/api");
    expect(source).not.toContain("apps/");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("writeFile");
    expect(source).not.toContain("readFile");
  });
});
