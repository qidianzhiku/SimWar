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

export type L1ClosureIssueState = "OPEN" | "CLOSED";

export type L1ClosureHumanValidation =
  | "NOT_PERFORMED"
  | "WAIVED_BY_OWNER_NOT_PERFORMED"
  | "HUMAN_VALIDATION_COMPLETED";

export interface L1AutomatedClosureEvidenceArtifact {
  payload: Record<string, unknown>;
  sha256: string;
}

export interface L1AutomatedClosureEvidenceInput {
  current_facts: {
    ci: {
      browser_smoke: "PASS";
      codeql: "PASS";
      quality: "PASS";
      source_sha: string;
    };
    fresh_clone: {
      source_sha: string;
      status: "PASS";
    };
    issues: {
      issue_111: L1ClosureIssueState;
      issue_114: L1ClosureIssueState;
      issue_115: L1ClosureIssueState;
    };
    source_sha: string;
  };
  human_validation: L1ClosureHumanValidation;
  known_limits: L1AutomatedClosureEvidenceArtifact;
  phase7_core: {
    evidence_order: L1AutomatedClosureEvidenceArtifact;
    run_a: L1AutomatedClosureEvidenceArtifact;
    run_a_freeze: L1AutomatedClosureEvidenceArtifact;
    run_b_lifecycle: L1AutomatedClosureEvidenceArtifact;
  };
}

export interface L1AutomatedClosureEvidencePack {
  classification: "AUTOMATED_INTERNAL_APPLICATION_VALIDATION";
  core_evidence_sha256: {
    phase7_evidence_order: string;
    run_a_evidence: string;
    run_a_freeze: string;
    run_b_lifecycle: string;
  };
  explicit_non_proofs: readonly [
    "HUMAN_VALIDATION_NOT_PERFORMED",
    "POSTGRESQL_NOT_ACTIVE",
    "DURABLE_SETTLEMENT_NOT_PROVEN",
    "DURABLE_RECOVERY_NOT_PROVEN",
    "PILOT_NOT_AUTHORIZED",
    "PRODUCTION_NOT_AUTHORIZED"
  ];
  human_validation: Exclude<L1ClosureHumanValidation, "HUMAN_VALIDATION_COMPLETED">;
  issue_disposition: {
    issue_111: "OPEN_KNOWN_LIMIT";
    issue_114: "CLOSED";
    issue_115: "CLOSED";
  };
  known_limits_sha256: string;
  machine_validation: "PASS";
  owner_acknowledgment: "NOT_ISSUED";
  schema_version: "simwar.l1.automated-closure-evidence.v1";
  source_sha: string;
  status: "AUTOMATED_EVIDENCE_COMPLETE_OWNER_ACKNOWLEDGMENT_REQUIRED";
}

function asClosureRecord(value: unknown, label: string): Record<string, unknown> {
  assertCondition(
    value !== null && !Array.isArray(value) && typeof value === "object",
    "L1_CLOSURE_EVIDENCE_PAYLOAD_INVALID",
    `${label} must be an object`
  );
  return value as Record<string, unknown>;
}

function assertClosureExactValue(value: unknown, expected: unknown, label: string): void {
  assertCondition(
    value === expected,
    "L1_CLOSURE_EVIDENCE_PAYLOAD_INVALID",
    `${label} must equal ${String(expected)}`
  );
}

function assertClosureSha(value: string, label: string): void {
  assertCondition(
    /^[a-f0-9]{64}$/.test(value),
    "L1_CLOSURE_EVIDENCE_HASH_INVALID",
    `${label} must be a lowercase SHA-256`
  );
}

function assertClosureSourceSha(value: unknown, expectedSourceSha: string, label: string): void {
  assertCondition(
    value === expectedSourceSha,
    "L1_CLOSURE_EVIDENCE_SOURCE_SHA_DRIFT",
    `${label} must equal the current source SHA`
  );
}

function assertZeroCounts(value: unknown, label: string): void {
  const record = asClosureRecord(value, label);
  assertCondition(
    Object.keys(record).length > 0 && Object.values(record).every((entry) => entry === 0),
    "L1_CLOSURE_EVIDENCE_BOUNDARY_FAILED",
    `${label} must contain only zero counts`
  );
}

function assertEmptyArray(value: unknown, label: string): void {
  assertCondition(
    Array.isArray(value) && value.length === 0,
    "L1_CLOSURE_EVIDENCE_BOUNDARY_FAILED",
    `${label} must be an empty array`
  );
}

function asStringSet(value: unknown, label: string): Set<string> {
  assertCondition(
    Array.isArray(value) && value.every((entry) => typeof entry === "string"),
    "L1_CLOSURE_EVIDENCE_PAYLOAD_INVALID",
    `${label} must be a string array`
  );
  return new Set(value as string[]);
}

function assertHasAll(values: Set<string>, required: readonly string[], label: string): void {
  assertCondition(
    required.every((entry) => values.has(entry)),
    "L1_CLOSURE_EVIDENCE_KNOWN_LIMITS_INCOMPLETE",
    `${label} is missing a required disclosure`
  );
}

function assertNoResolvedIssueDisclosure(values: Set<string>): void {
  assertCondition(
    !values.has("ISSUE_114_OPEN") && !values.has("ISSUE_115_OPEN"),
    "L1_CLOSURE_EVIDENCE_ISSUE_DISPOSITION_INVALID",
    "resolved issue disclosures must not remain in current Known Limits"
  );
}

function assertArtifact(
  artifact: L1AutomatedClosureEvidenceArtifact,
  expectedSourceSha: string,
  label: string
): Record<string, unknown> {
  assertClosureSha(artifact.sha256, `${label}.sha256`);
  const payload = asClosureRecord(artifact.payload, `${label}.payload`);
  assertClosureSourceSha(payload.source_sha, expectedSourceSha, `${label}.payload.source_sha`);
  return payload;
}

function assertCoreEvidence(input: L1AutomatedClosureEvidenceInput, sourceSha: string): void {
  const runA = assertArtifact(input.phase7_core.run_a, sourceSha, "run_a");
  assertClosureExactValue(
    runA.classification,
    "AUTOMATED_OPERATOR_EXECUTION",
    "run_a.classification"
  );
  assertClosureExactValue(runA.lock_count, 1, "run_a.lock_count");
  assertClosureExactValue(runA.settlement_count, 1, "run_a.settlement_count");
  assertClosureExactValue(runA.settlement_outcome, "COMMITTED", "run_a.settlement_outcome");
  assertClosureExactValue(runA.publish_count, 1, "run_a.publish_count");
  assertClosureExactValue(runA.published_state, "PUBLISHED", "run_a.published_state");
  assertZeroCounts(runA.boundary_results, "run_a.boundary_results");

  const freeze = assertArtifact(input.phase7_core.run_a_freeze, sourceSha, "run_a_freeze");
  assertClosureExactValue(
    freeze.status,
    "SEALED_AUTOMATED_RUN_A_BEFORE_RUN_B",
    "run_a_freeze.status"
  );
  assertClosureExactValue(freeze.boundary_status, "PASS", "run_a_freeze.boundary_status");
  assertClosureExactValue(
    freeze.run_b_exists_at_freeze,
    false,
    "run_a_freeze.run_b_exists_at_freeze"
  );
  assertClosureExactValue(
    freeze.run_b_creation_attempted_at_freeze,
    false,
    "run_a_freeze.run_b_creation_attempted_at_freeze"
  );
  assertClosureExactValue(
    freeze.run_a_evidence_sha256,
    input.phase7_core.run_a.sha256,
    "run_a_freeze.run_a_evidence_sha256"
  );

  const order = assertArtifact(input.phase7_core.evidence_order, sourceSha, "evidence_order");
  assertClosureExactValue(
    order.run_b_created_after_freeze_readback,
    true,
    "evidence_order.run_b_created_after_freeze_readback"
  );
  assertClosureExactValue(
    order.run_a_evidence_sha256,
    input.phase7_core.run_a.sha256,
    "evidence_order.run_a_evidence_sha256"
  );
  assertClosureExactValue(
    order.run_a_freeze_sha256,
    input.phase7_core.run_a_freeze.sha256,
    "evidence_order.run_a_freeze_sha256"
  );

  const runB = assertArtifact(input.phase7_core.run_b_lifecycle, sourceSha, "run_b_lifecycle");
  assertClosureExactValue(runB.abort_count, 2, "run_b_lifecycle.abort_count");
  assertClosureExactValue(runB.reset_count, 1, "run_b_lifecycle.reset_count");
  assertClosureExactValue(runB.cleanup_count, 1, "run_b_lifecycle.cleanup_count");
  assertClosureExactValue(runB.final_state, "CLEANED", "run_b_lifecycle.final_state");
  for (const key of [
    "settlement_count",
    "publish_count",
    "replay_execution_count",
    "student_decision_count"
  ] as const) {
    assertClosureExactValue(runB[key], 0, `run_b_lifecycle.${key}`);
  }
  for (const key of [
    "run_a_official_result_unchanged",
    "run_a_replay_summary_unchanged",
    "run_a_historical_state_unchanged"
  ] as const) {
    assertClosureExactValue(runB[key], true, `run_b_lifecycle.${key}`);
  }
  assertClosureExactValue(
    runB.run_a_freeze_sha256,
    input.phase7_core.run_a_freeze.sha256,
    "run_b_lifecycle.run_a_freeze_sha256"
  );
  assertClosureExactValue(
    runB.evidence_order_sha256,
    input.phase7_core.evidence_order.sha256,
    "run_b_lifecycle.evidence_order_sha256"
  );
}

function assertKnownLimits(
  artifact: L1AutomatedClosureEvidenceArtifact,
  sourceSha: string,
  humanValidation: Exclude<L1ClosureHumanValidation, "HUMAN_VALIDATION_COMPLETED">
): void {
  const payload = assertArtifact(artifact, sourceSha, "known_limits");
  assertZeroCounts(payload.business_mutation_counts, "known_limits.business_mutation_counts");
  for (const key of [
    "cross_team_exposure_count",
    "cross_tenant_exposure_count",
    "internal_route_count",
    "private_replay_exposure_count",
    "state_true_exposure_count",
    "credential_scan"
  ] as const) {
    assertClosureExactValue(payload[key], 0, `known_limits.${key}`);
  }
  for (const key of ["missing_ids", "unexpected_ids", "contradictory_ids"] as const) {
    assertEmptyArray(payload[key], `known_limits.${key}`);
  }

  const commonIds = asStringSet(
    payload.common_disclosure_ids,
    "known_limits.common_disclosure_ids"
  );
  assertHasAll(
    commonIds,
    [
      "JSON_INTERNAL_ONLY",
      "SYNTHETIC_ONLY",
      "LOOPBACK_ONLY",
      "POSTGRESQL_NOT_ACTIVE",
      "DURABLE_SETTLEMENT_NOT_PROVEN",
      "DURABLE_RECOVERY_NOT_PROVEN",
      "AUTOMATED_VALIDATION_IS_NOT_HUMAN_VALIDATION",
      "NO_PILOT_OR_PRODUCTION_AUTHORIZATION"
    ],
    "known_limits.common_disclosure_ids"
  );
  const privilegedIds = asStringSet(
    payload.teacher_admin_additional_ids,
    "known_limits.teacher_admin_additional_ids"
  );
  assertHasAll(privilegedIds, ["ISSUE_111_OPEN"], "known_limits.teacher_admin_additional_ids");
  if (humanValidation === "WAIVED_BY_OWNER_NOT_PERFORMED") {
    assertHasAll(
      privilegedIds,
      ["HUMAN_VALIDATION_WAIVED_BY_OWNER"],
      "known_limits.teacher_admin_additional_ids"
    );
  }
  assertNoResolvedIssueDisclosure(new Set([...commonIds, ...privilegedIds]));
}

export function createL1AutomatedClosureEvidencePack(
  input: L1AutomatedClosureEvidenceInput
): L1AutomatedClosureEvidencePack {
  const sourceSha = input.current_facts.source_sha;
  const humanValidation = input.human_validation;
  assertCondition(
    isSha(sourceSha),
    "L1_CLOSURE_EVIDENCE_SOURCE_SHA_INVALID",
    "current facts require an exact source SHA"
  );
  assertCondition(
    input.current_facts.fresh_clone.status === "PASS" &&
      input.current_facts.fresh_clone.source_sha === sourceSha &&
      input.current_facts.ci.source_sha === sourceSha &&
      input.current_facts.ci.quality === "PASS" &&
      input.current_facts.ci.browser_smoke === "PASS" &&
      input.current_facts.ci.codeql === "PASS",
    "L1_CLOSURE_EVIDENCE_CURRENT_FACTS_INVALID",
    "fresh clone and CI evidence must pass at the exact current source SHA"
  );
  assertCondition(
    input.current_facts.issues.issue_111 === "OPEN" &&
      input.current_facts.issues.issue_114 === "CLOSED" &&
      input.current_facts.issues.issue_115 === "CLOSED",
    "L1_CLOSURE_EVIDENCE_ISSUE_DISPOSITION_INVALID",
    "Issue #111 must remain the explicit durable known limit while #114 and #115 are closed"
  );
  assertCondition(
    humanValidation !== "HUMAN_VALIDATION_COMPLETED",
    "L1_CLOSURE_EVIDENCE_HUMAN_VALIDATION_OVERSTATED",
    "automated evidence must not claim completed human validation"
  );

  assertCoreEvidence(input, sourceSha);
  const verifiedHumanValidation = humanValidation as Exclude<
    L1ClosureHumanValidation,
    "HUMAN_VALIDATION_COMPLETED"
  >;
  assertKnownLimits(input.known_limits, sourceSha, verifiedHumanValidation);

  return Object.freeze({
    classification: "AUTOMATED_INTERNAL_APPLICATION_VALIDATION",
    core_evidence_sha256: Object.freeze({
      phase7_evidence_order: input.phase7_core.evidence_order.sha256,
      run_a_evidence: input.phase7_core.run_a.sha256,
      run_a_freeze: input.phase7_core.run_a_freeze.sha256,
      run_b_lifecycle: input.phase7_core.run_b_lifecycle.sha256
    }),
    explicit_non_proofs: [
      "HUMAN_VALIDATION_NOT_PERFORMED",
      "POSTGRESQL_NOT_ACTIVE",
      "DURABLE_SETTLEMENT_NOT_PROVEN",
      "DURABLE_RECOVERY_NOT_PROVEN",
      "PILOT_NOT_AUTHORIZED",
      "PRODUCTION_NOT_AUTHORIZED"
    ] as const,
    human_validation: verifiedHumanValidation,
    issue_disposition: {
      issue_111: "OPEN_KNOWN_LIMIT",
      issue_114: "CLOSED",
      issue_115: "CLOSED"
    } as const,
    known_limits_sha256: input.known_limits.sha256,
    machine_validation: "PASS",
    owner_acknowledgment: "NOT_ISSUED",
    schema_version: "simwar.l1.automated-closure-evidence.v1",
    source_sha: sourceSha,
    status: "AUTOMATED_EVIDENCE_COMPLETE_OWNER_ACKNOWLEDGMENT_REQUIRED"
  });
}
