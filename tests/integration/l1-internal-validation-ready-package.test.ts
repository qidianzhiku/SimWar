import { describe, expect, it } from "vitest";
import {
  COURSE_RUNTIME_V3_REQUIRED_CHAIN,
  type CourseRuntimeV3Evidence
} from "../../services/api/src/course-runtime-v3";
import { createL1GoldenM1CourseRuntimeConsolidationReport } from "../../services/api/src/l1-golden-m1-course-runtime-consolidation";
import {
  createL1InternalValidationReadyPackage,
  L1_INTERNAL_VALIDATION_READY_REQUIRED_CAPABILITIES,
  type L1InternalValidationReadyProgramEvidence
} from "../../services/api/src/l1-internal-validation-ready-package";
import { createL1SyntheticInternalApplicationReadinessReport } from "../../services/api/src/l1-synthetic-internal-application-readiness";

const PR_208_MERGE_COMMIT = "b3257e1272e571cadf7eb0fbe390d1cfe66450be";
const PR_209_HEAD_COMMIT = "6e082a67a45286ab254d17fcac421bb7b7c2b989";
const PR_209_MERGE_COMMIT = "e44bd949b79d3bee1314795689339863f2b03099";

function createRuntimeV3Evidence(): CourseRuntimeV3Evidence {
  return {
    audit_integrity: {
      audit_events_have_request_id: true,
      duplicate_audit_side_effects_detected: false,
      observed_request_ids: [
        "req_runtime_v3_course_publish_once",
        "req_runtime_v3_alpha_decision",
        "req_runtime_v3_round_lock_once",
        "req_runtime_v3_settle_once",
        "req_runtime_v3_round_publish_once"
      ]
    },
    course_blueprint: {
      course_id: "course_l1_golden_m1",
      engine_version: "toy_logit_wellness_v1@current",
      mutation_allowed: false,
      parameter_set_id: "pset_l1_golden_m1",
      plugin_package_id: "plugin_wellness_eldercare_v1",
      scenario_package_id: "scenario_l1_golden_m1",
      seed: 424242
    },
    direct_store_delta: "NONE",
    evidence_kind: "course_runtime_v3_synthetic_execution_evidence",
    evidence_version: "course-runtime-v3.synthetic.v1",
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    idempotency: {
      duplicate_audit_side_effects_detected: false,
      duplicate_decision_result_stable: true,
      duplicate_publish_result_stable: true,
      duplicate_round_lock_result_stable: true,
      duplicate_settlement_result_stable: true
    },
    known_limits: [
      "does_not_claim_g0_pass",
      "does_not_claim_l1_ready",
      "does_not_activate_postgresql_runtime",
      "does_not_prove_durable_settlement"
    ],
    l1_status: "NOT_READY",
    replay_and_shadow: {
      learning_evidence_excluded_from_truth_hash: true,
      replay_status: "matched",
      replay_writes_formal_results: false,
      shadow_replay_writes_formal_results: false
    },
    role_scope: {
      denied_operations: [
        {
          actor: "student",
          code: "AUTHZ-403-ROUND-LOCK",
          operation: "round.lock",
          private_detail_leaked: false,
          status: 403
        },
        {
          actor: "student",
          code: "TEAM-403-001",
          operation: "decision.submit.cross_team",
          private_detail_leaked: false,
          status: 403
        },
        {
          actor: "student",
          code: "TENANT-403-001",
          operation: "result.read.cross_tenant",
          private_detail_leaked: false,
          status: 403
        }
      ],
      student_private_markers_observed: [],
      tenant_admin_visible_tenants: ["tenant_demo"]
    },
    runtime_chain: COURSE_RUNTIME_V3_REQUIRED_CHAIN,
    state_machine: {
      observed_actions: [
        "course.publish",
        "decision.submit",
        "round.lock",
        "round.publish",
        "round.settle_requested"
      ],
      synthetic_course_execution_complete: true
    },
    student_feedback: {
      next_step_advisory_only: true,
      private_trace_included: false,
      protected_truth_included: false
    }
  };
}

function createProgramEvidence(
  overrides: Partial<L1InternalValidationReadyProgramEvidence> = {}
): L1InternalValidationReadyProgramEvidence {
  return {
    baselineValidation: {
      direct_store_delta: "NONE",
      status: "PASSED"
    },
    currentReadback: {
      candidate_branch: "codex/l1-golden-m1-course-runtime-consolidation-20260708-080643",
      candidate_commit: PR_209_HEAD_COMMIT,
      closeout_keywords_observed: false,
      current_master_sha: PR_209_MERGE_COMMIT,
      issues: [
        { number: 111, state: "OPEN" },
        { number: 114, state: "OPEN" },
        { number: 115, state: "OPEN" }
      ],
      pr_number: 209,
      pr_state: "MERGED",
      pre_merge_master_sha: PR_208_MERGE_COMMIT,
      required_checks: [
        { name: "quality", status: "pass" },
        { name: "browser-smoke", status: "pass" },
        { name: "Analyze JavaScript and TypeScript", status: "pass" }
      ]
    },
    graphEvidence: {
      codegraph_mcp_used: true,
      docs_mcp_status: "NOT_AVAILABLE",
      graphify_code_preflight: "PASSED"
    },
    protectedMainWorkspace: {
      path: "D:\\codex\\SimWar",
      touched_in_program_027: false
    },
    securityScan: {
      findings: 0,
      scan_id: "10e5682e-d2bb-4a36-9a88-86781f4bc031",
      status: "complete / sealed"
    },
    ...overrides
  };
}

function createConsolidation() {
  const runtimeEvidence = createRuntimeV3Evidence();
  const readinessReport = createL1SyntheticInternalApplicationReadinessReport({
    courseRuntimeV3Evidence: runtimeEvidence,
    internalDraftReference:
      "docs/operations/r8-g1-l1-synthetic-internal-application-readiness-draft.md",
    postMergeEvidence: {
      baseline_validation: "PASSED",
      direct_store_delta: "NONE",
      pr_207_merge_commit: "5ea8e70e9fc30fc6590c0be3949464652b61c30b"
    }
  });

  return createL1GoldenM1CourseRuntimeConsolidationReport({
    courseRuntimeV3Evidence: runtimeEvidence,
    readinessReport,
    r4DiscoveryReference: "docs/architecture/r4-discovery-parity-gap-directory.md",
    r8G1DraftPackReferences: [
      "docs/operations/l1-teacher-kit-internal-only.md",
      "docs/operations/l1-session-runbook-lite.md",
      "docs/operations/l1-replay-evidence-review-checklist.md",
      "docs/operations/l1-issue-escalation-procedure.md"
    ],
    sourceEvidence: {
      graphify_preflight: "GRAPHIFY_PREFLIGHT_EVIDENCE",
      codegraph_query: "CODEGRAPH_EVIDENCE",
      post_merge_baseline: "POSTMERGE_MASTER_EVIDENCE",
      pr_208_merge_commit: PR_208_MERGE_COMMIT
    }
  });
}

function createPackageInput() {
  return {
    consolidation: createConsolidation(),
    programEvidence: createProgramEvidence(),
    references: {
      currentEvidenceLedger: "docs/quality/l1-g0-g7-current-evidence-ledger.md",
      internalRehearsalKit: "docs/operations/r8-g1-l1-internal-validation-ready-package-draft.md",
      r4Discovery: "docs/architecture/r4-discovery-parity-gap-directory.md",
      readinessDocument: "docs/quality/l1-internal-validation-ready-package.md"
    } as const
  };
}

describe("L1 Internal Validation Ready Package", () => {
  it("packages PR #209 reconciliation, security, graph and G0-G7 evidence without claiming readiness", () => {
    const report = createL1InternalValidationReadyPackage(createPackageInput());

    expect(report.evidence_kind).toBe("l1_internal_validation_ready_package");
    expect(report.evidence_version).toBe("l1-internal-validation-ready-package.v1");
    expect(report.g0_status).toBe("EXCEPTION");
    expect(report.g0_pass).toBe("NOT_GRANTED");
    expect(report.l1_status).toBe("NOT_READY");
    expect(report.direct_store_delta).toBe("NONE");
    expect(report.validation_boundary).toBe("INTERNAL_VALIDATION_READY_PENDING_INDEPENDENT_REVIEW");
    expect(report.capability_matrix.map((item) => item.capability)).toEqual([
      ...L1_INTERNAL_VALIDATION_READY_REQUIRED_CAPABILITIES
    ]);
    expect(report.g0_g7_freshness_ledger.map((item) => item.gate)).toEqual([
      "G0",
      "G1",
      "G2",
      "G3",
      "G4",
      "G5",
      "G6",
      "G7"
    ]);
    expect(
      report.g0_g7_freshness_ledger.every((item) => item.source_master_sha === PR_209_MERGE_COMMIT)
    ).toBe(true);
    expect(report.pr209_reconciliation).toEqual({
      current_master_sha: PR_209_MERGE_COMMIT,
      head_commit: PR_209_HEAD_COMMIT,
      pre_merge_master_sha: PR_208_MERGE_COMMIT,
      pr_state: "MERGED"
    });
    expect(report.security_scan).toEqual({
      findings: 0,
      scan_id: "10e5682e-d2bb-4a36-9a88-86781f4bc031",
      status: "complete / sealed"
    });
    expect(report.platform_admin_authority).toEqual({
      explicit_authority_required: true,
      platform_scope_not_inferred_from_tenant_admin: true
    });
    expect(report.replay_and_learning_boundary).toEqual({
      learning_evidence_excluded_from_truth_hash: true,
      replay_writes_formal_results: false,
      shadow_replay_writes_formal_results: false
    });
    expect(report.go_no_go_decision_pack).toEqual({
      independent_evidence_review_required: true,
      merge_authorization: false,
      recommendation: "GO_FOR_INDEPENDENT_EVIDENCE_REVIEW_ONLY",
      release_authorization: false
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

  it("fails closed when the associated sealed security scan is not clean", () => {
    expect(() =>
      createL1InternalValidationReadyPackage({
        ...createPackageInput(),
        programEvidence: createProgramEvidence({
          securityScan: {
            findings: 1,
            scan_id: "10e5682e-d2bb-4a36-9a88-86781f4bc031",
            status: "complete / sealed"
          }
        })
      })
    ).toThrow(/L1_VALIDATION_READY_SECURITY_SCAN_NOT_CLEAN/);
  });

  it("fails closed when Program 027 protected main workspace evidence is not clean", () => {
    expect(() =>
      createL1InternalValidationReadyPackage({
        ...createPackageInput(),
        programEvidence: createProgramEvidence({
          protectedMainWorkspace: {
            path: "D:\\codex\\SimWar",
            touched_in_program_027: true
          }
        })
      })
    ).toThrow(/L1_VALIDATION_READY_PROTECTED_MAIN_BOUNDARY_BROKEN/);
  });
});
