import { describe, expect, it } from "vitest";
import {
  interpretIndustryModelDiagnostics,
  type DiagnosticInterpretationInput
} from "../../services/api/src/industry-model-diagnostic-interpretation";

const digest = (value: string) => value.repeat(64).slice(0, 64);

function input(overrides: Partial<DiagnosticInterpretationInput> = {}) {
  const base: DiagnosticInterpretationInput = {
    context: {
      tenant_id: "tenant-1",
      course_id: "course-1",
      run_id: "run-1",
      team_id: "team-1",
      round_id: "round-1"
    },
    readiness_status: "READY_WITH_LIMITS",
    diagnostic_evidence_digest: digest("a"),
    interpretation_policy_digest: digest("b"),
    entries: [
      {
        producer_id: "producer-1",
        diagnostic_family: "market preference",
        classification: "WANT_EVIDENCE",
        status: "PASS",
        bounded_metrics: { fit_score: 0.81 },
        provenance: { source_path: "services/core/demand.ts", symbol: "deriveDemandCandidate" },
        known_limits: ["descriptive_only"]
      },
      {
        producer_id: "producer-2",
        diagnostic_family: "capacity feasibility",
        classification: "CAN_EVIDENCE",
        status: "PASS",
        bounded_metrics: { capacity_fit: 0.72 },
        provenance: { source_path: "services/core/operations.ts", symbol: "capacityFit" },
        known_limits: ["not_realized"]
      }
    ],
    identity_movements: [],
    provider: "OFF",
    official_truth_write: false
  };
  return { ...base, ...overrides };
}

describe("IM-O1 role-safe diagnostic interpretation domain", () => {
  it("keeps full evidence for Teacher/Admin and returns bounded Student data", () => {
    const result = interpretIndustryModelDiagnostics(input());

    expect(result.status).toBe("READY_WITH_LIMITS");
    expect(result.teacher.entries[0]).toMatchObject({
      producer_id: "producer-1",
      provenance: { source_path: "services/core/demand.ts" }
    });
    expect(result.admin).toMatchObject({
      diagnostic_evidence_digest: digest("a"),
      interpretation_policy_digest: digest("b")
    });
    expect(result.student).toMatchObject({
      visibility: "ROLE_SAFE_STUDENT",
      readiness_class: "READY_WITH_LIMITS",
      evidence_classes: ["WANT_EVIDENCE", "CAN_EVIDENCE"]
    });
    expect(JSON.stringify(result.student)).not.toContain("producer-1");
    expect(JSON.stringify(result.student)).not.toContain("services/core/demand.ts");
    expect(JSON.stringify(result.student)).not.toContain(digest("a"));
    expect(result.official_truth_write).toBe(false);
    expect(result.provider).toBe("OFF");
  });

  it("does not promote diagnostic PASS into REALIZED or causal proof", () => {
    const result = interpretIndustryModelDiagnostics(input());
    expect(result.teacher.known_limits).toEqual(
      expect.arrayContaining(["DIAGNOSTIC_PASS_IS_NOT_BUSINESS_TRUTH", "NO_CAUSAL_PROOF"])
    );
    expect(result.student.known_limits).toEqual(
      expect.arrayContaining(["DIAGNOSTIC_PASS_IS_NOT_BUSINESS_TRUTH"])
    );
  });

  it("returns REBASE_REQUIRED and hides stale ready state when identity moves", () => {
    const result = interpretIndustryModelDiagnostics(
      input({ identity_movements: ["qualification", "diagnostic_evidence"] })
    );

    expect(result).toMatchObject({
      status: "REBASE_REQUIRED",
      rebase_required: true
    });
    expect(result.student.readiness_class).toBe("REBASE_REQUIRED");
  });

  it("keeps unsupported classifications explicit as NOT_PROVEN", () => {
    const result = interpretIndustryModelDiagnostics(
      input({
        entries: [
          {
            ...input().entries[0],
            classification: "NOT_PROVEN"
          }
        ]
      })
    );

    expect(result.teacher.entries[0]?.classification).toBe("NOT_PROVEN");
    expect(result.student.evidence_classes).toEqual(["NOT_PROVEN"]);
  });
});
