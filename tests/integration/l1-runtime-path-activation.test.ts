import { describe, expect, it } from "vitest";
import {
  createL1RuntimePathActivationPackage,
  L1_RUNTIME_PATH_ACTIVATION_REQUIRED_ACTIONS,
  type L1RuntimeHelperPathClassification,
  type L1RuntimePathActivationInput,
  type L1RuntimePathEvidence
} from "../../services/api/src/l1-runtime-path-activation";

const PR_211_HEAD_COMMIT = "ff43654b742d408bdf88b5173de8812480a66777";
const PR_211_MERGE_COMMIT = "aa87f9a7bf17ce9502c8842efdbb5aee5442824c";

function createInternalValidationReadyPackage(): L1RuntimePathActivationInput["internalValidationReadyPackage"] {
  return {
    direct_store_delta: "NONE",
    evidence_kind: "l1_internal_validation_ready_package",
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    go_no_go_decision_pack: {
      independent_evidence_review_required: true,
      merge_authorization: false,
      recommendation: "GO_FOR_INDEPENDENT_EVIDENCE_REVIEW_ONLY",
      release_authorization: false
    },
    independent_evidence_review_required: true,
    l1_status: "NOT_READY",
    replay_and_learning_boundary: {
      learning_evidence_excluded_from_truth_hash: true,
      replay_writes_formal_results: false,
      shadow_replay_writes_formal_results: false
    },
    validation_boundary: "INTERNAL_VALIDATION_READY_PENDING_INDEPENDENT_REVIEW"
  };
}

function createRuntimePaths(
  overrides: Partial<Record<L1RuntimePathEvidence["action"], Partial<L1RuntimePathEvidence>>> = {}
): L1RuntimePathEvidence[] {
  const paths: L1RuntimePathEvidence[] = [
    {
      action: "course.publish",
      actor: "teacher",
      api_path: "/api/v1/courses/:courseId/publish",
      audit_event: "course.publish",
      classification: "RUNTIME_PATH",
      idempotency_evidence: "STABLE_RESPONSE",
      permission: "course:publish",
      request_id_required: true,
      source_reference: "services/api/src/server.ts",
      tenant_scope: "CURRENT_TENANT"
    },
    {
      action: "run.create",
      actor: "teacher",
      api_path: "/api/v1/courses/:courseId/runs",
      audit_event: "run.create",
      classification: "RUNTIME_PATH",
      idempotency_evidence: "NOT_APPLICABLE",
      permission: "run:create",
      request_id_required: true,
      source_reference: "services/api/src/server.ts",
      tenant_scope: "CURRENT_TENANT"
    },
    {
      action: "round.start",
      actor: "teacher",
      api_path: "/api/v1/runs/:runId/rounds/:roundNo/start",
      audit_event: "round.start",
      classification: "RUNTIME_PATH",
      idempotency_evidence: "NOT_APPLICABLE",
      permission: "round:start",
      request_id_required: true,
      source_reference: "services/api/src/server.ts",
      tenant_scope: "CURRENT_TENANT"
    },
    {
      action: "decision.submit",
      actor: "student",
      api_path: "/api/v1/runs/:runId/rounds/:roundNo/decisions",
      audit_event: "decision.submit",
      classification: "RUNTIME_PATH",
      idempotency_evidence: "STABLE_RESPONSE",
      permission: "decision:submit",
      request_id_required: true,
      source_reference: "services/api/src/server.ts",
      tenant_scope: "CURRENT_TENANT"
    },
    {
      action: "round.lock",
      actor: "teacher",
      api_path: "/api/v1/runs/:runId/rounds/:roundNo/lock",
      audit_event: "round.lock",
      classification: "RUNTIME_PATH",
      idempotency_evidence: "STABLE_RESPONSE",
      permission: "round:lock",
      request_id_required: true,
      source_reference: "services/api/src/server.ts",
      tenant_scope: "CURRENT_TENANT"
    },
    {
      action: "round.settle_requested",
      actor: "teacher",
      api_path: "/api/v1/runs/:runId/rounds/:roundNo/settle",
      audit_event: "round.settle_requested",
      classification: "RUNTIME_PATH",
      idempotency_evidence: "STABLE_RESPONSE",
      permission: "round:settle",
      request_id_required: true,
      source_reference: "services/api/src/server.ts",
      tenant_scope: "CURRENT_TENANT"
    },
    {
      action: "round.publish",
      actor: "teacher",
      api_path: "/api/v1/runs/:runId/rounds/:roundNo/publish",
      audit_event: "round.publish",
      classification: "RUNTIME_PATH",
      idempotency_evidence: "STABLE_RESPONSE",
      permission: "round:publish",
      request_id_required: true,
      source_reference: "services/api/src/server.ts",
      tenant_scope: "CURRENT_TENANT"
    },
    {
      action: "result.read",
      actor: "student",
      api_path: "/api/v1/runs/:runId/rounds/:roundNo/results",
      audit_event: null,
      classification: "RUNTIME_PATH",
      idempotency_evidence: "READ_ONLY",
      permission: "result:read",
      request_id_required: false,
      source_reference: "services/api/src/server.ts",
      student_projection: {
        forbidden_markers_observed: [],
        protected_truth_visible: false,
        redacted_result: true,
        replay_evidence_visible: false
      },
      tenant_scope: "CURRENT_TENANT"
    },
    {
      action: "demo_state.read",
      actor: "tenant_admin",
      api_path: "/api/v1/demo-state",
      audit_event: null,
      classification: "RUNTIME_PATH",
      idempotency_evidence: "READ_ONLY",
      permission: "demo:read",
      request_id_required: false,
      source_reference: "services/api/src/server.ts",
      tenant_scope: "CURRENT_TENANT"
    },
    {
      action: "audit.read",
      actor: "tenant_admin",
      api_path: "/api/v1/audit/logs",
      audit_event: null,
      classification: "RUNTIME_PATH",
      idempotency_evidence: "READ_ONLY",
      permission: "audit:read",
      request_id_required: false,
      source_reference: "services/api/src/server.ts",
      tenant_scope: "CURRENT_TENANT"
    }
  ];

  return paths.map((path) => ({
    ...path,
    ...(overrides[path.action] ?? {})
  }));
}

function createHelperClassifications(
  overrides: Partial<Record<string, Partial<L1RuntimeHelperPathClassification>>> = {}
): L1RuntimeHelperPathClassification[] {
  const classifications: L1RuntimeHelperPathClassification[] = [
    {
      classification: "HELPER_PATH",
      file: "services/api/src/l1-internal-validation-ready-package.ts",
      runtime_caller_observed: false,
      source_only_inference: true,
      symbol: "createL1InternalValidationReadyPackage",
      test_caller_observed: true
    },
    {
      classification: "HELPER_PATH",
      file: "services/api/src/l1-golden-m1-course-runtime-consolidation.ts",
      runtime_caller_observed: false,
      source_only_inference: true,
      symbol: "createL1GoldenM1CourseRuntimeConsolidationReport",
      test_caller_observed: true
    },
    {
      classification: "HELPER_PATH",
      file: "services/api/src/course-runtime-v3.ts",
      runtime_caller_observed: false,
      source_only_inference: true,
      symbol: "createCourseRuntimeV3Evidence",
      test_caller_observed: true
    },
    {
      classification: "RUNTIME_PATH",
      file: "services/api/src/server.ts",
      runtime_caller_observed: true,
      source_only_inference: false,
      symbol: "routeRequest",
      test_caller_observed: true
    }
  ];

  return classifications.map((classification) => ({
    ...classification,
    ...(overrides[classification.symbol] ?? {})
  }));
}

function createPackageInput(
  overrides: Partial<L1RuntimePathActivationInput> = {}
): L1RuntimePathActivationInput {
  return {
    helperPathClassifications: createHelperClassifications(),
    internalValidationReadyPackage: createInternalValidationReadyPackage(),
    programEvidence: {
      baseline_validation: "PASSED",
      codegraph_mcp_used: true,
      graphify_code_preflight: "PASSED",
      pr211_head_commit: PR_211_HEAD_COMMIT,
      pr211_merge_commit: PR_211_MERGE_COMMIT,
      protected_main_workspace_touched: false,
      security_scan: {
        findings: 0,
        scan_id: "9f8488be-fd4d-43e4-bbf2-6c2974ab41b3",
        status: "complete / sealed"
      }
    },
    references: {
      currentEvidenceLedger: "docs/quality/l1-g0-g7-current-evidence-ledger.md",
      r4Discovery: "docs/architecture/r4-discovery-parity-gap-directory.md",
      readinessDocument: "docs/quality/l1-runtime-path-activation.md",
      rehearsalDraft: "docs/operations/r8-g1-l1-runtime-path-activation-draft.md"
    },
    runtimePaths: createRuntimePaths(),
    ...overrides
  };
}

describe("L1 runtime path activation package", () => {
  it("connects the internal validation package to existing controlled runtime paths", () => {
    const report = createL1RuntimePathActivationPackage(createPackageInput());

    expect(report.evidence_kind).toBe("l1_runtime_path_activation_package");
    expect(report.evidence_version).toBe("l1-runtime-path-activation.v1");
    expect(report.g0_status).toBe("EXCEPTION");
    expect(report.g0_pass).toBe("NOT_GRANTED");
    expect(report.l1_status).toBe("NOT_READY");
    expect(report.direct_store_delta).toBe("NONE");
    expect(report.runtime_path_activation_boundary).toBe(
      "EXISTING_CONTROLLED_API_PATHS_CONNECTED_PENDING_INDEPENDENT_REVIEW"
    );
    expect(report.runtime_path_matrix.map((path) => path.action)).toEqual([
      ...L1_RUNTIME_PATH_ACTIVATION_REQUIRED_ACTIONS
    ]);
    expect(report.helper_path_classification).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "HELPER_PATH",
          runtime_caller_observed: false,
          symbol: "createL1InternalValidationReadyPackage"
        }),
        expect.objectContaining({
          classification: "RUNTIME_PATH",
          runtime_caller_observed: true,
          symbol: "routeRequest"
        })
      ])
    );
    expect(report.pr211_reconciliation).toEqual({
      head_commit: PR_211_HEAD_COMMIT,
      merge_commit: PR_211_MERGE_COMMIT,
      pr_state: "MERGED"
    });
    expect(report.security_scan).toEqual({
      findings: 0,
      scan_id: "9f8488be-fd4d-43e4-bbf2-6c2974ab41b3",
      status: "complete / sealed"
    });
    expect(report.non_proofs).toEqual(
      expect.arrayContaining([
        "G0_PASS",
        "L1_READY",
        "PILOT_READY",
        "PRODUCTION_READY",
        "POSTGRESQL_RUNTIME_READY",
        "DURABLE_SETTLEMENT_PROVEN"
      ])
    );
  });

  it("fails closed when helper-only evidence is misclassified as a runtime path", () => {
    expect(() =>
      createL1RuntimePathActivationPackage({
        ...createPackageInput(),
        helperPathClassifications: createHelperClassifications({
          createL1InternalValidationReadyPackage: {
            classification: "RUNTIME_PATH"
          }
        })
      })
    ).toThrow(/L1_RUNTIME_PATH_HELPER_ONLY_MISCLASSIFIED/);
  });

  it("fails closed when a required runtime action is missing", () => {
    expect(() =>
      createL1RuntimePathActivationPackage({
        ...createPackageInput(),
        runtimePaths: createRuntimePaths().filter((path) => path.action !== "result.read")
      })
    ).toThrow(/L1_RUNTIME_PATH_REQUIRED_ACTION_MISSING/);
  });

  it("fails closed when the student result runtime path exposes protected markers", () => {
    expect(() =>
      createL1RuntimePathActivationPackage({
        ...createPackageInput(),
        runtimePaths: createRuntimePaths({
          "result.read": {
            student_projection: {
              forbidden_markers_observed: ["state_true"],
              protected_truth_visible: false,
              redacted_result: true,
              replay_evidence_visible: false
            }
          }
        })
      })
    ).toThrow(/L1_RUNTIME_PATH_STUDENT_PROJECTION_LEAK/);
  });
});
