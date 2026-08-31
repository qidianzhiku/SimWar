import { describe, expect, it } from "vitest";
import {
  advanceStudentDecisionContextEvidence,
  createStudentDecisionContextEvidence,
  isStudentDecisionContextEvidenceScope,
  type StudentDecisionContextScope
} from "../../packages/shared-contracts/src/student-decision-context-evidence";

const scope: StudentDecisionContextScope = {
  activity_id: "activity_consequence",
  course_id: "course_demo",
  role_key: "CEO",
  round_id: "round_m31",
  round_no: 1,
  run_id: "run_m31",
  team_id: "team_alpha",
  tenant_id: "tenant_demo"
};

const source = {
  consumption_status: "LOOKAHEAD_READY" as const,
  epoch_version: "epoch-b.2026-08-30",
  exact_binding_required: true as const,
  qualification_status: "LIMITED" as const,
  target_region: "Hangzhou" as const
};

describe("M31 student decision context evidence", () => {
  it("creates one source-safe, exact-scope evidence identity", () => {
    const evidence = createStudentDecisionContextEvidence(scope, source);

    expect(evidence.status).toBe("READY");
    expect(evidence.scope).toEqual(scope);
    expect(evidence.evidence_version).toBe("student-decision-context.v1");
    expect(evidence.source_context).toEqual(source);
    expect(evidence.continuity).toEqual({
      context: "PROVEN",
      decision: "PROVEN",
      consequence: "PENDING_PUBLISH",
      debrief: "PENDING_PUBLISH",
      regional_transfer: "PENDING_PUBLISH"
    });
    expect(JSON.stringify(evidence)).not.toMatch(
      /raw_source|locator|digest|private|hidden_calibration|model_truth|state_true|score|rank|settlement/i
    );
    expect(isStudentDecisionContextEvidenceScope(evidence, scope)).toBe(true);
  });

  it("changes the opaque evidence identity when the immutable source binding changes", () => {
    const first = createStudentDecisionContextEvidence(scope, source, "source-package-a");
    const replacement = createStudentDecisionContextEvidence(
      scope,
      { ...source, epoch_version: "epoch-b.2026-09-01" },
      "source-package-b"
    );

    expect(first.evidence_id).not.toBe(replacement.evidence_id);
    expect(first.evidence_id).toContain("source-package-a");
    expect(replacement.evidence_id).toContain("source-package-b");
  });

  it("fails closed when source evidence is missing", () => {
    const evidence = createStudentDecisionContextEvidence(scope, undefined);

    expect(evidence.status).toBe("BLOCKED");
    expect(evidence.blocker_codes).toEqual(["SOURCE_EVIDENCE_UNAVAILABLE"]);
    expect(evidence.source_context).toBeUndefined();
    expect(evidence.continuity.decision).toBe("BLOCKED");
  });

  it("rejects an exact-scope mismatch and advances only the same evidence identity", () => {
    const evidence = createStudentDecisionContextEvidence(scope, source);
    const wrongScope = { ...scope, team_id: "team_beta" };

    expect(isStudentDecisionContextEvidenceScope(evidence, wrongScope)).toBe(false);
    expect(() => advanceStudentDecisionContextEvidence(evidence, wrongScope)).toThrow(
      "STUDENT_CONTEXT_EVIDENCE_SCOPE_MISMATCH"
    );

    const advanced = advanceStudentDecisionContextEvidence(evidence, scope);
    expect(advanced.evidence_id).toBe(evidence.evidence_id);
    expect(advanced.continuity).toEqual({
      context: "PROVEN",
      decision: "PROVEN",
      consequence: "PROVEN",
      debrief: "PROVEN",
      regional_transfer: "PROVEN"
    });
  });
});
