import { describe, expect, it } from "vitest";
import {
  buildTeacherDebriefIntelligence,
  type TeacherDebriefContext
} from "../../services/agent-gateway/src/teacher-debrief-intelligence.js";
import {
  qualifyWorkflowEvidence,
  type WorkflowEvidenceContext
} from "../../services/agent-gateway/src/workflow-evidence-policy.js";
import { createDeterministicMockGateway } from "../../services/agent-gateway/src/index.js";

const baseContext: WorkflowEvidenceContext = {
  actor_id_hash: "a".repeat(64),
  actor_role: "teacher",
  advisory_scopes: ["debrief"],
  context_digest: "b".repeat(64),
  course_id: "course_001",
  discriminator: "w020_role_safe_context",
  round_id: "round_001",
  run_id: "run_001",
  source_event_ids: ["event_001", "event_002", "event_003", "event_004", "event_005"],
  source_event_types: [
    "role_assigned",
    "section_saved",
    "section_ready",
    "merge_created",
    "team_confirmed"
  ],
  team_id: "team_001",
  tenant_id: "tenant_demo",
  transformation_version: "w020-role-safe-context-v1"
};

function context(overrides: Partial<WorkflowEvidenceContext> = {}): TeacherDebriefContext {
  return { ...baseContext, ...overrides };
}

describe("W020 R3 teacher debrief intelligence", () => {
  it("creates an evidence-grounded mechanism resolver", () => {
    const evidence = qualifyWorkflowEvidence(context());
    const result = buildTeacherDebriefIntelligence(context(), evidence);

    expect(result.output_type).toBe("advisory");
    expect(result.advisory_text).toContain("Mechanism question");
    expect(result.advisory_text).toContain("Assumption");
    expect(result.advisory_text).toContain("Risk");
    expect(result.advisory_text).toContain("Alternative");
    expect(result.advisory_text).toContain("Contradiction challenge");
    expect(result.advisory_text).toContain("Process Evidence is not Outcome/Causality");
  });

  it("changes its deterministic debrief when the process stage changes", () => {
    const saved = context({
      source_event_ids: ["event_001", "event_002"],
      source_event_types: ["role_assigned", "section_saved"]
    });
    const ready = context({
      source_event_ids: ["event_001", "event_002", "event_003"],
      source_event_types: ["role_assigned", "section_saved", "section_ready"]
    });

    const savedResult = buildTeacherDebriefIntelligence(saved, qualifyWorkflowEvidence(saved));
    const readyResult = buildTeacherDebriefIntelligence(ready, qualifyWorkflowEvidence(ready));

    expect(savedResult.advisory_text).not.toBe(readyResult.advisory_text);
    expect(savedResult.advisory_text).toContain("ROLE_CONTRIBUTION_DRAFTED");
    expect(readyResult.advisory_text).toContain("ROLE_CONTRIBUTION_READY");
  });

  it("abstains after a reset with no recovered process evidence", () => {
    const reset = context({
      source_event_ids: ["event_001", "event_002", "event_003"],
      source_event_types: ["role_assigned", "section_saved", "workflow_reset"]
    });
    const result = buildTeacherDebriefIntelligence(reset, qualifyWorkflowEvidence(reset));

    expect(result.advisory_text).toContain("No qualified workflow evidence");
    expect(result.advisory_text).not.toContain("state_true");
    expect(result.advisory_text).not.toContain("SettlementResult");
  });

  it("keeps the teacher gateway advisory-only and process-evidence grounded", () => {
    const gateway = createDeterministicMockGateway();
    const result = gateway.generate({
      context: context(),
      surface: "teacher_debrief"
    });

    expect(result.coach_output.advisory_only).toBe(true);
    expect(result.coach_output.advisory_text).toContain("Mechanism question");
    expect(result.coach_output.evidence_refs).toEqual(baseContext.source_event_ids);
    expect(result.coach_output).not.toHaveProperty("state_true");
    expect(result.coach_output).not.toHaveProperty("SettlementResult");
    expect(result.coach_output).not.toHaveProperty("score");
    expect(result.coach_output).not.toHaveProperty("rank");
  });
});
