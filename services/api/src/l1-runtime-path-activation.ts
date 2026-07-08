import type { L1InternalValidationReadyPackage } from "./l1-internal-validation-ready-package.js";

export const L1_RUNTIME_PATH_ACTIVATION_REQUIRED_ACTIONS = [
  "course.publish",
  "run.create",
  "round.start",
  "decision.submit",
  "round.lock",
  "round.settle_requested",
  "round.publish",
  "result.read",
  "demo_state.read",
  "audit.read"
] as const;

export const L1_RUNTIME_PATH_ACTIVATION_NON_PROOFS = [
  "G0_PASS",
  "L1_READY",
  "PILOT_READY",
  "PRODUCTION_READY",
  "POSTGRESQL_RUNTIME_READY",
  "DURABLE_SETTLEMENT_PROVEN",
  "R4_MACRO_READY"
] as const;

export const L1_RUNTIME_PATH_ACTIVATION_FORBIDDEN_STUDENT_MARKERS = [
  "state_true",
  "truth_hash",
  "canonical_evidence_digest",
  "decision_batch_hash",
  "json_runtime_source_digest",
  "manifest_hash",
  "replay_hash",
  "private_replay_evidence",
  "other_tenant_data"
] as const;

export type L1RuntimePathAction = (typeof L1_RUNTIME_PATH_ACTIVATION_REQUIRED_ACTIONS)[number];

export type L1RuntimePathClassification =
  | "RUNTIME_PATH"
  | "HELPER_PATH"
  | "TEST_PATH"
  | "DOC_PATH"
  | "BROWSER_SMOKE_PATH";

export type L1RuntimePathActor =
  | "teacher"
  | "student"
  | "tenant_admin"
  | "platform_admin"
  | "service_kernel";

export interface L1RuntimePathEvidence {
  action: L1RuntimePathAction;
  actor: L1RuntimePathActor;
  api_path: string;
  audit_event: string | null;
  classification: "RUNTIME_PATH";
  idempotency_evidence: "STABLE_RESPONSE" | "READ_ONLY" | "NOT_APPLICABLE";
  permission: string;
  request_id_required: boolean;
  source_reference: string;
  student_projection?: {
    forbidden_markers_observed: string[];
    protected_truth_visible: false;
    replay_evidence_visible: false;
    redacted_result: true;
  };
  tenant_scope: "CURRENT_TENANT" | "EXPLICIT_PLATFORM_SCOPE" | "SERVICE_INTERNAL";
}

export interface L1RuntimeHelperPathClassification {
  classification: Exclude<L1RuntimePathClassification, "BROWSER_SMOKE_PATH">;
  file: string;
  runtime_caller_observed: boolean;
  source_only_inference: boolean;
  symbol: string;
  test_caller_observed: boolean;
}

export interface L1RuntimePathActivationInput {
  helperPathClassifications: L1RuntimeHelperPathClassification[];
  internalValidationReadyPackage: Pick<
    L1InternalValidationReadyPackage,
    | "direct_store_delta"
    | "evidence_kind"
    | "g0_pass"
    | "g0_status"
    | "go_no_go_decision_pack"
    | "independent_evidence_review_required"
    | "l1_status"
    | "replay_and_learning_boundary"
    | "validation_boundary"
  >;
  programEvidence: {
    baseline_validation: "PASSED";
    codegraph_mcp_used: true;
    graphify_code_preflight: "PASSED";
    pr211_head_commit: string;
    pr211_merge_commit: string;
    protected_main_workspace_touched: false;
    security_scan: {
      findings: 0;
      scan_id: string;
      status: "complete / sealed";
    };
  };
  references: {
    currentEvidenceLedger: "docs/quality/l1-g0-g7-current-evidence-ledger.md";
    r4Discovery: "docs/architecture/r4-discovery-parity-gap-directory.md";
    readinessDocument: "docs/quality/l1-runtime-path-activation.md";
    rehearsalDraft: "docs/operations/r8-g1-l1-runtime-path-activation-draft.md";
  };
  runtimePaths: L1RuntimePathEvidence[];
}

export interface L1RuntimePathActivationPackage {
  direct_store_delta: "NONE";
  evidence_kind: "l1_runtime_path_activation_package";
  evidence_version: "l1-runtime-path-activation.v1";
  g0_pass: "NOT_GRANTED";
  g0_status: "EXCEPTION";
  helper_path_classification: L1RuntimeHelperPathClassification[];
  independent_evidence_review_required: true;
  l1_status: "NOT_READY";
  non_proofs: typeof L1_RUNTIME_PATH_ACTIVATION_NON_PROOFS;
  pr211_reconciliation: {
    head_commit: string;
    merge_commit: string;
    pr_state: "MERGED";
  };
  references: L1RuntimePathActivationInput["references"];
  runtime_path_activation_boundary: "EXISTING_CONTROLLED_API_PATHS_CONNECTED_PENDING_INDEPENDENT_REVIEW";
  runtime_path_matrix: L1RuntimePathEvidence[];
  security_scan: L1RuntimePathActivationInput["programEvidence"]["security_scan"];
  validation_boundary: "RUNTIME_PATH_ACTIVATION_PENDING_INDEPENDENT_EVIDENCE_REVIEW";
}

class L1RuntimePathActivationError extends Error {
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "L1RuntimePathActivationError";
  }
}

function assertCondition(condition: boolean, code: string, message: string): void {
  if (!condition) {
    throw new L1RuntimePathActivationError(code, message);
  }
}

function isSha(value: string): boolean {
  return /^[a-f0-9]{40}$/.test(value);
}

function assertInternalValidationPackage(
  internalValidationReadyPackage: L1RuntimePathActivationInput["internalValidationReadyPackage"]
): void {
  assertCondition(
    internalValidationReadyPackage.evidence_kind === "l1_internal_validation_ready_package" &&
      internalValidationReadyPackage.direct_store_delta === "NONE" &&
      internalValidationReadyPackage.g0_status === "EXCEPTION" &&
      internalValidationReadyPackage.g0_pass === "NOT_GRANTED" &&
      internalValidationReadyPackage.l1_status === "NOT_READY" &&
      internalValidationReadyPackage.independent_evidence_review_required,
    "L1_RUNTIME_PATH_INTERNAL_PACKAGE_BOUNDARY_DRIFT",
    "runtime path activation must consume the internal validation package without status escalation"
  );
  assertCondition(
    internalValidationReadyPackage.validation_boundary ===
      "INTERNAL_VALIDATION_READY_PENDING_INDEPENDENT_REVIEW",
    "L1_RUNTIME_PATH_INTERNAL_PACKAGE_NOT_REVIEW_PENDING",
    "internal validation package must still be pending independent evidence review"
  );
  assertCondition(
    internalValidationReadyPackage.go_no_go_decision_pack.merge_authorization === false &&
      internalValidationReadyPackage.go_no_go_decision_pack.release_authorization === false,
    "L1_RUNTIME_PATH_INTERNAL_PACKAGE_AUTHORIZATION_DRIFT",
    "internal validation package must not authorize merge or release"
  );
  assertCondition(
    internalValidationReadyPackage.replay_and_learning_boundary
      .learning_evidence_excluded_from_truth_hash &&
      !internalValidationReadyPackage.replay_and_learning_boundary.replay_writes_formal_results &&
      !internalValidationReadyPackage.replay_and_learning_boundary
        .shadow_replay_writes_formal_results,
    "L1_RUNTIME_PATH_INTERNAL_PACKAGE_REPLAY_BOUNDARY_DRIFT",
    "runtime path activation must preserve replay, shadow replay and learning evidence boundaries"
  );
}

function assertProgramEvidence(evidence: L1RuntimePathActivationInput["programEvidence"]): void {
  assertCondition(
    isSha(evidence.pr211_head_commit) && isSha(evidence.pr211_merge_commit),
    "L1_RUNTIME_PATH_SHA_INVALID",
    "PR #211 head and merge commits must be concrete SHA values"
  );
  assertCondition(
    evidence.pr211_head_commit !== evidence.pr211_merge_commit,
    "L1_RUNTIME_PATH_PR211_NOT_MERGED",
    "runtime path activation requires PR #211 to be merged before packaging"
  );
  assertCondition(
    evidence.baseline_validation === "PASSED" &&
      evidence.codegraph_mcp_used &&
      evidence.graphify_code_preflight === "PASSED",
    "L1_RUNTIME_PATH_PROGRAM_EVIDENCE_INCOMPLETE",
    "baseline validation, CodeGraph MCP and Graphify code preflight evidence must be present"
  );
  assertCondition(
    evidence.protected_main_workspace_touched === false,
    "L1_RUNTIME_PATH_PROTECTED_MAIN_TOUCHED",
    "Program 028 must not use the protected main workspace"
  );
  assertCondition(
    evidence.security_scan.status === "complete / sealed" && evidence.security_scan.findings === 0,
    "L1_RUNTIME_PATH_SECURITY_SCAN_NOT_CLEAN",
    "runtime path activation requires a complete sealed security scan with zero findings"
  );
}

function assertRuntimePaths(runtimePaths: L1RuntimePathEvidence[]): void {
  const actionSet = new Set(runtimePaths.map((path) => path.action));
  for (const action of L1_RUNTIME_PATH_ACTIVATION_REQUIRED_ACTIONS) {
    assertCondition(
      actionSet.has(action),
      "L1_RUNTIME_PATH_REQUIRED_ACTION_MISSING",
      `runtime path matrix must include ${action}`
    );
  }

  for (const path of runtimePaths) {
    assertCondition(
      path.classification === "RUNTIME_PATH" && path.api_path.startsWith("/api/v1/"),
      "L1_RUNTIME_PATH_CLASSIFICATION_INVALID",
      "runtime path evidence must point at an existing controlled API path"
    );

    const isMutationPath = !["result.read", "demo_state.read", "audit.read"].includes(path.action);
    if (isMutationPath) {
      assertCondition(
        Boolean(path.audit_event) && path.request_id_required && path.permission.length > 0,
        "L1_RUNTIME_PATH_MUTATION_GUARD_MISSING",
        "mutation runtime paths must carry permission, request-id and audit evidence"
      );
    }

    if (path.action === "result.read") {
      assertCondition(
        Boolean(path.student_projection) &&
          path.student_projection?.redacted_result === true &&
          path.student_projection?.protected_truth_visible === false &&
          path.student_projection?.replay_evidence_visible === false,
        "L1_RUNTIME_PATH_STUDENT_PROJECTION_NOT_REDACTED",
        "student result runtime path must remain redacted"
      );
      assertCondition(
        path.student_projection?.forbidden_markers_observed.length === 0,
        "L1_RUNTIME_PATH_STUDENT_PROJECTION_LEAK",
        "student result runtime path must not expose protected markers"
      );
    }
  }
}

function assertHelperClassifications(
  helperPathClassifications: L1RuntimeHelperPathClassification[]
): void {
  const helperSymbols = new Set(helperPathClassifications.map((path) => path.symbol));
  for (const requiredSymbol of [
    "createL1InternalValidationReadyPackage",
    "createL1GoldenM1CourseRuntimeConsolidationReport",
    "createCourseRuntimeV3Evidence"
  ]) {
    assertCondition(
      helperSymbols.has(requiredSymbol),
      "L1_RUNTIME_PATH_HELPER_CLASSIFICATION_MISSING",
      `helper path matrix must classify ${requiredSymbol}`
    );
  }

  for (const item of helperPathClassifications) {
    if (item.classification === "RUNTIME_PATH") {
      assertCondition(
        item.runtime_caller_observed,
        "L1_RUNTIME_PATH_HELPER_ONLY_MISCLASSIFIED",
        "helper-only evidence cannot be classified as a runtime path"
      );
    }
    if (item.symbol.startsWith("createL1") || item.symbol.startsWith("createCourseRuntime")) {
      assertCondition(
        item.classification === "HELPER_PATH" && item.source_only_inference,
        "L1_RUNTIME_PATH_HELPER_BOUNDARY_DRIFT",
        "synthetic evidence factories must remain helper paths unless a runtime caller is observed"
      );
    }
  }
}

export function createL1RuntimePathActivationPackage(
  input: L1RuntimePathActivationInput
): L1RuntimePathActivationPackage {
  assertInternalValidationPackage(input.internalValidationReadyPackage);
  assertProgramEvidence(input.programEvidence);
  assertRuntimePaths(input.runtimePaths);
  assertHelperClassifications(input.helperPathClassifications);

  return {
    direct_store_delta: "NONE",
    evidence_kind: "l1_runtime_path_activation_package",
    evidence_version: "l1-runtime-path-activation.v1",
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    helper_path_classification: input.helperPathClassifications,
    independent_evidence_review_required: true,
    l1_status: "NOT_READY",
    non_proofs: L1_RUNTIME_PATH_ACTIVATION_NON_PROOFS,
    pr211_reconciliation: {
      head_commit: input.programEvidence.pr211_head_commit,
      merge_commit: input.programEvidence.pr211_merge_commit,
      pr_state: "MERGED"
    },
    references: input.references,
    runtime_path_activation_boundary:
      "EXISTING_CONTROLLED_API_PATHS_CONNECTED_PENDING_INDEPENDENT_REVIEW",
    runtime_path_matrix: input.runtimePaths,
    security_scan: input.programEvidence.security_scan,
    validation_boundary: "RUNTIME_PATH_ACTIVATION_PENDING_INDEPENDENT_EVIDENCE_REVIEW"
  };
}
