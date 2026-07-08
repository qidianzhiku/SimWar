import type { L1GoldenM1CourseRuntimeConsolidationReport } from "./l1-golden-m1-course-runtime-consolidation.js";

export const L1_INTERNAL_VALIDATION_READY_REQUIRED_CAPABILITIES = [
  "teacher_course_operations_runtime",
  "student_decision_and_feedback_runtime",
  "tenant_admin_scoped_course_operations_summary",
  "platform_admin_explicit_authority_summary",
  "course_blueprint_runtime_binding",
  "scenario_parameter_plugin_seed_provenance",
  "team_role_scope_enforcement",
  "round_lifecycle_and_idempotency",
  "scenario_driven_golden_m1_runtime",
  "teacher_lock_settlement_publish_runtime",
  "student_redacted_three_part_feedback_runtime",
  "teacher_replay_evidence_workspace",
  "learning_evidence_ledger_runtime",
  "synthetic_internal_application_harness_v3",
  "course_delivery_audit_and_state_machine_evidence",
  "r8_g1_internal_only_rehearsal_kit",
  "l1_g0_g7_freshness_gate_ledger",
  "go_no_go_decision_pack"
] as const;

export const L1_INTERNAL_VALIDATION_READY_NON_PROOFS = [
  "G0_PASS",
  "L1_READY",
  "PILOT_READY",
  "PRODUCTION_READY",
  "POSTGRESQL_RUNTIME_READY",
  "DURABLE_SETTLEMENT_PROVEN"
] as const;

export type L1InternalValidationReadyCapability =
  (typeof L1_INTERNAL_VALIDATION_READY_REQUIRED_CAPABILITIES)[number];

export type L1InternalValidationReadyGate = "G0" | "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7";

export type L1InternalValidationReadyEvidenceLabel =
  | "CURRENT_GITHUB_READBACK"
  | "CURRENT_REMOTE_GIT_READBACK"
  | "POSTMERGE_MASTER_EVIDENCE"
  | "CODEGRAPH_MCP_EVIDENCE"
  | "GRAPHIFY_CODE_PREFLIGHT_EVIDENCE"
  | "CODEX_SECURITY_SEALED_SCAN"
  | "INTEGRATION_TEST_EVIDENCE"
  | "E2E_BROWSER_EVIDENCE"
  | "R4_DISCOVERY_EVIDENCE"
  | "R8_G1_REHEARSAL_KIT_EVIDENCE";

export interface L1InternalValidationReadyProgramEvidence {
  baselineValidation: {
    direct_store_delta: "NONE";
    status: "PASSED";
  };
  currentReadback: {
    candidate_branch: string;
    candidate_commit: string;
    closeout_keywords_observed: false;
    current_master_sha: string;
    issues: Array<{
      number: 111 | 114 | 115;
      state: "OPEN";
    }>;
    pr_number: 209;
    pr_state: "MERGED";
    pre_merge_master_sha: string;
    required_checks: Array<{
      name: "quality" | "browser-smoke" | "Analyze JavaScript and TypeScript";
      status: "pass";
    }>;
  };
  graphEvidence: {
    codegraph_mcp_used: true;
    docs_mcp_status: "NOT_AVAILABLE" | "USED";
    graphify_code_preflight: "PASSED";
  };
  protectedMainWorkspace: {
    path: "D:\\codex\\SimWar";
    touched_in_program_027: false;
  };
  securityScan: {
    findings: 0;
    scan_id: "10e5682e-d2bb-4a36-9a88-86781f4bc031";
    status: "complete / sealed";
  };
}

export interface L1InternalValidationReadyPackageInput {
  consolidation: L1GoldenM1CourseRuntimeConsolidationReport;
  programEvidence: L1InternalValidationReadyProgramEvidence;
  references: {
    currentEvidenceLedger: "docs/quality/l1-g0-g7-current-evidence-ledger.md";
    internalRehearsalKit: "docs/operations/r8-g1-l1-internal-validation-ready-package-draft.md";
    r4Discovery: "docs/architecture/r4-discovery-parity-gap-directory.md";
    readinessDocument: "docs/quality/l1-internal-validation-ready-package.md";
  };
}

export interface L1InternalValidationReadyPackage {
  capability_matrix: Array<{
    capability: L1InternalValidationReadyCapability;
    evidence_label: L1InternalValidationReadyEvidenceLabel;
    evidence_present: true;
  }>;
  direct_store_delta: "NONE";
  evidence_kind: "l1_internal_validation_ready_package";
  evidence_version: "l1-internal-validation-ready-package.v1";
  g0_g7_freshness_ledger: Array<{
    gate: L1InternalValidationReadyGate;
    evidence_label: L1InternalValidationReadyEvidenceLabel;
    source_master_sha: string;
    status: "CURRENT_EVIDENCE_PRESENT" | "BOUNDARY_HELD";
  }>;
  g0_pass: "NOT_GRANTED";
  g0_status: "EXCEPTION";
  go_no_go_decision_pack: {
    independent_evidence_review_required: true;
    merge_authorization: false;
    recommendation: "GO_FOR_INDEPENDENT_EVIDENCE_REVIEW_ONLY";
    release_authorization: false;
  };
  independent_evidence_review_required: true;
  l1_status: "NOT_READY";
  non_proofs: typeof L1_INTERNAL_VALIDATION_READY_NON_PROOFS;
  platform_admin_authority: {
    explicit_authority_required: true;
    platform_scope_not_inferred_from_tenant_admin: true;
  };
  pr209_reconciliation: {
    current_master_sha: string;
    head_commit: string;
    pre_merge_master_sha: string;
    pr_state: "MERGED";
  };
  references: L1InternalValidationReadyPackageInput["references"];
  replay_and_learning_boundary: {
    learning_evidence_excluded_from_truth_hash: true;
    replay_writes_formal_results: false;
    shadow_replay_writes_formal_results: false;
  };
  security_scan: L1InternalValidationReadyProgramEvidence["securityScan"];
  validation_boundary: "INTERNAL_VALIDATION_READY_PENDING_INDEPENDENT_REVIEW";
}

class L1InternalValidationReadyPackageError extends Error {
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "L1InternalValidationReadyPackageError";
  }
}

function assertCondition(condition: boolean, code: string, message: string): void {
  if (!condition) {
    throw new L1InternalValidationReadyPackageError(code, message);
  }
}

function isSha(value: string): boolean {
  return /^[a-f0-9]{40}$/.test(value);
}

function hasAllRequiredChecks(
  checks: L1InternalValidationReadyProgramEvidence["currentReadback"]["required_checks"]
): boolean {
  const names = new Set(
    checks.filter((check) => check.status === "pass").map((check) => check.name)
  );
  return (
    names.has("quality") &&
    names.has("browser-smoke") &&
    names.has("Analyze JavaScript and TypeScript")
  );
}

function assertConsolidation(consolidation: L1GoldenM1CourseRuntimeConsolidationReport): void {
  assertCondition(
    consolidation.evidence_kind === "l1_golden_m1_course_runtime_consolidation" &&
      consolidation.direct_store_delta === "NONE" &&
      consolidation.g0_status === "EXCEPTION" &&
      consolidation.g0_pass === "NOT_GRANTED" &&
      consolidation.l1_status === "NOT_READY" &&
      consolidation.independent_evidence_review_required,
    "L1_VALIDATION_READY_CONSOLIDATION_BOUNDARY_DRIFT",
    "internal validation package must consume synthetic consolidation evidence without status escalation"
  );
  assertCondition(
    consolidation.tenant_admin_scope.platform_admin_explicit_authority_required === true,
    "L1_VALIDATION_READY_PLATFORM_ADMIN_AUTHORITY_MISSING",
    "platform admin authority must remain explicit and cannot be inferred from tenant admin scope"
  );
  assertCondition(
    consolidation.replay_and_shadow.replay_writes_formal_results === false &&
      consolidation.replay_and_shadow.shadow_replay_writes_formal_results === false &&
      consolidation.replay_and_shadow.learning_evidence_excluded_from_truth_hash === true,
    "L1_VALIDATION_READY_REPLAY_BOUNDARY_DRIFT",
    "replay, shadow replay and learning evidence must remain non-writing"
  );
  assertCondition(
    consolidation.g0_g7_evidence.map((item) => item.gate).join(",") === "G0,G1,G2,G3,G4,G5,G6,G7",
    "L1_VALIDATION_READY_G0_G7_LEDGER_INCOMPLETE",
    "consolidation must provide a complete G0-G7 evidence ledger"
  );
  assertCondition(
    consolidation.non_proofs.every((item) =>
      (L1_INTERNAL_VALIDATION_READY_NON_PROOFS as readonly string[]).includes(item)
    ),
    "L1_VALIDATION_READY_NON_PROOF_MISMATCH",
    "internal validation package must preserve all non-proof boundaries"
  );
}

function assertProgramEvidence(evidence: L1InternalValidationReadyProgramEvidence): void {
  assertCondition(
    evidence.currentReadback.pr_number === 209 && evidence.currentReadback.pr_state === "MERGED",
    "L1_VALIDATION_READY_PR209_NOT_MERGED",
    "Program 027 only packages PR #209 after current readback proves it is merged"
  );
  assertCondition(
    isSha(evidence.currentReadback.current_master_sha) &&
      isSha(evidence.currentReadback.candidate_commit) &&
      isSha(evidence.currentReadback.pre_merge_master_sha),
    "L1_VALIDATION_READY_SHA_INVALID",
    "current master, candidate and pre-merge master must be concrete SHA values"
  );
  assertCondition(
    evidence.currentReadback.current_master_sha !== evidence.currentReadback.pre_merge_master_sha,
    "L1_VALIDATION_READY_MASTER_NOT_ADVANCED",
    "current master must be a post-PR #209 merge commit"
  );
  assertCondition(
    evidence.currentReadback.closeout_keywords_observed === false,
    "L1_VALIDATION_READY_ISSUE_CLOSEOUT_OBSERVED",
    "PR and package evidence must not close #111, #114 or #115"
  );
  assertCondition(
    evidence.currentReadback.issues.length === 3 &&
      evidence.currentReadback.issues.every((issue) => issue.state === "OPEN"),
    "L1_VALIDATION_READY_ISSUE_STATE_DRIFT",
    "#111, #114 and #115 must remain open"
  );
  assertCondition(
    hasAllRequiredChecks(evidence.currentReadback.required_checks),
    "L1_VALIDATION_READY_REQUIRED_CHECKS_NOT_PASSING",
    "quality, browser-smoke and Analyze JavaScript and TypeScript must be passing"
  );
  assertCondition(
    evidence.securityScan.status === "complete / sealed" && evidence.securityScan.findings === 0,
    "L1_VALIDATION_READY_SECURITY_SCAN_NOT_CLEAN",
    "associated Codex Security scan must be complete, sealed and contain zero findings"
  );
  assertCondition(
    evidence.graphEvidence.codegraph_mcp_used &&
      evidence.graphEvidence.graphify_code_preflight === "PASSED",
    "L1_VALIDATION_READY_GRAPH_EVIDENCE_MISSING",
    "CodeGraph MCP and Graphify code preflight evidence must be present"
  );
  assertCondition(
    evidence.baselineValidation.status === "PASSED" &&
      evidence.baselineValidation.direct_store_delta === "NONE",
    "L1_VALIDATION_READY_BASELINE_NOT_PASSED",
    "post-merge baseline validation must pass without direct-store delta"
  );
  assertCondition(
    evidence.protectedMainWorkspace.path === "D:\\codex\\SimWar" &&
      evidence.protectedMainWorkspace.touched_in_program_027 === false,
    "L1_VALIDATION_READY_PROTECTED_MAIN_BOUNDARY_BROKEN",
    "Program 027 must not read or use the protected main workspace"
  );
}

function buildCapabilityMatrix(): L1InternalValidationReadyPackage["capability_matrix"] {
  return L1_INTERNAL_VALIDATION_READY_REQUIRED_CAPABILITIES.map((capability) => ({
    capability,
    evidence_label:
      capability === "l1_g0_g7_freshness_gate_ledger"
        ? "POSTMERGE_MASTER_EVIDENCE"
        : capability === "r8_g1_internal_only_rehearsal_kit"
          ? "R8_G1_REHEARSAL_KIT_EVIDENCE"
          : capability === "go_no_go_decision_pack"
            ? "CURRENT_GITHUB_READBACK"
            : capability === "synthetic_internal_application_harness_v3"
              ? "E2E_BROWSER_EVIDENCE"
              : "INTEGRATION_TEST_EVIDENCE",
    evidence_present: true
  }));
}

function buildG0G7FreshnessLedger(
  consolidation: L1GoldenM1CourseRuntimeConsolidationReport,
  sourceMasterSha: string
): L1InternalValidationReadyPackage["g0_g7_freshness_ledger"] {
  return consolidation.g0_g7_evidence.map((item) => ({
    gate: item.gate,
    evidence_label:
      item.gate === "G0"
        ? "CURRENT_GITHUB_READBACK"
        : item.gate === "G7"
          ? "R8_G1_REHEARSAL_KIT_EVIDENCE"
          : "INTEGRATION_TEST_EVIDENCE",
    source_master_sha: sourceMasterSha,
    status: item.status
  }));
}

export function createL1InternalValidationReadyPackage(
  input: L1InternalValidationReadyPackageInput
): L1InternalValidationReadyPackage {
  assertConsolidation(input.consolidation);
  assertProgramEvidence(input.programEvidence);

  return {
    capability_matrix: buildCapabilityMatrix(),
    direct_store_delta: "NONE",
    evidence_kind: "l1_internal_validation_ready_package",
    evidence_version: "l1-internal-validation-ready-package.v1",
    g0_g7_freshness_ledger: buildG0G7FreshnessLedger(
      input.consolidation,
      input.programEvidence.currentReadback.current_master_sha
    ),
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
    non_proofs: L1_INTERNAL_VALIDATION_READY_NON_PROOFS,
    platform_admin_authority: {
      explicit_authority_required: true,
      platform_scope_not_inferred_from_tenant_admin: true
    },
    pr209_reconciliation: {
      current_master_sha: input.programEvidence.currentReadback.current_master_sha,
      head_commit: input.programEvidence.currentReadback.candidate_commit,
      pre_merge_master_sha: input.programEvidence.currentReadback.pre_merge_master_sha,
      pr_state: "MERGED"
    },
    references: input.references,
    replay_and_learning_boundary: {
      learning_evidence_excluded_from_truth_hash: true,
      replay_writes_formal_results: false,
      shadow_replay_writes_formal_results: false
    },
    security_scan: input.programEvidence.securityScan,
    validation_boundary: "INTERNAL_VALIDATION_READY_PENDING_INDEPENDENT_REVIEW"
  };
}
