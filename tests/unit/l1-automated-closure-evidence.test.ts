import { describe, expect, it } from "vitest";
import {
  createL1AutomatedClosureEvidencePack,
  type L1AutomatedClosureEvidenceInput
} from "../../services/api/src/l1-internal-validation-ready-package";

const SOURCE_SHA = "a".repeat(40);
const SHA256 = "b".repeat(64);

function createInput(
  overrides: Partial<L1AutomatedClosureEvidenceInput> = {}
): L1AutomatedClosureEvidenceInput {
  return {
    current_facts: {
      ci: {
        browser_smoke: "PASS",
        codeql: "PASS",
        quality: "PASS",
        source_sha: SOURCE_SHA
      },
      fresh_clone: {
        source_sha: SOURCE_SHA,
        status: "PASS"
      },
      issues: {
        issue_111: "OPEN",
        issue_114: "CLOSED",
        issue_115: "CLOSED"
      },
      source_sha: SOURCE_SHA
    },
    human_validation: "WAIVED_BY_OWNER_NOT_PERFORMED",
    known_limits: {
      payload: {
        business_mutation_counts: {
          course: 0,
          decision: 0,
          lifecycle: 0,
          publish: 0,
          round: 0,
          run: 0,
          settlement: 0
        },
        common_disclosure_ids: [
          "JSON_INTERNAL_ONLY",
          "SYNTHETIC_ONLY",
          "LOOPBACK_ONLY",
          "POSTGRESQL_NOT_ACTIVE",
          "DURABLE_SETTLEMENT_NOT_PROVEN",
          "DURABLE_RECOVERY_NOT_PROVEN",
          "AUTOMATED_VALIDATION_IS_NOT_HUMAN_VALIDATION",
          "NO_PILOT_OR_PRODUCTION_AUTHORIZATION"
        ],
        contradictory_ids: [],
        credential_scan: 0,
        cross_team_exposure_count: 0,
        cross_tenant_exposure_count: 0,
        internal_route_count: 0,
        missing_ids: [],
        private_replay_exposure_count: 0,
        source_sha: SOURCE_SHA,
        state_true_exposure_count: 0,
        teacher_admin_additional_ids: [
          "ISSUE_111_OPEN",
          "HUMAN_VALIDATION_WAIVED_BY_OWNER",
          "AI_ADVISORY_ONLY",
          "SIMULATION_CORE_IS_FORMAL_TRUTH_AUTHORITY"
        ],
        unexpected_ids: []
      },
      sha256: SHA256
    },
    phase7_core: {
      evidence_order: {
        payload: {
          run_a_evidence_sha256: SHA256,
          run_a_freeze_sha256: SHA256,
          run_b_created_after_freeze_readback: true,
          source_sha: SOURCE_SHA
        },
        sha256: SHA256
      },
      run_a: {
        payload: {
          boundary_results: {
            cross_team_exposure: 0,
            cross_tenant_exposure: 0,
            student_a_internal_route_count: 0,
            student_a_other_team_exposure: 0,
            student_a_other_tenant_exposure: 0,
            student_a_private_replay_exposure: 0,
            student_a_state_true_exposure: 0,
            student_b_internal_route_count: 0,
            student_b_other_team_exposure: 0,
            student_b_other_tenant_exposure: 0,
            student_b_private_replay_exposure: 0,
            student_b_state_true_exposure: 0
          },
          classification: "AUTOMATED_OPERATOR_EXECUTION",
          lock_count: 1,
          publish_count: 1,
          published_state: "PUBLISHED",
          settlement_count: 1,
          settlement_outcome: "COMMITTED",
          source_sha: SOURCE_SHA
        },
        sha256: SHA256
      },
      run_a_freeze: {
        payload: {
          boundary_status: "PASS",
          run_a_evidence_sha256: SHA256,
          run_b_creation_attempted_at_freeze: false,
          run_b_exists_at_freeze: false,
          source_sha: SOURCE_SHA,
          status: "SEALED_AUTOMATED_RUN_A_BEFORE_RUN_B"
        },
        sha256: SHA256
      },
      run_b_lifecycle: {
        payload: {
          abort_count: 2,
          cleanup_count: 1,
          evidence_order_sha256: SHA256,
          final_state: "CLEANED",
          publish_count: 0,
          replay_execution_count: 0,
          reset_count: 1,
          run_a_freeze_sha256: SHA256,
          run_a_historical_state_unchanged: true,
          run_a_official_result_unchanged: true,
          run_a_replay_summary_unchanged: true,
          settlement_count: 0,
          source_sha: SOURCE_SHA,
          student_decision_count: 0
        },
        sha256: SHA256
      }
    },
    ...overrides
  };
}

describe("L1 automated closure evidence pack", () => {
  it("assembles current-master automated evidence without upgrading human validation", () => {
    const pack = createL1AutomatedClosureEvidencePack(createInput());

    expect(pack.source_sha).toBe(SOURCE_SHA);
    expect(pack.machine_validation).toBe("PASS");
    expect(pack.human_validation).toBe("WAIVED_BY_OWNER_NOT_PERFORMED");
    expect(pack.owner_acknowledgment).toBe("NOT_ISSUED");
    expect(pack.status).toBe("AUTOMATED_EVIDENCE_COMPLETE_OWNER_ACKNOWLEDGMENT_REQUIRED");
    expect(pack.issue_disposition).toEqual({
      issue_111: "OPEN_KNOWN_LIMIT",
      issue_114: "CLOSED",
      issue_115: "CLOSED"
    });
    expect(pack.explicit_non_proofs).toContain("HUMAN_VALIDATION_NOT_PERFORMED");
  });

  it("fails closed when any core artifact is bound to another source SHA", () => {
    const input = createInput();
    input.phase7_core.run_b_lifecycle.payload.source_sha = "c".repeat(40);

    expect(() => createL1AutomatedClosureEvidencePack(input)).toThrow(
      /L1_CLOSURE_EVIDENCE_SOURCE_SHA_DRIFT/
    );
  });

  it("fails closed when a resolved issue is still open or human validation is overstated", () => {
    const unresolved = createInput();
    unresolved.current_facts.issues.issue_115 = "OPEN";
    expect(() => createL1AutomatedClosureEvidencePack(unresolved)).toThrow(
      /L1_CLOSURE_EVIDENCE_ISSUE_DISPOSITION_INVALID/
    );

    const overstated = createInput();
    overstated.human_validation = "HUMAN_VALIDATION_COMPLETED";
    expect(() => createL1AutomatedClosureEvidencePack(overstated)).toThrow(
      /L1_CLOSURE_EVIDENCE_HUMAN_VALIDATION_OVERSTATED/
    );
  });
});
