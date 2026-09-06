import { describe, expect, it } from "vitest";
import {
  buildIndustryModelDiagnosticReadiness,
  type IndustryModelDiagnosticReadinessInput
} from "../../services/api/src/industry-model-diagnostic-readiness";

const digest = (value: string) => value.repeat(64).slice(0, 64);

function input(overrides: Partial<IndustryModelDiagnosticReadinessInput> = {}) {
  const base: IndustryModelDiagnosticReadinessInput = {
    context: {
      tenant_id: "tenant-1",
      course_id: "course-1",
      run_id: "run-1",
      team_id: "team-1",
      round_id: "round-1",
      scenario_package_id: "scenario-1",
      parameter_set_id: "params-1"
    },
    model_version_reference: { model_id: "industry-model", version: "1.0.0" },
    model_artifact_reference: { artifact_id: "industry-artifact", content_digest: digest("a") },
    qualification: {
      qualification_id: "qualification-1",
      qualification_digest: digest("b"),
      decision: "APPROVED",
      review_status: "APPROVED",
      binding_status: "BOUND"
    },
    adoption: {
      adoption_id: "adoption-1",
      adoption_digest: digest("c")
    },
    diagnostic_evidence_digest: digest("d"),
    interpretation_policy_digest: digest("e"),
    producers: [
      {
        producer_id: "producer-demand-1",
        current_source_path: "services/simulation-core/src/demand.ts",
        exact_symbol: "deriveDemandCandidate",
        contract: "DemandCandidate.v1",
        diagnostic_family: "market preference",
        evidence_identity: "evidence-demand-1",
        tests: ["tests/unit/demand-candidate.test.ts"],
        freshness: "FRESH",
        authority_owner: "SIMULATION_CORE",
        candidate_classification: "WANT_EVIDENCE"
      },
      {
        producer_id: "producer-feasibility-1",
        current_source_path: "services/simulation-core/src/operations.ts",
        exact_symbol: "deriveCapacityFeasibility",
        contract: "CanEvidence.v1",
        diagnostic_family: "capacity feasibility",
        evidence_identity: "evidence-can-1",
        tests: ["tests/unit/can-service-feasibility.test.ts"],
        freshness: "FRESH",
        authority_owner: "SIMULATION_CORE",
        candidate_classification: "CAN_EVIDENCE"
      }
    ],
    identity_movements: [],
    official_truth_write: false,
    provider_calls: 0
  };
  return { ...base, ...overrides };
}

describe("IM-O1 diagnostic readiness domain", () => {
  it("creates a deterministic exact-bound readiness envelope without writing truth", () => {
    const first = buildIndustryModelDiagnosticReadiness(input());
    const second = buildIndustryModelDiagnosticReadiness(input());

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      readiness_status: "READY",
      provider: "OFF",
      official_truth_write: false,
      bound_context: input().context,
      diagnostic_evidence_digest: digest("d"),
      interpretation_policy_digest: digest("e"),
      provability: [{ classification: "WANT_EVIDENCE" }, { classification: "CAN_EVIDENCE" }]
    });
    expect(first.readiness_digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps qualified diagnostics distinct from business truth when no producer is provable", () => {
    const result = buildIndustryModelDiagnosticReadiness(
      input({
        producers: [
          {
            ...input().producers[0],
            candidate_classification: "NOT_PROVEN"
          }
        ]
      })
    );

    expect(result.readiness_status).toBe("READY_WITH_LIMITS");
    expect(result.provability).toEqual([expect.objectContaining({ classification: "NOT_PROVEN" })]);
    expect(result.known_limits).toEqual(
      expect.arrayContaining([
        "DIAGNOSTIC_PROVABILITY_NOT_ESTABLISHED",
        "DIAGNOSTIC_PASS_IS_NOT_BUSINESS_TRUTH"
      ])
    );
  });

  it("returns REBASE_REQUIRED for any stale exact identity movement", () => {
    const result = buildIndustryModelDiagnosticReadiness(
      input({ identity_movements: ["model_version", "adoption"] })
    );

    expect(result).toMatchObject({
      readiness_status: "REBASE_REQUIRED",
      rebase_required: true,
      official_truth_write: false
    });
  });

  it("rejects a fabricated REALIZED reference producer", () => {
    expect(() =>
      buildIndustryModelDiagnosticReadiness(
        input({
          producers: [
            {
              ...input().producers[0],
              candidate_classification: "REALIZED_REFERENCE",
              authority_owner: "INDUSTRY_DIAGNOSTIC"
            }
          ]
        })
      )
    ).toThrow("REALIZED_REFERENCE_AUTHORITY_REQUIRED");
  });
});
