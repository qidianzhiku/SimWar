import { describe, expect, it } from "vitest";
import {
  buildStudentDecisionChallenge,
  type StudentChallengeContext
} from "../../services/agent-gateway/src/student-decision-challenge.js";
import {
  qualifyWorkflowEvidence,
  type WorkflowEvidenceContext
} from "../../services/agent-gateway/src/workflow-evidence-policy.js";
import { createDeterministicMockGateway } from "../../services/agent-gateway/src/index.js";

const baseContext: WorkflowEvidenceContext = {
  actor_id_hash: "a".repeat(64),
  actor_role: "student",
  advisory_scopes: ["strategy"],
  context_digest: "b".repeat(64),
  course_id: "course_001",
  discriminator: "w020_role_safe_context",
  role_key: "CEO",
  round_id: "round_001",
  run_id: "run_001",
  source_event_ids: ["event_001", "event_002", "event_003", "event_004"],
  source_event_types: ["role_assigned", "section_saved", "section_ready", "merge_created"],
  team_id: "team_001",
  tenant_id: "tenant_demo",
  transformation_version: "w020-role-safe-context-v1"
};

function context(overrides: Partial<WorkflowEvidenceContext> = {}): StudentChallengeContext {
  return { ...baseContext, ...overrides };
}

describe("W020 R2 student decision challenge", () => {
  it("turns a qualified contribution stage into a role-safe coaching prompt", () => {
    const evidence = qualifyWorkflowEvidence(
      context({ source_event_ids: ["event_001", "event_002", "event_003"], source_event_types: ["role_assigned", "section_saved", "section_ready"] })
    );
    const result = buildStudentDecisionChallenge(context(), evidence);

    expect(result.output_type).toBe("advisory");
    expect(result.advisory_text).toContain("ROLE_CONTRIBUTION_READY");
    expect(result.advisory_text).toContain("Private judgment");
    expect(result.advisory_text).toContain("Team position");
    expect(result.advisory_text).toContain("canonical decision");
  });

  it("distinguishes a team-confirmed milestone from round lock", () => {
    const evidence = qualifyWorkflowEvidence(
      context({
        source_event_ids: ["event_001", "event_002", "event_003", "event_004", "event_005"],
        source_event_types: ["role_assigned", "section_saved", "section_ready", "merge_created", "team_confirmed"]
      })
    );
    const result = buildStudentDecisionChallenge(context(), evidence);

    expect(result.advisory_text).toContain("TEAM_CONFIRMED");
    expect(result.advisory_text).toContain("not a round lock");
    expect(result.advisory_text).toContain("dissent");
  });

  it("abstains without qualified evidence and never emits formal-state fields", () => {
    const empty = context({ source_event_ids: [], source_event_types: [] });
    const result = buildStudentDecisionChallenge(empty, qualifyWorkflowEvidence(empty));

    expect(result.advisory_text).toContain("No qualified workflow evidence");
    expect(result.advisory_text).not.toContain("state_true");
    expect(result.advisory_text).not.toContain("SettlementResult");
    expect(result.advisory_text.toLowerCase()).not.toContain("score");
    expect(result.advisory_text.toLowerCase()).not.toContain("rank");
  });

  it("makes the gateway output change when the qualified stage changes", () => {
    const gateway = createDeterministicMockGateway();
    const ready = gateway.generate({
      context: context({
        source_event_ids: ["event_001", "event_002", "event_003"],
        source_event_types: ["role_assigned", "section_saved", "section_ready"]
      }),
      role_key: "CEO",
      surface: "student_role"
    });
    const merged = gateway.generate({
      context: context(),
      role_key: "CEO",
      surface: "student_role"
    });

    expect(ready.coach_output.advisory_text).not.toBe(merged.coach_output.advisory_text);
    expect(ready.coach_output.output_type).toBe("advisory");
    expect(merged.coach_output.output_type).toBe("advisory");
  });
});
