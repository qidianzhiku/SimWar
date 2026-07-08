import { describe, expect, it } from "vitest";
import {
  COURSE_RUNTIME_V3_REQUIRED_CHAIN,
  type CourseRuntimeV3Evidence
} from "../../services/api/src/course-runtime-v3";
import { createL1GoldenM1CourseRuntimeConsolidationReport } from "../../services/api/src/l1-golden-m1-course-runtime-consolidation";
import { createL1SyntheticInternalApplicationReadinessReport } from "../../services/api/src/l1-synthetic-internal-application-readiness";

const PR_208_MERGE_COMMIT = "b3257e1272e571cadf7eb0fbe390d1cfe66450be";

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

describe("L1 Golden M1 Course Runtime Consolidation", () => {
  it("converges Runtime V3 and readiness evidence without claiming L1 readiness", () => {
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

    const consolidation = createL1GoldenM1CourseRuntimeConsolidationReport({
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

    expect(consolidation.evidence_kind).toBe("l1_golden_m1_course_runtime_consolidation");
    expect(consolidation.evidence_version).toBe("l1-golden-m1-course-runtime-consolidation.v1");
    expect(consolidation.g0_status).toBe("EXCEPTION");
    expect(consolidation.g0_pass).toBe("NOT_GRANTED");
    expect(consolidation.l1_status).toBe("NOT_READY");
    expect(consolidation.direct_store_delta).toBe("NONE");
    expect(consolidation.independent_evidence_review_required).toBe(true);
    expect(consolidation.runtime_chain).toEqual([
      "teacher.course_draft",
      "scenario_asset.approved_frozen",
      "parameter_set_plugin_seed.bound",
      ...COURSE_RUNTIME_V3_REQUIRED_CHAIN,
      "learning_evidence.ledger",
      "r8_g1.internal_only_draft_pack",
      "r4_discovery.read_only_update"
    ]);
    expect(consolidation.g0_g7_evidence.map((item) => item.gate)).toEqual([
      "G0",
      "G1",
      "G2",
      "G3",
      "G4",
      "G5",
      "G6",
      "G7"
    ]);
    expect(consolidation.teacher_course_operations).toMatchObject({
      course_publish_observed: true,
      teacher_lock_settle_publish_observed: true
    });
    expect(consolidation.student_decision_and_feedback).toMatchObject({
      decision_submit_observed: true,
      redacted_result_observed: true,
      three_part_feedback_observed: true
    });
    expect(consolidation.tenant_admin_scope).toEqual({
      visible_tenants: ["tenant_demo"],
      cross_tenant_denial_observed: true,
      platform_admin_explicit_authority_required: true
    });
    expect(consolidation.replay_and_shadow).toMatchObject({
      replay_status: "matched",
      replay_writes_formal_results: false,
      shadow_replay_writes_formal_results: false,
      repeated_settlement_overwrites_official_result: false
    });
    expect(consolidation.r8_g1_draft_pack.status).toBe("INTERNAL_ONLY_DRAFT_NOT_RELEASED");
    expect(consolidation.r4_discovery.status).toBe("READ_ONLY_ONLY");
    expect(consolidation.non_proofs).toEqual(
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

  it("fails closed when Runtime V3 evidence exposes private student markers", () => {
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

    expect(() =>
      createL1GoldenM1CourseRuntimeConsolidationReport({
        courseRuntimeV3Evidence: {
          ...runtimeEvidence,
          role_scope: {
            ...runtimeEvidence.role_scope,
            student_private_markers_observed: ["state_true"]
          }
        },
        readinessReport,
        r4DiscoveryReference: "docs/architecture/r4-discovery-parity-gap-directory.md",
        r8G1DraftPackReferences: ["docs/operations/l1-teacher-kit-internal-only.md"],
        sourceEvidence: {
          graphify_preflight: "GRAPHIFY_PREFLIGHT_EVIDENCE",
          codegraph_query: "CODEGRAPH_EVIDENCE",
          post_merge_baseline: "POSTMERGE_MASTER_EVIDENCE",
          pr_208_merge_commit: PR_208_MERGE_COMMIT
        }
      })
    ).toThrow(/L1_GOLDEN_M1_STUDENT_VISIBILITY_LEAK/);
  });
});
